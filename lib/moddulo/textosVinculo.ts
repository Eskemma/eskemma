// lib/moddulo/textosVinculo.ts
// Textos de los rechazos de VINCULAR un análisis de Centinela a un proyecto de Moddulo (link-moddulo,
// import-pestel y el selector de Centinela). Cada uno dice qué pasó y el camino que existe en la pantalla;
// ninguno manda a pedir ayuda externa (prueba: `textosVinculo.test.ts`).
//
// Los caminos que nombran existen en `exploracion/page.tsx`: «Desvincular» (visible con un PESTEL vinculado)
// y «Regresar a Moddulo F2 con resultados» (botón de Centinela con el proyecto ya vinculado).

/** El Moddulo ya está vinculado a OTRO análisis PESTEL (T22 de otro proyecto de Centinela). */
export const MENSAJE_MODDULO_CON_OTRO_PESTEL =
  "Este proyecto de Moddulo ya usa otro análisis PESTEL. Para cambiarlo, abre la Fase 2 del proyecto y usa «Desvincular»; ahí se te muestra qué se reemplaza.";

/** El Moddulo ya tiene importada OTRA versión del análisis de este mismo PESTEL. */
export const MENSAJE_MODDULO_OTRA_VERSION =
  "Este proyecto de Moddulo ya tiene importada otra versión del análisis de este PESTEL. Para actualizarla, usa «Regresar a Moddulo F2 con resultados» desde el análisis en Centinela; en la Fase 2 se te pedirá confirmar el reemplazo.";

/** `import-pestel`: el proyecto tiene un análisis importado de otra fuente (la pantalla pide confirmar). */
export const MENSAJE_CONFLICTO_IMPORT =
  "Este proyecto ya tiene un análisis PESTEL importado de otra fuente. Se reemplazará solo si lo confirmas.";

/**
 * T5: el Moddulo ya tiene un análisis de Centinela EN PREPARACIÓN (un proyecto PESTEL que apunta a él, aún sin
 * importar) y se intentó vincular otro. «Cancelar vínculo pendiente» es el control de la Fase 2 (menú de «Análisis
 * PESTEL») cuando el proyecto está en ese estado.
 */
export const MENSAJE_MODDULO_CON_PENDIENTE =
  "Este proyecto de Moddulo ya tiene un análisis de Centinela en preparación. Abre su Fase 2 y usa «Cancelar vínculo pendiente» si quieres vincular otro.";

/** T5: `unlink-pestel` en modo pendiente: el vínculo que la pantalla creía pendiente ya no es ese. */
export const MENSAJE_PENDIENTE_CAMBIO =
  "El estado del vínculo con Centinela cambió mientras tanto. No se canceló nada: recarga la página para ver el estado actual.";

/** T5: no hay nada pendiente que cancelar (ya se canceló o nunca existió). */
export const MENSAJE_PENDIENTE_NO_ENCONTRADO =
  "Este proyecto no tiene un vínculo pendiente con Centinela. Recarga la página para ver el estado actual.";
