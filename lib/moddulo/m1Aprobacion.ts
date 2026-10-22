// lib/moddulo/m1Aprobacion.ts
// Pure state logic for the user's review of M1 (Análisis PESTEL) in F2: derived state,
// per-path edits, the "Editado" chip, the count of adjusted categories and the
// traceability line. No Firestore, no crypto: it is imported by both server and client.
// The fingerprint (huella) is computed on the server (m1Huella.ts) and passed in.
//
// Model (see types/moddulo.types.ts, M1Datos): linkedSource.payload is the working M1;
// `m1.ediciones` keeps the AI's original next to the user's edit; `m1.aprobacion.mapa` is a
// frozen copy of what was approved. An approval is valid only while its fingerprint matches
// the current payload, so a writer that forgets to reset `m1` can never make an old approval
// cover new content.

import type {
  CampoEditableM1,
  F2DimensionPESTEL,
  M1Aprobacion,
  M1Datos,
  M1Edicion,
  MapaPESTEL,
  RutaEdicionM1,
} from "@/types/moddulo.types";

export const CAMPOS_EDITABLES_M1: readonly CampoEditableM1[] = ["narrativa", "clasificacion"];
export const CLASIFICACIONES_M1 = ["OPORTUNIDAD", "NEUTRAL", "AMENAZA"] as const;

export type EstadoM1 =
  | "sin_m1" // no payload and nothing left over
  | "sin_m1_con_restos" // no payload, but a motors draft / motor approvals remain (e.g. after an unlink)
  | "anterior" // payload with motors/dvs created before this feature (no `m1` record at all)
  | "borrador" // payload, not approved (or the approval no longer matches the payload)
  | "reabierto" // approved once, reopened by the user, not yet re-approved
  | "aprobado";

export interface EntradaEstadoM1 {
  m1?: M1Datos;
  /** Is there a linkedSource.payload with at least one dimension? */
  tienePayload: boolean;
  /** Fingerprint of the CURRENT payload, computed on the server (null when no payload). */
  huellaPayload: string | null;
  tieneDvs: boolean;
  tieneDraft: boolean;
  /** Some motor (M2..M5) is currently approved. */
  hayMotoresAprobados: boolean;
}

export interface ResultadoEstadoM1 {
  estado: EstadoM1;
  /** The approval exists AND matches the current payload. */
  aprobacionValida: boolean;
  /** Approved, but the motors draft was not generated from this approval. */
  motoresSinGenerar: boolean;
  /**
   * Approved, and the finalized Reporte F2 (`dvs`) was NOT built from this approval. With the finalization seal
   * (`m1.finalizacion`) it is the comparison of fingerprints. COMPATIBILITY RULE for a `dvs` finalized before the
   * seal existed: it is assumed current only when there is NO saved draft pending (a pending draft next to a
   * `dvs` means the motors were regenerated and not finalized). It cannot tell apart a legacy `dvs` that really
   * is current but has a leftover draft (it is reported as «de otro análisis»).
   */
  dvsDeOtroAnalisis: boolean;
}

export function estadoM1(e: EntradaEstadoM1): ResultadoEstadoM1 {
  const restos = e.tieneDraft || e.hayMotoresAprobados;
  if (!e.tienePayload) {
    return { estado: restos ? "sin_m1_con_restos" : "sin_m1", aprobacionValida: false, motoresSinGenerar: false, dvsDeOtroAnalisis: false };
  }

  const aprobacion = e.m1?.aprobacion;
  const aprobacionValida = !!aprobacion && !!e.huellaPayload && aprobacion.huella === e.huellaPayload;
  if (aprobacionValida) {
    const gen = e.m1?.generacion;
    const sello = e.m1?.finalizacion;
    return {
      estado: "aprobado",
      aprobacionValida: true,
      motoresSinGenerar: !gen || gen.huella !== aprobacion!.huella,
      dvsDeOtroAnalisis: e.tieneDvs && (sello ? sello.huella !== aprobacion!.huella : e.tieneDraft),
    };
  }

  // No valid approval from here on.
  if (!e.m1) {
    // Projects created before this feature: nothing recorded about M1.
    return {
      estado: e.tieneDvs || restos ? "anterior" : "borrador",
      aprobacionValida: false,
      motoresSinGenerar: false,
      dvsDeOtroAnalisis: false,
    };
  }
  if (e.m1.reabiertoEn && !aprobacion) {
    return { estado: "reabierto", aprobacionValida: false, motoresSinGenerar: false, dvsDeOtroAnalisis: false };
  }
  return { estado: "borrador", aprobacionValida: false, motoresSinGenerar: false, dvsDeOtroAnalisis: false };
}

// ── Edits by path ─────────────────────────────────────────────────────────────

export const rutaEdicion = (dim: string, campo: CampoEditableM1): RutaEdicionM1 => `${dim}.${campo}`;

type Ediciones = NonNullable<M1Datos["ediciones"]>;

export interface EdicionNueva {
  dim: string;
  campo: CampoEditableM1;
  /** Value currently in the payload before this edit (the AI's, if never edited). */
  valorActual: string;
  editado: string;
  por: string;
  en: unknown;
}

/**
 * Records an edit. The FIRST edit of a path keeps the AI's original; later ones keep it.
 * Editing back to the original text removes the entry (it is not an adjustment).
 * Pure: returns a new object.
 */
/**
 * Is `editado` the same as `original` for this field? The narrative is compared TRIMMED on both sides (the route
 * stores the edited text trimmed, so an original that ends in a space or line break would otherwise count as a
 * «ghost» edit that looks identical on screen). The classification is compared exactly.
 */
export function mismoValorDeEdicion(campo: CampoEditableM1, original: string, editado: string): boolean {
  return campo === "narrativa" ? original.trim() === editado.trim() : original === editado;
}

export function registrarEdicion(ediciones: Ediciones | undefined, nueva: EdicionNueva): Ediciones {
  const ruta = rutaEdicion(nueva.dim, nueva.campo);
  const actual = { ...(ediciones ?? {}) };
  const original = actual[ruta]?.original ?? nueva.valorActual;
  if (mismoValorDeEdicion(nueva.campo, original, nueva.editado)) {
    delete actual[ruta];
    return actual;
  }
  actual[ruta] = { original, editado: nueva.editado, por: nueva.por, en: nueva.en };
  return actual;
}

/**
 * "Restaurar texto original" for a dimension: returns the values to write back to the
 * payload and the edits without that dimension.
 */
export function restaurarDimension(
  ediciones: Ediciones | undefined,
  dim: string
): { ediciones: Ediciones; valores: Partial<Record<CampoEditableM1, string>> } {
  const resto: Ediciones = {};
  const valores: Partial<Record<CampoEditableM1, string>> = {};
  for (const [ruta, ed] of Object.entries(ediciones ?? {}) as [RutaEdicionM1, M1Edicion][]) {
    const [d, campo] = ruta.split(".") as [string, CampoEditableM1];
    if (d === dim) valores[campo] = ed.original;
    else resto[ruta] = ed;
  }
  return { ediciones: resto, valores };
}

function valorDeCampo(dim: F2DimensionPESTEL | undefined, campo: CampoEditableM1): string | undefined {
  if (!dim) return undefined;
  const v = campo === "narrativa" ? dim.narrativa : dim.clasificacion;
  return typeof v === "string" ? v : undefined;
}

/** Edits that are still in force: the edited value is what the payload holds now. */
function edicionesVigentes(ediciones: Ediciones | undefined, mapa: MapaPESTEL | undefined): [RutaEdicionM1, M1Edicion][] {
  return (Object.entries(ediciones ?? {}) as [RutaEdicionM1, M1Edicion][]).filter(([ruta, ed]) => {
    const [dim, campo] = ruta.split(".") as [string, CampoEditableM1];
    return valorDeCampo(mapa?.[dim], campo) === ed.editado && !mismoValorDeEdicion(campo, ed.original, ed.editado);
  });
}

/** "Editado" chip: the dimension has at least one edit whose text is the one in the payload. */
export function dimensionEditada(ediciones: Ediciones | undefined, mapa: MapaPESTEL | undefined, dim: string): boolean {
  return edicionesVigentes(ediciones, mapa).some(([ruta]) => ruta.split(".")[0] === dim);
}

/** Dimensions with any edit in force (narrative and classification edited count ONCE). */
export function contarDimensionesEditadas(ediciones: Ediciones | undefined, mapa: MapaPESTEL | undefined): number {
  return new Set(edicionesVigentes(ediciones, mapa).map(([ruta]) => ruta.split(".")[0])).size;
}

/** Number of dimensions in a mapa (the "total" of the traceability line). */
export function totalDimensiones(mapa: MapaPESTEL | undefined): number {
  return Object.values(mapa ?? {}).filter((d) => d && typeof d === "object").length;
}

// ── Traceability line (DVS / PESTEL download) ─────────────────────────────────

/** Accepts a Date, an ISO string, a Firestore Timestamp (client or admin shape) or epoch ms. */
export function aFecha(valor: unknown): Date | null {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === "string" || typeof valor === "number") {
    const d = new Date(valor);
    return isNaN(d.getTime()) ? null : d;
  }
  if (valor && typeof valor === "object") {
    const o = valor as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof o.toDate === "function") return aFecha(o.toDate());
    const s = typeof o._seconds === "number" ? o._seconds : o.seconds;
    if (typeof s === "number") return new Date(s * 1000);
  }
  return null;
}

function fechaLarga(valor: unknown): string | null {
  const d = aFecha(valor);
  if (!d) return null;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
}

/**
 * One line for the F2 report and the PESTEL download. Never marks anything inside the text.
 * Returns null when there is no approval record (projects created before this feature).
 */
export function lineaTrazabilidadM1(aprobacion: Pick<M1Aprobacion, "en" | "categoriasEditadas" | "total"> | undefined): string | null {
  if (!aprobacion) return null;
  const fecha = fechaLarga(aprobacion.en);
  if (!fecha) return null;
  if (aprobacion.categoriasEditadas > 0) {
    return `Análisis revisado y ajustado por el usuario el ${fecha}, en ${aprobacion.categoriasEditadas} de ${aprobacion.total} categorías.`;
  }
  return `Análisis aprobado sin ajustes el ${fecha}.`;
}

// ── Map used by the sufficiency criteria ───────────────────────────────────────

/**
 * Which map the DVS sufficiency criteria 1, 8 and 9 read: the APPROVED COPY when the approval is valid (it is what
 * M2–M5 read), otherwise the working payload (projects from before the review, drafts, reopened M1). With a valid
 * approval both have the same fingerprint, so today the result is the same; the rule is the precondition for reopening
 * a closed phase, where the payload could drift from what the report was built on. Pure: the validity comes from
 * `estadoM1` (server) or from the project summary (client).
 */
export function elegirMapaParaCriterios(i: {
  aprobacionValida: boolean;
  aprobacion?: Pick<M1Aprobacion, "mapa"> | null;
  payload?: MapaPESTEL | null;
}): MapaPESTEL | undefined {
  if (i.aprobacionValida && i.aprobacion?.mapa) return i.aprobacion.mapa;
  return i.payload ?? undefined;
}
