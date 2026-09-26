// lib/ui/multiSelectFiltro.ts
// Lógica PURA de PartidosMultiSelect (búsqueda y Enter), extraída para poder probarla (Paso 4c, 26-09-26).
// El componente es compartido (Sefix, TerritorySelector): aquí vive el comportamiento común.

export interface OpcionFiltrable {
  value: string;
  label: string;
}

/** Minúsculas y sin diacríticos: «mexico» encuentra «México», «tonala» encuentra «Tonalá». */
export function plegarBusqueda(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Tope de opciones que se dibujan a la vez (Oaxaca tiene 570 municipios). El resto se busca escribiendo. */
export const LIMITE_OPCIONES_VISIBLES = 100;

export function filtrarOpciones<T extends OpcionFiltrable>(
  opciones: T[],
  seleccionadas: string[],
  busqueda: string,
  limite: number = LIMITE_OPCIONES_VISIBLES
): { visibles: T[]; total: number } {
  const q = plegarBusqueda(busqueda.trim());
  const coinciden = opciones.filter((o) => !seleccionadas.includes(o.value) && plegarBusqueda(o.label).includes(q));
  return { visibles: coinciden.slice(0, limite), total: coinciden.length };
}

export interface EntradaEnter {
  /** ¿Está abierto el desplegable de opciones? */
  abierto: boolean;
  busqueda: string;
  /** Opciones que hoy coinciden con la búsqueda (ya sin las seleccionadas). */
  coincidencias: OpcionFiltrable[];
  /** Enter durante una composición IME (acentos/CJK): no debe seleccionar. */
  componiendo: boolean;
}

/**
 * Qué hace Enter dentro del campo. Antes agregaba SIEMPRE la primera opción, aunque el usuario no
 * hubiera escrito nada y el desplegable estuviera cerrado. Ahora solo agrega la primera coincidencia
 * cuando el usuario buscó algo con el desplegable abierto; nunca envía un <form> que contenga el campo.
 */
export function decidirEnter(e: EntradaEnter): { evitarEnvio: boolean; agregar: string | null } {
  if (e.componiendo) return { evitarEnvio: false, agregar: null };
  const puedeAgregar = e.abierto && e.busqueda.trim() !== "" && e.coincidencias.length > 0;
  return { evitarEnvio: true, agregar: puedeAgregar ? e.coincidencias[0].value : null };
}
