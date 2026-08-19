// lib/territorio/staleness.ts
// Propagación de cambios de territorio (Ronda 12-13, 26-08-18) — Capa 1:
// primitiva genérica de detección de staleness snapshot-vs-actual. Vive
// fuera de lib/moddulo/ deliberadamente — Territorio es un concepto
// cruzado entre apps (types/shared.types.ts), no exclusivo de Moddulo.
//
// Diseño deliberado, confirmado con Raúl: NO es un motor de diff único —
// cada consumidor real (F2/PESTEL Express, Canal 3, y cualquier consumidor
// futuro de Fontana/Sefix/Sefix-AI) tiene una forma de dependencia
// distinta (valor escalar vs. re-evaluación de una decisión pasada), así
// que el "diff" real siempre lo construye el consumidor. Esta función solo
// resuelve la pregunta binaria "¿lo que tengo guardado sigue coincidiendo
// con el territorio vigente?", genérica sobre `T`.
//
// Sin registro central: un consumidor nuevo se engancha importando esta
// función y definiendo su propia extracción/snapshot/UI — cero archivos
// compartidos que tocar (misma garantía de extensibilidad que
// TipoAgregacionTerritorial, Fase 2). No importable desde functions/src/
// (misma restricción que todo lib/) — si algún consumidor de Cloud
// Functions lo necesita, se replica ahí (mismo criterio de "Lógica
// duplicada" ya tabulado en CLAUDE.md).

import type { Territorio } from "@/types/shared.types";

export interface TerritorioStalenessResult<T> {
  /** false = sin snapshot todavía (nada que evaluar) — nunca "cambio: true" en este caso. */
  evaluable: boolean;
  cambio: boolean;
  anterior: T | null;
  actual: T;
}

export function detectarTerritorioStale<T>(
  snapshotRaw: string | undefined,
  territorioActual: Territorio,
  extraerDependencia: (t: Territorio) => T
): TerritorioStalenessResult<T> {
  const actual = extraerDependencia(territorioActual);
  if (!snapshotRaw) {
    return { evaluable: false, cambio: false, anterior: null, actual };
  }
  try {
    const anterior = JSON.parse(snapshotRaw) as T;
    return {
      evaluable: true,
      cambio: JSON.stringify(anterior) !== JSON.stringify(actual),
      anterior,
      actual,
    };
  } catch {
    return { evaluable: false, cambio: false, anterior: null, actual };
  }
}

// Capa 2 (Ronda 13) — helper compartido, NO obligatorio para consumidores
// futuros (cada uno sigue libre de definir su propio `T`). Se comparte
// porque los 2 consumidores reales de hoy (generate-m1-express.ts,
// checkTerritoryMatch en linkCompatibility.ts) leen exactamente este mismo
// conjunto de 6 campos — nunca los arreglos plurales
// (municipiosPorEstado/estadosSeleccionados/distritosSeleccionados).
export interface TerritorioEscalar {
  nivel: Territorio["nivel"];
  pais: string | null;
  estado: string | null;
  municipio: string | null;
  nombre: string;
  cve_distrito: string | null;
}

export function extraerTerritorioEscalar(t: Territorio): TerritorioEscalar {
  return {
    nivel: t.nivel,
    pais: t.pais ?? null,
    estado: t.estado ?? null,
    municipio: t.municipio ?? null,
    nombre: t.nombre,
    cve_distrito: t.cve_distrito ?? null,
  };
}

// Diff campo por campo de TerritorioEscalar — mismo shape {field, from, to}
// que PropagationDiff (lib/moddulo/phasePropagation.ts) para reutilizar el
// patrón de render del banner ya existente (XPCTO), sin importar ese
// archivo (evita acoplar este módulo cross-app a algo Moddulo-específico).
export interface TerritorioFieldDiff {
  field: string;
  from: string;
  to: string;
}

const ETIQUETAS_TERRITORIO_ESCALAR: Record<keyof TerritorioEscalar, string> = {
  nivel: "Nivel territorial",
  pais: "País",
  estado: "Estado",
  municipio: "Municipio",
  nombre: "Nombre",
  cve_distrito: "Distrito",
};

export function diffTerritorioEscalar(
  anterior: TerritorioEscalar,
  actual: TerritorioEscalar
): TerritorioFieldDiff[] {
  const diffs: TerritorioFieldDiff[] = [];
  for (const key of Object.keys(ETIQUETAS_TERRITORIO_ESCALAR) as (keyof TerritorioEscalar)[]) {
    const a = anterior[key] ?? "";
    const b = actual[key] ?? "";
    if (a !== b) {
      diffs.push({ field: ETIQUETAS_TERRITORIO_ESCALAR[key], from: String(a) || "(vacío)", to: String(b) || "(vacío)" });
    }
  }
  return diffs;
}