// lib/centinela/pestel/destinoTrasCrear.ts
// Decisión pura del asistente «Nuevo proyecto» (app/centinela/pestel/nuevo) tras POST /pestel/project.
//
// El POST responde 201 cuando CREA un proyecto y 200 cuando el dedup devuelve un PESTEL que ya estaba
// vinculado al Moddulo de origen. Con 200 el proyecto ya tiene sus variables (E3) y quizá un análisis:
// escribir de nuevo PUT /variables reemplazaría el documento completo `pestel_variable_configs/{id}`
// con lo que el usuario acaba de elegir en el asistente, dejando el análisis existente calculado con
// otras variables. En ese caso se abre el proyecto existente y se le dice al usuario, con un aviso
// `?aviso=<código>` de lista cerrada (el valor de la URL nunca se pinta).

import { MENSAJE_FASE_CERRADA_REEMPLAZO } from "@/lib/moddulo/guardadoHonesto";

export type PlanTrasCrear = {
  /** Solo un proyecto recién creado (201) recibe las variables del asistente. */
  guardarVariables: boolean;
  /** Código del aviso a mostrar en la pantalla de destino; null si no hay. */
  aviso: CodigoAvisoAsistente | null;
};

export const AVISOS_ASISTENTE = {
  // T5: con el vínculo pendiente el PESTEL existente puede no tener aún ningún análisis, así que el texto ya no lo afirma.
  pestel_existente:
    "Este proyecto ya tenía un proyecto de Centinela vinculado; se abrió ese. Las variables que elegiste no se guardaron.",
} as const;
export type CodigoAvisoAsistente = keyof typeof AVISOS_ASISTENTE;

export function planTrasCrearProyecto(status: number): PlanTrasCrear {
  const creado = status === 201;
  // Cualquier otro código (200 de dedup u otro) abre lo que hay sin escribir y lo avisa.
  return { guardarVariables: creado, aviso: creado ? null : "pestel_existente" };
}

/** Texto fijo del código; null para cualquier valor que no esté en la lista cerrada. */
export function mensajeDeAvisoAsistente(codigo: string | null | undefined): string | null {
  if (typeof codigo !== "string") return null;
  return Object.prototype.hasOwnProperty.call(AVISOS_ASISTENTE, codigo)
    ? AVISOS_ASISTENTE[codigo as CodigoAvisoAsistente]
    : null;
}

/** Misma convención del resto de la app: desde la etapa 5 hay análisis que ver; antes, datos. */
export function rutaProyectoExistente(
  projectId: string,
  currentStage: unknown,
  aviso: CodigoAvisoAsistente | null = null
): string {
  const etapa = typeof currentStage === "number" ? currentStage : 0;
  const base = `/centinela/pestel/${projectId}/${etapa >= 5 ? "analisis" : "datos"}`;
  return aviso ? `${base}?aviso=${aviso}` : base;
}

/**
 * T5: texto de un rechazo de `POST /pestel/project` (ya no hay modal de reemplazo). Se muestra en el error del
 * asistente; cada texto nombra un camino que existe en la pantalla de Moddulo F2.
 */
export function textoRechazoCrear(status: number, cuerpo: { error?: string; message?: string }): string {
  if (status === 409 && cuerpo.error === "fase_cerrada") return MENSAJE_FASE_CERRADA_REEMPLAZO;
  if (cuerpo.message && /\s/.test(cuerpo.message)) return cuerpo.message;
  if (status === 404) return "No se encontró el proyecto de Moddulo; puede que ya no exista.";
  return "No se pudo crear el proyecto. Intenta de nuevo.";
}
