// lib/geo/estadoCve.ts
// Conversión nombre de estado → CVE de 2 dígitos (ESTADO_CVE_MAP usa claves
// en mayúsculas sin acentos; los nombres de estado en la UI — ESTADOS_MEXICO
// en TerritorySelector.tsx — tienen formato propio con acentos).
//
// Extraída 26-08-13 desde app/api/moddulo/f2/generate-m1-express/route.ts,
// donde vivía inline, para que TerritorySelector.tsx (cliente) pueda
// reutilizarla sin duplicar una tercera copia — ya existía duplicada ahí y
// en functions/src/utils/estadoCveMap.ts (build separado de Cloud
// Functions, no importable desde el resto del proyecto — esa copia sigue
// siendo necesaria y no se toca).

import { resolverEstadoCve } from "@/lib/geo/estados";

/** @deprecated Delegado — usar `resolverEstadoCve` (lib/geo/estados.ts). Se conserva por los importadores existentes. */
export function getCveEntidad(estadoNombre: string): string | null {
  return resolverEstadoCve(estadoNombre);
}
