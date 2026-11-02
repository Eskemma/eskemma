// lib/centinela/pestel/transformToMapaPESTEL.ts
// Shared transformation: PestlAnalysisV2 dimensions (+ the analyst's adjustments) → MapaPESTEL for Moddulo F2.

import { DIMENSION_META } from "@/types/pestel.types";
import type { MapaPESTEL, F2DimensionPESTEL, F2Senal, AjusteAnalistaF2 } from "@/types/moddulo.types";
import { aMillis } from "./aprobacion";

type RawSenal = {
  descripcion?: string;
  fuente?: string;
  fechaCorte?: string;
  nivelConfianza?: "alto" | "medio" | "bajo";
  origenInternacional?: boolean;
};

type Clasificacion = "OPORTUNIDAD" | "NEUTRAL" | "AMENAZA";

export type RawDimension = {
  code: string;
  classification?: Clasificacion;
  narrative?: string;
  confidence?: number;
  senalesFavorables?: RawSenal[];
  senalesAdversas?: RawSenal[];
  senalesInciertas?: RawSenal[];
};

/** Un `HumanAdjustment` tal como se guarda en pestel_analyses (las fechas llegan como Timestamp, {_seconds} o ISO). */
export type RawAdjustment = {
  dimensionCode?: string;
  originalClassification?: string;
  newClassification?: string;
  justification?: string;
  adjustedAt?: unknown;
  originalPosition?: { x?: unknown; y?: unknown };
  newPosition?: { x?: unknown; y?: unknown };
};

const CLASIFICACIONES: readonly string[] = ["OPORTUNIDAD", "NEUTRAL", "AMENAZA"];
const esClasificacion = (v: unknown): v is Clasificacion => typeof v === "string" && CLASIFICACIONES.includes(v);

function toF2Senal(s: RawSenal): F2Senal {
  return {
    descripcion: s.descripcion ?? "",
    fuente: s.fuente ?? "",
    fechaCorte: s.fechaCorte ?? "",
    nivelConfianza: s.nivelConfianza ?? "medio",
    origenInternacional: s.origenInternacional ?? false,
  };
}

const esNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * El ajuste del analista de una dimensión, o null si no hay. Un ajuste NUNCA se descarta completo por un dato
 * ilegible: una fecha que no se puede convertir solo omite `ajustadoEn` (y deja un aviso sin contenido); unas
 * posiciones incompletas solo omiten `posiciones`. Orden de claves fijo (la huella es estable).
 */
function toAjuste(adj: RawAdjustment, clasificacionIA: Clasificacion): AjusteAnalistaF2 {
  const original = esClasificacion(adj.originalClassification) ? adj.originalClassification : clasificacionIA;
  const ajustada = esClasificacion(adj.newClassification) ? adj.newClassification : original;
  const out: AjusteAnalistaF2 = {
    clasificacionOriginal: original,
    clasificacionAjustada: ajustada,
    justificacion: typeof adj.justification === "string" ? adj.justification : "",
  };
  const ms = aMillis(adj.adjustedAt);
  if (ms !== null && Number.isFinite(ms)) {
    out.ajustadoEn = new Date(ms).toISOString();
  } else {
    console.warn(`[transformToMapaPESTEL] ajuste sin fecha convertible (dimensión ${adj.dimensionCode ?? "?"}); se conserva sin ajustadoEn`);
  }
  const o = adj.originalPosition;
  const n = adj.newPosition;
  if (o && n && esNum(o.x) && esNum(o.y) && esNum(n.x) && esNum(n.y)) {
    out.posiciones = { original: { x: o.x, y: o.y }, nueva: { x: n.x, y: n.y } };
  }
  return out;
}

export function transformToMapaPESTEL(dimensions: RawDimension[], adjustments?: RawAdjustment[] | null): MapaPESTEL {
  const mapaPESTEL: MapaPESTEL = {};
  for (const dim of dimensions) {
    const code = dim.code;
    const label = DIMENSION_META[code as keyof typeof DIMENSION_META]?.label ?? code;
    const clasificacionIA = dim.classification ?? "NEUTRAL";
    // Si hubiera más de uno para la misma dimensión, vale el último (la ruta de ajuste guarda uno por dimensión).
    const adj = (adjustments ?? []).filter((a) => a?.dimensionCode === code).pop();
    const ajuste = adj ? toAjuste(adj, clasificacionIA) : null;
    const entry: F2DimensionPESTEL = {
      code,
      label,
      clasificacion: ajuste ? ajuste.clasificacionAjustada : clasificacionIA,
      senalesFavorables: (dim.senalesFavorables ?? []).map(toF2Senal),
      senalesAdversas: (dim.senalesAdversas ?? []).map(toF2Senal),
      senalesInciertas: (dim.senalesInciertas ?? []).map(toF2Senal),
      narrativa: dim.narrative,
      confidence: dim.confidence,
    };
    if (ajuste) entry.ajuste = ajuste;
    mapaPESTEL[code] = entry;
  }
  return mapaPESTEL;
}
