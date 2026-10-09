// Muestras que la guía de navegador del commit 4 (H-M3) pide sembrar a mano en
// `phases.investigacion` de un proyecto DESECHABLE. Las pruebas usan exactamente
// estas muestras, para que la guía no falle por un campo mal escrito.
export const SIEMBRA_SINTESIS = {
  convergencias: [], contradicciones: [], vaciosResiduales: [],
  fodaPropioInsumo: { fortalezas: [], oportunidades: [], debilidades: [], amenazas: [] },
  fodaAdversariosInsumo: {},
};
export const SIEMBRA_VEREDICTO = {
  resultado: "ajustada", contraste: "c", argumentacion: "a", premisaResultante: "p", aprobadoPorUsuario: false,
};
export const SIEMBRA_DIE = {
  sintesisPorDimension: SIEMBRA_SINTESIS,
  tableroTareasPIP: [],
  veredictoHEI: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true },
};
