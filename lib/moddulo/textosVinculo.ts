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

/**
 * T5b: el import (automático al volver de Centinela, «Vincular de nuevo» o el modal de confirmación) fue rechazado
 * porque el proyecto de Centinela de ese análisis YA está vinculado a OTRO Moddulo. El control que nombra existe en
 * `ModduloButton` (rama vinculado) del análisis en Centinela. El texto del servidor (`pestel_already_linked`) NO cambia:
 * lo comparte `link-moddulo`; este se mapea en el cliente. Sin la frase «No se importó nada.» (la agrega quien lo muestra).
 */
export const MENSAJE_F2_IMPORT_YA_VINCULADO =
  "Ese análisis de Centinela ya está vinculado a otro proyecto de Moddulo. Ve a Centinela y usa «Regresar a Moddulo F2 con resultados» para ir al proyecto al que sí está vinculado.";

/**
 * T5b: el import fue rechazado porque ESTE Moddulo ya tiene un análisis de Centinela en preparación (pendiente). El
 * control existe en esta misma pantalla: «Cancelar vínculo pendiente» (franja del panel «Análisis PESTEL» y su menú).
 */
export const MENSAJE_F2_IMPORT_CON_PENDIENTE =
  "Este proyecto ya tiene un análisis de Centinela en preparación. Usa «Cancelar vínculo pendiente», en el panel «Análisis PESTEL», si quieres importar otro.";

// ── T7 C2: el gate de origen (H-P1). Las frases que dicen QUÉ control resuelve cada razón. Los controles existen:
// «Finalizar interpretación» y «Marcar como revisado» están en Interpretación (Centinela); «Regresar a Moddulo F2 con
// resultados» es el botón de Centinela con el proyecto ya vinculado. El armado con fechas y conteos reales está en
// `lib/centinela/pestel/textosOrigen.ts`; aquí viven las frases fijas, sin huecos y sin remitir a soporte.

/** El análisis todavía no está aprobado en Centinela. */
export const MENSAJE_ORIGEN_NO_APROBADO =
  "Este análisis todavía no está aprobado en Centinela. Puedes aprobarlo en Interpretación con «Finalizar interpretación».";

/** Hay UNA alerta de sesgo sin revisar. */
export const MENSAJE_ORIGEN_UN_SESGO =
  "Tiene 1 alerta de sesgo sin revisar. Puedes revisarla en Interpretación con «Marcar como revisado».";

/** Hay varias alertas de sesgo sin revisar (`n` ≥ 2, el conteo real). */
export const mensajeOrigenSesgos = (n: number): string =>
  `Tiene ${n} alertas de sesgo sin revisar. Puedes revisarlas en Interpretación con «Marcar como revisado».`;

/** Camino para usar el análisis vigente en lugar del que no lo es. */
export const CAMINO_ORIGEN_VIGENTE =
  "Para usar el vigente, ábrelo en Centinela y usa «Regresar a Moddulo F2 con resultados».";
