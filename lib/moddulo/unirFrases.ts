// lib/moddulo/unirFrases.ts
// T7 C3b: junta una frase que viene del servidor (puede no terminar en puntuación, p. ej. «No autorizado») con la frase
// fija que la completa, sin dejar dos frases pegadas («No autorizado No se importó nada.»). Pura.

/** ¿Termina en un signo que cierra la frase (`.`, `!`, `?`, `…`, con cierres como `»` `)` `"` detrás)? */
function terminaEnPuntuacion(s: string): boolean {
  return /[.!?…][»)"'\]]*$/.test(s.trimEnd());
}

/** `base` + espacio + `cola`; si `base` no cierra con puntuación se le agrega un punto. `base` vacía devuelve solo la cola. */
export function unirFrases(base: string, cola: string): string {
  const b = base.trim();
  if (!b) return cola;
  return `${terminaEnPuntuacion(b) ? b : `${b}.`} ${cola}`;
}
