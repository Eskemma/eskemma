// lib/moddulo/versionado/restaurarF3.ts
// SOLO SERVIDOR (usa `huella`, que depende de node:crypto). C4b-1a — lo PROPIO de F3 de «volver a una versión anterior
// de un resultado»; la ruta (C4b-1b) solo hace sesión, rol y transacción. Módulo sin Firestore ni red: todo entra por
// argumentos, así se prueba entero con documentos de muestra.
//
// Reglas (decisiones de Raúl):
//   · D1: se reinicia TODA asignación cuyo `resultadoId` es el del resultado restaurado (estado «en_curso» y sin
//     `resultadoId`, como `reiniciarAsignacion` de `canal1/entregar`): 0, 1 o varias, nunca se elige una. Se busca SOLO
//     por `resultadoId` sobre el tablero releído, jamás por la forma del `asignacionId` (122 de 169 reales son
//     legados). `activada` no se toca.
//   · D4: con el «Reporte F3» emitido o el veredicto aprobado NO se vuelve (PROVISIONAL, mismo criterio que M8).
//   · D5: solo se restaura `f3Resultado`; la asignación se ajusta por la regla anterior (no se restaura su versión).
//   · El documento restaurado queda SIN aprobar; `notasUsuario` no se escribe; `createdAt` se toma del vivo.

import { huellaContenido } from "@/lib/versionado/huella";
import type { CambioArtefacto } from "@/lib/versionado/registrar";
import type { DetalleEvento } from "@/lib/versionado/tipos";
import type { AsignacionCanal } from "@/types/moddulo.types";
import { decidirGeneracionF3, type DecisionGeneracionF3, type EstadoF3 } from "@/lib/moddulo/impactoRegeneracionF3";
import {
  estadoAsignacion, estadoResultado, nombreAsignacion, nombreResultado, vivoAsignacion, vivoResultado,
} from "./artefactosF3";
import { armarCambioRestauracion } from "./restaurar";

export const MOTIVO_RESTAURACION = "restauracion";

type Doc = Record<string, unknown>;
/** Tarea del tablero ya normalizada (`normalizeTareaPIP`): solo lo que esta lógica usa. */
export interface TareaTablero {
  pipItemId: string;
  asignaciones: AsignacionCanal[];
}

// ---- D4: bloqueo ----

/** Reporte F3 emitido o veredicto aprobado → bloqueado. Reutiliza `decidirGeneracionF3` con el verbo «volver». */
export function decidirVolverF3(estado: EstadoF3): Extract<DecisionGeneracionF3, { accion: "continuar" | "bloqueado" }> {
  const d = decidirGeneracionF3(estado, "volver_resultado");
  // «ya_existe» no aplica a este destino (solo lo producen síntesis y veredicto).
  return d.accion === "bloqueado" ? d : { accion: "continuar" };
}

// ---- D1: reinicio de asignaciones ----

/** Asignaciones del tablero que hoy apuntan a ESTE resultado, por `resultadoId` (nunca por la forma del id). */
export function asignacionesDelResultado(tablero: readonly TareaTablero[], resultadoId: string): AsignacionCanal[] {
  return tablero.flatMap((t) => t.asignaciones.filter((a) => a.resultadoId === resultadoId));
}

/** Copia en «en_curso» y SIN la clave `resultadoId` (omitida, no `undefined`: el Admin SDK rechaza `undefined`). */
export function reiniciada(a: AsignacionCanal): AsignacionCanal {
  const copia: AsignacionCanal = { ...a, estado: "en_curso" };
  delete copia.resultadoId;
  return copia;
}

export interface ReinicioTablero {
  /** Payload EXPLÍCITO `{pipItemId, asignaciones}` por tarea (nunca spread: igual que `resultados/aprobar`). */
  tablero: { pipItemId: string; asignaciones: AsignacionCanal[] }[];
  /** Por cada asignación reiniciada: cómo estaba y cómo queda. Vacío = el tablero no cambia (no se escribe). */
  reiniciadas: { previa: AsignacionCanal; nueva: AsignacionCanal }[];
}

export function reiniciarAsignacionesDelResultado(tablero: readonly TareaTablero[], resultadoId: string): ReinicioTablero {
  const reiniciadas: ReinicioTablero["reiniciadas"] = [];
  const nuevo = tablero.map((t) => ({
    pipItemId: t.pipItemId,
    asignaciones: t.asignaciones.map((a) => {
      if (a.resultadoId !== resultadoId) return a;
      const nueva = reiniciada(a);
      reiniciadas.push({ previa: a, nueva });
      return nueva;
    }),
  }));
  return { tablero: nuevo, reiniciadas };
}

// ---- documento restaurado ----

/**
 * El documento que `tx.set` escribe: el contenido de la versión REEMPLAZA al vivo (lo que el vivo tenía y la versión no,
 * se elimina), `aprobado: false`, sin `notasUsuario`, `createdAt` del vivo (si falta, no se escribe: nunca se inventa)
 * y sin valores `undefined`. El archivo de Storage no se toca (la ruta vive en `payload`, que viene en el contenido).
 */
export function documentoRestaurado(contenido: unknown, vivoActual: Doc | undefined): Doc {
  const doc: Doc = {};
  if (contenido && typeof contenido === "object" && !Array.isArray(contenido)) {
    for (const [k, v] of Object.entries(contenido as Doc)) {
      if (v === undefined || k === "aprobado" || k === "notasUsuario" || k === "createdAt") continue;
      doc[k] = v;
    }
  }
  doc.aprobado = false;
  if (vivoActual && vivoActual.createdAt !== undefined && vivoActual.createdAt !== null) doc.createdAt = vivoActual.createdAt;
  return doc;
}

// ---- artefactos del historial (el `vivo` se arma con lo MISMO que se escribe: sin falsa deriva) ----

export interface EntradaArtefactosVolver {
  resultadoId: string;
  /** El documento vivo del resultado ANTES (tal como estaba en la transacción). */
  vivoPrevio: Doc;
  /** El documento que se va a escribir (de `documentoRestaurado`). */
  docNuevo: Doc;
  reiniciadas: ReinicioTablero["reiniciadas"];
  por: string;
  /** ISO concreto de la aprobación retirada (un solo instante por operación). */
  en: string;
}

export function artefactosDeVolver(e: EntradaArtefactosVolver): CambioArtefacto[] {
  const artefactos: CambioArtefacto[] = [
    armarCambioRestauracion({
      artefacto: nombreResultado(e.resultadoId),
      // El contenido que se guarda en la versión nueva es el del documento ESCRITO (sin sello ni createdAt).
      contenido: estadoResultado(e.docNuevo).contenido,
      vivo: vivoResultado(e.docNuevo),
      estadoPrevio: estadoResultado(e.vivoPrevio),
      vivoPrevio: vivoResultado(e.vivoPrevio),
      aprobacion: { en: e.en },
      por: e.por,
    }),
  ];
  for (const r of e.reiniciadas) {
    artefactos.push({
      artefacto: nombreAsignacion(r.nueva.asignacionId),
      ...estadoAsignacion(r.nueva),
      vivo: vivoAsignacion(r.nueva),
      estadoPrevio: estadoAsignacion(r.previa),
      vivoPrevio: vivoAsignacion(r.previa),
    });
  }
  return artefactos;
}

// ---- huella (extras) ----

/**
 * Lo propio de F3 que entra a `huellaRestauracion`: hash del vivo del resultado, [asignacionId, estado, resultadoId]
 * de las asignaciones afectadas (en orden estable) y si está bloqueado. Sin uid, sin contenido, sin nombre de archivo y
 * SIN el resultado de la comprobación de Storage (entrará en el aviso, nunca en la huella).
 */
export function extrasHuellaVolver(vivoResultadoDoc: Doc, afectadas: readonly AsignacionCanal[], bloqueado: boolean) {
  return {
    vivo: huellaContenido(vivoResultado(vivoResultadoDoc)),
    asignaciones: afectadas
      .map((a) => [a.asignacionId, a.estado, a.resultadoId ?? null] as const)
      .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)),
    bloqueado,
  };
}

// ---- archivo (solo informa) ----

/** La ruta de Storage se consulta SOLO si es de este proyecto: `moddulo/{uid}/{projectId}/…`. Otra cosa → null. */
export function rutaDeArchivoVerificable(archivoUrl: unknown, projectId: string): string | null {
  if (typeof archivoUrl !== "string" || projectId.length === 0 || projectId.includes("/")) return null;
  const partes = archivoUrl.split("/");
  if (partes.length < 4 || partes[0] !== "moddulo" || partes[1] === "" || partes[2] !== projectId || partes.slice(3).some((p) => p === "" || p === "..")) {
    return null;
  }
  return archivoUrl;
}

// ---- evento (solo banderas y números) ----

export interface EntradaDetalleVolver {
  estabaAprobado: boolean;
  teniaNotas: boolean;
  tareasReiniciadas: number;
  haySintesis: boolean;
  hayVeredicto: boolean;
  /** `true` solo si se COMPROBÓ y faltaba; `null` = no se comprobó (no hay archivo verificable o falló la consulta). */
  archivoFaltaba: boolean | null;
}

/** Detalle del evento: solo claves verdaderas/positivas; nunca el texto de la pregunta, notas, rutas ni ids. */
export function detalleDeVolver(e: EntradaDetalleVolver): DetalleEvento {
  const d: DetalleEvento = {};
  if (e.estabaAprobado) d.resultadoEstabaAprobado = true;
  if (e.teniaNotas) d.notasEliminadas = true;
  if (e.tareasReiniciadas > 0) d.tareasReiniciadas = e.tareasReiniciadas;
  if (e.haySintesis) d.sintesisExistente = true;
  if (e.hayVeredicto) d.veredictoExistente = true;
  if (e.archivoFaltaba === true) d.archivoNoEncontrado = true;
  return d;
}

// ---- confirmación (familia (i) de `respuestaCandado`) ----

export type AccionVolver = "continuar" | "requiere_confirmacion" | "huella_vencida";

/**
 * Misma regla que `decidirCandadoReemplazo` (F2): sin `confirmarReemplazo: true` y una huella no vacía → pregunta;
 * con ambas pero otra huella → vencida (algo cambió entre el aviso y la confirmación); igual → continuar. El
 * bloqueo y `sin_cambios` se deciden ANTES. `huellaRecibida` ausente o malformada es «no confirmado» (409), nunca 400.
 */
export function decidirConfirmacionVolver(args: {
  confirmar: unknown;
  huellaRecibida: unknown;
  huellaActual: string;
}): AccionVolver {
  const { confirmar, huellaRecibida, huellaActual } = args;
  if (confirmar !== true || typeof huellaRecibida !== "string" || huellaRecibida.length === 0) return "requiere_confirmacion";
  return huellaRecibida === huellaActual ? "continuar" : "huella_vencida";
}

// ---- `sin_cambios` ----

export interface EntradaSinCambios {
  /** `versionId` de la versión que se quiere restaurar y la vigente según el manifiesto (null = sin historial). */
  objetivo: string;
  vigente: string | null;
  /** El vivo cambió sin registro (huella viva ≠ la del manifiesto): true / false / null = no se puede saber. */
  deriva: boolean | null;
  vivo: Doc;
  /** Asignaciones que hoy apuntan a este resultado. */
  afectadas: readonly AsignacionCanal[];
}

/**
 * La versión objetivo YA es la vigente, el vivo no derivó, no hay aprobación que retirar ni notas que quitar y ninguna
 * tarea que reiniciar → volver no cambiaría nada (409 `sin_cambios`). Un resultado APROBADO nunca es «sin cambios»
 * (hay una aprobación que retirar); una deriva desconocida (`null`) tampoco: ante la duda se deja volver.
 */
export function esSinCambios(e: EntradaSinCambios): boolean {
  return (
    e.vigente !== null &&
    e.objetivo === e.vigente &&
    e.deriva === false &&
    e.vivo.aprobado !== true &&
    e.vivo.notasUsuario === undefined &&
    e.afectadas.length === 0
  );
}

// ---- textos del servidor (sin fecha: la fecha de la fila la pone la interfaz con el formateador del panel) ----

/** La pregunta del resultado recortada a ~120 caracteres con «…» (por caracteres, no por unidades UTF-16). */
export function nombreDeResultado(moduloPIP: unknown, max = 120): string | undefined {
  if (typeof moduloPIP !== "string") return undefined;
  const t = moduloPIP.replace(/\s+/g, " ").trim();
  if (t.length === 0) return undefined;
  const cars = Array.from(t);
  return cars.length > max ? `${cars.slice(0, max).join("").trimEnd()}…` : t;
}

export interface EntradaLineasVolver {
  estabaAprobado: boolean;
  teniaNotas: boolean;
  tareasReiniciadas: number;
  haySintesis: boolean;
  hayVeredicto: boolean;
  /** `true` solo si se COMPROBÓ y el archivo de la versión no existe. */
  archivoFaltaba: boolean;
}

/**
 * Líneas CONDICIONALES de la pregunta, en español cotidiano y con los rótulos de la pantalla. Sin fecha, sin el
 * nombre del resultado y sin la frase de apertura (las compone la interfaz con la fila del panel).
 */
export function lineasDeVolver(e: EntradaLineasVolver): string[] {
  const l: string[] = [];
  if (e.estabaAprobado) {
    l.push("Este resultado está aprobado. Al volver quedará sin aprobar y tendrás que aprobarlo otra vez en «M2 · Resultados recibidos».");
  }
  if (e.teniaNotas) l.push("Las notas que escribiste al aprobarlo dejarán de verse.");
  if (e.tareasReiniciadas === 1) {
    l.push("1 tarea de investigación que usaba este resultado volverá a «En curso» y se desvinculará de él.");
  } else if (e.tareasReiniciadas > 1) {
    l.push(`${e.tareasReiniciadas} tareas de investigación que usaban este resultado volverán a «En curso» y se desvincularán de él.`);
  }
  if (e.haySintesis || e.hayVeredicto) {
    const que = e.haySintesis && e.hayVeredicto ? "La síntesis y el veredicto que ya generaste no se vuelven" : e.haySintesis ? "La síntesis que ya generaste no se vuelve" : "El veredicto que ya generaste no se vuelve";
    l.push(`${que} a calcular: seguirá${e.haySintesis && e.hayVeredicto ? "n" : ""} reflejando lo que tenías antes de volver.`);
  }
  if (e.archivoFaltaba) {
    l.push("El archivo de esa versión ya no está guardado; el texto sí se conserva, pero no podrás consultar el archivo original.");
  }
  return l;
}
