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
import { resolverEstadoCve } from "@/lib/geo/estados";
import { claveComparacionMunicipio, normalizeGeoName, plegarDiacriticosGeo } from "@/lib/geo/municipioCanonico";
import { extraerNumeroDistrito } from "@/lib/moddulo/distritoElectoral";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";

export type TerritoryMatch = "exact" | "approximate" | "mismatch";

// Comparaciones por CLAVE, no por cadena exacta (2026-09-20). Antes todo era `!==`
// y daba "mismatch" para el MISMO territorio escrito distinto. Caso real: el proyecto
// Moddulo `nZvpYu…` (Iztapalapa, distrito local 27: `municipio:"IZTAPALAPA"`,
// `cve_distrito:"027"`) contra la sesión Fontana `1qEjT…` del mismo distrito
// (`municipio:"Distrito Electoral Local 27 en la CDMX"`, sin `cve_distrito`).
// Los municipios realmente distintos siguen dando "mismatch".
const claveTexto = (s: string) => plegarDiacriticosGeo(normalizeGeoName(s)).replace(/\s+/g, " ").trim();

function mismoEstado(a: string, b: string): boolean {
  const ca = resolverEstadoCve(a);
  const cb = resolverEstadoCve(b);
  // Estado mexicano en ambos lados → por CVE (alias, acentos, nombre oficial largo).
  // Si alguno no lo es (p. ej. un departamento de Colombia) → texto sin acentos/mayúsculas.
  return ca && cb ? ca === cb : claveTexto(a) === claveTexto(b);
}

function mismoMunicipio(estado: string | undefined, a: string, b: string): boolean {
  const cve = resolverEstadoCve(estado) ?? "";
  return claveComparacionMunicipio(cve, a) === claveComparacionMunicipio(cve, b);
}

// Número de distrito (3 dígitos) de un territorio: `cve_distrito` numérico o el número
// (romano/arábigo) de la frase "Distrito Electoral Federal/Local {n} …". null si no hay.
const numeroDistrito = (t: Territorio): string | null =>
  extraerNumeroDistrito(t.municipio ?? t.nombre, t.cve_distrito);

export function checkTerritoryMatch(
  a: Territorio | null | undefined,
  b: Territorio | null | undefined
): TerritoryMatch {
  if (!a || !b) return "approximate";
  if (a.nivel !== b.nivel) return "mismatch";
  if (a.pais && b.pais && claveTexto(a.pais) !== claveTexto(b.pais)) return "mismatch";
  if (a.estado && b.estado && !mismoEstado(a.estado, b.estado)) return "mismatch";

  const isDistrito = ["distrito_federal", "distrito_local", "distrito"].includes(a.nivel);
  if (isDistrito) {
    const na = numeroDistrito(a);
    const nb = numeroDistrito(b);
    if (na && nb) {
      if (na !== nb) return "mismatch";
      // "exact" solo con `cve_distrito` en AMBOS lados (regla previa). Si el número
      // salió de un texto libre en alguno, es "approximate" (pide confirmación, como
      // antes): nunca se concede "exact" por interpretar texto.
      return a.cve_distrito && b.cve_distrito ? "exact" : "approximate";
    }
    if (a.municipio && b.municipio) {
      const ca = extraerCiudadCabecera(a.municipio);
      const cb = extraerCiudadCabecera(b.municipio);
      if (ca && cb && !mismoMunicipio(a.estado ?? b.estado, ca, cb)) return "mismatch";
    }
    return "approximate";
  }

  if (a.nivel === "municipal") {
    if (a.municipio && b.municipio && !mismoMunicipio(a.estado ?? b.estado, a.municipio, b.municipio)) return "mismatch";
    return "approximate";
  }

  return "exact";
}

export function esTipoCompatible(tipoA: string, tipoB: string): boolean {
  return tipoA === tipoB;
}
