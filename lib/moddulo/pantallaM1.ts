// lib/moddulo/pantallaM1.ts
// PURE decisions of the M1 review screen (F2 · Análisis PESTEL): who may edit, what the fixed
// footer shows for each state, which buttons and notices apply, which dimensions have unsaved
// changes and what the motors area says while M1 is not approved. The page only renders what
// these return (no DOM tests exist, so every decision lives here).
//
// State comes from the server (`m1` of the project GET, see m1Servidor.ts); nothing here computes
// a fingerprint.

import type { MapaPESTEL } from "@/types/moddulo.types";
import { ETIQUETA_DIMENSION } from "./impactoM1";
import { aFecha, type EstadoM1 } from "./m1Aprobacion";
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
export function reporteDelAnalisisAnterior(estado: EstadoM1 | null, hayDvs: boolean): boolean {
  return hayDvs && (estado === "borrador" || estado === "reabierto");
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
  faseCompletada: boolean;
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
  if (i.hayDvs && !i.showReporte && !i.reporteAnterior && (i.faseCompletada || dvsDeEsteM1)) return "completo";
  if (i.hayMensajeArea) return "mensaje";
  if (i.avisoSinGenerar) return "sin_generar";
  return "motores";
}

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
