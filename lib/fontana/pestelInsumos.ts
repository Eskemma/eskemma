// lib/fontana/pestelInsumos.ts
// Mapeo curado de indicadores de Fontana por dimensión PEST-L, para la
// integración PESTEL↔Fontana (26-09-13, diseño aprobado por Raúl). Solo
// las dimensiones Económico/Social/Ecológico tienen indicadores reales de
// Fontana — Político/Tecnológico/tienen a lo sumo comparación
// internacional (F4) o un solo indicador demográfico, insuficiente para
// alimentar esas dimensiones (ver auditoría PESTEL↔Fontana↔T22, Bloque B).
// Legal es un vacío total y deliberado en Fontana — nunca se incluye aquí.
//
// Curado a mano, NO "todo indicador de la familia" — algunos indicadores
// de F1/F2/F3/F5 no aportan valor real a un factor PEST-L (ej. F1-9
// ocupantes por cuarto no es un insumo económico/social relevante para
// PESTEL) y se excluyen deliberadamente.

export type DimensionPestelConFontana = "E" | "S" | "Ec";

// Shape del insumo por indicador que devuelve
// `app/api/fontana/insumos-pestel/route.ts` — fuente única para el lado
// Next.js (Express, mismo runtime, importa este tipo directo). El lado
// Cloud Function (Controlada, `functions/src/pestel/classifier/claudePESTL.ts`)
// declara una copia espejo — `functions/` no puede importar `lib/`.
export interface InsumoFontanaSimple {
  id: string;
  nombre: string;
  tipo: "simple";
  valor: number;
  unidad?: string;
  fuenteEtiqueta?: string;
  // Vintage real del dato (26-09-13, corrección post-verificación) — NUNCA
  // inventado, extraído del texto de `fuenteEtiqueta` (ej. "CONEVAL
  // (Medición de la pobreza 2020)" → "2020"; "INEGI (ENSU 2026-T2, ...)" →
  // "2026-T2"). `undefined` cuando la fuente no publica un año/trimestre
  // reconocible en su etiqueta (ej. SESNSP/RNID, dataset corriente sin
  // vintage propio) — en ese caso la cita se hace SIN fecha, nunca con
  // una inferida. Ver `extraerPeriodoFuente` en tabla/insumosPestel.ts.
  periodo?: string;
  // Fuente OFICIAL del dato (26-09-13, 2ª corrección) — nombre de la
  // agencia (SESNSP/INEGI/CONEVAL/CONAPO/IMCO/...), extraído del texto
  // antes del primer paréntesis en `fuenteEtiqueta`. Es lo que debe
  // aparecer en la cita de la narrativa — "Fontana" es solo la app que
  // agrega y verifica estos datos ya oficiales, nunca la fuente citable.
  // Ver `extraerFuenteOficial` en tabla/insumosPestel.ts.
  fuenteOficial: string;
}
export interface InsumoFontanaSintesis {
  id: string;
  nombre: string;
  tipo: "sintesis";
  tipoCalculo?: string;
  desglose: { nombre: string; valor?: number; unidad?: string; motivo?: string }[];
  fuenteEtiqueta?: string;
  periodo?: string;
  fuenteOficial: string;
}
export interface InsumoFontanaSinDato {
  id: string;
  nombre: string;
  tipo: "sin_dato";
  motivo: string;
}
export type InsumoFontana = InsumoFontanaSimple | InsumoFontanaSintesis | InsumoFontanaSinDato;

export const INDICADORES_PESTEL_POR_DIMENSION: Record<DimensionPestelConFontana, string[]> = {
  // Económico — pobreza, marginación, ingreso, informalidad, fiscal, PIB.
  E: [
    "F2-1", "F2-2", "F2-3", "F2-4", "F2-6", "F2-9", "F2-10", "F2-12",
    "F2-17", "F2-18", "F1-17", "F4-1", "F4-5",
  ],
  // Social — demografía, seguridad/percepción, IDH, organizaciones sociales.
  S: [
    "F1-1", "F1-2", "F1-3", "F1-4", "F1-5", "F1-6", "F1-7", "F1-8",
    "F1-10", "F1-11", "F1-13", "F1-14", "F1-15", "F1-19",
    "F2-5", "F2-19", "F2-20", "F2-21", "F2-22",
    "F3-1", "F3-2", "F3-3", "F3-4", "F3-15", "F3-17",
  ],
  // Ecológico — clima y riesgos ambientales (F5).
  Ec: ["F5-2", "F5-11", "F5-12", "F5-13", "F5-14"],
};
