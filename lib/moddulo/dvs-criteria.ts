// lib/moddulo/dvs-criteria.ts
// Los 10 criterios de suficiencia del DVS F2, en el orden canónico de la metodología.

import type { DVSF2, MapaPESTEL, ProjectType, RDAItem } from "@/types/moddulo.types";
import { DIMENSION_PRIORITY_BY_TYPE, type DimensionCode } from "@/lib/moddulo/dimensionPriority";

export interface CriterioDVS {
  id: string;
  descripcion: string;
  satisfecho: boolean;
  severidad: "bloqueante" | "advertencia";
}

// Rutas de resolución por criterio — mismo patrón que DEFICIENCIAS en
// lib/moddulo/criterios.ts (F1). Las claves deben coincidir exactamente con
// los `id` usados en evaluarCriteriosDVS más abajo. Los criterios 1, 8 y 9 no están aquí: su texto depende del origen
// del análisis (ver recomendacionDependienteDelOrigen).
const RECOMENDACIONES_DVS: Record<string, string> = {
  "contraste-xpcto":
    "Revisa el motor M2 y confirma que las 5 variables del XPCTO (Hito, Sujeto, Capacidades, Tiempo, Justificación) tengan un veredicto explícito (Coherente / Requiere ajuste / Requiere investigación). Completa o aprueba cualquier variable pendiente.",
  "semaforo-veto":
    "Revisa el motor M3 y confirma que cada actor de veto tenga su nivel de riesgo asignado y, si aplica, la necesidad de investigación que genera. Agrega actores faltantes o completa los que estén incompletos.",
  "mapa-incertidumbres":
    "Revisa el motor M4 y confirma que cada incertidumbre tenga clasificadas ambas dimensiones (Urgencia y Resolución) y su destino (F3 o Sistema de Investigación Permanente).",
  "hei-clara":
    "Revisa el motor M5 (Hipótesis + PIP) y confirma que la Hipótesis Estratégica Inicial (HEI) incluya tensión central, contexto, condiciones favorables/adversas y una premisa estratégica clara y auditable.",
  "pip-completo":
    "Revisa el Programa de Investigación Profunda (PIP) dentro del motor M5 (Hipótesis + PIP) y confirma que cada necesidad de información tenga definido qué se investigará, por qué, con qué método, con qué profundidad y en qué orden.",
  "especificidad-escaneo":
    "Revisa las narrativas del Análisis PESTEL y confirma que estén redactadas en función del proyecto y territorio específicos (mencionando al sujeto, hito o territorio), no como un análisis genérico del entorno.",
  "aprobacion-usuario":
    "Revisa y aprueba explícitamente cada uno de los motores M2 a M5 antes de cerrar la Fase 2 y avanzar a Investigación (F3).",
};

// Descripciones de los 10 criterios — única fuente de verdad, referenciada
// por evaluarCriteriosDVS() y por getCriterioDVSDescripcion() (usado para
// resolver texto en vivo en RDAItem, ver lib/moddulo/rda.ts). Las claves
// deben coincidir exactamente con los `id` usados abajo.
const CRITERIO_DVS_DESCRIPCIONES: Record<string, string> = {
  "cobertura-pestl":
    "Cobertura PESTEL — ¿El escaneo cubre las 6 dimensiones con señales favorables, adversas e inciertas?",
  "contraste-xpcto":
    "Contraste XPCTO-Entorno — ¿Se emite veredicto explícito sobre cada variable del XPCTO?",
  "semaforo-veto":
    "Semáforo de Veto — ¿Están identificados los actores de veto con nivel de riesgo y necesidad de información?",
  "mapa-incertidumbres":
    "Mapa de Incertidumbres — ¿Las incertidumbres están priorizadas por urgencia y resolución?",
  "hei-clara":
    "Hipótesis Estratégica Inicial (HEI) — ¿Es clara, auditable y responde a la tensión central?",
  "pip-completo":
    "Programa de Investigación Profunda (PIP) — ¿El PIP define qué, por qué, con qué método, con qué profundidad y en qué orden?",
  "especificidad-escaneo":
    "Especificidad del escaneo — ¿El PESTEL se lee en función del proyecto específico, no genéricamente?",
  "pesos-tipo-proyecto":
    "Pesos por tipo de proyecto — ¿Las dimensiones prioritarias corresponden al tipo de proyecto definido en el Propósito (F1)?",
  "trazabilidad-hallazgos":
    "Trazabilidad de hallazgos — ¿Cada señal indica fuente, fecha de corte y nivel de confianza?",
  "aprobacion-usuario":
    "Aprobación del usuario — ¿El usuario ha revisado el Reporte F2 - Exploratorio y el Programa de Investigación Profunda (PIP) y decidido continuar a F3?",
};

/**
 * Descripción estática de un criterio DVS por id, o undefined si no existe
 * — permite distinguir "id desconocido" de un fallback silencioso.
 */
export function getCriterioDVSDescripcion(id: string): string | undefined {
  return CRITERIO_DVS_DESCRIPCIONES[id];
}

export type OrigenAnalisisPESTEL = "express" | "centinela";

/** `linkedSource.kind`: everything that is not T22 (Centinela) is treated as Express. */
export function origenDeAnalisis(kind: string | null | undefined): OrigenAnalisisPESTEL {
  return kind === "T22" ? "centinela" : "express";
}

// Criteria 1, 8 and 9 look at SIGNALS and CLASSIFICATIONS of the approved analysis. The signals are not editable in
// the M1 review, so the only actions that exist are the ones below, and they depend on where the analysis came from.
// Without a known origin (items created before this field existed) the text is valid for both.
const ACCION_NUEVO_ANALISIS: Record<OrigenAnalisisPESTEL | "ambos", string> = {
  express: "genera un «Nuevo análisis» desde el panel «Análisis PESTEL»",
  centinela: "genera un análisis nuevo en Centinela y vuelve a importarlo",
  ambos:
    "si el análisis es Express, genera un «Nuevo análisis» desde el panel «Análisis PESTEL»; si viene de Centinela, genera uno nuevo allá y vuelve a importarlo",
};

const CRITERIOS_CON_ORIGEN = new Set(["cobertura-pestl", "pesos-tipo-proyecto", "trazabilidad-hallazgos"]);

function recomendacionDependienteDelOrigen(id: string, origen: OrigenAnalisisPESTEL | undefined): string | undefined {
  const accion = ACCION_NUEVO_ANALISIS[origen ?? "ambos"];
  if (id === "cobertura-pestl") {
    return `El análisis aprobado debe tener al menos una señal en cada una de las 6 dimensiones. Las señales no se editan en la revisión del análisis: ${accion}.`;
  }
  if (id === "trazabilidad-hallazgos") {
    return `Cada señal del análisis aprobado debe citar su fuente y su fecha de corte. Las señales no se editan en la revisión del análisis: ${accion}.`;
  }
  if (id === "pesos-tipo-proyecto") {
    const aceptar = "si dejaste una dimensión en Neutral a propósito, puedes aceptar esta advertencia como condición del proyecto";
    if (origen === "express") {
      return `Las dimensiones prioritarias para este tipo de proyecto deben estar clasificadas como Oportunidad o Amenaza. Puedes cambiar la clasificación en «Editar narrativas» y aprobar de nuevo, o ${accion}; ${aceptar}.`;
    }
    if (origen === "centinela") {
      return `Las dimensiones prioritarias para este tipo de proyecto deben estar clasificadas como Oportunidad o Amenaza. La clasificación de un análisis de Centinela no se edita aquí: ${accion}; ${aceptar}.`;
    }
    return `Las dimensiones prioritarias para este tipo de proyecto deben estar clasificadas como Oportunidad o Amenaza. Si el análisis es Express, puedes cambiar la clasificación en «Editar narrativas» y aprobar de nuevo; si viene de Centinela, no se edita aquí: genera uno nuevo allá y vuelve a importarlo. ${aceptar[0].toUpperCase()}${aceptar.slice(1)}.`;
  }
  return undefined;
}

/**
 * Ruta de resolución estática de un criterio DVS por id, o undefined si
 * no existe. Los criterios 1, 8 y 9 nombran la acción según el origen del análisis.
 */
export function getRecomendacionDVS(id: string, origen?: OrigenAnalisisPESTEL): string | undefined {
  return recomendacionDependienteDelOrigen(id, origen) ?? RECOMENDACIONES_DVS[id];
}

export function evaluarCriteriosDVS(
  dvs: DVSF2,
  mapaPESTEL?: MapaPESTEL,
  tipo?: ProjectType
): CriterioDVS[] {
  const DIMS = ["P", "E", "S", "T", "Ec", "L"];

  // Criterion 1: cobertura del mapaPESTEL — si está disponible, verificar señales tripartitas
  const coberturaSatisfecha = mapaPESTEL
    ? DIMS.every((code) => {
        const dim = mapaPESTEL[code as keyof typeof mapaPESTEL] as
          | { senalesFavorables?: unknown[]; senalesAdversas?: unknown[]; senalesInciertas?: unknown[] }
          | undefined;
        if (!dim) return false;
        const total =
          (dim.senalesFavorables?.length ?? 0) +
          (dim.senalesAdversas?.length ?? 0) +
          (dim.senalesInciertas?.length ?? 0);
        return total >= 1;
      })
    : dvs.contrasteXPCTO.length >= 5; // proxy cuando no hay mapaPESTEL

  return [
    // ── 1–6 y 10: bloqueantes ──────────────────────────────────────────────
    {
      id: "cobertura-pestl",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["cobertura-pestl"],
      satisfecho: coberturaSatisfecha,
      severidad: "bloqueante",
    },
    {
      id: "contraste-xpcto",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["contraste-xpcto"],
      satisfecho:
        dvs.contrasteXPCTO.length >= 5 &&
        dvs.contrasteXPCTO.every((c) => c.argumentacion.trim().length > 5),
      severidad: "bloqueante",
    },
    {
      id: "semaforo-veto",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["semaforo-veto"],
      satisfecho:
        dvs.semaforo.length >= 1 &&
        dvs.semaforo.every((a) => a.nivelRiesgo && a.capacidadVeto),
      severidad: "bloqueante",
    },
    {
      id: "mapa-incertidumbres",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["mapa-incertidumbres"],
      satisfecho:
        dvs.incertidumbres.length >= 3 &&
        dvs.incertidumbres.some((i) => i.urgencia === "alta"),
      severidad: "bloqueante",
    },
    {
      id: "hei-clara",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["hei-clara"],
      satisfecho:
        dvs.hei.tensionCentral.trim().length > 10 &&
        dvs.hei.premisaEstrategica.trim().length > 10 &&
        dvs.hei.condicionesFavorables.length >= 2 &&
        dvs.hei.condicionesAdversas.length >= 2,
      severidad: "bloqueante",
    },
    {
      id: "pip-completo",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["pip-completo"],
      satisfecho:
        dvs.pip.length >= 4 &&
        dvs.pip.every((p) => p.pregunta.trim().length > 0 && p.metodo.trim().length > 0),
      severidad: "bloqueante",
    },

    // ── 7–9: advertencias ─────────────────────────────────────────────────
    {
      id: "especificidad-escaneo",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["especificidad-escaneo"],
      // Proxy: argumentaciones con substancia (>50 chars) indican análisis situado, no genérico
      satisfecho: dvs.contrasteXPCTO.every((c) => c.argumentacion.trim().length > 50),
      severidad: "advertencia",
    },
    {
      id: "pesos-tipo-proyecto",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["pesos-tipo-proyecto"],
      // Compara contra el set EFECTIVO de prioritarias: la tabla estática
      // (DIMENSION_PRIORITY_BY_TYPE) más cualquier dimensión "de seguimiento"
      // que el M1 haya marcado escaladaPorRelevanciaLocal: true — una
      // dimensión legítimamente escalada no debe penalizarse como
      // "mal cubierta" solo por ser de seguimiento en la tabla original.
      satisfecho:
        mapaPESTEL && tipo
          ? (() => {
              const config = DIMENSION_PRIORITY_BY_TYPE[tipo];
              const prioritariasEfectivas = new Set<DimensionCode>(config.prioritarias);
              for (const dim of config.seguimiento) {
                const d = mapaPESTEL[dim as keyof MapaPESTEL] as
                  | { escaladaPorRelevanciaLocal?: boolean }
                  | undefined;
                if (d?.escaladaPorRelevanciaLocal) prioritariasEfectivas.add(dim);
              }
              return Array.from(prioritariasEfectivas).every((dim) => {
                const d = mapaPESTEL[dim as keyof MapaPESTEL] as
                  | { clasificacion?: string }
                  | undefined;
                return d?.clasificacion === "OPORTUNIDAD" || d?.clasificacion === "AMENAZA";
              });
            })()
          : dvs.contrasteXPCTO.filter((c) => c.veredicto !== "coherente").length >= 2,
      severidad: "advertencia",
    },
    {
      id: "trazabilidad-hallazgos",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["trazabilidad-hallazgos"],
      // Si hay mapaPESTEL, verificar campos de trazabilidad en señales; si no, verificar que el contraste tenga señales
      satisfecho: mapaPESTEL
        ? Object.values(mapaPESTEL).every((d) =>
            d === undefined ||
            [...(d.senalesFavorables ?? []), ...(d.senalesAdversas ?? []), ...(d.senalesInciertas ?? [])].every(
              (s) => s.fuente.trim().length > 0 && s.fechaCorte.trim().length > 0
            )
          )
        : dvs.contrasteXPCTO.every((c) => c.senalesPESTEL.length >= 1),
      severidad: "advertencia",
    },

    // ── 10: bloqueante ────────────────────────────────────────────────────
    {
      id: "aprobacion-usuario",
      descripcion: CRITERIO_DVS_DESCRIPCIONES["aprobacion-usuario"],
      // Siempre false al evaluar — se resuelve cuando el usuario hace clic en "Cerrar Fase 2"
      satisfecho: false,
      severidad: "bloqueante",
    },
  ];
}

/**
 * Convierte un CriterioDVS no satisfecho al esquema unificado RDAItem.
 * Pura — no escribe nada; fechaCreacion se agrega en el punto de escritura
 * (complete-phase) con FieldValue.serverTimestamp().
 */
export function criterioDVSToRDAItem(c: CriterioDVS, origen?: OrigenAnalisisPESTEL): Omit<RDAItem, "fechaCreacion"> {
  return {
    id: `exploracion:${c.id}`,
    faseOrigen: "exploracion",
    origenMecanismo: "criterio_suficiencia",
    criterioId: c.id,
    nombre: c.id,
    descripcion: c.descripcion,
    nivelImpacto: c.severidad === "bloqueante" ? "prioritario" : "advertencia",
    recomendacion: getRecomendacionDVS(c.id, origen) ?? "",
    ...(origen && CRITERIOS_CON_ORIGEN.has(c.id) ? { origenAnalisis: origen } : {}),
    estado: "activo",
  };
}
