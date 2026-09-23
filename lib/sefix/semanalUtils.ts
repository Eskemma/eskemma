// lib/sefix/semanalUtils.ts
// Funciones puras para transformar y proyectar series semanales del Padrón Electoral.
// Migradas desde la lógica R/Shiny en docs/sefix_R/modules/lista_nominal_graficas/
// Sin dependencias de React ni Firebase — 100% testeables en aislamiento.

import type { Ambito } from "./seriesUtils";
import { ESTADOS_ALFABETICOS, claveEstadoSnake } from "@/lib/geo/estados";
import { nombreEstadoProsa } from "@/lib/geo/abreviaturasEstado";
import type { SemanalSerieRow } from "@/app/sefix/hooks/useLneSemanalesSerie";

// ────────────────────────────────────────────────────────────────
// CONSTANTES (migradas de graficas_semanal_edad.R)
// ────────────────────────────────────────────────────────────────

export const RANGOS_EDAD = [
  "18", "19", "20_24", "25_29", "30_34", "35_39",
  "40_44", "45_49", "50_54", "55_59", "60_64", "65_y_mas",
] as const;

export type RangoEdad = typeof RANGOS_EDAD[number];

export const ETIQ_RANGOS: Record<RangoEdad, string> = {
  "18":       "18 años",
  "19":       "19 años",
  "20_24":    "20–24 años",
  "25_29":    "25–29 años",
  "30_34":    "30–34 años",
  "35_39":    "35–39 años",
  "40_44":    "40–44 años",
  "45_49":    "45–49 años",
  "50_54":    "50–54 años",
  "55_59":    "55–59 años",
  "60_64":    "60–64 años",
  "65_y_mas": "65+ años",
};

export const GRUPOS_ETARIOS = {
  "Jóvenes (18–29)": ["18", "19", "20_24", "25_29"] as RangoEdad[],
  "Adultos (30–59)": ["30_34", "35_39", "40_44", "45_49", "50_54", "55_59"] as RangoEdad[],
  "Mayores (60+)":   ["60_64", "65_y_mas"] as RangoEdad[],
};

export type GrupoKey = keyof typeof GRUPOS_ETARIOS;

// Paletas de colores (migradas exactamente desde R)
// Nacional — oscuro primero para máximo contraste con pocos rangos seleccionados
export const AZULES     = ["#00193B","#012A51","#003E66","#015378","#277592","#4891B3","#6BA4C6","#90B8D6","#B3CDE5"];
export const ROJOS      = ["#71001B","#8B0A2B","#AE0E35","#D3103F","#D10F3F","#E05F7F","#F15F8E","#F87FA8","#FFA0A0"];
// Extranjero — paleta morada/azul (igual que vista histórico)
export const MORADOS    = ["#2a004e","#3f0074","#5a0490","#7206b4","#8b2bd6","#a854e8","#c585f5","#dbb4f9","#f0dcfc"];
export const AZULES_EXT = ["#001428","#002548","#003964","#004e84","#0163a4","#2480d4","#4d9de8","#87baf0","#bbd6f4"];
export const VERDES     = ["#36591f","#3f6625","#48742c","#518032","#649941","#7eaf5a","#99c374","#b3d591","#cce4b1"];

// CSV column key override for some states (CDMX uses "cdmx" not "ciudad_de_mexico")
const TEXTO_ORIGEN_COL: Record<string, string> = { ciudad_de_mexico: "cdmx" };
function textoOrigenCol(key: string): string { return TEXTO_ORIGEN_COL[key] ?? key; }

// Colores modo total (E1 sin selección de rangos)
export const COLOR_PAD_NAC = "#277592";
export const COLOR_LNE_NAC = "#D10F3F";
export const COLOR_PAD_EXT = "#7206b4";  // purple (igual que histórico)
export const COLOR_LNE_EXT = "#0163a4";  // blue  (igual que histórico)

// Colores E3 por grupo etario
export const COLOR_E3_PAD_NAC: Record<string, string> = { "Jóvenes (18–29)": "#6BA4C6", "Adultos (30–59)": "#277592", "Mayores (60+)": "#D10F3F" };
export const COLOR_E3_LNE_NAC: Record<string, string> = { "Jóvenes (18–29)": "#4891B3", "Adultos (30–59)": "#003E66", "Mayores (60+)": "#8B0A2B" };
export const COLOR_E3_PAD_EXT: Record<string, string> = { "Jóvenes (18–29)": "#8b2bd6", "Adultos (30–59)": "#7206b4", "Mayores (60+)": "#1d7fe9" };
export const COLOR_E3_LNE_EXT: Record<string, string> = { "Jóvenes (18–29)": "#5a0490", "Adultos (30–59)": "#004e84", "Mayores (60+)": "#0163a4" };

// ────────────────────────────────────────────────────────────────
// TIPO: punto proyectado
// ────────────────────────────────────────────────────────────────

export interface ProyeccionPoint {
  fecha: string;   // YYYY-MM-DD
  padron: number;
  lista: number;
  proyectado: boolean;
}

// Dark mode — paletas revertidas (colores claros primero) y colores únicos
export function getDarkPalette(palette: string[]): string[] {
  return [...palette].reverse();
}
export const COLOR_PAD_NAC_DARK = "#6BA4C6";
export const COLOR_LNE_NAC_DARK = "#E05F7F";
export const COLOR_PAD_EXT_DARK = "#C585F5";
export const COLOR_LNE_EXT_DARK = "#4D9DE8";

export const COLOR_E3_PAD_NAC_DARK: Record<string, string> = {
  "Jóvenes (18–29)": "#90B8D6", "Adultos (30–59)": "#6BA4C6", "Mayores (60+)": "#E05F7F",
};
export const COLOR_E3_LNE_NAC_DARK: Record<string, string> = {
  "Jóvenes (18–29)": "#6BA4C6", "Adultos (30–59)": "#4891B3", "Mayores (60+)": "#D3103F",
};
export const COLOR_E3_PAD_EXT_DARK: Record<string, string> = {
  "Jóvenes (18–29)": "#dbb4f9", "Adultos (30–59)": "#c585f5", "Mayores (60+)": "#87baf0",
};
export const COLOR_E3_LNE_EXT_DARK: Record<string, string> = {
  "Jóvenes (18–29)": "#c585f5", "Adultos (30–59)": "#87baf0", "Mayores (60+)": "#4D9DE8",
};

// ────────────────────────────────────────────────────────────────
// COLOR HELPERS
// ────────────────────────────────────────────────────────────────

export function colorRangoPad(i: number, ambito: Ambito): string {
  const pal = ambito === "extranjero" ? MORADOS : AZULES;
  return pal[i % pal.length];
}

export function colorRangoLne(i: number, ambito: Ambito): string {
  const pal = ambito === "extranjero" ? AZULES_EXT : ROJOS;
  return pal[i % pal.length];
}

export function colorTotalPad(ambito: Ambito): string {
  return ambito === "extranjero" ? COLOR_PAD_EXT : COLOR_PAD_NAC;
}

export function colorTotalLne(ambito: Ambito): string {
  return ambito === "extranjero" ? COLOR_LNE_EXT : COLOR_LNE_NAC;
}

// ────────────────────────────────────────────────────────────────
// PROYECCIÓN SEMANAL
// Fórmula: Tasa = (Vf/Vi)^(1/(n-1)) - 1
// Proyecta desde el último dato real hasta diciembre del año de la serie
// ────────────────────────────────────────────────────────────────

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula proyección hasta diciembre del año del último dato.
 * Retorna array de puntos con { fecha, padron, lista, proyectado }.
 * Incluye el último dato real como punto de conexión (proyectado=false).
 */
export function computeSemanalesProyeccion(
  serie: SemanalSerieRow[],
  colPadron: string,
  colLista: string,
): ProyeccionPoint[] {
  if (serie.length < 2) return [];

  const real: ProyeccionPoint[] = serie.map((row) => ({
    fecha: row.fecha as string,
    padron: (row[colPadron] as number) ?? 0,
    lista:  (row[colLista]  as number) ?? 0,
    proyectado: false,
  }));

  const n = serie.length;
  const vPadronIni = (serie[0][colPadron]  as number) ?? 0;
  const vPadronFin = (serie[n-1][colPadron] as number) ?? 0;
  const vListaIni  = (serie[0][colLista]   as number) ?? 0;
  const vListaFin  = (serie[n-1][colLista]  as number) ?? 0;

  if (vPadronIni <= 0 || vPadronFin <= 0) return real;

  // Tasa de crecimiento mensual compuesto
  // Asumimos cada fila ≈ 1 semana, convertimos a mensual
  const semanasReales = n - 1;
  const mesesReales = semanasReales / 4.33;
  if (mesesReales < 0.5) return real;

  const tasaPadron = Math.pow(vPadronFin / vPadronIni, 1 / mesesReales) - 1;
  const tasaLista  = vListaIni > 0
    ? Math.pow(vListaFin / vListaIni, 1 / mesesReales) - 1
    : tasaPadron;

  // Meses restantes hasta diciembre
  const ultimaFecha = serie[n-1].fecha as string;
  const mesUltimo = parseInt(ultimaFecha.slice(5, 7), 10);
  const mesesRest = 12 - mesUltimo;
  if (mesesRest <= 0) return real;

  const proyectados: ProyeccionPoint[] = [];
  for (let i = 1; i <= mesesRest; i++) {
    proyectados.push({
      fecha: addMonths(ultimaFecha, i),
      padron: Math.round(vPadronFin * Math.pow(1 + tasaPadron, i)),
      lista:  Math.round(vListaFin  * Math.pow(1 + tasaLista,  i)),
      proyectado: true,
    });
  }

  return [...real, ...proyectados];
}

/**
 * Proyecta la serie sumando varios rangos de edad (para E3).
 */
export function computeProyeccionGrupo(
  serie: SemanalSerieRow[],
  rangos: RangoEdad[],
): ProyeccionPoint[] {
  if (serie.length < 2 || rangos.length === 0) return [];

  // Sumar columnas del grupo para crear serie virtual
  const serieGrupo: SemanalSerieRow[] = serie.map((row) => {
    const padron = rangos.reduce((sum, r) => sum + ((row[`padron_${r}`] as number) ?? 0), 0);
    const lista  = rangos.reduce((sum, r) => sum + ((row[`lista_${r}`]  as number) ?? 0), 0);
    return { ...row, __padron_grupo: padron, __lista_grupo: lista };
  });

  return computeSemanalesProyeccion(serieGrupo, "__padron_grupo", "__lista_grupo");
}

// ────────────────────────────────────────────────────────────────
// ANÁLISIS TEXTUAL — EDAD
// ────────────────────────────────────────────────────────────────

export interface SemanalTextsEdad {
  titulo: string;
  resumen: string;
  distribucion: string;
  topRangos: string;
  fuente: string;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("es-MX").format(Math.round(n));
}

function fmtPct(n: number): string {
  return n.toFixed(2) + "%";
}

function fmtPctNB(n: number): string {
  if (n === 0) return "0.00%";
  if (n >= 0.01) return n.toFixed(2) + "%";
  // Find precision that yields at least 2 non-zero significant decimal digits
  for (let p = 3; p <= 10; p++) {
    const dec = n.toFixed(p).split(".")[1] ?? "";
    if (dec.replace(/^0+/, "").length >= 2) return n.toFixed(p) + "%";
  }
  return n.toFixed(10) + "%";
}

/**
 * Obtiene el total de un rango manejando ambos formatos de datos:
 *   - Series CSV:   lista_18 / padron_18  (columna total directa)
 *   - Aggregate:    lista_18_hombres + lista_18_mujeres + lista_18_no_binario
 */
function rTotal(
  data: Record<string, number>,
  r: string,
  prefix: "lista" | "padron"
): number {
  const direct = data[`${prefix}_${r}`];
  if (direct !== undefined && direct > 0) return direct;
  return (
    (data[`${prefix}_${r}_hombres`]    ?? 0) +
    (data[`${prefix}_${r}_mujeres`]    ?? 0) +
    (data[`${prefix}_${r}_no_binario`] ?? 0)
  );
}

export function generateSemanalTextsEdad(
  data: Record<string, number>,
  serie: SemanalSerieRow[],
  ambito: Ambito,
  fecha: string,
): SemanalTextsEdad {
  const ambitoLabel = ambito === "extranjero" ? "Extranjero" : "Nacional";

  // Totales: sumar rangos H+M+NB
  let padronTotal = 0;
  let listaTotal = 0;
  const rangoPadrones: { rango: RangoEdad; padron: number; lista: number }[] = [];

  for (const rango of RANGOS_EDAD) {
    const p = rTotal(data, rango, "padron");
    const l = rTotal(data, rango, "lista");
    padronTotal += p;
    listaTotal  += l;
    rangoPadrones.push({ rango, padron: p, lista: l });
  }

  const tasaInclusion = padronTotal > 0 ? (listaTotal / padronTotal) * 100 : 0;

  // Variación desde primera semana de la serie
  let variacion = "";
  if (serie.length >= 2) {
    const primerPadron = RANGOS_EDAD.reduce(
      (sum, r) => sum + ((serie[0][`padron_${r}`] as number) ?? 0), 0
    );
    if (primerPadron > 0) {
      const pct = ((padronTotal - primerPadron) / primerPadron) * 100;
      variacion = ` En el periodo, el padrón ha ${pct >= 0 ? "aumentado" : "disminuido"} un <strong>${Math.abs(pct).toFixed(2)}%</strong>.`;
    }
  }

  // Distribución por grupo etario
  const grupos = Object.entries(GRUPOS_ETARIOS).map(([nombre, rangos]) => {
    const lne = rangos.reduce((sum, r) => sum + rTotal(data, r, "lista"), 0);
    const pct = listaTotal > 0 ? (lne / listaTotal) * 100 : 0;
    return { nombre, lne, pct };
  });

  // Top 3 rangos por LNE
  const top3 = [...rangoPadrones]
    .sort((a, b) => b.lista - a.lista)
    .slice(0, 3);

  const titulo = `Análisis Semanal de Rango de Edad — ${ambitoLabel}`;

  const resumen =
    `Al corte del <strong>${fecha}</strong>, el Padrón Electoral ${ambitoLabel} registra ` +
    `<strong>${fmtNum(padronTotal)}</strong> ciudadanos y la Lista Nominal Electoral ` +
    `<strong>${fmtNum(listaTotal)}</strong>. La tasa de inclusión es <strong>${fmtPct(tasaInclusion)}</strong>.` +
    variacion;

  const distribucion =
    `Por grupos etarios: <strong>Jóvenes (18–29)</strong> representan el <strong>${fmtPct(grupos[0]?.pct ?? 0)}</strong> ` +
    `de la LNE (${fmtNum(grupos[0]?.lne ?? 0)}); <strong>Adultos (30–59)</strong> el ` +
    `<strong>${fmtPct(grupos[1]?.pct ?? 0)}</strong> (${fmtNum(grupos[1]?.lne ?? 0)}); ` +
    `y <strong>Mayores (60+)</strong> el <strong>${fmtPct(grupos[2]?.pct ?? 0)}</strong> (${fmtNum(grupos[2]?.lne ?? 0)}).`;

  const topRangos =
    `Los tres rangos con mayor número de ciudadanos en la LNE son: ` +
    top3.map((t, i) =>
      `<strong>${ETIQ_RANGOS[t.rango]}</strong> con <strong>${fmtNum(t.lista)}</strong>` +
      (i < top3.length - 1 ? ", " : ".")
    ).join("");

  const fuente =
    "Fuente: INE. Estadística de Padrón Electoral y Lista Nominal del Electorado.";

  return { titulo, resumen, distribucion, topRangos, fuente };
}

// ────────────────────────────────────────────────────────────────
// ANÁLISIS TEXTUAL — SEXO
// ────────────────────────────────────────────────────────────────

export interface SemanalTextsSexo {
  titulo: string;
  resumen: string;
  tasas: string;
  distribucion: string;
  topRangos: string;
  fuente: string;
}

export function generateSemanalTextsSexo(
  dataSexo: Record<string, number>,
  dataEdad: Record<string, number> | null,
  ambito: Ambito,
  fecha: string,
): SemanalTextsSexo {
  const ambitoLabel = ambito === "extranjero" ? "Extranjero" : "Nacional";
  const ext = ambito === "extranjero" ? " de residentes en el extranjero" : "";

  const pH = (dataSexo["padron_hombres"]    as number) ?? 0;
  const pM = (dataSexo["padron_mujeres"]    as number) ?? 0;
  const pN = (dataSexo["padron_no_binario"] as number) ?? 0;
  const lH = (dataSexo["lista_hombres"]     as number) ?? 0;
  const lM = (dataSexo["lista_mujeres"]     as number) ?? 0;
  const lN = (dataSexo["lista_no_binario"]  as number) ?? 0;

  const padronTotal = pH + pM + pN;
  const listaTotal  = lH + lM + lN;

  const tasaH = pH > 0 ? (lH / pH) * 100 : 0;
  const tasaM = pM > 0 ? (lM / pM) * 100 : 0;
  const tasaN = pN > 0 ? (lN / pN) * 100 : 0;

  const pctPadH = padronTotal > 0 ? (pH / padronTotal) * 100 : 0;
  const pctPadM = padronTotal > 0 ? (pM / padronTotal) * 100 : 0;
  const pctPadN = padronTotal > 0 ? (pN / padronTotal) * 100 : 0;
  const pctLneH = listaTotal  > 0 ? (lH / listaTotal)  * 100 : 0;
  const pctLneM = listaTotal  > 0 ? (lM / listaTotal)  * 100 : 0;
  const pctLneN = listaTotal  > 0 ? (lN / listaTotal)  * 100 : 0;

  const titulo = `Análisis Semanal de Distribución por Sexo - ${ambitoLabel}`;

  const resumen =
    `Al corte del <strong>${fecha}</strong>, el Padrón Electoral se constituye por: ` +
    `<strong>${fmtNum(pH)}</strong> hombres (<strong>${fmtPct(pctPadH)}</strong>), ` +
    `<strong>${fmtNum(pM)}</strong> mujeres (<strong>${fmtPct(pctPadM)}</strong>) y ` +
    `<strong>${fmtNum(pN)}</strong> personas no binarias (<strong>${fmtPctNB(pctPadN)}</strong>). ` +
    `En tanto, la LNE se integra por <strong>${fmtNum(lH)}</strong> hombres (<strong>${fmtPct(pctLneH)}</strong>), ` +
    `<strong>${fmtNum(lM)}</strong> mujeres (<strong>${fmtPct(pctLneM)}</strong>) y ` +
    `<strong>${fmtNum(lN)}</strong> personas no binarias (<strong>${fmtPctNB(pctLneN)}</strong>).`;

  const tasas =
    `Padrón total: <strong>${fmtNum(padronTotal)}</strong>; LNE total: <strong>${fmtNum(listaTotal)}</strong>. ` +
    `Tasas de inclusión en la LNE: Hombres <strong>${fmtPct(tasaH)}</strong>, ` +
    `Mujeres <strong>${fmtPct(tasaM)}</strong>, No Binario <strong>${fmtPct(tasaN)}</strong>.`;

  const fuente =
    "Fuente: INE. Estadística de Padrón Electoral y Lista Nominal del Electorado.";

  let distribucion = "";
  let topRangos = "";

  if (dataEdad) {
    const totH = RANGOS_EDAD.reduce((s, r) => s + ((dataEdad[`lista_${r}_hombres`]    as number) ?? 0), 0);
    const totM = RANGOS_EDAD.reduce((s, r) => s + ((dataEdad[`lista_${r}_mujeres`]    as number) ?? 0), 0);
    const totN = RANGOS_EDAD.reduce((s, r) => s + ((dataEdad[`lista_${r}_no_binario`] as number) ?? 0), 0);

    const grupoLne = (rangos: RangoEdad[], sufijo: string) =>
      rangos.reduce((s, r) => s + ((dataEdad[`lista_${r}_${sufijo}`] as number) ?? 0), 0);

    const pctH = (rangos: RangoEdad[]) => totH > 0 ? grupoLne(rangos, "hombres")    / totH * 100 : 0;
    const pctM = (rangos: RangoEdad[]) => totM > 0 ? grupoLne(rangos, "mujeres")    / totM * 100 : 0;
    const pctN = (rangos: RangoEdad[]) => totN > 0 ? grupoLne(rangos, "no_binario") / totN * 100 : 0;

    const [g1, g2, g3] = Object.values(GRUPOS_ETARIOS);

    const nbDistrib = totN > 0
      ? ` Las personas no binarias${ext} registran <strong>${fmtPct(pctN(g1))}</strong> en jóvenes, ` +
        `<strong>${fmtPct(pctN(g2))}</strong> en adultos y ` +
        `<strong>${fmtPct(pctN(g3))}</strong> en adultos mayores.`
      : "";

    distribucion =
      `Del total de mujeres en la LNE${ext}, <strong>${fmtPct(pctM(g1))}</strong> ` +
      `son ciudadanas de entre 18 y 29 años; <strong>${fmtPct(pctM(g2))}</strong> ` +
      `entre 30 y 59; y <strong>${fmtPct(pctM(g3))}</strong> son mayores de 60 años. ` +
      `En cuanto a los hombres, <strong>${fmtPct(pctH(g1))}</strong> son jóvenes (18–29), ` +
      `<strong>${fmtPct(pctH(g2))}</strong> son adultos (30–59) y ` +
      `<strong>${fmtPct(pctH(g3))}</strong> son adultos mayores.${nbDistrib}`;

    const sortBy = (sufijo: string) =>
      [...RANGOS_EDAD].sort(
        (a, b) => ((dataEdad[`lista_${b}_${sufijo}`] as number) ?? 0)
                - ((dataEdad[`lista_${a}_${sufijo}`] as number) ?? 0)
      );

    const top3H = sortBy("hombres").slice(0, 3);
    const top3M = sortBy("mujeres").slice(0, 3);

    const rPctH = (r: RangoEdad) => totH > 0 ? ((dataEdad[`lista_${r}_hombres`] as number) ?? 0) / totH * 100 : 0;
    const rPctM = (r: RangoEdad) => totM > 0 ? ((dataEdad[`lista_${r}_mujeres`] as number) ?? 0) / totM * 100 : 0;

    let nbTop = "";
    if (totN > 0) {
      const top3N = sortBy("no_binario").slice(0, 3);
      const rPctN = (r: RangoEdad) => totN > 0 ? ((dataEdad[`lista_${r}_no_binario`] as number) ?? 0) / totN * 100 : 0;
      nbTop =
        ` El mayor porcentaje de personas no binarias${ext} se encuentra en ` +
        `<strong>${ETIQ_RANGOS[top3N[0]]}</strong> (<strong>${fmtPct(rPctN(top3N[0]))}</strong>), ` +
        `seguido por <strong>${ETIQ_RANGOS[top3N[1]]}</strong> (<strong>${fmtPct(rPctN(top3N[1]))}</strong>) ` +
        `y <strong>${ETIQ_RANGOS[top3N[2]]}</strong> (<strong>${fmtPct(rPctN(top3N[2]))}</strong>).`;
    }

    topRangos =
      `Por rangos de edad, la mayor concentración de mujeres${ext} en la LNE está en ` +
      `<strong>${ETIQ_RANGOS[top3M[0]]}</strong> (<strong>${fmtPct(rPctM(top3M[0]))}</strong>), ` +
      `<strong>${ETIQ_RANGOS[top3M[1]]}</strong> (<strong>${fmtPct(rPctM(top3M[1]))}</strong>) y ` +
      `<strong>${ETIQ_RANGOS[top3M[2]]}</strong> (<strong>${fmtPct(rPctM(top3M[2]))}</strong>). ` +
      `En los hombres${ext}, los tres rangos con mayor LNE son ` +
      `<strong>${ETIQ_RANGOS[top3H[0]]}</strong> (<strong>${fmtPct(rPctH(top3H[0]))}</strong>), ` +
      `<strong>${ETIQ_RANGOS[top3H[1]]}</strong> (<strong>${fmtPct(rPctH(top3H[1]))}</strong>) y ` +
      `<strong>${ETIQ_RANGOS[top3H[2]]}</strong> (<strong>${fmtPct(rPctH(top3H[2]))}</strong>).${nbTop}`;
  }

  return { titulo, resumen, tasas, distribucion, topRangos, fuente };
}

// ────────────────────────────────────────────────────────────────
// ANÁLISIS TEXTUAL — ORIGEN
// ────────────────────────────────────────────────────────────────

export interface SemanalTextsOrigen {
  titulo: string;
  top5: string;
  especiales: string;
  brecha: string;
  fuente: string;
}

// Nombre a mostrar en la PROSA del análisis semanal por llave "snake". Nombre completo
// del catálogo para todos los estados salvo Ciudad de México, que se queda "CDMX"
// (siglas universales). Las llaves y su orden son el contrato con las columnas
// `ln_<estado>` que `generateSemanalTextsOrigen` recorre; solo cambian los valores.
// Exportada para la prueba de que llaves y orden se conservan.
export const ESTADOS_PROSA_POR_SNAKE: Record<string, string> = Object.fromEntries(
  ESTADOS_ALFABETICOS.map((e) => [claveEstadoSnake(e.clave), nombreEstadoProsa(e.cve) as string])
);

export function generateSemanalTextsOrigen(
  data: Record<string, number>,
  ambito: Ambito,
  fecha: string,
): SemanalTextsOrigen {
  const ambitoLabel = ambito === "extranjero" ? "Extranjero" : "Nacional";

  // Construir lista de estados con su LNE
  const estados: { nombre: string; lne: number; pad: number; key: string }[] = [];
  for (const [key, label] of Object.entries(ESTADOS_PROSA_POR_SNAKE)) {
    const col = textoOrigenCol(key);
    const lne = (data[`ln_${col}`] as number) ?? 0;
    const pad = (data[`pad_${col}`] as number) ?? 0;
    if (lne > 0 || pad > 0) estados.push({ nombre: label, lne, pad, key });
  }

  // LN87 y LN88
  const ln87  = (data["ln87"]  as number) ?? 0;
  const ln88  = (data["ln88"]  as number) ?? 0;
  const pad87 = (data["pad87"] as number) ?? 0;
  const pad88 = (data["pad88"] as number) ?? 0;

  // Ranking completo incluyendo LN87/LN88
  const todo: { nombre: string; lne: number; pad: number; key: string }[] = [
    ...estados,
    { nombre: "Nacidos en el extranjero (LN87)", lne: ln87, pad: pad87, key: "87" },
    { nombre: "Ciudadanos naturalizados (LN88)",  lne: ln88, pad: pad88, key: "88" },
  ].sort((a, b) => b.lne - a.lne);

  const top5 = todo.slice(0, 5);

  const lneTotal = todo.reduce((s, e) => s + e.lne, 0);
  const padTotal = todo.reduce((s, e) => s + e.pad, 0);
  const brecha = padTotal - lneTotal;

  const titulo = `Análisis Semanal por Entidad de Origen — ${ambitoLabel}`;

  const top5Text =
    `Los cinco estados con mayor LNE según entidad de origen son: ` +
    top5.map((e, i) =>
      `<strong>${e.nombre}</strong> (${fmtNum(e.lne)})` + (i < 4 ? ", " : ".")
    ).join("");

  const pos87 = todo.findIndex((e) => e.key === "87") + 1;
  const pos88 = todo.findIndex((e) => e.key === "88") + 1;
  const especiales =
    `Mexicanos nacidos en el extranjero (LN87): <strong>${fmtNum(ln87)}</strong> ` +
    `(posición #${pos87} en el ranking). ` +
    `Ciudadanos naturalizados (LN88): <strong>${fmtNum(ln88)}</strong> ` +
    `(posición #${pos88} en el ranking).`;

  const brechaText =
    `Padrón Electoral: <strong>${fmtNum(padTotal)}</strong>. ` +
    `LNE: <strong>${fmtNum(lneTotal)}</strong>. ` +
    `Brecha Padrón–LNE agregada: <strong>${fmtNum(brecha)}</strong> ciudadanos. ` +
    `Esta diferencia representa la ciudadanía inscrita en el Padrón Electoral que aún no ha ` +
    `tramitado o activado su credencial de elector — o está en proceso — y por tanto no ` +
    `aparece en la Lista Nominal. A mayor brecha, mayor el rezago de activación en la entidad.`;

  const fuente =
    "Fuente: INE. Estadística de Padrón Electoral y Lista Nominal del Electorado.";

  return { titulo, top5: top5Text, especiales, brecha: brechaText, fuente };
}
