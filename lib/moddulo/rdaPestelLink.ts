// lib/moddulo/rdaPestelLink.ts
// Vinculación RDA↔dimensión PESTEL: qué criterios de suficiencia de F1
// afectan qué dimensiones del escaneo PESTEL de F2. Es una función pura del
// criterioId — no se persiste en el RDAItem, se calcula al mostrar el RDA
// heredado en F2 (ver rdaPestelLink.test / uso en exploracion/page.tsx).
//
// Contenido confirmado por Raúl (26-07-19): 6 de los 10 criterios de F1
// quedan deliberadamente sin vínculo (`[]`) — son criterios de consistencia
// interna del proyecto o de calibración global del escaneo (el hito y la
// escala afectan la resolución de las 6 dimensiones, no una en particular),
// no de una dimensión PESTEL específica. No es un vacío pendiente de
// completar — es la decisión final.

import type { DimensionCode } from "@/lib/moddulo/dimensionPriority";

// Claves = CriterioSuficiencia.id (F1) como string, mismos ids que
// lib/moddulo/criterios.ts.
export const RDA_PESTEL_LINK: Record<string, DimensionCode[]> = {
  "1": [], // Coherencia XPCTO
  "2": [], // Viabilidad del hito
  "3": ["E", "T"], // Suficiencia de capacidades (Económico + Tecnológico: incluye capacidad logística/digital — plataformas de redes sociales, sitio web, ecosistema digital del proyecto)
  "4": ["P", "L"], // Realismo temporal (calendario político + restricciones legales)
  "5": ["P"], // Solidez del propósito (resiliencia frente a adversidad política)
  "6": ["S", "P"], // Legitimidad del sujeto (imagen social + posicionamiento político)
  "7": [], // Consistencia con el universo
  "8": [], // Claridad de escala
  "9": [], // Criterio de integridad
  "10": [], // Aprobación del usuario
};

/**
 * Resuelve las dimensiones PESTEL vinculadas a un criterio de F1.
 * @param criterioId - id del CriterioSuficiencia (F1), como string.
 * @returns Dimensiones vinculadas, o [] si no aplica ninguna.
 */
export function getVinculacionPESTEL(criterioId: string | undefined): DimensionCode[] {
  if (!criterioId) return [];
  return RDA_PESTEL_LINK[criterioId] ?? [];
}
