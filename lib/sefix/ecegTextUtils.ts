// lib/sefix/ecegTextUtils.ts
// Pure text generation for the ECEG sidebar "Análisis Textual Dinámico".
import { DISTRITO_TODOS } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegCommitted } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegContexto, EcegNivelData } from "@/app/sefix/hooks/useGeoEcegContexto";
import type { EcegIndicator } from "./ecegConstants";

function toTitle(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function fmtNum(n: number, decimals = 1): string {
  return n.toLocaleString("es-MX", { maximumFractionDigits: decimals });
}

function fmtPct(n: number): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

// Returns the noun phrase for the denominator (without leading "de").
// Used in: "26.2% de {denomPhrase} {scopeSuffix}"
function denomPhrase(denomKey: string): string {
  const map: Record<string, string> = {
    POBTOT:     "la población total",
    P_18YMAS:   "la población de 18 años y más",
    PEA:        "la PEA",
    VIVPAR_HAB: "las viviendas habitadas",
    TVIVPAR:    "las viviendas particulares",
    TOTHOG:     "los hogares",
  };
  return map[denomKey] ?? "";
}

// scopeSuffix: "del país" | "del estado" | "del distrito" | "del municipio" | "de la sección"
function formatNivel(
  label: string,
  data: EcegNivelData | undefined,
  indicator: EcegIndicator,
  denomKey: string | undefined,
  scopeSuffix: string
): string | null {
  if (!data) return null;

  if (denomKey && data.porcentaje !== null) {
    const dp = denomPhrase(denomKey);
    const scope = scopeSuffix ? ` ${scopeSuffix}` : "";
    const denomPart = dp ? ` de ${dp}${scope}` : "";
    return `${label}: <strong>${fmtPct(data.porcentaje)}</strong>${denomPart}`;
  }

  // Index indicator — show raw value with unit
  const unit = indicator.unit ?? "";
  return `${label}: <strong>${fmtNum(data.valor, 2)}</strong>${unit ? ` ${unit}` : ""}`;
}

/** Generates the scope text for block 2 (Alcance de la consulta). */
export function generateAlcanceEceg(committed: EcegCommitted): string {
  if (!committed.estado) return "Consulta nacional — 32 entidades federativas";

  const lines: string[] = [`Estado: ${committed.estado}`];

  if (committed.filterMode === "municipio") {
    if (committed.municipioNombre) {
      lines.push(`Municipio: ${toTitle(committed.municipioNombre)}`);
    }
  } else {
    // distrito mode
    if (committed.cabeceraCve && committed.cabeceraCve !== DISTRITO_TODOS) {
      const distDisplay = committed.cabeceraLabel || `Distrito ${committed.cabeceraCve}`;
      lines.push(`Distrito Federal: ${distDisplay}`);
    } else {
      lines.push("Todos los distritos del estado");
    }
  }

  if (committed.secciones.length > 0) {
    const nums = committed.secciones.map((s) => parseInt(s, 10)).join(", ");
    const plural = committed.secciones.length > 1 ? "es" : "";
    lines.push(`Sección${plural}: ${nums}`);
  }

  return lines.join("\n");
}

/** Generates the comparative lines for block 3 (Análisis comparativo). */
export function generateComparativoEceg(
  contexto: EcegContexto,
  committed: EcegCommitted,
  indicator: EcegIndicator,
  denomKey: string | undefined
): string[] {
  const lines: string[] = [];

  const nac = formatNivel("A nivel nacional", contexto.nacional, indicator, denomKey, "del país");
  if (nac) lines.push(nac);

  if (committed.estado) {
    const estLabel = `En ${committed.estado}`;
    const est = formatNivel(estLabel, contexto.estado, indicator, denomKey, "del estado");
    if (est) lines.push(est);
  }

  if (contexto.distrito) {
    const distDisplay = committed.cabeceraLabel
      ? committed.cabeceraLabel
      : committed.cabeceraCve && committed.cabeceraCve !== DISTRITO_TODOS
      ? `Distrito ${committed.cabeceraCve}`
      : "el distrito";
    const distLabel = `En el Distrito ${distDisplay}`;
    const dst = formatNivel(distLabel, contexto.distrito, indicator, denomKey, "del distrito");
    if (dst) lines.push(dst);
  }

  if (contexto.municipio && committed.municipioNombre) {
    const munLabel = `En ${toTitle(committed.municipioNombre)}`;
    const mun = formatNivel(munLabel, contexto.municipio, indicator, denomKey, "del municipio");
    if (mun) lines.push(mun);
  }

  if (contexto.seccion) {
    const secCount = committed.secciones.length;
    const secLabel = secCount === 1
      ? `En la sección ${parseInt(committed.secciones[0], 10)}`
      : `En las ${secCount} secciones seleccionadas`;
    const scopeSuffix = secCount === 1 ? "de la sección" : "de las secciones";
    const sec = formatNivel(secLabel, contexto.seccion, indicator, denomKey, scopeSuffix);
    if (sec) lines.push(sec);
  }

  return lines;
}
