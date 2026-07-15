// lib/centinela/pestel/transformToMapaPESTEL.ts
// Shared transformation: PestlAnalysisV2 dimensions → MapaPESTEL for Moddulo F2.

import { DIMENSION_META } from "@/types/pestel.types";
import type { MapaPESTEL, F2DimensionPESTEL, F2Senal } from "@/types/moddulo.types";

type RawSenal = {
  descripcion?: string;
  fuente?: string;
  fechaCorte?: string;
  nivelConfianza?: "alto" | "medio" | "bajo";
  origenInternacional?: boolean;
};

export type RawDimension = {
  code: string;
  classification?: "OPORTUNIDAD" | "NEUTRAL" | "AMENAZA";
  narrative?: string;
  confidence?: number;
  senalesFavorables?: RawSenal[];
  senalesAdversas?: RawSenal[];
  senalesInciertas?: RawSenal[];
};

function toF2Senal(s: RawSenal): F2Senal {
  return {
    descripcion: s.descripcion ?? "",
    fuente: s.fuente ?? "",
    fechaCorte: s.fechaCorte ?? "",
    nivelConfianza: s.nivelConfianza ?? "medio",
    origenInternacional: s.origenInternacional ?? false,
  };
}

export function transformToMapaPESTEL(dimensions: RawDimension[]): MapaPESTEL {
  const mapaPESTEL: MapaPESTEL = {};
  for (const dim of dimensions) {
    const code = dim.code;
    const label = DIMENSION_META[code as keyof typeof DIMENSION_META]?.label ?? code;
    const entry: F2DimensionPESTEL = {
      code,
      label,
      clasificacion: dim.classification ?? "NEUTRAL",
      senalesFavorables: (dim.senalesFavorables ?? []).map(toF2Senal),
      senalesAdversas: (dim.senalesAdversas ?? []).map(toF2Senal),
      senalesInciertas: (dim.senalesInciertas ?? []).map(toF2Senal),
      narrativa: dim.narrative,
      confidence: dim.confidence,
    };
    mapaPESTEL[code] = entry;
  }
  return mapaPESTEL;
}
