// lib/centinela/pestel/huellaOrigen.ts
// SERVER-ONLY (node:crypto). Huella del CONTENIDO de un análisis de Centinela tal como Moddulo F2 lo consume:
// sha-256 de la serialización estable (sin depender del orden de claves) del objeto canónico de
// `contenidoOrigen.ts`. Se guarda al importar en `linkedSource.huellaFuente` y se recalcula para comparar.
//
// No depende del texto que reciben los prompts ni de `m1Huella.ts` (la huella de la aprobación del M1 es otra
// cosa: describe el mapa de trabajo). Misma regla que ahí: el cliente nunca la calcula.

import { createHash } from "node:crypto";
import { serializacionEstable } from "@/lib/moddulo/serializacionEstable";
import { contenidoDeOrigen, VERSION_HUELLA_ORIGEN, type AjusteCrudo, type DimensionCruda } from "./contenidoOrigen";

export interface HuellaFuente {
  v: number;
  h: string;
}

export function huellaDeOrigen(
  dimensions: DimensionCruda[] | null | undefined,
  adjustments: AjusteCrudo[] | null | undefined
): HuellaFuente {
  const h = createHash("sha256")
    .update(serializacionEstable({ v: VERSION_HUELLA_ORIGEN, ...contenidoDeOrigen(dimensions, adjustments) }))
    .digest("hex");
  return { v: VERSION_HUELLA_ORIGEN, h };
}

/** ¿La huella guardada es comparable con la actual? (misma versión de la regla). */
export function huellaComparable(g: { v?: unknown; h?: unknown } | null | undefined): g is HuellaFuente {
  return !!g && g.v === VERSION_HUELLA_ORIGEN && typeof g.h === "string" && g.h.length > 0;
}
