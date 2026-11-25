// lib/moddulo/versionado/leerHistorial.ts
// SOLO SERVIDOR. C4a-1 — LECTOR del historial unificado de UNA fase de un proyecto Moddulo. Solo lectura: no escribe
// NADA (ni `lastAccessedAt`: lee el documento del proyecto en crudo, sin pasar por `getProject`, H-V23) y no llama a
// ningún modelo.
//
// Lecturas (contadas por los contadores del mock en las pruebas):
//   1. el documento del proyecto (acceso, rol, puntero de la fase, colaboradores, vivo para la deriva);
//   2. el manifiesto de la revisión vigente (solo si hay puntero);
//   3. UNA página de eventos: `where(fase ==).orderBy(revisionN desc).startAfter(cursor).limit(K)` → índice compuesto
//      `eventos (fase ASC, revisionN DESC)` (H-V45). Costo fijo: 2 + K lecturas por página, sin importar cuántas
//      acciones tenga la fase.
//   4. (solo F3 con `conDeriva`) la colección `f3Resultados`: N lecturas.
//
// CONSISTENCIA — límite declarado: el proyecto, el manifiesto y los eventos se leen en lecturas SEPARADAS (no hay
// transacción de lectura). Las revisiones y los eventos son INMUTABLES (nunca se actualizan ni se podan); solo el
// documento del proyecto cambia. Por eso el manifiesto de la revisión `puntero.n` leída es siempre consistente con ese
// puntero; lo único que puede ocurrir entre lecturas es que aparezca un evento NUEVO (revisionN > puntero.n): se
// muestra como fila `posteriorALaLectura`, nunca como vigente, y no rompe el orden (se omite de la comprobación de
// continuidad). Un cambio entre las lecturas nunca produce una vigente equivocada.

import type { Firestore } from "firebase-admin/firestore";
import { idRevision } from "@/lib/versionado/registrar";
import {
  analizarContinuidad,
  clasificarEvento,
  recuperabilidadDeEvento,
  revisionDeEvento,
  versionesExistentes,
  vigenteDeManifiesto,
  type ArtefactoDeFila,
  type ArtefactoVigente,
  type CodigoAviso,
  type FaseConHistorial,
  type FilaHistorial,
  type RespuestaHistorial,
} from "@/lib/versionado/lectura";
import { enAIso } from "./artefactosF2";
import { detectarDeriva } from "./derivaVivo";
import { puedeVerDetalleHistorial, puedeVerPanelHistorial, puedeVolverAVersion } from "./visibilidadHistorial";
import { TEXTO_AVISO, detalleEnTexto, etiquetaArtefacto, textoQuien, tituloAccion } from "./textosHistorial";
import type { CollaboratorRole } from "@/types/moddulo.types";

type Doc = Record<string, unknown>;

/** El índice compuesto de `eventos` aún no existe o se está construyendo (código gRPC 9 / FAILED_PRECONDITION). */
export class IndiceNoListoError extends Error {
  constructor() {
    super("El índice de eventos (fase, revisionN) no está listo.");
    this.name = "IndiceNoListoError";
  }
}

/** El puntero y el manifiesto no coinciden (o el puntero es inválido): se dice, nunca se muestra «sin historial». */
export class HistorialIlegibleError extends Error {
  constructor(detalle: string) {
    super(`Historial ilegible: ${detalle}`);
    this.name = "HistorialIlegibleError";
  }
}

export type ResultadoLectura =
  | { tipo: "no_encontrado" }
  | { tipo: "sin_permiso" }
  | { tipo: "ok"; respuesta: RespuestaHistorial };

export interface OpcionesLectura {
  proyectoId: string;
  uid: string;
  fase: FaseConHistorial;
  limite: number;
  /** `revisionN` de la última fila ya vista: devuelve las revisiones MENORES. */
  cursor?: number;
  /** F3: leer los resultados vivos para comprobar la deriva (cuesta N lecturas). F1 y F2 la comprueban siempre (gratis). */
  conDeriva?: boolean;
}

function esErrorDeIndice(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  if (!e) return false;
  if (e.code === 9) return true;
  return typeof e.message === "string" && /FAILED_PRECONDITION|requires an index/i.test(e.message);
}

function punteroValido(p: unknown): number | null {
  if (p === undefined || p === null) return null;
  const n = (p as { n?: unknown }).n;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
    throw new HistorialIlegibleError("el puntero de revisión de la fase no es válido.");
  }
  return n;
}

export async function leerHistorialFase(db: Firestore, o: OpcionesLectura): Promise<ResultadoLectura> {
  const { proyectoId, uid, fase, limite, cursor } = o;
  const refProyecto = db.collection("moddulo_projects").doc(proyectoId);

  // 1) Proyecto, EN CRUDO (sin `getProject`: no escribe `lastAccessedAt`). Mismo criterio de acceso que
  //    `getProjectParaPrellenado`: colaborador y sin `deletedAt`; el mismo resultado para inexistente, papelera y ajeno.
  const snap = await refProyecto.get();
  if (!snap.exists) return { tipo: "no_encontrado" };
  const proyecto = snap.data() as Doc;
  if (proyecto.deletedAt) return { tipo: "no_encontrado" };
  const colaboradores = (Array.isArray(proyecto.collaborators) ? proyecto.collaborators : []) as Array<{
    uid?: unknown; role?: unknown; displayName?: unknown;
  }>;
  const yo = colaboradores.find((c) => c.uid === uid);
  if (!yo) return { tipo: "no_encontrado" };
  const rol = yo.role as CollaboratorRole;
  if (!puedeVerPanelHistorial(rol)) return { tipo: "sin_permiso" };
  const verDetalle = puedeVerDetalleHistorial(rol);

  const phases = proyecto.phases as Doc | undefined;
  const punteroN = punteroValido((phases?.[fase] as Doc | undefined)?.revision);

  // 2) Manifiesto de la revisión vigente.
  type Manifiesto = { n?: unknown; fase?: unknown; artefactos?: Record<string, { versionId: string; n: number; tupla?: string; vivo?: string; retenidas: { id: string; n: number; aprobada: boolean; protegida: boolean }[] }> };
  let manifiesto: Manifiesto | undefined;
  if (punteroN !== null) {
    const m = await refProyecto.collection("revisiones").doc(idRevision(fase, punteroN)).get();
    if (!m.exists) throw new HistorialIlegibleError(`el puntero apunta a la revisión ${punteroN}, que no existe.`);
    manifiesto = m.data() as Manifiesto;
    if (manifiesto?.n !== punteroN || manifiesto?.fase !== fase) {
      throw new HistorialIlegibleError(`el manifiesto de la fase no coincide con el puntero (n=${punteroN}).`);
    }
  }
  const existentes = versionesExistentes(manifiesto);

  // 3) Una página de eventos (índice compuesto fase ASC + revisionN DESC; el cursor es revisionN).
  let consulta = refProyecto.collection("eventos").where("fase", "==", fase).orderBy("revisionN", "desc");
  if (cursor !== undefined) consulta = consulta.startAfter(cursor);
  let docs: { id: string; data: () => unknown }[];
  const omitirConsultaVacia = punteroN === null && cursor !== undefined; // sin puntero no hay páginas siguientes
  try {
    docs = omitirConsultaVacia ? [] : (await consulta.limit(limite).get()).docs;
  } catch (err) {
    if (esErrorDeIndice(err)) throw new IndiceNoListoError();
    throw err;
  }

  // 4) Filas.
  const filas: FilaHistorial[] = [];
  const validas: number[] = [];
  let invalidos = 0;
  let hayPosterior = false;
  // H-V55: un evento sin artefactos o sin `versionId` es un registro INCOMPLETO, no retención; solo una versión citada
  // que ya no está entre las existentes cuenta como retención parcial.
  let eventosSinVersiones = 0;
  let hayRetencion = false;
  for (const d of docs) {
    const data = (d.data() ?? {}) as Doc;
    const n = revisionDeEvento({ id: d.id, data }, fase);
    if (n === null) {
      invalidos++;
      continue;
    }
    const posterior = punteroN !== null && n > punteroN;
    if (posterior) hayPosterior = true;
    else validas.push(n);

    const nombres = (Array.isArray(data.artefactos) ? data.artefactos : []).filter((x): x is string => typeof x === "string");
    const versionIds = (data.versionIds ?? {}) as Record<string, unknown>;
    const idsDelEvento = nombres.map((nom) => (typeof versionIds[nom] === "string" ? (versionIds[nom] as string) : null));
    if (!posterior) {
      const c = clasificarEvento(idsDelEvento, existentes);
      if (c.incompleto) eventosSinVersiones++;
      if (c.retencionParcial) hayRetencion = true;
    }
    const artefactos: ArtefactoDeFila[] = nombres.map((nom, i) => {
      const id = idsDelEvento[i];
      return {
        nombre: nom,
        etiqueta: etiquetaArtefacto(nom),
        versionId: id,
        vigente: id !== null && vigenteDeManifiesto(manifiesto, nom) === id,
        recuperable: recuperabilidadDeEvento([id], existentes),
      };
    });
    const por = typeof data.por === "string" && data.por.length > 0 ? data.por : null;
    const quien = textoQuien({
      por,
      nombreColaborador: colaboradores.find((x) => x.uid === por)?.displayName,
      verDetalle,
    });

    filas.push({
      revisionN: n,
      eventoId: d.id,
      en: enAIso(data.en),
      quien,
      tipo: typeof data.tipo === "string" ? data.tipo : "desconocido",
      titulo: tituloAccion({ tipo: data.tipo, motivo: data.motivo, artefactos: nombres }),
      detalleTexto: verDetalle ? detalleEnTexto(data.detalle) : null,
      artefactos,
      esVigente: punteroN !== null && n === punteroN,
      derivaAntes: Array.isArray(data.artefactosConDeriva) && data.artefactosConDeriva.length > 0,
      posteriorALaLectura: posterior,
      recuperable: recuperabilidadDeEvento(idsDelEvento, existentes),
    });
  }

  // 5) Continuidad: contador del puntero vs eventos obtenidos.
  const techo = cursor !== undefined ? cursor - 1 : punteroN ?? 0;
  const cont = analizarContinuidad(validas, { techo, pedidos: docs.length, limite });

  // 6) Artefactos vigentes y deriva (F1/F2 siempre —gratis—; F3 solo con `conDeriva`).
  let vigente: RespuestaHistorial["vigente"] = null;
  if (punteroN !== null && manifiesto) {
    let resultadosF3: Map<string, Doc> | null = null;
    const hayF3 = Object.keys(manifiesto.artefactos ?? {}).some((k) => k.startsWith("f3Resultado:") || k.startsWith("f3Asignacion:"));
    if (fase === "investigacion" && o.conDeriva === true && hayF3) {
      const res = await refProyecto.collection("f3Resultados").get();
      resultadosF3 = new Map(res.docs.map((x) => [x.id, (x.data() ?? {}) as Doc]));
    }
    const artefactos: ArtefactoVigente[] = Object.entries(manifiesto.artefactos ?? {})
      .map(([nombre, e]) => ({
        nombre,
        etiqueta: etiquetaArtefacto(nombre),
        versionVigenteId: e.versionId,
        n: e.n,
        derivaDetectada: detectarDeriva(nombre, e, { phases, resultadosF3 }),
      }))
      .sort((a, b) => (a.nombre < b.nombre ? -1 : 1));
    vigente = { revisionN: punteroN, artefactos };
  }

  // 7) Avisos (nunca «sin historial» ni omisión silenciosa).
  const codigos: CodigoAviso[] = [];
  if (punteroN === null && docs.length > 0) codigos.push("historial_sin_puntero");
  if (cont.faltantesTotal > 0 || invalidos > 0 || eventosSinVersiones > 0) codigos.push("eventos_incompletos");
  if (hayRetencion) codigos.push("retencion_parcial");
  if (hayPosterior) codigos.push("cambio_durante_lectura");

  return {
    tipo: "ok",
    respuesta: {
      fase,
      puedeVolver: puedeVolverAVersion(rol),
      totalCambios: punteroN ?? 0,
      vigente,
      filas,
      siguienteCursor: cont.siguienteCursor,
      avisos: codigos.map((c) => ({ codigo: c, texto: TEXTO_AVISO[c] })),
      faltantes: cont.faltantes,
      faltantesTotal: cont.faltantesTotal,
    },
  };
}
