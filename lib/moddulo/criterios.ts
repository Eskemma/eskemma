import type { XPCTO, Dictamen, CriterioSuficiencia } from "@/types/moddulo.types";

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

  return [
    {
      id: 1,
      nombre: "Coherencia XPCTO",
      nivel: "Prioritario",
      estado: allCrucesCoherentes(dictamen) ? "resuelto" : "pendiente",
    },
    {
      id: 2,
      nombre: "Viabilidad del hito",
      nivel: "Prioritario",
      estado: tiempo.fechaLimite?.trim() ? "resuelto" : "pendiente",
    },
    {
      id: 3,
      nombre: "Suficiencia de capacidades",
      nivel: "Prioritario",
      estado: capSuficiente ? "resuelto" : "pendiente",
    },
    {
      id: 4,
      nombre: "Realismo temporal",
      nivel: "Con advertencia",
      estado: (tiempo.duracionMeses ?? 0) >= 2 ? "resuelto" : "pendiente",
    },
    {
      id: 5,
      nombre: "Solidez del propósito",
      nivel: "Prioritario",
      estado: (x.justificacion ?? "").trim().length > 30 ? "resuelto" : "pendiente",
    },
    {
      id: 6,
      nombre: "Legitimidad del sujeto",
      nivel: "Con advertencia",
      estado: (x.sujeto ?? "").trim().length > 10 ? "resuelto" : "pendiente",
    },
    {
      id: 7,
      nombre: "Consistencia con el universo",
      nivel: "Prioritario",
      estado: tipoConsistente(dictamen) ? "resuelto" : "pendiente",
    },
    {
      id: 8,
      nombre: "Claridad de escala",
      nivel: "Prioritario",
      estado: (x.hito ?? "").trim().length > 20 ? "resuelto" : "pendiente",
    },
    {
      id: 9,
      nombre: "Criterio de integridad",
      nivel: "Con advertencia",
      estado: !capFields.some(hasPlaceholder) && !hasPlaceholder(x.hito ?? "") ? "resuelto" : "pendiente",
    },
    {
      id: 10,
      nombre: "Aprobación explícita del usuario",
      nivel: "Prioritario",
      estado: faseYaCerrada ? "resuelto" : "pendiente",
    },
  ];
}

const DEFICIENCIAS: Record<number, { descripcion: string; rutaResolucion: string }> = {
  1: {
    descripcion: "Existen cruces de validación XPCTO con veredicto 'requiere_ajuste'.",
    rutaResolucion: "Revisa el Dictamen de Coherencia XPCTO y ajusta las variables señaladas.",
  },
  2: {
    descripcion: "El hito no tiene fecha límite definida.",
    rutaResolucion: "Define la fecha inamovible del proyecto en el campo T del formulario XPCTO.",
  },
  3: {
    descripcion: "Una o más dimensiones de capacidades están insuficientemente descritas.",
    rutaResolucion: "Completa los campos Financiero, Humano y Logístico con al menos 10 caracteres cada uno.",
  },
  4: {
    descripcion: "El horizonte temporal es menor a 2 meses.",
    rutaResolucion: "Verifica la fecha límite o ajusta el alcance del hito para un horizonte más realista.",
  },
  5: {
    descripcion: "La justificación estratégica es demasiado breve.",
    rutaResolucion: "Amplía el campo O (propósito superior) explicando por qué este proyecto es éticamente necesario.",
  },
  6: {
    descripcion: "La descripción del sujeto político es insuficiente.",
    rutaResolucion: "Amplía el campo P con al menos 10 caracteres describiendo al actor político del proyecto.",
  },
  7: {
    descripcion: "Las variables XPCTO no son consistentes con el tipo de proyecto seleccionado.",
    rutaResolucion: "Revisa el cruce 5 del Dictamen y ajusta las variables para que sean coherentes con el tipo de proyecto.",
  },
  8: {
    descripcion: "El hito (X) está poco definido en términos de escala.",
    rutaResolucion: "Reescribe el hito con al menos 20 caracteres especificando el resultado concreto e inamovible.",
  },
  9: {
    descripcion: "Uno o más campos contienen texto de marcador de posición (placeholder).",
    rutaResolucion: "Reemplaza los textos genéricos (prueba, N/A, TBD, etc.) con información real del proyecto.",
  },
  10: {
    descripcion: "El usuario aún no ha cerrado formalmente la Fase 1.",
    rutaResolucion: "Haz clic en 'Cerrar Fase 1' para aprobar el EPP y avanzar a la Exploración.",
  },
};

export function getCriterioDeficiencia(id: number) {
  return DEFICIENCIAS[id] ?? { descripcion: "Deficiencia no definida.", rutaResolucion: "Consulta con tu asesor." };
}
