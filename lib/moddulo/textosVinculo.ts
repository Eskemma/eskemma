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
