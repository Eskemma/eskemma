// lib/fontana/ingesta/inegiPm.ts
// Adaptador de F2-1 (Pobreza), F2-2 (Pobreza extrema) y F2-14 (Población
// con ≥1 carencia social) — SOLO celdas Nacional y Estatal, migradas de
// CONEVAL 2020 a INEGI "Pobreza Multidimensional (PM) 2024" (la medición
// de pobreza multidimensional se transfirió de CONEVAL a INEGI en 2024,
// reforma LGDS vigente desde 17-jul-2025). Municipal/Distrital de estos
// 3 indicadores SIGUEN en `coneval.ts` sin cambio — INEGI-PM 2024 no
// publica nivel Municipal (confirmado con el API real: `ErrorCode: 100`
// "No se encontraron resultados", consistente con la periodicidad legal
// de la LGDS art. 36-37 — mínimo 2 años Nacional/Estatal, 5 años
// Municipal, último municipal 2020). F2-3 (Rezago Social) NO migra —
// excepción permanente, el IRS nunca fue parte del programa PM (no
// aparece ni una vez en la nota técnica de PM 2024) y depende del ciclo
// censal (próxima edición ~2030), no de la ENIGH.
//
// Metodología confirmada continua con CONEVAL 2020 (nota técnica PM
// 2024, https://www.inegi.org.mx/contenidos/desarrollosocial/pm/doc/pm_nota_tecnica_2024.pdf,
// leída completa 2026-08-18): "la medición de la pobreza multidimensional
// 2024 conserva los mismos principios conceptuales y metodológicos de
// sus ediciones previas... Al mantener la fuente de información y la
// metodología que desarrolló Coneval... se garantiza la continuidad y
// consistencia de los resultados." Los cambios documentados son ajustes
// operativos de equivalencia derivados de preguntas nuevas de la ENIGH
// 2024 (ej. categorías de afiliación a salud tras la desaparición del
// INSABI), no cambios de umbral/definición.
//
// Mecanismo: API de Indicadores (BISE) de INEGI, JSON en vivo — no un
// Excel descargable como CONEVAL. Verificado en vivo 2026-08-18:
//   https://www.inegi.org.mx/app/api/indicadores/interna_v1_3/Indicador/{codigo}/{area}/es/true/null/json/{token}
// {token} es público, embebido en el JS del propio micrositio INEGI
// (lib/componentes/biinegi/config.min.js), no una credencial personal.
// {area} = "00" Nacional, "01".."32" Estatal (ESTADO_CVE_MAP) — NO
// soporta batch real: probado con área="01,02,03" e indicador="A,B,C"
// separados por coma, el backend regresa un solo valor (concatena
// SourcesPeriod como string) en vez de un array — cada estado/indicador
// requiere su propia llamada HTTP.
//
// Códigos de indicador confirmados por coincidencia exacta de nombre
// con la definición ya usada en Fontana (no por posición en la lista):
//   F2-1  Pobreza          → 8999998769 "Población en situación de pobreza"
//   F2-2  Pobreza extrema  → 8999998767 "Población en situación de pobreza extrema"
//   F2-14 Carencia social  → 8999998763 "Población con al menos una carencia social"
// (el código "hermano" de cada uno, sin el último dígito 6/7/8/9, es la
// cifra ABSOLUTA en personas — no la usamos, Fontana siempre trabaja en
// %; NoOfDecimals/Unit del JSON lo confirman por indicador).
//
// Concurrencia de "Ver estados" (32 llamadas HTTP, una por estado, sin
// batch): medido en vivo 2026-08-18, 4 corridas de 32 en paralelo —
// 128/128 exitosas (100%), latencia total 1.3s-7.4s por corrida (variable,
// sin relación con volumen — mismo tipo de inestabilidad ya vista con un
// 500 real de este servicio en la misma sesión). Promise.all sin límite
// de concurrencia artificial, con manejo de error por estado individual
// (uno que falle no tumba los otros 31) — mismo criterio que
// resolverDesgloseMunicipiosNacional.

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_INEGI_PM = "INEGI (Pobreza Multidimensional 2024)";

const TOKEN_BISE = "96fbd1bf-21e6-28e3-6e64-2b15999d2c89";
const BASE_BISE = "https://www.inegi.org.mx/app/api/indicadores/interna_v1_3/Indicador";

const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

const CODIGO_POBREZA = "8999998769";
const CODIGO_POBREZA_EXTREMA = "8999998767";
const CODIGO_CARENCIA_SOCIAL = "8999998763";

async function consultarIndicadorBise(codigo: string, area: string): Promise<number | null> {
  const url = `${BASE_BISE}/${codigo}/${area}/es/true/null/json/${TOKEN_BISE}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`INEGI BISE HTTP ${res.status} en ${url}`);
  const json = await res.json();
  const crudo = json?.Data?.Serie?.[0]?.CurrentValue;
  if (typeof crudo !== "string") return null;
  const valor = Number(crudo);
  return Number.isFinite(valor) ? valor : null;
}

async function resolverCeldaNacionalEstatal(
  codigo: string,
  territorio: Territorio
): Promise<[CeldaFontana, CeldaFontana]> {
  const motivoError = "Error de conexión con INEGI (Pobreza Multidimensional)";

  let nacional: CeldaFontana;
  try {
    const valor = await consultarIndicadorBise(codigo, "00");
    nacional =
      valor != null
        ? { nivel: "nacional", valor: Math.round(valor * 100) / 100, unidad: "%", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_INEGI_PM }
        : { nivel: "nacional", motivo: "INEGI no reportó un valor nacional para este indicador" };
  } catch {
    nacional = { nivel: "nacional", motivo: motivoError };
  }

  if (!territorio.estado) {
    return [nacional, { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" }];
  }
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) {
    return [nacional, { nivel: "estatal", motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` }];
  }

  let estatal: CeldaFontana;
  try {
    const valor = await consultarIndicadorBise(codigo, estadoCve);
    estatal =
      valor != null
        ? { nivel: "estatal", valor: Math.round(valor * 100) / 100, unidad: "%", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_INEGI_PM }
        : { nivel: "estatal", motivo: "INEGI no reportó un valor estatal para este indicador" };
  } catch {
    estatal = { nivel: "estatal", motivo: motivoError };
  }

  return [nacional, estatal];
}

export async function resolverPobrezaInegi(territorio: Territorio): Promise<[CeldaFontana, CeldaFontana]> {
  return resolverCeldaNacionalEstatal(CODIGO_POBREZA, territorio);
}

export async function resolverPobrezaExtremaInegi(territorio: Territorio): Promise<[CeldaFontana, CeldaFontana]> {
  return resolverCeldaNacionalEstatal(CODIGO_POBREZA_EXTREMA, territorio);
}

export async function resolverCarenciaSocialInegi(territorio: Territorio): Promise<[CeldaFontana, CeldaFontana]> {
  return resolverCeldaNacionalEstatal(CODIGO_CARENCIA_SOCIAL, territorio);
}

// "Ver estados" en proyectos Nacional — 32 llamadas individuales (sin
// batch real, ver comentario de cabecera), en LOTES de 8 en vez de las
// 32 de golpe (2026-08-18) — medido en vivo con proceso nuevo por
// corrida (sin reuso de conexión, carga "fría" real): sin límite, 2 de
// 3 corridas superaron 10s y hubo fallos intermitentes reales bajo esa
// carga (hasta 6/32 "Error de conexión"). Un estado que falle no debe
// tumbar los otros 31 — motivo explícito por estado, nunca se omite del
// array (mismo contrato que el resto de Fontana: siempre las 32
// entradas, con valor o con motivo).
const TAMANO_LOTE_BISE = 8;

async function resolverUnEstado(codigo: string, cve: string): Promise<ElementoDeEstado> {
  const nombre = CVE_ESTADO_NOMBRE[cve] ?? cve;
  try {
    const valor = await consultarIndicadorBise(codigo, cve);
    const celda: CeldaFontana =
      valor != null
        ? { nivel: "estatal", valor: Math.round(valor * 100) / 100, unidad: "%", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_INEGI_PM }
        : { nivel: "estatal", motivo: "INEGI no reportó un valor estatal para este indicador" };
    return { cve, nombre, celda };
  } catch {
    return { cve, nombre, celda: { nivel: "estatal", motivo: "Error de conexión con INEGI (Pobreza Multidimensional)" } };
  }
}

async function resolverEstadosInegiGenerico(codigo: string): Promise<ElementoDeEstado[]> {
  const cves = Object.values(ESTADO_CVE_MAP);
  const resultado: ElementoDeEstado[] = [];
  for (let i = 0; i < cves.length; i += TAMANO_LOTE_BISE) {
    const lote = cves.slice(i, i + TAMANO_LOTE_BISE);
    resultado.push(...(await Promise.all(lote.map((cve) => resolverUnEstado(codigo, cve)))));
  }
  return resultado;
}

export async function resolverEstadosPobrezaInegi(): Promise<ElementoDeEstado[]> {
  return resolverEstadosInegiGenerico(CODIGO_POBREZA);
}

export async function resolverEstadosPobrezaExtremaInegi(): Promise<ElementoDeEstado[]> {
  return resolverEstadosInegiGenerico(CODIGO_POBREZA_EXTREMA);
}

export async function resolverEstadosCarenciaSocialInegi(): Promise<ElementoDeEstado[]> {
  return resolverEstadosInegiGenerico(CODIGO_CARENCIA_SOCIAL);
}
