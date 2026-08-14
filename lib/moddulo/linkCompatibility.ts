// lib/moddulo/linkCompatibility.ts
// Lógica de compatibilidad tipo/territorio compartida entre la vinculación
// Moddulo↔Centinela (Canal 1) y Canal 3 (fuente externa). Movida desde
// app/api/centinela/pestel/project/[projectId]/link-moddulo/route.ts, donde
// vivía como lógica local/inline — no duplicar en un tercer lugar.
//
// Consolidada 26-08-13: existían 3 copias independientes de esta misma
// lógica (esta, app/components/centinela/pestel/ModduloButton.tsx, y
// checkTerritoryMatchInverse en el sidebar de F2). Auditadas línea por
// línea antes de fusionar — el cuerpo era idéntico en las 3, la única
// diferencia real era que checkTerritoryMatchInverse aceptaba AMBOS
// parámetros como nullable (porque ModduloProject.territorio es opcional y
// el estado projectTerritory del sidebar puede quedarse en null), mientras
// esta versión solo garantizaba el segundo. La firma de abajo adopta la más
// permisiva de las dos para no romper ese call site. La lógica interna es
// simétrica en a/b: el orden de los argumentos no cambia el resultado,
// porque a.nivel === b.nivel ya está garantizado antes de usarse.

import type { Territorio } from "@/types/shared.types";

export type TerritoryMatch = "exact" | "approximate" | "mismatch";

export function checkTerritoryMatch(
  a: Territorio | null | undefined,
  b: Territorio | null | undefined
): TerritoryMatch {
  if (!a || !b) return "approximate";
  if (a.nivel !== b.nivel) return "mismatch";
  if (a.pais && b.pais && a.pais !== b.pais) return "mismatch";
  if (a.estado && b.estado && a.estado !== b.estado) return "mismatch";

  const isDistrito = ["distrito_federal", "distrito_local", "distrito"].includes(a.nivel);
  if (isDistrito) {
    if (a.cve_distrito && b.cve_distrito) {
      return a.cve_distrito === b.cve_distrito ? "exact" : "mismatch";
    }
    if (a.municipio && b.municipio && a.municipio !== b.municipio) return "mismatch";
    return "approximate";
  }

  if (a.nivel === "municipal") {
    if (a.municipio && b.municipio && a.municipio !== b.municipio) return "mismatch";
    return "approximate";
  }

  return "exact";
}

export function esTipoCompatible(tipoA: string, tipoB: string): boolean {
  return tipoA === tipoB;
}
