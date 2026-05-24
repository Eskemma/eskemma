// lib/sefix/eleccionesLocalesTextUtils.ts
// Funciones puras de generación de texto dinámico para Elecciones Locales.
// Adaptación de eleccionesTextUtils.ts: sin nivel nacional, sin voto extranjero.
import { ResultadosEleccionesData, EleccionesLocalesFilterParams } from "@/types/sefix.types";
import { CARGO_DISPLAY_LABELS_LOC } from "@/lib/sefix/eleccionesLocalesConstants";

function fmtNum(n: number): string {
  return n.toLocaleString("es-MX");
}

function fmtPct(n: number): string {
  return n.toFixed(2) + "%";
}

// ============================================================
// TÍTULO DINÁMICO
// ============================================================

export function generateTituloLoc(
  anio: number,
  cargo: string,
  tipo: string
): { anio: string; cargo: string; esExtraordinaria: boolean } {
  return {
    anio: String(anio),
    cargo: CARGO_DISPLAY_LABELS_LOC[cargo] ?? cargo,
    esExtraordinaria: tipo === "EXTRAORDINARIA",
  };
}

// ============================================================
// ALCANCE DEL ANÁLISIS
// ============================================================

export function generateAlcanceLoc(params: EleccionesLocalesFilterParams): string {
  const { estado, cabecera, municipio, secciones } = params;
  const parts: string[] = [estado];
  if (cabecera) parts.push(`Distrito: ${cabecera}`);
  if (municipio) parts.push(`Municipio: ${municipio}`);
  if (secciones.length > 0) parts.push(`Secciones: ${secciones.join(", ")}`);
  return parts.join(" — ");
}

// ============================================================
// RESUMEN GENERAL
// ============================================================

export function generateResumenGeneralLoc(
  data: ResultadosEleccionesData,
  params: EleccionesLocalesFilterParams
): string {
  const { anio, cargo, estado, cabecera, municipio, secciones } = params;
  const cargoLabel = (CARGO_DISPLAY_LABELS_LOC[cargo] ?? cargo).toLowerCase();

  let geo = `en el estado de ${estado}`;
  if (secciones.length > 0) {
    const secStr =
      secciones.slice(0, 5).join(", ") + (secciones.length > 5 ? "…" : "");
    geo = `en las secciones ${secStr}${municipio ? ` del municipio de ${municipio}` : ""}${
      cabecera ? `, distrito ${cabecera}` : ""
    } de ${estado}`;
  } else if (municipio) {
    geo = `en el municipio de ${municipio}${
      cabecera ? `, distrito ${cabecera}` : ""
    } de ${estado}`;
  } else if (cabecera) {
    geo = `en el distrito ${cabecera} de ${estado}`;
  }

  return `Los resultados para la elección de ${cargoLabel} del año ${anio} ${geo} muestran un total de <strong>${fmtNum(data.totalVotos)}</strong> votos.`;
}

// ============================================================
// FUERZA PARTIDISTA (top 3 con diferencias %)
// Reutiliza la misma lógica que la versión federal (solo depende de data).
// ============================================================

export function generateFuerzaPartidistaLoc(
  data: ResultadosEleccionesData
): string | null {
  const ranking = data.partidos
    .filter((p) => p.partido !== "vot_nul" && p.partido !== "no_reg")
    .slice(0, 3);

  if (ranking.length < 2) return null;

  const fmt = (p: (typeof ranking)[0]) =>
    `<strong>${p.partido}</strong>: ${fmtPct(p.porcentaje)}`;

  const diff12 = (ranking[0].porcentaje - ranking[1].porcentaje).toFixed(2);
  let text = `La diferencia entre el primer lugar (${fmt(ranking[0])}) y el segundo (${fmt(ranking[1])}) fue de <strong>${diff12} puntos porcentuales</strong>`;

  if (ranking.length >= 3) {
    const diff23 = (ranking[1].porcentaje - ranking[2].porcentaje).toFixed(2);
    text += `; y la diferencia entre este y el tercer lugar (${fmt(ranking[2])}) fue de <strong>${diff23} puntos porcentuales</strong>`;
  }

  return text + ".";
}

// ============================================================
// PARTICIPACIÓN ELECTORAL EN CASCADA
// Locales: estatal → distrital → municipal → seccional (sin nacional).
// ============================================================

export function generateParticipacionLoc(
  data: ResultadosEleccionesData,
  params: EleccionesLocalesFilterParams
): string[] {
  const { estado, cabecera, municipio, secciones } = params;
  const pnivel = data.participacionPorNivel;
  const lines: string[] = [];

  if (pnivel.estatal !== undefined) {
    lines.push(
      `La tasa global de participación en <strong>${estado}</strong> fue de <strong>${fmtPct(pnivel.estatal)}</strong>.`
    );
  }

  if (cabecera && pnivel.distrital !== undefined) {
    lines.push(
      `La tasa global de participación en el distrito <strong>${cabecera}</strong> fue de <strong>${fmtPct(pnivel.distrital)}</strong>.`
    );
  }

  if (municipio && pnivel.municipal !== undefined) {
    lines.push(
      `La tasa global de participación en <strong>${municipio}</strong> fue de <strong>${fmtPct(pnivel.municipal)}</strong>.`
    );
  }

  if (secciones.length > 0 && pnivel.seccional !== undefined) {
    lines.push(
      `La tasa global de participación en las secciones seleccionadas fue de <strong>${fmtPct(pnivel.seccional)}</strong>.`
    );
  }

  return lines;
}
