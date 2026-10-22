// lib/moddulo/pantallaM1.ts
// PURE decisions of the M1 review screen (F2 · Análisis PESTEL): who may edit, what the fixed
// footer shows for each state, which buttons and notices apply, which dimensions have unsaved
// changes and what the motors area says while M1 is not approved. The page only renders what
// these return (no DOM tests exist, so every decision lives here).
//
// State comes from the server (`m1` of the project GET, see m1Servidor.ts); nothing here computes
// a fingerprint.

import type { M1Aprobacion, MapaPESTEL } from "@/types/moddulo.types";
import { ETIQUETA_DIMENSION } from "./impactoM1";
import { aFecha, lineaTrazabilidadM1, type EstadoM1, type ResultadoEstadoM1 } from "./m1Aprobacion";
import type { RespuestaGuardado } from "./guardadoHonesto";

export const ORDEN_DIMENSIONES = ["P", "E", "S", "T", "Ec", "L"] as const;
export const MAX_TEXTO_EDICION = 10_000;

export const ROTULO_CONFIANZA_IA = "Confianza de la IA";
export const MENSAJE_MOTORES_BORRADOR = "Los motores M2–M5 se generarán cuando apruebes el análisis.";
export const MENSAJE_MOTORES_REABIERTO = "Los motores M2–M5 están en pausa hasta que apruebes de nuevo el análisis.";
export const TEXTO_REABIERTO = "Abierto para edición — aprueba de nuevo para reactivar M2–M5";
export const TEXTO_ANTERIOR = "Aprobación no registrada (proyecto anterior)";
export const TEXTO_SIN_GENERAR = "M1 aprobado, motores sin generar";
export const TEXTO_GENERANDO = "Generando los motores M2–M5…";

export const TEXTO_REPORTE_ANTERIOR =
  "Este reporte corresponde al análisis anterior. Aprueba el análisis nuevo y vuelve a finalizarlo para actualizar el Reporte F2.";
export const MOTIVO_CERRAR_F2_SIN_APROBAR =
  "Aprueba el análisis nuevo (M1) y vuelve a finalizar el Reporte F2 para cerrar la Fase 2.";

/**
 * A finalized Reporte F2 exists but the M1 on screen is a new one nobody has approved (draft or
 * reopened): the report belongs to the PREVIOUS analysis. «Cerrar Fase 2» must not advance with it.
 * «anterior» (no record about M1) and «aprobado» are not this case.
 */
export function reporteDelAnalisisAnterior(estado: EstadoM1 | null, hayDvs: boolean, dvsDeOtroAnalisis = false): boolean {
  return hayDvs && (estado === "borrador" || estado === "reabierto" || (estado === "aprobado" && dvsDeOtroAnalisis));
}

/**
 * The one line under the Reporte F2 (and in its download) saying which analysis it came from. It never
 * marks anything inside the text and carries no origin. Pure; computed on display, nothing is written.
 *  · approved M1 whose approval is valid AND whose finalized report was built from it: the approval line;
 *  · a project from before the review (state «anterior»: PESTEL analysis but no `m1` record): TEXTO_ANTERIOR;
 *  · anything else (no analysis, draft, reopened, report of another analysis, no report): null.
 */
export function lineaTrazabilidadReporte(i: {
  estado: ResultadoEstadoM1["estado"] | null;
  aprobacionValida: boolean;
  aprobacion: Pick<M1Aprobacion, "en" | "categoriasEditadas" | "total"> | undefined;
  hayDvs: boolean;
  dvsDeOtroAnalisis: boolean;
}): string | null {
  if (!i.hayDvs) return null;
  if (i.estado === "aprobado" && i.dvsDeOtroAnalisis) return null;
  return lineaTrazabilidadPestel(i);
}

/**
 * The same line for the PESTEL download. That download uses the approved copy, so the line is true on its own: it
 * does not depend on a Reporte F2 existing or being current. Approved (valid approval) → the approval line;
 * state «anterior» → TEXTO_ANTERIOR; draft, reopened, no analysis or leftovers without payload → null.
 */
export function lineaTrazabilidadPestel(i: {
  estado: ResultadoEstadoM1["estado"] | null;
  aprobacionValida: boolean;
  aprobacion: Pick<M1Aprobacion, "en" | "categoriasEditadas" | "total"> | undefined;
}): string | null {
  if (i.estado === "anterior") return TEXTO_ANTERIOR;
  if (i.estado === "aprobado" && i.aprobacionValida) return lineaTrazabilidadM1(i.aprobacion);
  return null;
}

export type MotivoNoCerrarF2 = "ya_cerrada" | "m1_no_aprobado" | "reporte_f2_no_finalizado" | "reporte_f2_de_otro_analisis";

/**
 * Why F2 cannot be closed, or null when it can. The SERVER (complete-phase) and the «Cerrar Fase 2» button use
 * this one function, so the button is off exactly when the server would refuse:
 *  · an M1 under review (draft / reopened) that is not approved;
 *  · no finalized Reporte F2;
 *  · an approved M1 whose motors were not generated from it (`motoresSinGenerar`): the finalized Reporte F2
 *    belongs to a previous analysis.
 * Projects with no M1 record (anterior / sin_m1 states) only need their Reporte F2.
 * A Fase 2 that is already closed (`f2Cerrada`) wins over everything: there is nothing left to close.
 */
export function motivoNoCerrarF2(i: {
  estado: EstadoM1 | null;
  hayDvs: boolean;
  motoresSinGenerar: boolean;
  /** The finalized report was not built from the approved analysis (finalization seal, or the compatibility rule). */
  dvsDeOtroAnalisis?: boolean;
  f2Cerrada?: boolean;
}): MotivoNoCerrarF2 | null {
  if (i.f2Cerrada) return "ya_cerrada";
  if (i.estado === "borrador" || i.estado === "reabierto") return "m1_no_aprobado";
  if (!i.hayDvs) return "reporte_f2_no_finalizado";
  if (i.estado === "aprobado" && (i.motoresSinGenerar || i.dvsDeOtroAnalisis === true)) return "reporte_f2_de_otro_analisis";
  return null;
}

export const puedeCerrarFase = (i: Parameters<typeof motivoNoCerrarF2>[0]): boolean => motivoNoCerrarF2(i) === null;

/** Tooltip of the off «Cerrar Fase 2»: says what to do first, never to press the button. */
export function textoBotonCierreApagado(motivo: MotivoNoCerrarF2, puedeAprobar: boolean): string {
  if (motivo === "ya_cerrada") return "La Fase 2 ya está cerrada.";
  if (motivo === "m1_no_aprobado") return motivoCerrarF2SinAprobar(puedeAprobar);
  if (motivo === "reporte_f2_no_finalizado") return "Finaliza el análisis (M5) para poder cerrar la Fase 2.";
  return "El Reporte F2 es de un análisis anterior; genera y finaliza los motores del análisis actual para cerrar.";
}

/** The status badge next to the F2 title: «Cerrada» (closed phase) wins over «Lista» (finalized report). null = none. */
export function insigniaF2(i: { f2Cerrada: boolean; hayDvs: boolean; editando: boolean }): "Cerrada" | "Lista" | "Editando" | null {
  if (i.editando) return "Editando";
  if (i.f2Cerrada) return "Cerrada";
  return i.hayDvs ? "Lista" : null;
}

/** "16 oct 2026, 12:41 p. m." (Mexico City). Null for a missing or invalid value. */
export function fechaHora(valor: unknown): string | null {
  const d = aFecha(valor);
  if (!d) return null;
  const dia = d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Mexico_City" }).replace(/\./g, "");
  const hora = d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Mexico_City" });
  return `${dia}, ${hora.replace(/\u202f|\u00a0/g, " ")}`;
}

/** Stamp under the footer state: when this M1 was generated or imported. Null when it was not recorded. */
export function selloM1(i: { estado: EstadoM1 | null; kind: string | null; creadoEn: unknown }): string | null {
  if (!i.estado || i.estado === "sin_m1" || i.estado === "sin_m1_con_restos" || i.estado === "anterior") return null;
  const f = fechaHora(i.creadoEn);
  if (!f) return null;
  return i.kind === "T22" ? `Importado de Centinela el ${f}` : `Generado el ${f}`;
}

/** Notice after «Nuevo análisis» succeeds. */
export function textoExitoNuevoAnalisis(ahora: Date, hayDvs: boolean): string {
  const f = fechaHora(ahora) ?? "";
  // The time already ends with a period ("p. m."): never add a second one.
  const base = `Análisis nuevo generado el ${f}${f.endsWith(".") ? "" : "."} Revísalo, edítalo si hace falta y apruébalo para generar M2–M5.`;
  return hayDvs ? `${base} El Reporte F2 finalizado sigue siendo el del análisis anterior hasta que lo vuelvas a finalizar.` : base;
}

// ── Who may edit ──────────────────────────────────────────────────────────────

export type MotivoSinEdicion = "sin_m1" | "cerrada" | "centinela" | "aprobado" | "anterior";
export interface PermisoEdicionM1 {
  puede: boolean;
  motivo: "ok" | MotivoSinEdicion;
}

/** The pencil is Express only, while F2 is open and M1 is not approved (draft or reopened). */
export function permisoEdicionM1(i: { kind: string | null; f2Cerrada: boolean; estado: EstadoM1 | null }): PermisoEdicionM1 {
  const { estado } = i;
  if (!estado || estado === "sin_m1" || estado === "sin_m1_con_restos") return { puede: false, motivo: "sin_m1" };
  if (i.f2Cerrada) return { puede: false, motivo: "cerrada" };
  if (i.kind === "T22") return { puede: false, motivo: "centinela" };
  if (estado === "aprobado") return { puede: false, motivo: "aprobado" };
  if (estado === "anterior") return { puede: false, motivo: "anterior" };
  return { puede: true, motivo: "ok" };
}

// ── Drafts per dimension (unsaved changes) ────────────────────────────────────

export interface BorradorDimension {
  narrativa: string;
  clasificacion: string;
}
export type Borradores = Partial<Record<string, BorradorDimension>>;

/** Codes (screen order) of the dimensions in edit mode whose draft differs from what is saved. */
export function dimensionesConCambios(borradores: Borradores, mapa: MapaPESTEL | null): string[] {
  if (!mapa) return [];
  return ORDEN_DIMENSIONES.filter((code) => {
    const b = borradores[code];
    const d = mapa[code];
    if (!b || !d) return false;
    return b.narrativa !== (d.narrativa ?? "") || b.clasificacion !== d.clasificacion;
  });
}

export function mensajeCambiosSinGuardar(codigos: string[]): string {
  return `Guarda o cancela tus cambios en: ${codigos.map((c) => ETIQUETA_DIMENSION[c] ?? c).join(", ")}`;
}

/** Client-side check before sending (the server validates again). Null when the draft is sendable. */
export function errorDeBorrador(b: BorradorDimension): string | null {
  if (b.narrativa.trim().length === 0) return "La narrativa no puede estar vacía.";
  if (b.narrativa.length > MAX_TEXTO_EDICION) return "La narrativa no puede pasar de 10 000 caracteres.";
  return null;
}

/** Any 409 means the screen is stale: refetch the project. */
export function debeRefrescarTras409(resp: RespuestaGuardado): boolean {
  return resp.tipo === "respuesta" && resp.status === 409;
}

// ── Fixed footer ──────────────────────────────────────────────────────────────

export type TipoPie = "oculto" | "borrador" | "reabierto" | "aprobado" | "anterior";

export interface EntradaPie {
  estado: EstadoM1 | null;
  f2Cerrada: boolean;
  kind: string | null;
  /** `m1.aprobacion.en` as the project GET delivers it (Timestamp shape or ISO). */
  aprobadoEn: unknown;
  /** The server says the motors draft was not generated from this approval. */
  motoresSinGenerarServidor: boolean;
  /** A motors draft or a finalized dvs is on screen. */
  motoresGenerados: boolean;
  dimensionesConCambios: string[];
  aprobando: boolean;
  generando: boolean;
  /** `m1.creadoEn`: when this M1 was generated or imported (for the stamp). */
  creadoEn?: unknown;
}

export interface PieM1 {
  tipo: TipoPie;
  /** First line (state). */
  texto: string | null;
  /** Second line (generation state). */
  lineaGeneracion: string | null;
  /** «Generado el …» / «Importado de Centinela el …»; null when not recorded or not applicable. */
  sello: string | null;
  aprobar: { visible: boolean; deshabilitado: boolean; motivo: string | null; etiqueta: string };
  reintentarGeneracion: { visible: boolean; deshabilitado: boolean };
  /** Discreet «Reabrir análisis» link (Centinela only; Express reopens from the kebab). */
  reabrirCentinela: boolean;
}

/** Short date for the footer: "15 oct 2026". */
export function fechaCorta(valor: unknown): string | null {
  const d = aFecha(valor);
  if (!d) return null;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Mexico_City" }).replace(/\./g, "");
}

const SIN_BOTONES = {
  aprobar: { visible: false, deshabilitado: false, motivo: null, etiqueta: "Aprobar análisis" },
  reintentarGeneracion: { visible: false, deshabilitado: false },
  reabrirCentinela: false,
};

export function pieM1(e: EntradaPie): PieM1 {
  const base = { texto: null, lineaGeneracion: null, sello: null, ...SIN_BOTONES };
  const { estado } = e;
  if (!estado || estado === "sin_m1" || estado === "sin_m1_con_restos") return { tipo: "oculto", ...base };
  if (estado === "anterior") return { tipo: "anterior", ...base, texto: TEXTO_ANTERIOR };

  const sello = selloM1({ estado, kind: e.kind, creadoEn: e.creadoEn });
  const ocupado = e.aprobando || e.generando;
  const conCambios = e.dimensionesConCambios.length > 0;
  const aprobarBtn = {
    visible: puedeAprobarM1(estado, e.f2Cerrada),
    deshabilitado: ocupado || conCambios,
    motivo: conCambios ? mensajeCambiosSinGuardar(e.dimensionesConCambios) : null,
    etiqueta: e.aprobando ? "Aprobando…" : "Aprobar análisis",
  };

  if (estado === "borrador") {
    if (e.f2Cerrada) return { tipo: "oculto", ...base };
    return { tipo: "borrador", ...base, sello, aprobar: aprobarBtn };
  }
  if (estado === "reabierto") {
    return { tipo: "reabierto", ...base, sello, texto: TEXTO_REABIERTO, aprobar: aprobarBtn };
  }

  // aprobado
  const fecha = fechaCorta(e.aprobadoEn);
  const sinGenerar = e.motoresSinGenerarServidor && !e.motoresGenerados;
  return {
    tipo: "aprobado",
    ...base,
    sello,
    texto: fecha ? `✓ Aprobado el ${fecha}` : "✓ Aprobado",
    lineaGeneracion: e.generando ? TEXTO_GENERANDO : sinGenerar ? TEXTO_SIN_GENERAR : null,
    reintentarGeneracion: { visible: sinGenerar && !e.f2Cerrada, deshabilitado: e.generando },
    reabrirCentinela: e.kind === "T22" && !e.f2Cerrada,
  };
}

// ── Motors area and header chip ───────────────────────────────────────────────

/**
 * The panel offers «Aprobar análisis»: the ONE condition behind the button (pieM1) and behind every text
 * that invites the user to approve. A text that says «aprueba» must never appear without that button.
 */
export function puedeAprobarM1(estado: EstadoM1 | null, f2Cerrada: boolean): boolean {
  return (estado === "borrador" || estado === "reabierto") && !f2Cerrada;
}

export const MENSAJE_MOTORES_FASE_CERRADA = "La Fase 2 está cerrada: este análisis es de solo lectura y los motores no se regeneran.";

/**
 * While M1 is a draft or reopened the motors area shows a message instead of motors. With F2 closed the
 * panel is read-only and there is no «Aprobar» button, so the message says that and invites to nothing.
 */
export function mensajeAreaMotores(estado: EstadoM1 | null, f2Cerrada = false): string | null {
  if (estado !== "borrador" && estado !== "reabierto") return null;
  if (f2Cerrada) return MENSAJE_MOTORES_FASE_CERRADA;
  return estado === "borrador" ? MENSAJE_MOTORES_BORRADOR : MENSAJE_MOTORES_REABIERTO;
}

/** Subtitle of the motors area header. */
export function subtituloAreaMotores(estado: EstadoM1 | null, f2Cerrada: boolean): string {
  if (estado === "borrador" || estado === "reabierto") {
    return f2Cerrada ? "Fase 2 cerrada: análisis de solo lectura." : "Primero revisa y aprueba el análisis PESTEL (panel derecho).";
  }
  return "Revisa y aprueba cada sección antes de generar el Reporte F2.";
}

/** The success notice of «Nuevo análisis» is shown only for a draft that offers «Aprobar análisis». */
export function avisoExitoNuevoAnalisisVisible(i: { aviso: string | null; estado: EstadoM1 | null; f2Cerrada: boolean }): boolean {
  return i.aviso !== null && i.estado === "borrador" && puedeAprobarM1(i.estado, i.f2Cerrada);
}

/** Label of the report of the previous analysis; it only asks to approve when the button exists. */
export function textoReporteAnterior(puedeAprobar: boolean): string {
  return puedeAprobar ? TEXTO_REPORTE_ANTERIOR : "Este reporte corresponde al análisis anterior.";
}

/** Reason «Cerrar Fase 2» is off; it only asks to approve when the button exists. */
export function motivoCerrarF2SinAprobar(puedeAprobar: boolean): string {
  return puedeAprobar ? MOTIVO_CERRAR_F2_SIN_APROBAR : "El Reporte F2 es el del análisis anterior.";
}

/** Tooltip of the off «Editar análisis» (motors) while M1 is not approved; null in the other states. */
export function motivoSinEditarMotores(estado: EstadoM1 | null, f2Cerrada: boolean): string | null {
  if (estado !== "borrador" && estado !== "reabierto") return null;
  return f2Cerrada ? "La Fase 2 está cerrada: los motores quedan como están." : "Aprueba el análisis (M1) para editar los motores.";
}

/** «Editar análisis» (edit the motors' decisions): off while M1 is not approved or has no motors. */
export function puedeEditarMotores(estado: EstadoM1 | null, motoresGenerados: boolean): boolean {
  if (estado === "borrador" || estado === "reabierto") return false;
  if (estado === "aprobado" && !motoresGenerados) return false;
  return true;
}

/** Approved M1, no motors on screen and nothing running: the area offers to retry the generation. */
export function mostrarAvisoSinGenerar(i: {
  estado: EstadoM1 | null;
  motoresSinGenerarServidor: boolean;
  motoresGenerados: boolean;
  generando: boolean;
  hayErrorGeneracion: boolean;
}): boolean {
  return i.estado === "aprobado" && i.motoresSinGenerarServidor && !i.motoresGenerados && !i.generando && !i.hayErrorGeneracion;
}

/**
 * Are the motors (M2–M5) on screen the ones OF THE CURRENT M1? A project can hold a finalized dvs that was
 * generated from a previous M1 (or from none): that dvs must not count as «motors generated» for an M1 that
 * has just been approved. The discriminator is the server's `motoresSinGenerar` (m1.generacion vs the
 * approval's fingerprint). Without an M1 record (project from before the M1 review) the former local rule
 * applies unchanged: any draft or dvs counts.
 */
export function motoresGeneradosParaPantalla(i: {
  estado: EstadoM1 | null;
  motoresSinGenerarServidor: boolean;
  hayBorrador: boolean;
  hayDvs: boolean;
}): boolean {
  const tieneM1 = i.estado === "borrador" || i.estado === "reabierto" || i.estado === "aprobado";
  if (!tieneM1) return i.hayBorrador || i.hayDvs;
  return i.hayBorrador || !i.motoresSinGenerarServidor;
}

/**
 * After a successful approval: generate M2–M5 right away? Yes when the server says the motors are not those
 * of this M1 (`motoresSinGenerar`) and there is no draft of it on screen (a draft the server discarded does
 * not count). A finalized dvs of a previous M1 does NOT prevent it.
 */
export function debeGenerarTrasAprobar(i: { motoresSinGenerarServidor: boolean; hayBorradorLocal: boolean; motoresDescartados: boolean }): boolean {
  const hayMotores = i.motoresDescartados ? false : i.hayBorradorLocal;
  return i.motoresSinGenerarServidor && !hayMotores;
}

/**
 * What the CENTER of the motors area shows (F2, Estado B). The finalized analysis of THIS M1 (no draft on
 * screen, not generating, nothing failed) is shown as «completo» even if the phase is still open — after a
 * reload the draft is gone (it became the dvs) and the view must not fall back to «motores sin generar».
 */
export type ZonaCentroMotores = "completo" | "mensaje" | "sin_generar" | "motores";

export function zonaCentroMotores(i: {
  /** The phase is really CLOSED (`m1.f2Cerrada`), NOT «there is a finalized analysis on screen». */
  f2Cerrada: boolean;
  hayDvs: boolean;
  hayBorrador: boolean;
  generando: boolean;
  hayErrorGeneracion: boolean;
  showReporte: boolean;
  reporteAnterior: boolean;
  motoresGeneradosDelM1: boolean;
  hayMensajeArea: boolean;
  avisoSinGenerar: boolean;
}): ZonaCentroMotores {
  const dvsDeEsteM1 = i.hayDvs && !i.hayBorrador && !i.generando && !i.hayErrorGeneracion && i.motoresGeneradosDelM1;
  if (i.hayDvs && !i.showReporte && !i.reporteAnterior && (i.f2Cerrada || dvsDeEsteM1)) return "completo";
  if (i.hayMensajeArea) return "mensaje";
  if (i.avisoSinGenerar) return "sin_generar";
  return "motores";
}

// ── Working states: what is blocked and what the process indicator says ───────

export type MotivoBloqueoAccionesF2 = "m1_en_edicion" | "generando";
export type MotivoBloqueoEditarAnalisis = MotivoBloqueoAccionesF2 | "borrador_pendiente";

/**
 * Why «Reporte F2», «Generar Reporte F2», «Editar análisis» and «Cerrar Fase 2» are off, or null when they are
 * free: the M1 is a draft / reopened (the analysis is being edited, the finalized report belongs to the previous
 * one) or the motors are being generated. A closed phase is read-only: nothing is blocked, the report can be read.
 */
export function motivoBloqueoAccionesF2(i: { estado: EstadoM1 | null; generando: boolean; f2Cerrada?: boolean }): MotivoBloqueoAccionesF2 | null {
  if (i.f2Cerrada) return null;
  if (i.estado === "borrador" || i.estado === "reabierto") return "m1_en_edicion";
  if (i.generando) return "generando";
  return null;
}

/**
 * «Editar análisis» is also off while a saved motors draft is pending next to a finalized report: editing would
 * replace the new motors on screen with a copy of the old report, and «Guardar cambios» would finalize it as current.
 */
export function motivoBloqueoEditarAnalisis(i: {
  estado: EstadoM1 | null; generando: boolean; f2Cerrada?: boolean; hayDvs: boolean; borradorGuardado: boolean;
}): MotivoBloqueoEditarAnalisis | null {
  const general = motivoBloqueoAccionesF2(i);
  if (general) return general;
  if (!i.f2Cerrada && i.hayDvs && i.borradorGuardado) return "borrador_pendiente";
  return null;
}

/** Tooltip of the blocked actions; it only invites to approve when the «Aprobar análisis» button exists. */
export function textoBloqueoAccionesF2(motivo: MotivoBloqueoEditarAnalisis, puedeAprobar: boolean): string {
  if (motivo === "borrador_pendiente") return "Hay motores nuevos sin finalizar. Revísalos en orden y finaliza el análisis antes de editarlo.";
  if (motivo === "generando") return "Se están generando los motores M2–M5. Espera a que termine.";
  return puedeAprobar ? "Aprueba el análisis PESTEL para habilitar esta acción." : "El análisis PESTEL no está aprobado.";
}

/**
 * The process text shown above the zones of the motors area while M2–M5 are generated. null = nothing to add:
 * not generating, or the zone is already the loading skeleton (zone «motores» with no draft), which says it itself.
 * «lo que ves abajo es la última versión válida» is said ONLY when a previous draft is what the zone shows.
 */
export function indicadorProcesoMotores(i: { generando: boolean; zona: ZonaCentroMotores; hayBorrador: boolean }): string | null {
  if (!i.generando) return null;
  if (i.zona === "motores" && !i.hayBorrador) return null;
  if (i.zona === "motores" && i.hayBorrador) return "Actualizando análisis… lo que ves abajo es la última versión válida.";
  return TEXTO_GENERANDO;
}

/**
 * Notice shown while new motors are SAVED on the server and the finalized report is not from the current analysis.
 * «Ajustes» = any edit in force (narrative, classification or both) of the approved analysis; the names come from
 * `resumen.dimensionesEditadas` in screen order. Never promises that the motors mention the adjustments.
 */
export function textoMotoresActualizados(dimensionesEditadas: readonly string[]): string {
  const nombres = ORDEN_DIMENSIONES.filter((c) => dimensionesEditadas.includes(c)).map((c) => ETIQUETA_DIMENSION[c] ?? c);
  const cola = "Revísalos en orden; el efecto se ve en cómo se interpreta cada uno.";
  if (nombres.length === 0) return `Los motores M2–M5 se actualizaron con el análisis PESTEL aprobado. ${cola}`;
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  return `Los motores M2–M5 se actualizaron con tus ajustes en ${lista}. ${cola}`;
}

/** The notice is on while: approved, F2 open, a saved draft pending and the finalized report from another version. */
export function avisoMotoresActualizadosVisible(i: {
  estado: EstadoM1 | null; f2Cerrada: boolean; hayDvs: boolean; borradorGuardado: boolean; dvsDeOtroAnalisis: boolean;
}): boolean {
  return i.estado === "aprobado" && !i.f2Cerrada && i.hayDvs && i.borradorGuardado && i.dvsDeOtroAnalisis;
}

export const ETIQUETA_REPORTE_VERSION_ANTERIOR = "Este reporte se generó con una versión anterior del análisis PESTEL";
export const ACCION_REVISAR_MOTORES_NUEVOS = "Revisar los motores nuevos";

/** After a reload in the middle of a generation the server may still be working: only a possibility is stated. */
export const TEXTO_CAUTELA_RECARGA =
  "Si acabas de aprobar, la generación puede seguir en curso: espera unos minutos y recarga antes de reintentar.";

// ── Kebab ─────────────────────────────────────────────────────────────────────

export function opcionesKebabM1(i: { kind: string | null; estado: EstadoM1 | null; f2Cerrada: boolean }) {
  // F2 closed = read-only: nothing that replaces or edits the analysis is offered (the server refuses it
  // too: 409 fase_cerrada).
  const abierta = !i.f2Cerrada;
  const o = {
    nuevoAnalisis: abierta,
    vincularIndependiente: abierta,
    analizarConPestel: abierta,
    vincularDeNuevo: abierta,
    editarNarrativas: i.estado === "aprobado" && abierta && i.kind !== "T22",
  };
  return { ...o, hayOpciones: Object.values(o).some(Boolean) };
}

// ── Leaving the page ──────────────────────────────────────────────────────────

export const avisarAlSalir = (codigos: string[]): boolean => codigos.length > 0;

/** Text of the «Editado» chip tooltip: "Editado el 15 oct 2026". */
export function tooltipEditado(en: unknown): string {
  const f = fechaCorta(en);
  return f ? `Editado el ${f}` : "Editado por ti";
}
