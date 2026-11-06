// lib/centinela/pestel/ultimoAnalisis.ts
// T7 C1: UNA regla para «¿cuál es el último análisis de un proyecto PESTEL?». Antes estaba copiada en
// `latest-analysis/route.ts` y en `link-moddulo/route.ts` (la página `analisis/page.tsx` no la calcula: consume
// `latest-analysis`). Es la regla de siempre, copiada literalmente (refactor SIN cambio de comportamiento):
//   1. el pool son los análisis con `vigente !== false` (un `vigente` ausente cuenta como vigente);
//      si no hay ninguno, el pool son todos;
//   2. se ordena de más reciente a más antiguo por `analyzedAt` y gana el primero. El orden es estable: en un
//      empate gana el que llegó primero. Una fecha ausente vale 0; una ilegible da NaN, que el comparador
//      trata como empate (se conserva tal cual: es el comportamiento vigente, no una decisión nueva).
// Puro: sin firebase, sin lecturas.

export interface DatosEleccionAnalisis {
  vigente?: boolean;
  analyzedAt?: unknown;
}

/** Segundos de `analyzedAt` tal como llega de Firestore ({_seconds}) o guardado como texto. */
export function segundosDeAnalisis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && "_seconds" in (v as object)) return (v as { _seconds: number })._seconds;
  return new Date(v as string).getTime() / 1000;
}

/**
 * Elige el último análisis. `leer` extrae `vigente` y `analyzedAt` de cada elemento (un documento de
 * Firestore, un objeto plano…). Devuelve el elemento elegido o null si no hay ninguno. No modifica `items`.
 */
export function elegirUltimoAnalisis<T>(items: readonly T[], leer: (item: T) => DatosEleccionAnalisis): T | null {
  if (items.length === 0) return null;
  const vigentes = items.filter((i) => leer(i).vigente !== false);
  const pool = vigentes.length > 0 ? vigentes : [...items];
  pool.sort((a, b) => segundosDeAnalisis(leer(b).analyzedAt) - segundosDeAnalisis(leer(a).analyzedAt));
  return pool[0];
}
