// lib/moddulo/m1Servidor.ts
// SERVER-ONLY (uses the fingerprint, which needs node:crypto). Reads the M1 review state out of the
// raw `phases.exploracion` of a project document and builds the two things that depend on it: the
// input of the pure impact module and the summary the project GET hands to the screen (the screen
// cannot compute the fingerprint itself).

import type { M1Datos, MapaPESTEL } from "@/types/moddulo.types";
import { dimensionEditada, estadoM1, totalDimensiones, type ResultadoEstadoM1 } from "./m1Aprobacion";
import { huellaMapaPESTEL } from "./m1Huella";
import type { EstadoParaImpactoM1 } from "./impactoM1";
import { lineaTrazabilidadPestel, lineaTrazabilidadReporte } from "./pantallaM1";

/** The slice of `phases.exploracion` this module reads (the raw document, or getProject's view). */
export interface ExploracionParaM1 {
  status?: string;
  linkedSource?: { kind?: string; payload?: unknown };
  m1?: M1Datos;
  dvs?: unknown;
  draftDVS?: unknown;
  motorAprobaciones?: Partial<Record<string, boolean>>;
}

export interface AnalisisM1 {
  payload: MapaPESTEL | null;
  /** `kind` of the linkedSource ("express", "T22"), null without one. */
  kind: string | null;
  /** F2 is closed (the panel is read-only). */
  cerrada: boolean;
  huellaPayload: string | null;
  m1: M1Datos | undefined;
  estado: ResultadoEstadoM1;
  impacto: EstadoParaImpactoM1;
}

const MOTORES = ["M2", "M3", "M4", "M5"] as const;

export function analizarM1(exp: ExploracionParaM1 | undefined): AnalisisM1 {
  const crudo = exp?.linkedSource?.payload;
  const payload =
    crudo && typeof crudo === "object" && Object.keys(crudo).length > 0 ? (crudo as MapaPESTEL) : null;
  const huellaPayload = payload ? huellaMapaPESTEL(payload) : null;
  const motoresAprobados = MOTORES.filter((m) => exp?.motorAprobaciones?.[m] === true);
  const tieneDraft = !!exp?.draftDVS;
  const tieneDvs = !!exp?.dvs;
  const m1 = exp?.m1;

  const estado = estadoM1({
    m1, tienePayload: !!payload, huellaPayload, tieneDvs, tieneDraft,
    hayMotoresAprobados: motoresAprobados.length > 0,
  });

  const dimensionesEditadas = payload
    ? Object.keys(payload).filter((d) => dimensionEditada(m1?.ediciones, payload, d))
    : [];

  return {
    payload,
    kind: exp?.linkedSource?.kind ?? null,
    cerrada: exp?.status === "completed",
    huellaPayload,
    m1,
    estado,
    impacto: {
      estado: estado.estado,
      hayPayload: !!payload,
      aprobada: estado.aprobacionValida,
      huellaPayload,
      huellaAprobacion: estado.aprobacionValida ? m1?.aprobacion?.huella ?? null : null,
      huellaGeneracion: m1?.generacion?.huella ?? null,
      dimensionesEditadas,
      totalDimensiones: totalDimensiones(payload ?? undefined),
      motoresAprobados: [...motoresAprobados],
      hayBorrador: tieneDraft,
      hayDvs: tieneDvs,
    },
  };
}

/** What the project GET adds next to `project` (additive: no current reader looks at it). */
export interface ResumenM1Cliente {
  estado: ResultadoEstadoM1["estado"];
  aprobacionValida: boolean;
  motoresSinGenerar: boolean;
  /**
   * The finalized Reporte F2 comes from a previous version of the analysis (see estadoM1). Always false with F2
   * closed: a closed phase never changes label nor receives new refusals.
   */
  dvsDeOtroAnalisis: boolean;
  /** There is a motors draft SAVED on the server (not the local draft of «Editar análisis»). */
  borradorGuardado: boolean;
  /**
   * The line under the Reporte F2 and in its downloads (see lineaTrazabilidadReporte), or null. Computed here so the
   * page does not repeat the validity rules.
   */
  trazabilidad: string | null;
  /** The same line for the PESTEL download (does not depend on a Reporte F2), or null. */
  trazabilidadPestel: string | null;
  /** Fingerprint of the M1 the user is looking at; the client sends it back as `huellaVista`. */
  huella: string | null;
  kind: string | null;
  dimensionesEditadas: string[];
}

export function resumenM1ParaCliente(exp: ExploracionParaM1 | undefined): ResumenM1Cliente {
  const a = analizarM1(exp);
  const dvsDeOtroAnalisis = !a.cerrada && a.estado.dvsDeOtroAnalisis;
  return {
    estado: a.estado.estado,
    aprobacionValida: a.estado.aprobacionValida,
    motoresSinGenerar: a.estado.motoresSinGenerar,
    dvsDeOtroAnalisis,
    trazabilidad: lineaTrazabilidadReporte({
      estado: a.estado.estado,
      aprobacionValida: a.estado.aprobacionValida,
      aprobacion: a.m1?.aprobacion,
      hayDvs: a.impacto.hayDvs,
      dvsDeOtroAnalisis,
    }),
    trazabilidadPestel: lineaTrazabilidadPestel({
      estado: a.estado.estado,
      aprobacionValida: a.estado.aprobacionValida,
      aprobacion: a.m1?.aprobacion,
    }),
    borradorGuardado: a.impacto.hayBorrador,
    huella: a.huellaPayload,
    kind: a.kind,
    dimensionesEditadas: a.impacto.dimensionesEditadas,
  };
}
