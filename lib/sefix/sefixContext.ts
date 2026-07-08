// lib/sefix/sefixContext.ts
// Shared Sefix context builder for PEST-L analyses.
// Used by: app/api/centinela/pestel/trigger/route.ts
//          app/api/moddulo/f2/generate-m1-express/route.ts

import {
  getResultadosByEstado,
  getPadronByEstado,
  getResultadosLocalesFiltered,
} from "@/lib/sefix/storage";

// ── Types ──────────────────────────────────────────────────────

export type LocalCargoKey = "ayun" | "dip_loc" | "gob" | "junta" | "alc" | "jef_gob";
export type FederalCargoKey = "dip_fed" | "sen" | "pdte";
export type SefixCargoKey = LocalCargoKey | FederalCargoKey;

export interface SefixResultadoNorm {
  estado: string;
  cargo: string;
  anio: number;
  totalVotos: number;
  participacion: number;
  partidos: { partido: string; votos: number; porcentaje: number }[];
  fuente: string;
}

export interface SefixContextData {
  resultadosList: SefixResultadoNorm[];
  padron: unknown;
}

// ── Internal constants ─────────────────────────────────────────

const FEDERAL_CARGO_MAP: Partial<Record<SefixCargoKey, string>> = {
  dip_fed: "diputados",
  sen: "senadores",
  pdte: "presidente",
};

const CARGO_DISPLAY: Partial<Record<SefixCargoKey, string>> = {
  ayun: "AYUNTAMIENTOS",
  dip_loc: "DIPUTADOS LOCALES",
  gob: "GOBERNADOR",
  junta: "JUNTA MUNICIPAL",
  alc: "ALCALDÍAS",
  jef_gob: "JEFE DE GOBIERNO",
};

const LOCAL_YEARS_DESC = [2025, 2024, 2021, 2015];

// ── Priority table ─────────────────────────────────────────────

// Returns the 4-cargo priority list aligned to the project's electoral objective.
export function getSefixPriority(tipo: string, nivel: string): SefixCargoKey[] {
  if (tipo === "electoral") {
    if (nivel === "municipal") return ["ayun", "dip_loc", "dip_fed", "gob"];
    if (nivel === "distrital") return ["dip_loc", "ayun", "gob", "dip_fed"];
    if (nivel === "estatal") return ["gob", "dip_loc", "ayun", "dip_fed"];
    if (nivel === "federal") return ["dip_fed", "dip_loc", "pdte", "sen"];
    if (nivel === "nacional") return ["pdte", "dip_fed", "sen", "gob"];
    return ["ayun", "dip_loc", "gob", "dip_fed"];
  }
  if (tipo === "legislativo") {
    if (nivel === "federal" || nivel === "nacional") return ["dip_fed", "dip_loc", "pdte", "sen"];
    return ["dip_loc", "ayun", "gob", "dip_fed"];
  }
  if (tipo === "gubernamental") return ["gob", "dip_loc", "ayun", "dip_fed"];
  // ciudadano / default
  return ["ayun", "dip_loc", "gob", "dip_fed"];
}

// ── Fetcher ────────────────────────────────────────────────────

export async function fetchCargoPESTEL(
  estadoNombre: string,
  cargoKey: SefixCargoKey
): Promise<SefixResultadoNorm | null> {
  const federalCargo = FEDERAL_CARGO_MAP[cargoKey];
  if (federalCargo) {
    const r = await getResultadosByEstado(estadoNombre, federalCargo);
    if (!r || r.totalVotos === 0) return null;
    return {
      estado: r.estado,
      cargo: r.cargo,
      anio: r.anio,
      totalVotos: r.totalVotos,
      participacion: r.participacion,
      partidos: r.partidos.slice(0, 5),
      fuente: r.fuente,
    };
  }

  // Local cargo — try years descending until data is found
  for (const year of LOCAL_YEARS_DESC) {
    const r = await getResultadosLocalesFiltered({
      estadoNombre,
      cargoKey,
      anioInput: year,
    });
    if (r && r.totalVotos > 0) {
      return {
        estado: r.estado,
        cargo: CARGO_DISPLAY[cargoKey] ?? r.cargo,
        anio: r.anio,
        totalVotos: r.totalVotos,
        participacion: r.participacion,
        partidos: r.partidos.slice(0, 5),
        fuente: r.fuente,
      };
    }
  }
  return null;
}

// ── Context builder ────────────────────────────────────────────

export interface SefixProjectParams {
  tipoProyecto: string;
  estadoNombre: string | null;
  nivelTerritorial: string;
}

/**
 * Fetches up to 4 Sefix electoral datasets ordered by priority for the
 * project type, plus the padrón for the state. Returns null when there is
 * no state (nacional scope) or estadoNombre is empty.
 */
export async function buildSefixContext(
  params: SefixProjectParams
): Promise<SefixContextData | null> {
  const { tipoProyecto, estadoNombre, nivelTerritorial } = params;
  if (!estadoNombre || nivelTerritorial === "nacional") return null;

  const priorityCargos = getSefixPriority(tipoProyecto, nivelTerritorial);
  const resultadosList: SefixResultadoNorm[] = [];

  for (const cargoKey of priorityCargos) {
    if (resultadosList.length >= 4) break;
    try {
      const r = await fetchCargoPESTEL(estadoNombre, cargoKey);
      if (r) resultadosList.push(r);
    } catch (e) {
      console.warn(`[sefixContext] Sefix fetch failed for ${cargoKey}:`, e);
    }
  }

  const padron = await getPadronByEstado(estadoNombre).catch(() => null);

  console.log(
    `[sefixContext] ${resultadosList.length} cargos for ` +
      `${estadoNombre} (tipo=${tipoProyecto}, nivel=${nivelTerritorial}) — ` +
      resultadosList.map((r) => `${r.cargo} ${r.anio}`).join(", ")
  );

  return { resultadosList, padron };
}
