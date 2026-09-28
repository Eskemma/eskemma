// lib/moddulo/papelera.ts
// Papelera de proyectos de Moddulo — constante de retención compartida por la
// UI (fase b) y la futura purga programada (fase c, functions/). functions/
// no puede importar lib/ (Regla de Oro del repo) — cuando se construya la
// purga, este valor debe copiarse ahí a mano, mismo criterio que
// `functions/src/utils/country.ts` (ver "Lógica duplicada" en CLAUDE.md).
export const DIAS_RETENCION_PROYECTOS = 30;

/** Milisegundos restantes hasta que un proyecto en papelera sea purgable. Negativo = ya vencido. */
export function msRestantesEnPapelera(deletedAtMs: number, ahoraMs: number = Date.now()): number {
  return deletedAtMs + DIAS_RETENCION_PROYECTOS * 24 * 60 * 60 * 1000 - ahoraMs;
}

/** Días restantes redondeados hacia arriba (nunca negativo — un proyecto vencido muestra 0). */
export function diasRestantesEnPapelera(deletedAtMs: number, ahoraMs: number = Date.now()): number {
  const ms = msRestantesEnPapelera(deletedAtMs, ahoraMs);
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
