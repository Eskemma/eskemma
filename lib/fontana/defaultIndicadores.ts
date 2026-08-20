// lib/fontana/defaultIndicadores.ts
// Selección por defecto de indicadores para Fontana standalone (sin PIP
// de referencia, Escenarios b/c) — decisión de producto (2026-08-19):
// los primeros 3 indicadores de cada familia con pipeline activo, según
// el orden ya establecido del catálogo (FAMILIA1_ORDEN/FAMILIA2_ORDEN).
// Se expande automáticamente cuando Familia 3+ tengan su propio _ORDEN
// poblado (hoy no lo tienen — mismo criterio que el 400 explícito que
// ya usa app/api/fontana/familia/[familiaId]/route.ts para esas
// familias), sin tocar esta función.
//
// Se llama UNA sola vez, desde la creación de la sesión suelta — nunca
// se reimplementa este criterio en Flujo 1/2 (ambos parten de una
// sesión ya creada con este default).

import { FAMILIA1_ORDEN } from "@/lib/fontana/familia1Catalogo";
import { FAMILIA2_ORDEN } from "@/lib/fontana/familia2Catalogo";
import type { FamiliaFontanaId } from "@/types/fontana.types";

const CANTIDAD_DEFAULT = 3;

export function derivarIndicadoresPorDefecto(): Record<FamiliaFontanaId, string[]> {
  return {
    F1: FAMILIA1_ORDEN.slice(0, CANTIDAD_DEFAULT),
    F2: FAMILIA2_ORDEN.slice(0, CANTIDAD_DEFAULT),
    F3: [],
    F4: [],
    F5: [],
  };
}