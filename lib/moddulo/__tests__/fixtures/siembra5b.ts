// Muestras que la guía de navegador del commit 5b (H25) pide sembrar a mano en un proyecto
// o una sesión DESECHABLES. Las pruebas usan exactamente estas muestras (tipadas contra los
// tipos reales y leídas por el mismo código que las pinta), para que la guía no falle por un
// campo mal escrito.
import type { RDAItem } from "@/types/moddulo.types";
import type { FontanaCanvasResumen } from "@/types/fontana.types";

/**
 * Valor de `rda.<SIEMBRA_RDA_ID>` en el documento del proyecto (Firestore, consola).
 * `fechaCreacion` es un Timestamp en producción; en la consola se siembra con el tipo
 * «timestamp» (aquí se omite del tipo porque la pantalla no lo lee).
 */
export const SIEMBRA_RDA_ID = "proposito:prueba-5b";
export const SIEMBRA_RDA_ITEM: Omit<RDAItem, "fechaCreacion"> = {
  id: SIEMBRA_RDA_ID,
  faseOrigen: "proposito",
  origenMecanismo: "vacio_residual",
  nombre: "Prueba 5b — deficiencia desechable",
  descripcion: "Ítem sembrado a mano para verificar «Aceptar como condición».",
  nivelImpacto: "advertencia",
  recomendacion: "Solo para verificación; borrar al terminar.",
  estado: "activo",
};

/**
 * Elemento para agregar al arreglo `canvasItems` de una sesión de Fontana desechable
 * (la tarjeta aparece en la pestaña «Canvas - Fontana»).
 */
export const SIEMBRA_CANVAS_ITEM: FontanaCanvasResumen = {
  id: "cv-prueba-5b",
  tipo: "resumen",
  titulo: "Prueba 5b — tarjeta desechable",
  familiaId: "F1",
  creadoEn: "2026-10-11T00:00:00.000Z",
  mensajeId: "msg-prueba-5b",
  nivel: "estatal",
  filas: [{ indicadorId: "F1-1", nombre: "Población total", valor: "1,000", unidad: "personas" }],
};
