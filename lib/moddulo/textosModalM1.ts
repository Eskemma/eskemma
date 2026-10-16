// lib/moddulo/textosModalM1.ts
// PURE. The wording of the M1 confirmation modals, built from the SAME state and the SAME lines the
// server uses (impactoM1.ts): a line appears only when it applies to the real state, and a clean
// project gets no loss lines at all. The screen renders what these return; it writes no text of
// its own. When the server answers a 409 with its own `lineas` (authoritative: they were computed
// from the state at that moment) pass them as `lineasServidor` and they replace the local ones.
// No internal words ("huella", "payload", "linkedSource") ever reach the user.

import {
  lineasImpactoM1,
  type AccionM1,
  type EstadoParaImpactoM1,
} from "./impactoM1";
import type { EstadoM1 } from "./m1Aprobacion";

export interface TextoModalM1 {
  titulo: string;
  /** Opening paragraph(s). */
  intro: string[];
  /** What is lost / paused, only the lines that apply (may be empty). */
  lineas: string[];
  /** Closing sentence (what is kept if it fails); null when it does not apply. */
  cierre: string | null;
  confirmar: string;
  cancelar: string;
}

export interface OpcionesModalM1 {
  /** Name of the Centinela analysis being imported ("Vincular con análisis independiente"). */
  nombre?: string;
  /** Lines the server returned in its 409; they replace the locally computed ones. */
  lineasServidor?: string[];
}

export const MENSAJE_VINCULAR_CENTINELA_CON_EDICIONES =
  "Este proyecto tiene un análisis con ediciones o aprobación. Ábrelo en Moddulo y usa «Vincular con análisis independiente» para confirmar el reemplazo.";

/** Modal for "Nuevo análisis ↺", "Vincular con análisis independiente", "Editar narrativas" and "Desvincular". */
export function textoModalM1(accion: AccionM1, e: EstadoParaImpactoM1, o: OpcionesModalM1 = {}): TextoModalM1 {
  const lineas = o.lineasServidor ?? lineasImpactoM1(e, accion);
  const hayAlgoQueConservar = e.hayPayload; // there is a current analysis that survives a failure
  const base = { lineas, cancelar: "Cancelar" };

  switch (accion) {
    case "nuevo_analisis":
      return {
        ...base,
        titulo: hayAlgoQueConservar || lineas.length > 0 ? "¿Generar un análisis nuevo?" : "Generar análisis",
        intro: [
          hayAlgoQueConservar
            ? "Se generará un análisis PESTEL desde cero y reemplazará al actual."
            : "Se generará un análisis PESTEL nuevo para este proyecto.",
        ],
        cierre: hayAlgoQueConservar ? "Si la generación falla, tu análisis actual se conserva." : null,
        confirmar: "Generar análisis nuevo",
      };
    case "vincular":
      return {
        ...base,
        titulo: "¿Reemplazar el análisis actual por el de Centinela?",
        intro: [o.nombre ? `Se importará «${o.nombre}» y reemplazará al actual.` : "Se importará el análisis de Centinela y reemplazará al actual."],
        cierre: "Si la importación falla, tu análisis actual se conserva.",
        confirmar: "Reemplazar",
      };
    case "reabrir":
      return {
        ...base,
        titulo: "¿Editar las narrativas del análisis?",
        // The "M2–M5 en pausa / si es idéntico se conservan" sentences are lines (impactoM1): they
        // appear only when motors exist, so a project without motors is not told about a pause.
        intro: ["M1 quedará abierto para edición."],
        cierre: null,
        confirmar: "Editar narrativas",
      };
    case "desvincular":
      return {
        ...base,
        titulo: "¿Desvincular del análisis de Centinela PESTEL?",
        intro: ["Se quitará el análisis PESTEL (M1) de este proyecto. El análisis de Centinela no cambia y podrás restaurar este vínculo después."],
        cierre: null,
        confirmar: "Desvincular",
      };
  }
}

/** Facts the screen already has (project GET + its `m1` summary) to build the modal state. */
export interface DatosPantallaM1 {
  estado: EstadoM1;
  aprobacionValida: boolean;
  /** Codes of the dimensions with an edit in force (`m1.dimensionesEditadas` of the GET). */
  dimensionesEditadas: string[];
  totalDimensiones: number;
  /** Motors approved right now, e.g. ["M2", "M3"]. */
  motoresAprobados: string[];
  hayBorrador: boolean;
  hayDvs: boolean;
}

/**
 * The state the modal functions need, from what the screen has. The fingerprints are not needed to
 * word a modal (only the server's confirmation check uses them), so they are left null here.
 */
export function estadoImpactoDesdePantalla(d: DatosPantallaM1): EstadoParaImpactoM1 {
  return {
    estado: d.estado,
    hayPayload: d.estado !== "sin_m1" && d.estado !== "sin_m1_con_restos",
    aprobada: d.aprobacionValida,
    huellaPayload: null,
    huellaAprobacion: null,
    huellaGeneracion: null,
    dimensionesEditadas: d.dimensionesEditadas,
    totalDimensiones: d.totalDimensiones,
    motoresAprobados: d.motoresAprobados,
    hayBorrador: d.hayBorrador,
    hayDvs: d.hayDvs,
  };
}

/**
 * The 409 that the Centinela-side link (ModduloButton → link-moddulo) returns when the Moddulo
 * project has edits or an approval: the screen shows THIS text (not the server's wording). The
 * server emits it from commit 4; until then the branch never fires.
 */
export function mensajeRechazoVincularCentinela(resp: { status: number; codigo?: string }): string | null {
  if (resp.status !== 409) return null;
  return resp.codigo === "reemplazo_requiere_confirmacion" || resp.codigo === "reemplazo_huella_vencida"
    ? MENSAJE_VINCULAR_CENTINELA_CON_EDICIONES
    : null;
}
