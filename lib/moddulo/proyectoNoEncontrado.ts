// lib/moddulo/proyectoNoEncontrado.ts
// Regla de UX (26-09-26): cuando la API de un proyecto Moddulo responde 404 (eliminado, nunca existió o el
// usuario no colabora) las fases deben mostrar la página 404, no una pantalla «cargada» y vacía con el
// error solo en consola. La excepción es F2-Exploración: ahí un proyecto muerto no es un callejón sin
// salida —`OrphanRecoveryView` permite recuperar el análisis PESTEL que apuntaba a él (`?pest_analysis_id=`)—,
// así que el layout no debe taparla. Módulo puro (sin React/Next).

export function debeMostrarNotFound(status: number, pathname: string): boolean {
  if (status !== 404) return false;
  return !/\/exploracion(\/|$)/.test(pathname);
}
