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
}

export interface PieM1 {
  tipo: TipoPie;
  /** First line (state). */
  texto: string | null;
  /** Second line (generation state). */
  lineaGeneracion: string | null;
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
  const base = { texto: null, lineaGeneracion: null, ...SIN_BOTONES };
  const { estado } = e;
  if (!estado || estado === "sin_m1" || estado === "sin_m1_con_restos") return { tipo: "oculto", ...base };
  if (estado === "anterior") return { tipo: "anterior", ...base, texto: TEXTO_ANTERIOR };

  const ocupado = e.aprobando || e.generando;
  const conCambios = e.dimensionesConCambios.length > 0;
  const aprobarBtn = {
    visible: !e.f2Cerrada,
    deshabilitado: ocupado || conCambios,
    motivo: conCambios ? mensajeCambiosSinGuardar(e.dimensionesConCambios) : null,
    etiqueta: e.aprobando ? "Aprobando…" : "Aprobar análisis",
  };

  if (estado === "borrador") {
    if (e.f2Cerrada) return { tipo: "oculto", ...base };
    return { tipo: "borrador", ...base, aprobar: aprobarBtn };
  }
  if (estado === "reabierto") {
    return { tipo: "reabierto", ...base, texto: TEXTO_REABIERTO, aprobar: aprobarBtn };
  }

  // aprobado
  const fecha = fechaCorta(e.aprobadoEn);
  const sinGenerar = e.motoresSinGenerarServidor && !e.motoresGenerados;
  return {
    tipo: "aprobado",
    ...base,
    texto: fecha ? `✓ Aprobado el ${fecha}` : "✓ Aprobado",
    lineaGeneracion: e.generando ? TEXTO_GENERANDO : sinGenerar ? TEXTO_SIN_GENERAR : null,
    reintentarGeneracion: { visible: sinGenerar && !e.f2Cerrada, deshabilitado: e.generando },
    reabrirCentinela: e.kind === "T22" && !e.f2Cerrada,
  };
}

// ── Motors area and header chip ───────────────────────────────────────────────

/** While M1 is a draft or reopened the motors area shows a message instead of motors. */
export function mensajeAreaMotores(estado: EstadoM1 | null): string | null {
  if (estado === "borrador") return MENSAJE_MOTORES_BORRADOR;
  if (estado === "reabierto") return MENSAJE_MOTORES_REABIERTO;
  return null;
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

// ── Kebab ─────────────────────────────────────────────────────────────────────

export function opcionesKebabM1(i: { kind: string | null; estado: EstadoM1 | null; f2Cerrada: boolean }) {
  return {
    editarNarrativas: i.estado === "aprobado" && !i.f2Cerrada && i.kind !== "T22",
  };
}

// ── Leaving the page ──────────────────────────────────────────────────────────

export const avisarAlSalir = (codigos: string[]): boolean => codigos.length > 0;

/** Text of the «Editado» chip tooltip: "Editado el 15 oct 2026". */
export function tooltipEditado(en: unknown): string {
  const f = fechaCorta(en);
  return f ? `Editado el ${f}` : "Editado por ti";
}
