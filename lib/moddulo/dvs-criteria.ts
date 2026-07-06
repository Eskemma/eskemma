// lib/moddulo/dvs-criteria.ts
// Los 10 criterios de suficiencia del DVS F2, en el orden canónico de la metodología.

import type { DVSF2, MapaPESTEL } from "@/types/moddulo.types";

export interface CriterioDVS {
  id: string;
  descripcion: string;
  satisfecho: boolean;
  severidad: "bloqueante" | "advertencia";
}

export function evaluarCriteriosDVS(dvs: DVSF2, mapaPESTEL?: MapaPESTEL): CriterioDVS[] {
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
      descripcion:
        "Cobertura PESTEL — ¿El escaneo cubre las 6 dimensiones con señales favorables, adversas e inciertas?",
      satisfecho: coberturaSatisfecha,
      severidad: "bloqueante",
    },
    {
      id: "contraste-xpcto",
      descripcion:
        "Contraste XPCTO-Entorno — ¿Se emite veredicto explícito sobre cada variable del EPP?",
      satisfecho:
        dvs.contrasteXPCTO.length >= 5 &&
        dvs.contrasteXPCTO.every((c) => c.argumentacion.trim().length > 5),
      severidad: "bloqueante",
    },
    {
      id: "semaforo-veto",
      descripcion:
        "Semáforo de Veto — ¿Están identificados los actores de veto con nivel de riesgo y necesidad de información?",
      satisfecho:
        dvs.semaforo.length >= 1 &&
        dvs.semaforo.every((a) => a.nivelRiesgo && a.capacidadVeto),
      severidad: "bloqueante",
    },
    {
      id: "mapa-incertidumbres",
      descripcion:
        "Mapa de Incertidumbres — ¿Las incertidumbres están priorizadas por urgencia y resolución?",
      satisfecho:
        dvs.incertidumbres.length >= 3 &&
        dvs.incertidumbres.some((i) => i.urgencia === "alta"),
      severidad: "bloqueante",
    },
    {
      id: "hei-clara",
      descripcion:
        "Hipótesis Estratégica Inicial — ¿La HEI es clara, auditable y responde a la tensión central?",
      satisfecho:
        dvs.hei.tensionCentral.trim().length > 10 &&
        dvs.hei.premisaEstrategica.trim().length > 10 &&
        dvs.hei.condicionesFavorables.length >= 2 &&
        dvs.hei.condicionesAdversas.length >= 2,
      severidad: "bloqueante",
    },
    {
      id: "pip-completo",
      descripcion:
        "Programa de Investigación Profunda — ¿El PIP define qué, por qué, con qué método, con qué profundidad y en qué orden?",
      satisfecho:
        dvs.pip.length >= 4 &&
        dvs.pip.every((p) => p.pregunta.trim().length > 0 && p.metodo.trim().length > 0),
      severidad: "bloqueante",
    },

    // ── 7–9: advertencias ─────────────────────────────────────────────────
    {
      id: "especificidad-escaneo",
      descripcion:
        "Especificidad del escaneo — ¿El PESTEL se lee en función del proyecto específico, no genéricamente?",
      satisfecho: dvs.contrasteXPCTO.every((c) => c.senalesPESTEL.length >= 1),
      severidad: "advertencia",
    },
    {
      id: "pesos-tipo-proyecto",
      descripcion:
        "Pesos por tipo de proyecto — ¿Las dimensiones prioritarias corresponden al tipo heredado del EPP?",
      satisfecho: dvs.contrasteXPCTO.some((c) => c.veredicto === "requiere_investigacion"),
      severidad: "advertencia",
    },
    {
      id: "trazabilidad-hallazgos",
      descripcion:
        "Trazabilidad de hallazgos — ¿Cada señal indica fuente, fecha de corte y nivel de confianza?",
      satisfecho: dvs.contrasteXPCTO.every((c) => c.senalesPESTEL.length >= 1),
      severidad: "advertencia",
    },

    // ── 10: bloqueante ────────────────────────────────────────────────────
    {
      id: "aprobacion-usuario",
      descripcion:
        "Aprobación del usuario — ¿El usuario ha revisado el DVS y el PIP y decidido continuar a F3?",
      // Siempre false al evaluar — se resuelve cuando el usuario hace clic en "Cerrar Fase 2"
      satisfecho: false,
      severidad: "bloqueante",
    },
  ];
}
