// lib/moddulo/asignacionLabel.ts
// Derivación única de la etiqueta visible de una asignación a partir de su
// `canal` — reemplaza el uso de `tipo` (primaria/complementaria, dato
// interno de M1 sin significado para el usuario) como fuente de la
// etiqueta. Un solo lugar para esta derivación, usado por el Tablero
// (F3TareasPIP.tsx), el sidebar de Cobertura, el RDA (nota de
// desactivación) y el reporte descargable — mismo criterio que
// NOMBRES_COMERCIALES/FAMILIA_METODOLOGICA_POR_TECNICA en types/f3.types.ts.

import { NOMBRES_COMERCIALES } from "@/types/f3.types";
import type { AsignacionCanal } from "@/types/moddulo.types";

type AsignacionParaEtiqueta = Pick<AsignacionCanal, "canal" | "tecnicaId">;

/** Nombre corto de la vía, sin prefijo — ej. "Radar", "Carga manual". */
export function asignacionNombreCorto(a: AsignacionParaEtiqueta): string {
  if (a.canal === "canal1") return a.tecnicaId ? NOMBRES_COMERCIALES[a.tecnicaId] : "App del ecosistema";
  if (a.canal === "canal2") return "Carga manual";
  return "Herramienta externa";
}

/** Etiqueta completa para el Tablero (M1) y el reporte descargable — ej. "App: Radar", "Acción a realizar: Carga manual". */
export function asignacionEtiquetaCompleta(a: AsignacionParaEtiqueta): string {
  return a.canal === "canal1"
    ? `App: ${asignacionNombreCorto(a)}`
    : `Acción a realizar: ${asignacionNombreCorto(a)}`;
}

/** Prefijo corto para el sidebar de Cobertura — "App:" o "Acción:". */
export function asignacionPrefijoCorto(a: AsignacionParaEtiqueta): string {
  return a.canal === "canal1" ? "App:" : "Acción:";
}
