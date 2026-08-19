// lib/moddulo/territorioHeuristicas.ts
// Fase 4 del rediseño de territorio (26-08-18) — "formulario inteligente":
// piso determinista (sin modelo) para sugerir un nivel territorial inicial
// a partir del nombre/descripción que el usuario ya escribió en el Paso 1
// del wizard (Moddulo y PESTEL comparten este mismo momento, ver
// TerritorySelector.tsx). Nunca decide en silencio — el nivel sugerido
// siempre queda editable, mismo criterio de todo este workstream.
//
// Sin mapa tipo→nivel: comparado con evidencia concreta (2 casos reales)
// contra pasarle `tipo` como contexto al modelo — no cambió el resultado
// en ningún caso, y de los 4 tipos de proyecto solo "gubernamental" tenía
// una exclusión real. Descartado por Raúl, 26-08-18 — `tipo` se pasa
// directo como contexto del prompt del techo con modelo (servidor), no
// como filtro mecánico aquí.

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import type { NivelTerritorial } from "@/types/pestel.types";

// Reverso de ESTADO_CVE_MAP (claves en mayúsculas sin acentos) — nombres
// reales para detectar conjunción de 2+ estados en el texto, sin
// necesitar un fetch (los 32 ya viven en memoria, mismo criterio que
// ESTADOS_MEXICO de TerritorySelector.tsx, sin duplicar esa lista aquí).
const NOMBRES_ESTADO = Object.keys(ESTADO_CVE_MAP);

function normalizar(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function contienePalabraCompleta(textoNormalizado: string, frase: string): boolean {
  return new RegExp(`\\b${frase}\\b`).test(textoNormalizado);
}

interface SenalNivel {
  patrones: string[];
  nivel: NivelTerritorial;
  esPlural?: boolean;
}

// Vocabulario administrativo/electoral específico — alta confianza, poco
// probable que aparezca en el nombre/descripción de un proyecto por otro
// motivo. Frases completas únicamente (nunca palabra suelta, mismo
// criterio que lib/fontana/pipMinimos.ts y el fallback de nombres de
// municipio de Ronda 4 — evita falsos positivos como "distrito comercial
// local" disparando "distrito_local").
//
// Alias de abreviaturas metropolitanas (ZMG/ZMVM/ZMM) — hallazgo real de
// esta ronda: la frase completa "zona metropolitana" no matcheaba el
// proyecto de referencia de toda esta sesión ("Campaña de comunicación
// Vialidad ZMG", descripción "...movilidad interregional en la ZMG").
// Solo se incluyen las 3 abreviaturas confirmadas con certeza como
// estándar en el discurso político/administrativo mexicano (Guadalajara/
// Valle de México/Monterrey) — no se agregan otras por no tener la misma
// certeza, mismo criterio de no inventar del resto del workstream.
const SENALES_NIVEL: SenalNivel[] = [
  { patrones: ["ZONA METROPOLITANA", "AREA METROPOLITANA", "ZMG", "ZMVM", "ZMM"], nivel: "municipal", esPlural: true },
  { patrones: ["DISTRITO FEDERAL", "DIPUTACION FEDERAL", "DIPUTADO FEDERAL"], nivel: "distrito_federal" },
  { patrones: ["DISTRITO LOCAL", "DIPUTACION LOCAL", "DIPUTADO LOCAL"], nivel: "distrito_local" },
  { patrones: ["ALCALDIA", "PRESIDENCIA MUNICIPAL", "AYUNTAMIENTO"], nivel: "municipal" },
  { patrones: ["GUBERNATURA", "GOBIERNO DEL ESTADO", "GOBERNADOR"], nivel: "estatal" },
  { patrones: ["SENADURIA", "SENADOR"], nivel: "nacional" },
];

export interface SenalesTextoTerritorio {
  nivel?: NivelTerritorial;
  esPlural?: boolean;
  /** Nombres de estado detectados por conjunción (2+) — solo con nivel "estatal" implícito. */
  estadosDetectados?: string[];
}

/**
 * Detecta señales deterministas de nivel territorial y pluralidad en el
 * nombre/descripción de un proyecto — sin modelo, sin red. Ausencia total
 * de señal (null) es un resultado válido y esperado, no un error: el
 * techo con modelo (servidor, Fase 4 punto c) solo se consulta en ese
 * caso, nunca aquí.
 */
export function detectarSenalesTexto(nombre: string, descripcion: string): SenalesTextoTerritorio | null {
  const texto = normalizar(`${nombre} ${descripcion}`);

  for (const senal of SENALES_NIVEL) {
    for (const patron of senal.patrones) {
      if (contienePalabraCompleta(texto, patron)) {
        return { nivel: senal.nivel, esPlural: senal.esPlural };
      }
    }
  }

  const estadosDetectados = NOMBRES_ESTADO.filter((nombreEstado) =>
    contienePalabraCompleta(texto, normalizar(nombreEstado))
  );
  if (estadosDetectados.length >= 2) {
    return { nivel: "estatal", esPlural: true, estadosDetectados };
  }

  return null;
}