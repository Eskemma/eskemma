// lib/versionado/registrar.ts
// Registro de versiones EN LA MISMA TRANSACCIÓN que el cambio (SOLO SERVIDOR; el `tx` y las refs se inyectan:
// este módulo no importa lib/firebase-admin y no conoce ninguna app).
//
// Patrón de dos pasos de lib/centinela/pestel/vinculoUnico.ts (`prepararVinculoUnico` LEE,
// `aplicarVinculoUnico` ESCRIBE): Firestore exige todas las lecturas antes de la primera escritura.
//   1) `prepararVersion(tx, cambio)` — lee (a lo más 1 documento: el manifiesto de la revisión vigente) y decide.
//   2) `aplicarVersion(tx, plan)`    — escribe versión(es), revisión y evento con `create`, y borra lo podado.
//      Devuelve `updatesRaiz` (el puntero) para que el LLAMADOR lo fusione en el `update` que ya hace al
//      documento dueño: cero escrituras extra sobre el dueño.
//
// De dónde sale la revisión vigente `n`: la pasa el LLAMADOR dentro de `datosRaiz` (el documento dueño que él
// ya leyó en esta misma transacción) y `punteroCampo` (ruta con puntos, p. ej. "phases.exploracion.revision").
//
// Reglas (decisiones de Raúl):
//   · Dedupe: se compara SOLO contra la versión vigente del mismo artefacto y sobre la TUPLA completa
//     (contenido + aprobación + insumos/dependeDe + estado). A→B→A crea 3 versiones. Misma tupla → no-op.
//   · Todo se escribe con `create` (falla si existe): nunca pisa. Si el puntero y el manifiesto discrepan
//     se lanza un error explícito; nunca se crea desde cero.
//   · `previo_sin_historial` guarda el estado ANTERIOR COMPLETO (con su aprobación por/en/huella/mapa):
//     «la aprobación anterior queda en SU versión».
//   · Una regeneración con IA exige autorización de la persona.
//   · La trazabilidad nunca bloquea por política: solo falla si NO se puede registrar (y entonces falla el
//     cambio completo: todo o nada).

import { FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { huellaContenido, huellaTupla, huellasPorItem, type ItemConId } from "./huella";
import { decidirPoda } from "./retencion";
import { decidirContenido, estimarBytes, evaluarTamanoVersion, reportarTamano } from "./tamano";
import {
  AutorizacionIARequeridaError,
  CambioInvalidoError,
  ColisionHistorialError,
  HistorialInconsistenteError,
  MAX_BORRADOS_POR_ESCRITURA,
  TOPE_VERSIONES,
  type EntradaManifiesto,
  type EstadoArtefacto,
  type FuenteEvento,
  type Puntero,
  type RetenidaRef,
  type TipoCambio,
} from "./tipos";

export interface CambioArtefacto extends EstadoArtefacto {
  /** Nombre estable del artefacto (p. ej. "dvs", "m1.aprobacion", "f3Resultado:{id}"). */
  artefacto: string;
  /** Ítems con id estable, para detectar qué cambió DENTRO de la versión (huella por ítem). */
  items?: ItemConId[];
  /** Ids de ítems editados a mano por la persona (lo editado nunca se sobrescribe solo). */
  editadoPorPersona?: string[];
  /**
   * Estado ANTERIOR COMPLETO del artefacto (contenido + aprobación + insumos + estado). Solo se usa la primera
   * vez que el artefacto entra al historial: crea la versión `previo_sin_historial` (`por: null`).
   */
  estadoPrevio?: EstadoArtefacto;
}

export interface CambioFase {
  /** Documento dueño (moddulo_projects/{id}, fontana_sesiones/{id}…). Las subcolecciones cuelgan de él. */
  raiz: DocumentReference;
  /** El documento dueño YA LEÍDO por el llamador dentro de esta transacción (de él sale el puntero). */
  datosRaiz: Record<string, unknown> | undefined;
  /** Ruta con puntos del puntero embebido en el documento dueño. */
  punteroCampo: string;
  ambito: string;
  fase: string;
  tipoCambio: TipoCambio;
  por: string;
  autorizadoPor?: string;
  autorizadoEn?: string;
  motivo?: string;
  fuente?: FuenteEvento;
  artefactos: CambioArtefacto[];
  /** Cierra la fase en esta revisión: deja constancia de quién y marca las versiones vigentes como protegidas. */
  cierre?: { por: string };
  tope?: number;
}

export interface DocPlan {
  ref: DocumentReference;
  data: Record<string, unknown>;
}

export interface PlanVersion {
  sinCambios: boolean;
  revisionN: number | null;
  versiones: DocPlan[];
  revision: DocPlan | null;
  evento: DocPlan | null;
  borrar: DocumentReference[];
  updatesRaiz: Record<string, unknown>;
  versionIds: Record<string, string>;
}

export interface ResultadoVersion {
  cambio: boolean;
  revisionN: number | null;
  versionIds: Record<string, string>;
  updatesRaiz: Record<string, unknown>;
}

const pad = (n: number) => String(n).padStart(6, "0");
/** id de una revisión de fase: determinista, para que `create` detecte un puntero desfasado. */
export const idRevision = (fase: string, n: number) => `${fase}_${pad(n)}`;
/** id de una versión: determinista (artefacto + secuencia), para que `create` detecte una colisión. */
export const idVersion = (artefacto: string, n: number) => `${artefacto.replace(/\//g, "|")}__${pad(n)}`;

function leerRuta(obj: Record<string, unknown> | undefined, ruta: string): unknown {
  let actual: unknown = obj;
  for (const parte of ruta.split(".")) {
    if (actual === null || typeof actual !== "object") return undefined;
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual;
}

function validar(cambio: CambioFase): void {
  if (!cambio.por || typeof cambio.por !== "string") throw new CambioInvalidoError("`por` es obligatorio (autoría).");
  if (!cambio.fase || /[/]/.test(cambio.fase)) throw new CambioInvalidoError("`fase` vacía o con «/».");
  if (!cambio.punteroCampo) throw new CambioInvalidoError("`punteroCampo` es obligatorio.");
  if (cambio.artefactos.length === 0) throw new CambioInvalidoError("sin artefactos.");
  const nombres = new Set<string>();
  for (const a of cambio.artefactos) {
    if (!a.artefacto || a.artefacto === "." || a.artefacto === ".." || /^__.*__$/.test(a.artefacto)) {
      throw new CambioInvalidoError(`nombre de artefacto no válido: «${a.artefacto}».`);
    }
    if (nombres.has(a.artefacto)) throw new CambioInvalidoError(`artefacto repetido: «${a.artefacto}».`);
    nombres.add(a.artefacto);
  }
  if (cambio.tipoCambio === "regeneracion_ia" && (!cambio.autorizadoPor || !cambio.autorizadoEn)) {
    throw new AutorizacionIARequeridaError();
  }
}

/** Un error `ALREADY_EXISTS` del commit (código gRPC 6) se traduce a un error explícito del historial. */
export function traducirErrorHistorial(err: unknown): unknown {
  const e = err as { code?: unknown; message?: unknown } | null;
  if (e && (e.code === 6 || (typeof e.message === "string" && e.message.includes("ALREADY_EXISTS")))) {
    return new ColisionHistorialError(
      "ya existe una revisión, versión o evento con ese id: el puntero del documento dueño está desfasado o hubo una escritura concurrente. No se escribió nada."
    );
  }
  return err;
}

function docVersion(args: {
  cambio: CambioFase;
  artefacto: string;
  n: number;
  e: EstadoArtefacto;
  items?: ItemConId[];
  editadoPorPersona?: string[];
  previo: boolean;
  tupla: string;
}): Record<string, unknown> {
  const { cambio, artefacto, n, e, items, editadoPorPersona, previo, tupla } = args;
  const bytes = estimarBytes(e.contenido);
  const { guardarContenido } = decidirContenido(bytes);
  if (!guardarContenido) reportarTamano(`versión ${artefacto} n=${n}`, evaluarTamanoVersion(bytes));
  return {
    artefacto,
    n,
    fase: cambio.fase,
    ambito: cambio.ambito,
    estado: previo ? "reemplazada" : (e.estado ?? "vigente"),
    ...(guardarContenido ? { contenido: e.contenido } : { contenidoOmitido: true }),
    huella: huellaContenido(e.contenido),
    tupla,
    tamanoBytes: bytes,
    ...(e.aprobacion ? { aprobacion: e.aprobacion } : {}),
    ...(e.insumos ? { insumos: e.insumos } : {}),
    ...(items && items.length > 0 ? { huellasItems: huellasPorItem(items) } : {}),
    ...(editadoPorPersona && editadoPorPersona.length > 0 ? { editadoPorPersona } : {}),
    tipoCambio: previo ? "previo_sin_historial" : cambio.tipoCambio,
    // «sin autoría registrada»: el estado previo al historial no tiene autor ni fecha conocidos.
    por: previo ? null : cambio.por,
    en: previo ? null : FieldValue.serverTimestamp(),
    ...(!previo && cambio.autorizadoPor ? { autorizadoPor: cambio.autorizadoPor, autorizadoEn: cambio.autorizadoEn ?? null } : {}),
    ...(!previo && cambio.motivo ? { motivo: cambio.motivo } : {}),
  };
}

export async function prepararVersion(tx: Transaction, cambio: CambioFase): Promise<PlanVersion> {
  validar(cambio);
  const { raiz, fase } = cambio;
  const tope = cambio.tope ?? TOPE_VERSIONES;

  // ---- Lectura (la única): el manifiesto de la revisión vigente, si hay puntero ----
  const puntero = leerRuta(cambio.datosRaiz, cambio.punteroCampo) as Puntero | undefined;
  let manifiestoPrevio: { artefactos?: Record<string, EntradaManifiesto> } | undefined;
  if (puntero !== undefined && puntero !== null) {
    if (typeof puntero.n !== "number" || !Number.isInteger(puntero.n) || puntero.n < 1) {
      throw new HistorialInconsistenteError(`el puntero «${cambio.punteroCampo}» no trae una revisión válida.`);
    }
    const snap = await tx.get(raiz.collection("revisiones").doc(idRevision(fase, puntero.n)));
    if (!snap.exists) {
      throw new HistorialInconsistenteError(
        `el puntero apunta a la revisión ${puntero.n} de «${fase}», que no existe. No se crea historial desde cero.`
      );
    }
    manifiestoPrevio = snap.data() as typeof manifiestoPrevio;
    const m = snap.data() as { n?: unknown; fase?: unknown };
    if (m.n !== puntero.n || m.fase !== fase) {
      throw new HistorialInconsistenteError(`el manifiesto de «${fase}» no coincide con el puntero (n=${puntero.n}).`);
    }
  }
  // Copia profunda: el manifiesto leído nunca se muta (p. ej. el mock devuelve la misma referencia del almacén).
  const entradasPrevias: Record<string, EntradaManifiesto> = structuredClone(manifiestoPrevio?.artefactos ?? {});

  // ---- Decisión (pura) ----
  const versiones: DocPlan[] = [];
  const versionIds: Record<string, string> = {};
  const nuevas: Record<string, EntradaManifiesto> = {};
  const cambiados: string[] = [];

  for (const a of cambio.artefactos) {
    const estado: EstadoArtefacto = { contenido: a.contenido, aprobacion: a.aprobacion, insumos: a.insumos, estado: a.estado };
    const tupla = huellaTupla(estado);
    const vigente = entradasPrevias[a.artefacto];
    if (vigente && vigente.tupla === tupla) continue; // misma tupla que la vigente → sin cambio

    let retenidas: RetenidaRef[] = vigente ? [...vigente.retenidas] : [];
    let n = (vigente?.n ?? 0) + 1;

    if (!vigente && a.estadoPrevio) {
      const tuplaPrevia = huellaTupla(a.estadoPrevio);
      if (tuplaPrevia === tupla) continue; // lo que hay vivo ya es esto: nada que registrar
      const idPrevio = idVersion(a.artefacto, 1);
      versiones.push({
        ref: raiz.collection("versiones").doc(idPrevio),
        data: docVersion({ cambio, artefacto: a.artefacto, n: 1, e: a.estadoPrevio, previo: true, tupla: tuplaPrevia }),
      });
      retenidas = [{ id: idPrevio, n: 1, aprobada: a.estadoPrevio.aprobacion?.aprobado === true, protegida: false }];
      n = 2;
    }

    const id = idVersion(a.artefacto, n);
    versiones.push({
      ref: raiz.collection("versiones").doc(id),
      data: docVersion({
        cambio, artefacto: a.artefacto, n, e: estado, items: a.items, editadoPorPersona: a.editadoPorPersona, previo: false, tupla,
      }),
    });
    retenidas.push({ id, n, aprobada: a.aprobacion?.aprobado === true, protegida: false });
    nuevas[a.artefacto] = { versionId: id, n, tupla, dependeDe: a.insumos?.dependeDe ?? [], retenidas };
    versionIds[a.artefacto] = id;
    cambiados.push(a.artefacto);
  }

  if (cambiados.length === 0) {
    return { sinCambios: true, revisionN: null, versiones: [], revision: null, evento: null, borrar: [], updatesRaiz: {}, versionIds: {} };
  }

  // ---- Manifiesto nuevo: las entradas intactas se reutilizan tal cual (sin copiar contenido) ----
  const artefactos: Record<string, EntradaManifiesto> = { ...entradasPrevias, ...nuevas };

  // Protección: versiones citadas por un `dependeDe` vigente; con cierre, todas las vigentes.
  const citadas = new Set<string>();
  for (const e of Object.values(artefactos)) for (const d of e.dependeDe) citadas.add(d.versionId);
  for (const e of Object.values(artefactos)) {
    e.retenidas = e.retenidas.map((r) => ({ ...r, protegida: r.protegida || citadas.has(r.id) || (!!cambio.cierre && r.id === e.versionId) }));
  }

  // Poda (por artefacto cambiado), con un presupuesto global de borrados por escritura.
  const borrar: DocumentReference[] = [];
  let presupuesto = MAX_BORRADOS_POR_ESCRITURA;
  for (const nombre of cambiados) {
    if (presupuesto <= 0) break;
    const e = artefactos[nombre];
    const ids = decidirPoda(e.retenidas, { tope, maxBorrados: presupuesto, vigenteId: e.versionId });
    if (ids.length === 0) continue;
    e.retenidas = e.retenidas.filter((r) => !ids.includes(r.id));
    for (const id of ids) borrar.push(raiz.collection("versiones").doc(id));
    presupuesto -= ids.length;
  }

  const revisionN = (puntero?.n ?? 0) + 1;
  const tuplas: Record<string, string> = {};
  for (const [k, e] of Object.entries(artefactos)) tuplas[k] = e.tupla;
  const huellaRevision = huellaContenido(tuplas);

  const manifiesto: Record<string, unknown> = {
    fase,
    ambito: cambio.ambito,
    n: revisionN,
    previaN: puntero?.n ?? null,
    artefactos,
    huella: huellaRevision,
    tipoCambio: cambio.tipoCambio,
    por: cambio.por,
    en: FieldValue.serverTimestamp(),
    ...(cambio.cierre ? { cierre: { por: cambio.cierre.por, en: FieldValue.serverTimestamp() } } : {}),
    ...(cambio.motivo ? { motivo: cambio.motivo } : {}),
  };
  reportarTamano(`revisión ${fase}_${revisionN}`, evaluarTamanoVersion(estimarBytes(manifiesto)));

  const evento: Record<string, unknown> = {
    tipo: cambio.tipoCambio,
    fase,
    ambito: cambio.ambito,
    artefactos: cambiados,
    revisionN,
    versionIds,
    por: cambio.por,
    en: FieldValue.serverTimestamp(),
    fuente: cambio.fuente ?? (cambio.tipoCambio === "regeneracion_ia" ? "ia" : "usuario"),
    ...(cambio.motivo ? { motivo: cambio.motivo } : {}),
  };

  return {
    sinCambios: false,
    revisionN,
    versiones,
    revision: { ref: raiz.collection("revisiones").doc(idRevision(fase, revisionN)), data: manifiesto },
    evento: { ref: raiz.collection("eventos").doc(), data: evento },
    borrar,
    updatesRaiz: {
      [cambio.punteroCampo]: { n: revisionN, huella: huellaRevision, por: cambio.por, en: FieldValue.serverTimestamp() },
    },
    versionIds,
  };
}

/** Escribe el plan. TODO con `create` (falla si el documento existe): nunca pisa. Devuelve el puntero para el dueño. */
export function aplicarVersion(tx: Transaction, plan: PlanVersion): ResultadoVersion {
  if (plan.sinCambios || !plan.revision || !plan.evento) {
    return { cambio: false, revisionN: null, versionIds: {}, updatesRaiz: {} };
  }
  for (const v of plan.versiones) tx.create(v.ref, v.data);
  tx.create(plan.revision.ref, plan.revision.data);
  tx.create(plan.evento.ref, plan.evento.data);
  for (const ref of plan.borrar) tx.delete(ref);
  return { cambio: true, revisionN: plan.revisionN, versionIds: plan.versionIds, updatesRaiz: plan.updatesRaiz };
}
