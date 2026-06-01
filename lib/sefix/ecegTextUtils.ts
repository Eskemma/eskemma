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
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

// Short unit label for the denominator — used when we show the absolute count inline.
// "de {fmtNum(denominador)} {denomUnit} {scopeSuffix}"
function denomUnit(denomKey: string): string {
  const map: Record<string, string> = {
    POBTOT:     "personas",
    P_18YMAS:   "hab. de 18 años y más",
    PEA:        "personas en la PEA",
    VIVPAR_HAB: "viviendas habitadas",
    TVIVPAR:    "viviendas particulares",
    TOTHOG:     "hogares",
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

  const unit = indicator.unit ?? "";
  const unitPart = unit ? ` ${unit}` : "";

  if (denomKey && data.porcentaje !== null) {
    // Show absolute value + percentage with explicit denominator count for transparency
    const absVal = fmtNum(data.numerador, 0);
    const pct = fmtPct(data.porcentaje);
    const du = denomUnit(denomKey);
    const scope = scopeSuffix ? ` ${scopeSuffix}` : "";
    const denomStr = data.denominador !== null && du
      ? `de ${fmtNum(data.denominador, 0)} ${du}${scope}`
      : du ? `de ${du}${scope}` : scope.trim();
    return `${label}: <strong>${absVal}${unitPart}</strong> (<strong>${pct}</strong> ${denomStr})`;
  }

  // Sin denominador: sólo valor con unidad (promedio, índice o conteo absoluto)
  return `${label}: <strong>${fmtNum(data.valor, 2)}</strong>${unitPart}`;
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
      lines.push(`Distrito Electoral Federal: ${distDisplay}`);
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
