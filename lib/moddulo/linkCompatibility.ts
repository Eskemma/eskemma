// lib/moddulo/linkCompatibility.ts
// Lógica de compatibilidad tipo/territorio compartida entre la vinculación
// Moddulo↔Centinela (Canal 1) y Canal 3 (fuente externa). Movida desde
// app/api/centinela/pestel/project/[projectId]/link-moddulo/route.ts, donde
// vivía como lógica local/inline — no duplicar en un tercer lugar.

import type { Territorio } from "@/types/shared.types";

export type TerritoryMatch = "exact" | "approximate" | "mismatch";

export function checkTerritoryMatch(
  p: Territorio,
  m: Territorio | undefined
): TerritoryMatch {
  if (!m) return "approximate";
  if (p.nivel !== m.nivel) return "mismatch";
  if (p.pais && m.pais && p.pais !== m.pais) return "mismatch";
  if (p.estado && m.estado && p.estado !== m.estado) return "mismatch";

  const isDistrito = ["distrito_federal", "distrito_local", "distrito"].includes(p.nivel);
  if (isDistrito) {
    if (p.cve_distrito && m.cve_distrito) {
      return p.cve_distrito === m.cve_distrito ? "exact" : "mismatch";
    }
    if (p.municipio && m.municipio && p.municipio !== m.municipio) return "mismatch";
    return "approximate";
  }

  if (p.nivel === "municipal") {
    if (p.municipio && m.municipio && p.municipio !== m.municipio) return "mismatch";
    return "approximate";
  }

  return "exact";
}

export function esTipoCompatible(tipoA: string, tipoB: string): boolean {
  return tipoA === tipoB;
}
