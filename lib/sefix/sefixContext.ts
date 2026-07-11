// lib/sefix/sefixContext.ts
// Shared Sefix context builder for PEST-L analyses.
// Used by: app/api/centinela/pestel/trigger/route.ts
//          app/api/moddulo/f2/generate-m1-express/route.ts

import {
  getResultadosByEstado,
  getResultadosFiltered,
  getEleccionesGeo,
  getEleccionesLocalesGeo,
  getResultadosLocalesAvailableYears,
  getPadronByEstado,
  getPadronNacional,
  getResultadosLocalesFiltered,
} from "@/lib/sefix/storage";
import { matchDistrito, formatDistritoCabecera } from "@/lib/sefix/districtMatching";
import type { Territorio } from "@/types/pestel.types";

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
  /** Resolved district cabecera if data is district-scoped; null = state average. */
  distrito?: string | null;
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

// Fallback used only when no state-specific year list is available
const LOCAL_YEARS_FALLBACK = [2025, 2024, 2021, 2015];

// ── Priority table ─────────────────────────────────────────────

// Returns the 4-cargo priority list aligned to the project's electoral objective.
export function getSefixPriority(tipo: string, nivel: string): SefixCargoKey[] {
  if (tipo === "electoral") {
    if (nivel === "municipal") return ["ayun", "dip_loc", "dip_fed", "gob"];
    // "distrito_local" y "distrital" (legacy) → distrito electoral local
    if (nivel === "distrito_local" || nivel === "distrital") return ["dip_loc", "ayun", "gob", "dip_fed"];
    if (nivel === "estatal") return ["gob", "dip_loc", "ayun", "dip_fed"];
    // "distrito_federal", "distrito" (legacy) y "federal" (legacy) → distrito electoral federal
    if (nivel === "distrito_federal" || nivel === "distrito" || nivel === "federal") return ["dip_fed", "dip_loc", "pdte", "sen"];
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

// ── District cabecera resolver (shared with Google News) ───────

/**
 * Resolves the district cabecera name for a given territory using the most
 * recent electoral data available. Returns null when the level is not
 * district-specific or no match is found (fallback to state-level).
 */
export async function resolveDistrictCabecera(
  estadoNombre: string,
  nivelTerritorial: string,
  territorio: Pick<Territorio, "nombre" | "cve_distrito">
): Promise<string | null> {
  if (!estadoNombre) return null;
  try {
    if (
      nivelTerritorial === "distrito_federal" ||
      nivelTerritorial === "distrito" ||
      nivelTerritorial === "federal"
    ) {
      // Use the most recent year available (same pattern as getResultadosByEstado without anio)
      const latest = await getResultadosByEstado(estadoNombre, "diputados");
      if (!latest) return null;
      const opciones = await getEleccionesGeo("distritos", latest.anio, "dip", estadoNombre);
      return matchDistrito(opciones, territorio);
    }
    if (nivelTerritorial === "distrito_local" || nivelTerritorial === "distrital") {
      const years = await getResultadosLocalesAvailableYears(estadoNombre).catch(
        () => LOCAL_YEARS_FALLBACK
      );
      for (const year of [...years].sort((a, b) => b - a)) {
        const opciones = await getEleccionesLocalesGeo("distritos", year, "dip_loc", estadoNombre);
        if (opciones.length > 0) return matchDistrito(opciones, territorio);
      }
    }
  } catch {
    // intentional no-op: fallback to null → callers use state-level
  }
  return null;
}

// ── Fetcher ────────────────────────────────────────────────────

async function fetchCargoPESTEL(
  estadoNombre: string,
  cargoKey: SefixCargoKey,
  cabecera?: string | null,
  localYears?: number[]
): Promise<SefixResultadoNorm | null> {
  const federalCargo = FEDERAL_CARGO_MAP[cargoKey];
  if (federalCargo) {
    // Presidencia is always national scope — pass empty string to aggregate all states
    const estadoForQuery = cargoKey === "pdte" ? "" : estadoNombre;
    const r = await getResultadosByEstado(estadoForQuery, federalCargo);
    if (!r || r.totalVotos === 0) return null;

    // For federal diputados at district level, fetch district-scoped data
    if (cabecera && cargoKey === "dip_fed") {
      const filtered = await getResultadosFiltered({
        estadoInput: estadoNombre,
        cargoInput: federalCargo,
        anioInput: r.anio,
        cabecera,
      }).catch(() => null);
      if (filtered && filtered.totalVotos > 0) {
        return {
          estado: r.estado,
          cargo: r.cargo,
          anio: r.anio,
          totalVotos: filtered.totalVotos,
          participacion: filtered.participacion,
          partidos: filtered.partidos
            .slice(0, 5)
            .map((p) => ({ partido: p.partido, votos: p.votos, porcentaje: p.porcentaje })),
          fuente: r.fuente,
          distrito: formatDistritoCabecera(cabecera, "federal"),
        };
      }
    }

    return {
      estado: r.estado,
      cargo: r.cargo,
      anio: r.anio,
      totalVotos: r.totalVotos,
      participacion: r.participacion,
      partidos: r.partidos.slice(0, 5),
      fuente: r.fuente,
      distrito: null,
    };
  }

  // Local cargo — try years descending until data is found
  const yearsDesc = localYears
    ? [...localYears].sort((a, b) => b - a)
    : LOCAL_YEARS_FALLBACK;
  for (const year of yearsDesc) {
    const r = await getResultadosLocalesFiltered({
      estadoNombre,
      cargoKey,
      anioInput: year,
      ...(cabecera && cargoKey === "dip_loc" ? { cabecera } : {}),
    });
    if (r && r.totalVotos > 0) {
      return {
        estado: r.estado,
        cargo: CARGO_DISPLAY[cargoKey] ?? r.cargo,
        anio: r.anio,
        totalVotos: r.totalVotos,
        participacion: r.participacion,
        partidos: r.partidos
          .slice(0, 5)
          .map((p) => ({ partido: p.partido, votos: p.votos, porcentaje: p.porcentaje })),
        fuente: r.fuente,
        distrito:
          cabecera && cargoKey === "dip_loc"
            ? formatDistritoCabecera(cabecera, "local")
            : null,
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
  /** Pre-resolved district cabecera from resolveDistrictCabecera(). Skips re-fetching. */
  resolvedCabecera?: string | null;
}

/**
 * Fetches up to 4 Sefix electoral datasets ordered by priority for the
 * project type, plus the padrón for the state. Returns null when there is
 * no state (nacional scope) or estadoNombre is empty.
 *
 * Pass resolvedCabecera (from resolveDistrictCabecera) to get district-scoped
 * data for dip_fed and dip_loc instead of state averages.
 */
export async function buildSefixContext(
  params: SefixProjectParams
): Promise<SefixContextData | null> {
  const { tipoProyecto, estadoNombre, nivelTerritorial, resolvedCabecera } = params;
  if (!estadoNombre && nivelTerritorial !== "nacional") return null;

  // For national-scope projects (Presidencia), return national padron with no electoral results
  if (nivelTerritorial === "nacional" || !estadoNombre) {
    const padron = await getPadronNacional().catch(() => null);
    if (!padron) return null;
    // Federal national cargos use regular fetchCargoPESTEL with empty estadoNombre
    const priorityCargos = getSefixPriority(tipoProyecto, nivelTerritorial);
    const resultadosList: SefixResultadoNorm[] = [];
    for (const cargoKey of priorityCargos) {
      if (resultadosList.length >= 4) break;
      try {
        const r = await fetchCargoPESTEL("", cargoKey, resolvedCabecera);
        if (r) resultadosList.push(r);
      } catch (e) {
        console.warn(`[sefixContext] Nacional fetch failed for ${cargoKey}:`, e);
      }
    }
    return { resultadosList, padron };
  }

  const priorityCargos = getSefixPriority(tipoProyecto, nivelTerritorial);
  const resultadosList: SefixResultadoNorm[] = [];

  // Fetch available years for this state once — avoids N Firebase listings for N cargos
  const localYears = await getResultadosLocalesAvailableYears(estadoNombre).catch(
    () => LOCAL_YEARS_FALLBACK
  );

  for (const cargoKey of priorityCargos) {
    if (resultadosList.length >= 4) break;
    try {
      const r = await fetchCargoPESTEL(estadoNombre, cargoKey, resolvedCabecera, localYears);
      if (r) resultadosList.push(r);
    } catch (e) {
      console.warn(`[sefixContext] Sefix fetch failed for ${cargoKey}:`, e);
    }
  }

  const padron = await getPadronByEstado(estadoNombre).catch(() => null);

  const geoLabel = resolvedCabecera ? ` → ${resolvedCabecera}` : "";
  console.log(
    `[sefixContext] ${resultadosList.length} cargos for ` +
      `${estadoNombre}${geoLabel} (tipo=${tipoProyecto}, nivel=${nivelTerritorial}) — ` +
      resultadosList.map((r) => `${r.cargo} ${r.anio}`).join(", ")
  );

  return { resultadosList, padron };
}
