// lib/centinela/pestel/huellaOrigen.ts
// SERVER-ONLY (node:crypto). Huella del CONTENIDO de un análisis de Centinela tal como Moddulo F2 lo consume:
// sha-256 de la serialización estable (sin depender del orden de claves) del objeto canónico de
// `contenidoOrigen.ts`. Se guarda al importar en `linkedSource.huellaFuente` y se recalcula para comparar.
//
// No depende del texto que reciben los prompts ni de `m1Huella.ts` (la huella de la aprobación del M1 es otra
// cosa: describe el mapa de trabajo). Misma regla que ahí: el cliente nunca la calcula.

import { createHash } from "node:crypto";
import { serializacionEstable } from "@/lib/moddulo/serializacionEstable";
import { contenidoDeOrigen, VERSION_HUELLA_ORIGEN, VERSIONES_COMPARABLES, type AjusteCrudo, type DimensionCruda } from "./contenidoOrigen";
import type { NotaAprobacion } from "./notaAprobacion";

export interface HuellaFuente {
  v: number;
  h: string;
}

/**
 * `version` (por omisión la vigente, v2): para COMPARAR una importación se recalcula con la versión de SU huella
 * guardada (v1 → sin nota). `nota` solo cuenta en v2.
 */
export function huellaDeOrigen(
  dimensions: DimensionCruda[] | null | undefined,
  adjustments: AjusteCrudo[] | null | undefined,
  opts?: { version?: number; nota?: NotaAprobacion | null }
): HuellaFuente {
  const v = opts?.version ?? VERSION_HUELLA_ORIGEN;
  const h = createHash("sha256")
    .update(serializacionEstable({ v, ...contenidoDeOrigen(dimensions, adjustments, { version: v, nota: opts?.nota }) }))
    .digest("hex");
  return { v, h };
}

/** ¿La huella guardada se puede comparar? (una versión de la regla que seguimos sabiendo calcular: v1 o v2). */
export function huellaComparable(g: { v?: unknown; h?: unknown } | null | undefined): g is HuellaFuente {
  return !!g && typeof g.v === "number" && VERSIONES_COMPARABLES.includes(g.v) && typeof g.h === "string" && g.h.length > 0;
}
