// lib/fontana/series/seriesInternacionalesDisponibles.ts
// Config paralelo a seriesDisponibles.ts, pero para Familia 4 (comparación
// internacional). El camino de series de F4 es TOTALMENTE paralelo al
// geográfico (sin Territorio, sin niveles, sin serieTemporal.ts) — mismo
// criterio que familia4.ts es paralelo a resolverIndicadorFontana.
//
// `tieneSerieInternacional` es SEPARADA de `tieneSerie` (que se queda
// geográfica) para no contaminar el dispatcher / la ruta geográficos con
// ids F4. Las superficies que exponen la bandera al modelo devuelven
// `tieneSerie(id) || tieneSerieInternacional(id)`.
//
// 2026-09-06 — Fase 1: F4-2 (Gini, tramo comparable 2016-2024) + F4-3 (IDH)
// + F4-9/F4-10/F4-11 (confianza institucional, Latinobarómetro vía
// CEPALSTAT). Fases 2/3: F4-7 (Transparencia Intl), F4-1/F4-4/F4-5 (Banco
// Mundial). Fuera: F4-8 (RSF, "quiebre 2022" sin confirmar), F4-6 (EIU).

export type FuenteSerieF4Id = "cepalstat" | "pnud_hdr" | "banco_mundial" | "transparency";

export interface ConfigSerieF4 {
  fuenteId: FuenteSerieF4Id;
  // Año mínimo a mostrar. F4-2: 2016 — CEPAL marca con sus propias
  // footnotes (12429 "comparable hasta 2014" / 12428 "comparable desde
  // 2016") que las cifras hasta 2014 no son comparables con las
  // posteriores. Se muestra SOLO el tramo comparable, nunca empalmado.
  anioMinimo?: number;
  // Nota de tarjeta (visible SIEMPRE en el Canvas, no solo narrada) —
  // explica una limitación estructural del dato. F4-2: por qué se
  // excluye el tramo pre-2016.
  notaTarjeta?: string;
}

export const SERIES_INTERNACIONALES_DISPONIBLES: Record<string, ConfigSerieF4> = {
  "F4-2": {
    fuenteId: "cepalstat",
    anioMinimo: 2016,
    notaTarjeta:
      "Solo se muestra la serie comparable desde 2016 (5 puntos, 2016-2024). CEPAL rehízo la medición del ingreso de los hogares a partir de 2016 y marca explícitamente que las cifras hasta 2014 no son comparables con las posteriores — por eso el tramo anterior se omite en vez de empalmarlo.",
  },
  "F4-3": { fuenteId: "pnud_hdr" },
  // F4-7 (CPI, Transparencia Intl) — 2026-09-07. Serie 2012-2024 completa,
  // hoja "CPI Historical" del mismo workbook que la celda. Sin anioMinimo
  // ni nota de tramo: TODO el rango publicado es comparable (la revisión
  // metodológica de TI de 2012 es justo lo que define el inicio de la
  // serie; no hay quiebre interno). Ver transparencyInternational.ts.
  "F4-7": { fuenteId: "transparency" },
  "F4-9": { fuenteId: "cepalstat" },
  "F4-10": { fuenteId: "cepalstat" },
  "F4-11": { fuenteId: "cepalstat" },
  // Fase 3 (aún sin resolver de serie — el config se completa cuando se
  // implementen):
  // "F4-1": { fuenteId: "banco_mundial" },
  // "F4-4": { fuenteId: "banco_mundial" },
  // "F4-5": { fuenteId: "banco_mundial" },
};

export function tieneSerieInternacional(indicadorId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SERIES_INTERNACIONALES_DISPONIBLES, indicadorId);
}
