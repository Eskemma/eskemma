import type { XPCTO, Dictamen, CriterioSuficiencia, RDAItem } from "@/types/moddulo.types";

const PLACEHOLDER_PATTERNS = /^(prueba|test|ejemplo|n\/a|na|xxx|tbd|pendiente|placeholder)$/i;

function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.test(value.trim());
}

function allCrucesCoherentes(dictamen: Dictamen | null | undefined): boolean {
  if (!dictamen?.cruces?.length) return false;
  return dictamen.cruces.every((c) => c.veredicto === "coherente");
}

function tipoConsistente(dictamen: Dictamen | null | undefined): boolean {
  if (!dictamen?.cruces?.length) return false;
  const cruceTipo = dictamen.cruces.find((c) => c.id === 5);
  return cruceTipo?.veredicto === "coherente";
}

// Catálogo único de metadata estática de los 10 criterios de suficiencia
// de F1 — nombre, nivel, descripción de la deficiencia y ruta de
// resolución. Única fuente de verdad: evaluarCriterios() y
// getCriterioF1()/getCriterioDeficiencia() leen de aquí, para que una
// corrección de redacción no requiera tocar dos lugares ni quede
// desincronizada entre la evaluación en vivo y el texto persistido en
// RDAItem (ver lib/moddulo/rda.ts, getDisplayTextForRDAItem).
const CRITERIOS_F1: Record<number, {
  nombre: string;
  nivel: "Prioritario" | "Con advertencia";
  descripcion: string;
  rutaResolucion: string;
}> = {
  1: {
    nombre: "Coherencia XPCTO",
    nivel: "Prioritario",
    descripcion: "Existen cruces de validación XPCTO con veredicto 'requiere_ajuste'.",
    rutaResolucion: "Revisa el Dictamen de Coherencia XPCTO y ajusta las variables señaladas.",
  },
  2: {
    nombre: "Viabilidad del hito",
    nivel: "Prioritario",
    descripcion: "El hito no tiene fecha límite definida.",
    rutaResolucion: "Define la fecha inamovible del proyecto en el campo T del formulario XPCTO.",
  },
  3: {
    nombre: "Suficiencia de capacidades",
    nivel: "Prioritario",
    descripcion: "Una o más dimensiones de capacidades están insuficientemente descritas.",
    rutaResolucion: "Completa los campos Financiero, Humano y Logístico con al menos 10 caracteres cada uno.",
  },
  4: {
    nombre: "Realismo temporal",
    nivel: "Con advertencia",
    descripcion: "El horizonte temporal es menor a 2 meses.",
    rutaResolucion: "Verifica la fecha límite o ajusta el alcance del hito para un horizonte más realista.",
  },
  5: {
    nombre: "Solidez del propósito",
    nivel: "Prioritario",
    descripcion: "La justificación estratégica es demasiado breve.",
    rutaResolucion: "Amplía el campo O (propósito superior) explicando por qué este proyecto es éticamente necesario.",
  },
  6: {
    nombre: "Legitimidad del sujeto",
    nivel: "Con advertencia",
    descripcion: "La descripción del sujeto político es insuficiente.",
    rutaResolucion: "Amplía el campo P con al menos 10 caracteres describiendo al actor político del proyecto.",
  },
  7: {
    nombre: "Consistencia con el universo",
    nivel: "Prioritario",
    descripcion: "Las variables XPCTO no son consistentes con el tipo de proyecto seleccionado.",
    rutaResolucion: "Revisa el cruce 5 del Dictamen y ajusta las variables para que sean coherentes con el tipo de proyecto.",
  },
  8: {
    nombre: "Claridad de escala",
    nivel: "Prioritario",
    descripcion: "El hito (X) está poco definido en términos de escala.",
    rutaResolucion: "Reescribe el hito con al menos 20 caracteres especificando el resultado concreto e inamovible.",
  },
  9: {
    nombre: "Criterio de integridad",
    nivel: "Con advertencia",
    descripcion: "Uno o más campos contienen texto de marcador de posición (placeholder).",
    rutaResolucion: "Reemplaza los textos genéricos (prueba, N/A, TBD, etc.) con información real del proyecto.",
  },
  10: {
    nombre: "Aprobación explícita del usuario",
    nivel: "Prioritario",
    descripcion: "El usuario aún no ha cerrado formalmente la Fase 1.",
    rutaResolucion: "Haz clic en 'Cerrar Fase 1' para aprobar el Reporte F1 - Propósito y avanzar a la Exploración.",
  },
};

/**
 * Evaluates the 10 F1 sufficiency criteria deterministically.
 * @param xpcto - XPCTO form data (may be partial)
 * @param dictamen - AI-generated coherence dictamen (may be null)
 * @param faseYaCerrada - true if phase is already marked completed in Firestore
 */
export function evaluarCriterios(
  xpcto: Partial<XPCTO> | null | undefined,
  dictamen: Dictamen | null | undefined,
  faseYaCerrada: boolean
): CriterioSuficiencia[] {
  const x = xpcto ?? {};
  const cap = x.capacidades ?? { financiero: "", humano: "", logistico: "" };
  const tiempo = x.tiempo ?? { fechaLimite: "", duracionMeses: 0 };

  const capFields = [cap.financiero ?? "", cap.humano ?? "", cap.logistico ?? ""];
  const capSuficiente = capFields.every((f) => f.trim().length > 10);

  const estados: Record<number, CriterioSuficiencia["estado"]> = {
    1: allCrucesCoherentes(dictamen) ? "resuelto" : "pendiente",
    2: tiempo.fechaLimite?.trim() ? "resuelto" : "pendiente",
    3: capSuficiente ? "resuelto" : "pendiente",
    4: (tiempo.duracionMeses ?? 0) >= 2 ? "resuelto" : "pendiente",
    5: (x.justificacion ?? "").trim().length > 30 ? "resuelto" : "pendiente",
    6: (x.sujeto ?? "").trim().length > 10 ? "resuelto" : "pendiente",
    7: tipoConsistente(dictamen) ? "resuelto" : "pendiente",
    8: (x.hito ?? "").trim().length > 20 ? "resuelto" : "pendiente",
    9: !capFields.some(hasPlaceholder) && !hasPlaceholder(x.hito ?? "") ? "resuelto" : "pendiente",
    10: faseYaCerrada ? "resuelto" : "pendiente",
  };

  return Object.entries(CRITERIOS_F1).map(([idStr, meta]) => {
    const id = Number(idStr);
    return { id, nombre: meta.nombre, nivel: meta.nivel, estado: estados[id] };
  });
}

/**
 * Metadata estática de un criterio F1 por id, o undefined si no existe
 * (permite distinguir "id desconocido" de un fallback silencioso — usado
 * por getDisplayTextForRDAItem para resolver texto en vivo con fallback
 * al valor persistido).
 */
export function getCriterioF1(id: number): (typeof CRITERIOS_F1)[number] | undefined {
  return CRITERIOS_F1[id];
}

export function getCriterioDeficiencia(id: number) {
  const c = getCriterioF1(id);
  return c
    ? { descripcion: c.descripcion, rutaResolucion: c.rutaResolucion }
    : { descripcion: "Deficiencia no definida.", rutaResolucion: "Consulta con tu asesor." };
}

/**
 * Convierte un CriterioSuficiencia pendiente al esquema unificado RDAItem.
 * Pura — no escribe nada; fechaCreacion se agrega en el punto de escritura
 * (complete-phase) con FieldValue.serverTimestamp().
 */
export function criterioToRDAItem(c: CriterioSuficiencia): Omit<RDAItem, "fechaCreacion"> {
  const def = getCriterioDeficiencia(c.id);
  return {
    id: `proposito:${c.id}`,
    faseOrigen: "proposito",
    origenMecanismo: "criterio_suficiencia",
    criterioId: String(c.id),
    nombre: c.nombre,
    descripcion: def.descripcion,
    nivelImpacto: c.nivel === "Prioritario" ? "prioritario" : "advertencia",
    recomendacion: def.rutaResolucion,
    estado: "activo",
  };
}
