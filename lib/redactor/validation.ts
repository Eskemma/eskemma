// lib/redactor/validation.ts

import type { RedactorInput, PublicoObjetivo, TonoMensaje } from "@/types/redactor.types";

/**
 * ============================================
 * VALIDACIÓN DE INPUTS
 * ============================================
 */

/**
 * Opciones válidas de público objetivo
 */
export const PUBLICO_OPTIONS: { value: PublicoObjetivo; label: string }[] = [
  { value: "jovenes", label: "Jóvenes (18-29 años)" },
  { value: "adultos", label: "Adultos (30-54 años)" },
  { value: "adultos-mayores", label: "Adultos mayores (55+ años)" },
  { value: "mujeres", label: "Mujeres" },
  { value: "comunidad-rural", label: "Comunidad rural" },
  { value: "comunidad-urbana", label: "Comunidad urbana" },
  { value: "empresarios", label: "Empresarios" },
  { value: "trabajadores", label: "Trabajadores" },
  { value: "general", label: "Audiencia general" },
];

/**
 * Opciones válidas de tono
 */
export const TONO_OPTIONS: { value: TonoMensaje; label: string }[] = [
  { value: "profesional", label: "Profesional" },
  { value: "cercano", label: "Cercano" },
  { value: "inspirador", label: "Inspirador" },
  { value: "combativo", label: "Combativo" },
  { value: "tecnico", label: "Técnico" },
  { value: "emotivo", label: "Emotivo" },
];

/**
 * Límites de caracteres para tema
 */
export const TEMA_MIN_LENGTH = 10;
export const TEMA_MAX_LENGTH = 200;

/**
 * Límites de caracteres para posts
 */
export const POST_MIN_LENGTH = 200;
export const POST_MAX_LENGTH = 280;

/**
 * Patrones peligrosos (prompt injection)
 */
const DANGEROUS_PATTERNS = [
  /ignore\s+(previous|all)\s+instructions?/i,
  /system\s*:?\s*you\s+are/i,
  /forget\s+(everything|all)\s+(you|your)/i,
  /new\s+instructions?/i,
  /override\s+(previous|system)/i,
  /\[SYSTEM\]/i,
  /\[ADMIN\]/i,
  /<script>/i,
  /<iframe>/i,
];

/**
 * Errores de validación
 */
export interface ValidationError {
  field: "tema" | "publico" | "tono";
  message: string;
}

/**
 * Resultado de validación
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedInput?: RedactorInput;
}

/**
 * Valida el input completo del usuario
 */
export function validateRedactorInput(input: Partial<RedactorInput>): ValidationResult {
  const errors: ValidationError[] = [];

  // Validar tema
  if (!input.tema) {
    errors.push({
      field: "tema",
      message: "El tema es obligatorio",
    });
  } else if (input.tema.trim().length < TEMA_MIN_LENGTH) {
    errors.push({
      field: "tema",
      message: `El tema debe tener al menos ${TEMA_MIN_LENGTH} caracteres`,
    });
  } else if (input.tema.length > TEMA_MAX_LENGTH) {
    errors.push({
      field: "tema",
      message: `El tema no puede exceder ${TEMA_MAX_LENGTH} caracteres`,
    });
  } else if (containsDangerousPattern(input.tema)) {
    errors.push({
      field: "tema",
      message: "El tema contiene caracteres o patrones no permitidos",
    });
  }

  // Validar público
  if (!input.publico) {
    errors.push({
      field: "publico",
      message: "Debes seleccionar un público objetivo",
    });
  } else if (!PUBLICO_OPTIONS.find((opt) => opt.value === input.publico)) {
    errors.push({
      field: "publico",
      message: "Público objetivo no válido",
    });
  }

  // Validar tono
  if (!input.tono) {
    errors.push({
      field: "tono",
      message: "Debes seleccionar un tono",
    });
  } else if (!TONO_OPTIONS.find((opt) => opt.value === input.tono)) {
    errors.push({
      field: "tono",
      message: "Tono no válido",
    });
  }

  // Si hay errores, retornar inválido
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  // Sanitizar input
  const sanitizedInput: RedactorInput = {
    tema: sanitizeText(input.tema!),
    publico: input.publico!,
    tono: input.tono!,
  };

  return {
    isValid: true,
    errors: [],
    sanitizedInput,
  };
}

/**
 * Detecta patrones peligrosos (prompt injection)
 */
function containsDangerousPattern(text: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Sanitiza texto eliminando caracteres peligrosos
 */
function sanitizeText(text: string): string {
  return text
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, "") // Eliminar scripts
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "") // Eliminar iframes
    .replace(/[<>]/g, ""); // Eliminar < y >
}

/**
 * Cuenta caracteres de un texto (para contador en tiempo real)
 */
export function countCharacters(text: string): number {
  return text.trim().length;
}

/**
 * Verifica si un texto está dentro del límite de caracteres para posts
 */
export function isWithinPostLimit(text: string): boolean {
  const length = countCharacters(text);
  return length >= POST_MIN_LENGTH && length <= POST_MAX_LENGTH;
}

/**
 * Obtiene el color del contador según el número de caracteres
 */
export function getCounterColor(count: number): string {
  if (count < POST_MIN_LENGTH) {
    return "text-red-eske-60 dark:text-red-eske-20"; // Muy corto
  } else if (count >= POST_MIN_LENGTH && count <= POST_MAX_LENGTH) {
    return "text-green-eske-60 dark:text-green-eske-30"; // Perfecto
  } else {
    return "text-red-eske-60 dark:text-red-eske-20"; // Muy largo
  }
}
