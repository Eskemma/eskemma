// lib/fontana/ingesta/cepalstat.ts
// Adaptador de F4-2 (Gini internacional), F4-9 (Desconfianza en
// partidos/congreso), F4-10 (Confianza en la policía) y F4-11 (Confianza
// en el poder judicial) — Familia 4.
//
// Verificado 2026-08-21 vía GET https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator/{id}/data?lang=es
// API pública real, JSON, SIN token ni registro (contradice una
// suposición intermedia de una búsqueda web que sugería XML+registro —
// descartada al probar la API real, header.context:"public", code:200
// sin ninguna clave).
//
// F4-2 (Gini) — indicator_id 3289 "Índice de Gini de concentración del
// ingreso". Valores reales de México: ~0.47–0.53 según año/desglose,
// notablemente distinto del Gini de Banco Mundial (~0.43) — 2
// metodologías reales, no un error de lectura (ver plan, Ronda 2,
// Decisión 3). CEPALSTAT elegido como canónico:
//   - Fuente primaria: BADEHOG — CEPAL recalcula directo desde microdatos
//     de encuestas de hogares (ENIGH para México).
//   - Concepto de ingreso: per cápita de las PERSONAS, incluye
//     explícitamente personas con ingreso cero (metadata de la API).
//   - Quiebre metodológico propio, documentado por footnote: "Medición
//     de ingresos comparable hasta 2014" (12429) vs. "comparable desde
//     2016" (12428) — se usa la serie post-2016 para consistencia.
//   - Banco Mundial (SI.POV.GINI) no garantiza el mismo agregado de
//     bienestar entre países (sourceNote: "income or, in some cases,
//     consumption expenditure").
//
// F4-9/F4-10/F4-11 — confirmado vía /indicator/{id}/sources cuál de los
// 4 candidatos de "confianza institucional" cita realmente a
// Latinobarómetro (fuente CEPALSTAT id 480, "tabulaciones especiales de
// las encuestas de opinión realizadas por la Corporación Latinobarómetro
// en los respectivos países"):
//   995  → Desconfianza en partidos políticos y el congreso — Latinobarómetro ✓ (F4-9)
//   3257 → Confianza en la policía — Latinobarómetro ✓ (F4-10)
//   5528 → Confianza en el poder judicial — Latinobarómetro ✓ (F4-11)
//   5653 → Confianza en la municipalidad — LAPOP, NO Latinobarómetro — descartado
// No existe un indicador CEPALSTAT genérico "confianza en
// instituciones" — el catálogo original nombraba un concepto singular
// que en la fuente real es una canasta de 3 instituciones distintas. Se
// muestran como 3 indicadores independientes (nunca un promedio propio
// sin metodología real detrás). Cobertura real de país confirmada: 18
// países LATAM exactos (ARG/BOL/BRA/CHL/COL/CRI/DOM/ECU/GTM/HND/MEX/
// NIC/PAN/PER/PRY/SLV/URY/VEN) — no global, aunque la dimensión "País"
// del catálogo liste países no-LATAM (ej. Alemania) como metadata sin
// datos reales detrás para estos indicadores.
//
// BUG REAL corregido en Ronda 5 (2026-08-22), diagnosticado con
// evidencia real (repetición de /indicator/{id}/data + /dimensions):
//
// 1. `dim_326` ("Área geográfica", miembro 327 = "Nacional") SOLO existe
//    en el shape de datos de F4-2 (Gini) — F4-9/F4-10/F4-11 no tienen
//    ese campo en absoluto. Usan una dimensión de SEXO en su lugar, con
//    un id de dimensión DISTINTO por indicador:
//      995  (F4-9)  → dim_4821, miembro 4822 = "Ambos sexos"
//      3257 (F4-10) → dim_4821, miembro 4822 = "Ambos sexos"
//      5528 (F4-11) → dim_144,  miembro 146  = "Ambos sexos"
//    El código anterior filtraba TODOS los indicadores por
//    `dim_326 === 327` — como ese campo no existe en los registros de
//    995/3257/5528, el filtro nunca encontraba nada → "Sin dato" para
//    los 5 países en los 3 indicadores, aunque México sí tiene 69
//    registros reales por indicador. Corregido con
//    DIMENSION_TOTAL_POR_INDICADOR (mapa explícito por indicador, no
//    una constante única).
//
// 2. `dim_29117` ("Años__ESTANDAR", dimensión compartida 1900-2100 en
//    todo CEPALSTAT) es un ID DE MIEMBRO, no el año real — el código
//    anterior lo mostraba tal cual en `fuenteEtiqueta` (ej. "CEPALSTAT
//    (29194)" en vez de "CEPALSTAT (2024)", visible en la verificación
//    visual de Raúl). Corregido resolviendo el nombre real del miembro
//    vía /indicator/{id}/dimensions (cacheado igual que los datos).

import type { CeldaComparativaPais, PaisComparativoCompleto } from "@/lib/fontana/tablaComparativaInternacional";
import { ISO3_A_NOMBRE } from "@/lib/fontana/familia4Catalogo";

const INDICATOR_ID_CEPALSTAT: Record<string, number> = {
  "F4-2": 3289,
  "F4-9": 995,
  "F4-10": 3257,
  "F4-11": 5528,
};

const UNIDAD: Record<string, string> = {
  "F4-2": "índice (0-1)",
  "F4-9": "%",
  "F4-10": "%",
  "F4-11": "%",
};

// Dimensión + miembro que representa el "total" (nacional, ambos sexos,
// etc.) — DISTINTO por indicador, confirmado vía /indicator/{id}/data y
// /indicator/{id}/dimensions (ver bug real documentado arriba). Nunca
// asumir la misma dimensión para 2 indicadores solo porque comparten
// fuente (995/3257 comparten dim_4821, pero 5528 usa dim_144 aunque
// mida lo mismo — "confianza en el poder judicial" simplemente vive en
// un dataset con esquema de dimensiones propio dentro de CEPALSTAT).
const DIMENSION_TOTAL_POR_INDICADOR: Record<string, { campo: string; valorTotal: number }> = {
  "F4-2": { campo: "dim_326", valorTotal: 327 }, // Área geográfica → Nacional
  "F4-9": { campo: "dim_4821", valorTotal: 4822 }, // Sexo → Ambos sexos
  "F4-10": { campo: "dim_4821", valorTotal: 4822 },
  "F4-11": { campo: "dim_144", valorTotal: 146 },
};

const DIM_AÑOS_ID = 29117;

// Registro crudo de /indicator/{id}/data — trae SIEMPRE iso3/value/
// dim_29117 (año, como ID de miembro) + dimensiones adicionales que
// varían por indicador (dim_326 para Gini, dim_4821/dim_144 para
// confianza institucional) — se accede a esas por índice dinámico
// (Record<string, number>), nunca tipadas como campo fijo.
interface RegistroCepalstat {
  value: string;
  iso3: string;
  dim_29117: number;
  [dimensionAdicional: string]: string | number;
}

interface RespuestaCepalstatData {
  body: { data: RegistroCepalstat[] };
}

interface DimensionMiembro {
  id: number;
  name: string;
}

interface DimensionCepalstat {
  id: number;
  members: DimensionMiembro[];
}

interface RespuestaCepalstatDimensiones {
  body: { dimensions: DimensionCepalstat[] };
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheDatos = new Map<number, { datos: RegistroCepalstat[]; expira: number }>();
const enVueloDatos = new Map<number, Promise<RegistroCepalstat[]>>();
const cacheAños = new Map<number, { mapa: Map<number, string>; expira: number }>();
const enVueloAños = new Map<number, Promise<Map<number, string>>>();

async function fetchDatosIndicador(indicatorId: number): Promise<RegistroCepalstat[]> {
  const cacheado = cacheDatos.get(indicatorId);
  if (cacheado && cacheado.expira > Date.now()) return cacheado.datos;

  const enCurso = enVueloDatos.get(indicatorId);
  if (enCurso) return enCurso;

  const promesa = (async (): Promise<RegistroCepalstat[]> => {
    const url = `https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator/${indicatorId}/data?lang=es`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CEPALSTAT respondió ${res.status} para indicador ${indicatorId}`);
    const json = (await res.json()) as RespuestaCepalstatData;
    return json.body.data;
  })();
  enVueloDatos.set(indicatorId, promesa);
  try {
    const datos = await promesa;
    cacheDatos.set(indicatorId, { datos, expira: Date.now() + CACHE_TTL_MS });
    return datos;
  } finally {
    enVueloDatos.delete(indicatorId);
  }
}

// Mapa miembro→año real de la dimensión "Años__ESTANDAR" (id 29117,
// compartida por todo CEPALSTAT, rango sintético 1900-2100) — sin esto,
// dim_29117 se mostraría como un ID de miembro crudo (ej. 29194) en vez
// del año real (2024), bug real ya confirmado en la verificación visual
// de esta ronda.
async function fetchMapaAños(indicatorId: number): Promise<Map<number, string>> {
  const cacheado = cacheAños.get(indicatorId);
  if (cacheado && cacheado.expira > Date.now()) return cacheado.mapa;

  const enCurso = enVueloAños.get(indicatorId);
  if (enCurso) return enCurso;

  const promesa = (async (): Promise<Map<number, string>> => {
    const url = `https://api-cepalstat.cepal.org/cepalstat/api/v1/indicator/${indicatorId}/dimensions?lang=es`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CEPALSTAT (dimensiones) respondió ${res.status} para indicador ${indicatorId}`);
    const json = (await res.json()) as RespuestaCepalstatDimensiones;
    const dimAños = json.body.dimensions.find((d) => d.id === DIM_AÑOS_ID);
    return new Map((dimAños?.members ?? []).map((m) => [m.id, m.name]));
  })();
  enVueloAños.set(indicatorId, promesa);
  try {
    const mapa = await promesa;
    cacheAños.set(indicatorId, { mapa, expira: Date.now() + CACHE_TTL_MS });
    return mapa;
  } finally {
    enVueloAños.delete(indicatorId);
  }
}

// Registro más reciente del "total" (Nacional para Gini, Ambos sexos
// para confianza institucional) de un país — entre los que coincidan,
// el de mayor dim_29117 (el ID de miembro de año crece monótonamente
// con el año real, confirmado contra la dimensión completa — comparar
// el ID crudo para "más reciente" es válido aunque no sea el año en sí).
function masRecienteTotal(datos: RegistroCepalstat[], iso3: string, campo: string, valorTotal: number): RegistroCepalstat | null {
  const delPais = datos.filter((d) => d.iso3 === iso3 && d[campo] === valorTotal);
  if (delPais.length === 0) return null;
  return delPais.reduce((a, b) => (b.dim_29117 > a.dim_29117 ? b : a));
}

export async function resolverCepalstat(indicadorId: string, isos3: string[]): Promise<Map<string, CeldaComparativaPais>> {
  const indicatorId = INDICATOR_ID_CEPALSTAT[indicadorId];
  const unidad = UNIDAD[indicadorId];
  const dimensionTotal = DIMENSION_TOTAL_POR_INDICADOR[indicadorId];
  const porPais = new Map<string, CeldaComparativaPais>();

  let datos: RegistroCepalstat[];
  let mapaAños: Map<number, string>;
  try {
    [datos, mapaAños] = await Promise.all([fetchDatosIndicador(indicatorId), fetchMapaAños(indicatorId)]);
  } catch {
    for (const iso3 of isos3) {
      porPais.set(iso3, { iso3, estadoConsulta: "error_conexion", motivo: "Error de conexión con CEPALSTAT" });
    }
    return porPais;
  }

  for (const iso3 of isos3) {
    const registro = masRecienteTotal(datos, iso3, dimensionTotal.campo, dimensionTotal.valorTotal);
    if (!registro) {
      porPais.set(iso3, { iso3, estadoConsulta: "sin_datos_confirmado", motivo: "CEPALSTAT no tiene dato para este país — cobertura limitada a América Latina y el Caribe" });
      continue;
    }
    const año = mapaAños.get(registro.dim_29117) ?? String(registro.dim_29117);
    porPais.set(iso3, {
      iso3,
      valor: Number(registro.value),
      unidad,
      naturaleza: "dato_directo",
      fuenteEtiqueta: `CEPALSTAT (${año})`,
      estadoConsulta: "ok",
    });
  }
  return porPais;
}

// Todos los países reales con dato — para el modal "Ver resto de
// países" (Punto B, Ronda 6). Cobertura real de CEPALSTAT confirmada
// como solo América Latina y el Caribe (18 países), nunca global — ver
// ALCANCE_LATAM en familia4Catalogo.ts, usado por el modal para mostrar
// el aviso correspondiente.
export async function resolverCepalstatTodos(indicadorId: string): Promise<PaisComparativoCompleto[]> {
  const indicatorId = INDICATOR_ID_CEPALSTAT[indicadorId];
  const unidad = UNIDAD[indicadorId];
  const dimensionTotal = DIMENSION_TOTAL_POR_INDICADOR[indicadorId];
  const [datos, mapaAños] = await Promise.all([fetchDatosIndicador(indicatorId), fetchMapaAños(indicatorId)]);

  const isosReales = new Set(datos.map((d) => d.iso3));
  const resultado: PaisComparativoCompleto[] = [];
  for (const iso3 of isosReales) {
    const nombre = ISO3_A_NOMBRE[iso3];
    if (!nombre) continue; // fuera del set cerrado de Iberoamérica — no debería ocurrir, ver nota junto a ISO3_A_NOMBRE
    const registro = masRecienteTotal(datos, iso3, dimensionTotal.campo, dimensionTotal.valorTotal);
    if (!registro) continue;
    const año = mapaAños.get(registro.dim_29117) ?? String(registro.dim_29117);
    resultado.push({
      iso3,
      nombre,
      celda: { iso3, valor: Number(registro.value), unidad, naturaleza: "dato_directo", fuenteEtiqueta: `CEPALSTAT (${año})`, estadoConsulta: "ok" },
    });
  }
  return resultado;
}
