// lib/fontana/ingesta/bancoMundial.ts
// Adaptador de F4-1 (PIB per cápita PPA), F4-4 (Pobreza línea
// internacional) y F4-5 (Inflación) — Familia 4.
//
// Verificado 2026-08-21 vía GET https://api.worldbank.org/v2/country/{iso3}/indicator/{id}?format=json
// NY.GDP.PCAP.PP.CD → indicator.value:"GDP per capita, PPP (current international $)"
//   MEX 2025: 25868.48, COL 2025: 22640.42
// SI.POV.DDAY → indicator.value:"Poverty headcount ratio at $3.00 a day (2021 PPP) (% of population)"
//   (la migración $2.15→$3.00/2021 PPP que el catálogo anticipaba como
//   pendiente ya está vigente del lado de la fuente — no hay "cambio" que
//   marcar, ya ocurrió)
// FP.CPI.TOTL.ZG → indicator.value:"Inflation, consumer prices (annual %)"
//   MEX 2025: 3.81, COL 2025: 5.14
//
// El FMI (fuente secundaria del catálogo original para F4-1/F4-5,
// documentar BM-vs-FMI y frontera histórico/proyección) está bloqueado a
// nivel de infraestructura de red (Akamai "Access Denied" contra
// imf.org/external/datamapper/*, confirmado con curl + user-agent de
// navegador real, no un bloqueo de bot-UA) — LIMITACIÓN CONOCIDA ACTIVA,
// ver CoberturaAdvertencia nivel "fmi_no_disponible". Solo Banco Mundial
// por ahora; explorar el portal SDMX de data.imf.org en una ronda aparte
// (no bloquea esta implementación).
//
// Ronda 6 (2026-08-22) — mejora de rendimiento: antes N llamadas (una
// por país). Ahora 1 sola llamada por indicador con `country=all`
// (58 KB medido en vivo, mismo orden de magnitud que lo que Fontana ya
// cachea completo para PNUD/RSF/TI) — sirve tanto la fila principal como
// el modal "Ver resto de países" con el mismo fetch. `country=all`
// mezcla 217 países reales con 78 agregados regionales/de ingreso (ej.
// "Arab World", "Caribbean small states", confirmado con
// /v2/country?format=json: `region.id === "NA"` distingue agregados) —
// se filtra contra el catálogo de países reales de Banco Mundial (cache
// separado, TTL 24h) para que el modal nunca muestre un agregado como si
// fuera un país. Nombres en inglés (name/country.value de la propia API,
// sin traducción — WB no expone `language=es` de forma funcional,
// verificado en vivo) — aceptable para nombres de país, la mayoría son
// reconocibles igual en ambos idiomas.
//
// Sin caché en Storage — mismo criterio que coneval.ts/inegiPm.ts, solo
// caché en memoria de proceso, TTL 24h, single-flight.

import type { CeldaComparativaPais, PaisComparativoCompleto } from "@/lib/fontana/tablaComparativaInternacional";

const INDICADOR_WB: Record<string, string> = {
  "F4-1": "NY.GDP.PCAP.PP.CD",
  "F4-4": "SI.POV.DDAY",
  "F4-5": "FP.CPI.TOTL.ZG",
};

const UNIDAD_WB: Record<string, string> = {
  "F4-1": "USD PPA",
  "F4-4": "%",
  "F4-5": "%",
};

interface ObservacionWB {
  countryiso3code: string;
  country: { value: string };
  date: string;
  value: number | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheIndicador = new Map<string, { porPais: Map<string, ObservacionWB>; expira: number }>();
const enVueloIndicador = new Map<string, Promise<Map<string, ObservacionWB>>>();
let cachePaisesReales: { isos3: Set<string>; expira: number } | null = null;
let enVueloPaisesReales: Promise<Set<string>> | null = null;

// Catálogo de países reales de Banco Mundial (excluye agregados
// regionales/de ingreso, ver nota arriba) — se descarga una sola vez
// (mismo TTL 24h que el resto), independiente del indicador.
async function fetchPaisesReales(): Promise<Set<string>> {
  if (cachePaisesReales && cachePaisesReales.expira > Date.now()) return cachePaisesReales.isos3;
  if (enVueloPaisesReales) return enVueloPaisesReales;

  enVueloPaisesReales = (async (): Promise<Set<string>> => {
    const res = await fetch("https://api.worldbank.org/v2/country?format=json&per_page=300");
    if (!res.ok) throw new Error(`Banco Mundial (catálogo de países) respondió ${res.status}`);
    const json = (await res.json()) as [unknown, { id: string; region: { id: string } }[]];
    const reales = (json[1] ?? []).filter((c) => c.region.id !== "NA").map((c) => c.id);
    return new Set(reales);
  })();
  try {
    const isos3 = await enVueloPaisesReales;
    cachePaisesReales = { isos3, expira: Date.now() + CACHE_TTL_MS };
    return isos3;
  } finally {
    enVueloPaisesReales = null;
  }
}

// Última observación real (no nula) por país para un indicador — 1 sola
// llamada `country=all`, filtra huecos localmente en vez de pedir un
// país a la vez.
async function fetchTodosLosPaises(indicadorWB: string): Promise<Map<string, ObservacionWB>> {
  const cacheado = cacheIndicador.get(indicadorWB);
  if (cacheado && cacheado.expira > Date.now()) return cacheado.porPais;

  const enCurso = enVueloIndicador.get(indicadorWB);
  if (enCurso) return enCurso;

  const promesa = (async (): Promise<Map<string, ObservacionWB>> => {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${indicadorWB}?format=json&mrnev=1&per_page=300`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Banco Mundial respondió ${res.status} para ${indicadorWB}`);
    const json = (await res.json()) as [{ pages: number }, ObservacionWB[] | null];
    // `mrnev=1` ya trae el valor no-nulo más reciente por país en una
    // sola observación — no hace falta reducir por fecha.
    const porPais = new Map<string, ObservacionWB>();
    for (const obs of json[1] ?? []) {
      if (obs.value !== null) porPais.set(obs.countryiso3code, obs);
    }
    return porPais;
  })();
  enVueloIndicador.set(indicadorWB, promesa);
  try {
    const porPais = await promesa;
    cacheIndicador.set(indicadorWB, { porPais, expira: Date.now() + CACHE_TTL_MS });
    return porPais;
  } finally {
    enVueloIndicador.delete(indicadorWB);
  }
}

// F4-4 (Pobreza línea internacional) — verificado en vivo en Ronda 7
// (llamada real a SI.POV.DDAY para Maldivas/Catar/Eslovenia): la API
// regresa `value: 0` literal, no `null` — son ceros reales (a la línea
// de $3.00/día, la encuesta encontró 0.0% de la población), no un bug
// de conversión null→0. Indistinguible de un error sin contexto para el
// usuario (15 países consecutivos en "0%"), así que se acompaña de una
// nota aclaratoria explícita en vez de mostrarse sin más.
const NOTA_CERO_REAL_F44 = "Valor real reportado por la fuente — no es un error ni una ausencia de dato.";

function celdaDesdeObservacion(iso3: string, obs: ObservacionWB | undefined, unidad: string, indicadorId: string): CeldaComparativaPais {
  if (!obs) return { iso3, estadoConsulta: "sin_datos_confirmado", motivo: "Banco Mundial no tiene dato reciente para este país" };
  return {
    iso3,
    valor: obs.value!,
    unidad,
    naturaleza: "dato_directo",
    fuenteEtiqueta: `Banco Mundial (${obs.date})`,
    estadoConsulta: "ok",
    notaAclaratoria: indicadorId === "F4-4" && obs.value === 0 ? NOTA_CERO_REAL_F44 : undefined,
  };
}

export async function resolverBancoMundial(indicadorId: string, isos3: string[]): Promise<Map<string, CeldaComparativaPais>> {
  const indicadorWB = INDICADOR_WB[indicadorId];
  const unidad = UNIDAD_WB[indicadorId];
  const porPais = new Map<string, CeldaComparativaPais>();

  let datos: Map<string, ObservacionWB>;
  try {
    datos = await fetchTodosLosPaises(indicadorWB);
  } catch {
    for (const iso3 of isos3) {
      porPais.set(iso3, { iso3, estadoConsulta: "error_conexion", motivo: "Error de conexión con Banco Mundial" });
    }
    return porPais;
  }

  for (const iso3 of isos3) {
    porPais.set(iso3, celdaDesdeObservacion(iso3, datos.get(iso3), unidad, indicadorId));
  }
  return porPais;
}

// Todos los países reales con dato — para el modal "Ver resto de
// países" (Punto B, Ronda 6). Excluye agregados regionales/de ingreso.
export async function resolverBancoMundialTodos(indicadorId: string): Promise<PaisComparativoCompleto[]> {
  const indicadorWB = INDICADOR_WB[indicadorId];
  const unidad = UNIDAD_WB[indicadorId];
  const [datos, paisesReales] = await Promise.all([fetchTodosLosPaises(indicadorWB), fetchPaisesReales()]);

  const resultado: PaisComparativoCompleto[] = [];
  for (const [iso3, obs] of datos) {
    if (!paisesReales.has(iso3)) continue;
    resultado.push({ iso3, nombre: obs.country.value, celda: celdaDesdeObservacion(iso3, obs, unidad, indicadorId) });
  }
  return resultado;
}
