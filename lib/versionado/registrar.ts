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
  type DetalleEvento,
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
  /**
   * C3a — PROYECCIÓN VIVA del artefacto DESPUÉS de este cambio (lo que quedará en el documento vivo). Su huella
   * se guarda en la entrada del manifiesto (`vivo`). El llamador es quien sabe qué parte del documento vivo es
   * el artefacto y excluye lo volátil (createdAt…): este módulo solo la hashea.
   */
  vivo?: unknown;
  /**
   * C3a — la MISMA proyección, pero del estado vivo ANTES del cambio. Con ella se detecta la DERIVA: el vivo
   * cambió por un escritor que no registra historial. Obligatoria cuando el artefacto ya tiene una versión con
   * `vivo` y se pasa `estadoPrevio` (sin ella habría que comparar la tupla, y el sello de una aprobación no
   * existe en el documento vivo: daría una falsa deriva en cada acción).
   */
  vivoPrevio?: unknown;
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
  /**
   * C1b-1 — detalle de AUDITORÍA que se copia al evento (solo nombres y banderas; nunca contenido del usuario).
   * Se OMITE la clave cuando no se pasa o viene vacío: el evento de quien no lo usa es idéntico al de siempre.
   */
  detalle?: DetalleEvento;
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
  // H-V86: «volver a una versión anterior» es un acto de la persona, no una regeneración con IA: exige el
  // `motivo` (qué acto fue) y no admite `autorizadoPor` (esa marca es de `regeneracion_ia`). La constancia de la
  // aprobación (`aprobacion`) NO se exige aquí: no es universal (`cierre`, `f2M1`); es regla del llamador.
  if (cambio.tipoCambio === "restauracion") {
    if (typeof cambio.motivo !== "string" || cambio.motivo.trim().length === 0) {
      throw new CambioInvalidoError("una `restauracion` exige `motivo`.");
    }
    if (cambio.autorizadoPor !== undefined || cambio.autorizadoEn !== undefined) {
      throw new CambioInvalidoError("una `restauracion` no lleva `autorizadoPor`/`autorizadoEn` (es de `regeneracion_ia`).");
    }
  }
  if (cambio.detalle !== undefined) {
    if (cambio.detalle === null || typeof cambio.detalle !== "object" || Array.isArray(cambio.detalle)) {
      throw new CambioInvalidoError("`detalle` debe ser un objeto plano.");
    }
    for (const [k, v] of Object.entries(cambio.detalle)) {
      const ok =
        typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)) ||
        (Array.isArray(v) && v.every((x) => typeof x === "string"));
      if (!ok) throw new CambioInvalidoError(`\`detalle.${k}\` debe ser texto, número, booleano o lista de textos (sin anidados, null ni undefined).`);
    }
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
  deriva?: boolean;
  tupla: string;
}): Record<string, unknown> {
  const { cambio, artefacto, n, e, items, editadoPorPersona, previo, deriva, tupla } = args;
  const bytes = estimarBytes(e.contenido);
  const { guardarContenido } = decidirContenido(bytes);
  const doc: Record<string, unknown> = {
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
    // C3a — la versión de DERIVA (el vivo cambió sin registro) se marca para que el panel diga «estado detectado
    // antes de este cambio; autor desconocido».
    ...(previo && deriva ? { deriva: true } : {}),
    // «sin autoría registrada»: el estado previo al historial no tiene autor ni fecha conocidos.
    por: previo ? null : cambio.por,
    en: previo ? null : FieldValue.serverTimestamp(),
    ...(!previo && cambio.autorizadoPor ? { autorizadoPor: cambio.autorizadoPor, autorizadoEn: cambio.autorizadoEn ?? null } : {}),
    ...(!previo && cambio.motivo ? { motivo: cambio.motivo } : {}),
  };
  // C3a (arreglo declarado): el tamaño se vigila SIEMPRE y sobre el documento COMPLETO de la versión (contenido
  // + metadatos), que es lo que cuenta contra el 1 MiB de Firestore; antes solo se avisaba cuando el contenido
  // ya se había omitido por exceso.
  reportarTamano(`versión ${artefacto} n=${n}`, evaluarTamanoVersion(estimarBytes(doc)));
  return doc;
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
  const conDeriva: string[] = [];

  for (const a of cambio.artefactos) {
    const estado: EstadoArtefacto = { contenido: a.contenido, aprobacion: a.aprobacion, insumos: a.insumos, estado: a.estado };
    const tupla = huellaTupla(estado);
    const vigente = entradasPrevias[a.artefacto];
    const huellaVivoNuevo = a.vivo !== undefined ? huellaContenido(a.vivo) : undefined;
    const huellaVivoPrevio = a.vivoPrevio !== undefined ? huellaContenido(a.vivoPrevio) : undefined;

    // «Última versión registrada» de este artefacto a medida que se decide: arranca en la vigente y puede
    // avanzar por una versión previa / de deriva creada en esta misma acción.
    let retenidas: RetenidaRef[] = vigente ? [...vigente.retenidas] : [];
    let n = (vigente?.n ?? 0) + 1;
    let ultimo: { versionId: string; n: number; tupla: string; dependeDe: EntradaManifiesto["dependeDe"]; vivo?: string } | undefined =
      vigente ? { versionId: vigente.versionId, n: vigente.n, tupla: vigente.tupla, dependeDe: vigente.dependeDe, vivo: vigente.vivo } : undefined;
    let registroPrevio = false;

    if (a.estadoPrevio) {
      const tuplaPrevia = huellaTupla(a.estadoPrevio);
      let crearPrevio = false;
      let deriva = false;
      if (!vigente) {
        // Primera vez que el artefacto entra al historial.
        if (tuplaPrevia === tupla) continue; // lo que hay vivo ya es esto: nada que registrar
        crearPrevio = true;
      } else {
        // DERIVA (C3a): se evalúa ANTES del dedupe. Si la entrada trae `vivo`, se compara la proyección viva
        // contra ella (el sello de una aprobación no existe en el vivo); si no, contra la tupla.
        if (vigente.vivo !== undefined) {
          if (huellaVivoPrevio === undefined) {
            throw new CambioInvalidoError(`«${a.artefacto}»: se pasó estadoPrevio pero falta vivoPrevio (la entrada del manifiesto trae huella viva).`);
          }
          deriva = huellaVivoPrevio !== vigente.vivo;
        } else {
          deriva = tuplaPrevia !== vigente.tupla;
        }
        crearPrevio = deriva;
      }
      if (crearPrevio) {
        const idPrevio = idVersion(a.artefacto, n);
        versiones.push({
          ref: raiz.collection("versiones").doc(idPrevio),
          data: docVersion({ cambio, artefacto: a.artefacto, n, e: a.estadoPrevio, previo: true, deriva, tupla: tuplaPrevia }),
        });
        // Si el vivo tenía aprobación, cuenta como aprobada para la poda.
        retenidas.push({ id: idPrevio, n, aprobada: a.estadoPrevio.aprobacion?.aprobado === true, protegida: false });
        ultimo = { versionId: idPrevio, n, tupla: tuplaPrevia, dependeDe: a.estadoPrevio.insumos?.dependeDe ?? [], vivo: huellaVivoPrevio };
        n += 1;
        registroPrevio = true;
        if (deriva) conDeriva.push(a.artefacto);
      }
    }

    // Dedupe: contra la ÚLTIMA versión registrada (si hubo deriva, la de deriva): A, B (deriva), A.
    if (ultimo && ultimo.tupla === tupla) {
      if (!registroPrevio) continue; // misma tupla que la vigente y nada nuevo → sin cambio
      // La acción deja el vivo igual a lo que se acaba de detectar: la deriva queda registrada, sin versión nueva.
      nuevas[a.artefacto] = {
        versionId: ultimo.versionId, n: ultimo.n, tupla: ultimo.tupla, dependeDe: ultimo.dependeDe, retenidas,
        ...(huellaVivoNuevo !== undefined ? { vivo: huellaVivoNuevo } : ultimo.vivo !== undefined ? { vivo: ultimo.vivo } : {}),
      };
      versionIds[a.artefacto] = ultimo.versionId;
      cambiados.push(a.artefacto);
      continue;
    }

    const id = idVersion(a.artefacto, n);
    versiones.push({
      ref: raiz.collection("versiones").doc(id),
      data: docVersion({
        cambio, artefacto: a.artefacto, n, e: estado, items: a.items, editadoPorPersona: a.editadoPorPersona, previo: false, tupla,
      }),
    });
    retenidas.push({ id, n, aprobada: a.aprobacion?.aprobado === true, protegida: false });
    nuevas[a.artefacto] = {
      versionId: id, n, tupla, dependeDe: a.insumos?.dependeDe ?? [], retenidas,
      ...(huellaVivoNuevo !== undefined ? { vivo: huellaVivoNuevo } : {}),
    };
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
    // C3a — artefactos cuyo estado vivo había cambiado sin registro (versión de deriva creada antes de este cambio).
    ...(conDeriva.length > 0 ? { artefactosConDeriva: conDeriva } : {}),
    por: cambio.por,
    en: FieldValue.serverTimestamp(),
    fuente: cambio.fuente ?? (cambio.tipoCambio === "regeneracion_ia" ? "ia" : "usuario"),
    ...(cambio.motivo ? { motivo: cambio.motivo } : {}),
    ...(cambio.detalle && Object.keys(cambio.detalle).length > 0 ? { detalle: structuredClone(cambio.detalle) } : {}),
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
