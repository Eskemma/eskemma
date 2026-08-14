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

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";

export function getCveEntidad(estadoNombre: string): string | null {
  const normalized = estadoNombre
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return ESTADO_CVE_MAP[normalized] ?? null;
}
