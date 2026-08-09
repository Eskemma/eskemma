// lib/fontana/ingesta/eceg.ts
// Adaptador de Familia 1 (Sociodemográficos) sobre la bodega ECEG 2020 que
// ya vive en Sefix — no es un pipeline nuevo, no vuelve a descargar ni
// parsear nada. Solo mapea IDs de indicador de Fontana a claves ECEG ya
// curadas y resuelve el territorio del proyecto (nombres) a los códigos
// INEGI que la bodega usa como llave.
//
// Alcance: 14 de los 19 indicadores de Familia 1 — los que sí viven en
// ECEG (incluye F1-10/F1-12, desbloqueados 2026-08-02 vía extensión de
// CURATED_COLUMNS en scripts/eceg-data-pipeline.ts). F1-2, F1-11, F1-16,
// F1-17, F1-18 se resuelven en otros adaptadores
// (lib/fontana/ingesta/{iter,compendio,banxico,conapo}.ts, cierre
// 2026-07-31) y se enrutan desde lib/fontana/ingesta/index.ts, no desde
// este archivo.
//
// F1-12 (estado civil), denominador: verificado 2026-08-02 contra el
// Diccionario de Datos real de ECEG — P12YM_SOLT + P12YM_CASA (incluye
// unión libre, texto literal: "casadas por el civil y religiosamente o
// en unión libre") + P12YM_SEPA (separadas/divorciadas/viudas) cubren el
// 100% de la población 12+, sin categoría adicional pendiente.

import { ECEG_INDICATOR_MAP } from "@/lib/sefix/ecegConstants";
import { buildEcegStoragePath, fetchEcegFromStorage, type EcegNivel } from "@/lib/sefix/ecegStorage";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import {
  resolveMunicipioCve,
  normalizeGeoName,
  getMunicipiosOptions,
  getMunicipiosOptionsNacional,
  type GeoOptionNacional,
} from "@/lib/geo/municipios";
import {
  getDistritosFederalesOptions,
  getDistritosLocalesOptions,
  getDistritosFederalesOptionsNacional,
  getDistritosLocalesOptionsNacional,
} from "@/lib/geo/distritos";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import { extraerNumeroDistrito } from "@/lib/moddulo/distritoElectoral";
import {
  sumarConteo,
  calcularPorcentaje,
  promedioPonderado,
} from "@/lib/fontana/ingesta/nacionalAgregado";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { NaturalezaDato } from "@/lib/fontana/indicatorRegistry";

export const FUENTE_ETIQUETA_ECEG = "INEGI (Censo 2020, vía ECEG)";

export interface EcegIndicadorConfig {
  // Clave ECEG: numerador si tipo==="porcentaje", el valor si tipo==="directo".
  key: string;
  // "directo": ECEG ya publica el valor listo para usar (conteo o
  // promedio ya calculado por INEGI a este nivel) — sin división,
  // naturaleza dato_directo. "porcentaje": ECEG solo publica el conteo
  // crudo del numerador — Fontana divide contra denominadorKey,
  // naturaleza calculo_directo (Estatal/Municipal).
  tipo: "directo" | "porcentaje";
  denominadorKey?: string; // requerido si tipo === "porcentaje"
}

// Los 14 indicadores de Familia 1 con dato real disponible vía ECEG, más
// F2-11/F2-13 (Familia 2, Socioeconómicos — mismo mecanismo, ya curados
// en CURATED_COLUMNS/ECEG_INDICATOR_MAP, cero ingesta nueva, cierre
// Incremento 1 de Familia 2, 2026-08-07). F1-2, F1-11, F1-16, F1-17,
// F1-18 (otros adaptadores) están deliberadamente ausentes de este mapa.
export const FONTANA_ECEG_CONFIG: Record<string, EcegIndicadorConfig> = {
  "F1-1": { key: "POBTOT", tipo: "directo" },
  "F1-3": { key: "P3YM_HLI", tipo: "porcentaje", denominadorKey: "POBTOT" },
  "F1-4": { key: "HOGJEF_F", tipo: "porcentaje", denominadorKey: "TOTHOG" },
  "F1-5": { key: "GRAPROES", tipo: "directo" },
  "F1-6": { key: "PNACOE", tipo: "porcentaje", denominadorKey: "POBTOT" },
  "F1-7": { key: "POB65_MAS", tipo: "porcentaje", denominadorKey: "POBTOT" },
  "F1-8": { key: "VPH_PISOTI", tipo: "porcentaje", denominadorKey: "VIVPAR_HAB" },
  "F1-9": { key: "PRO_OCUP_C", tipo: "directo" },
  // Denominador TVIVPAR, no VIVPAR_HAB — verificado 2026-08-02: VPH_C_SERV
  // incluye viviendas "sin información de ocupantes" (texto literal del
  // Diccionario de Datos ECEG), universo que VIVPAR_HAB excluye — usar
  // VIVPAR_HAB producía porcentajes >100% (VPH_C_SERV > VIVPAR_HAB en
  // todos los municipios probados). Con TVIVPAR: Aguascalientes 84.1%,
  // rango plausible.
  "F1-10": { key: "VPH_C_SERV", tipo: "porcentaje", denominadorKey: "TVIVPAR" },
  "F1-12": { key: "P12YM_CASA", tipo: "porcentaje", denominadorKey: "__F1_12_DENOM__" },
  "F1-13": { key: "P15YM_SE", tipo: "porcentaje", denominadorKey: "P_18YMAS" },
  "F1-14": { key: "P18YM_PB", tipo: "porcentaje", denominadorKey: "P_18YMAS" },
  "F1-15": { key: "PCON_DISC", tipo: "porcentaje", denominadorKey: "POBTOT" },
  "F1-19": { key: "P3HLINHE", tipo: "porcentaje", denominadorKey: "POBTOT" },
  "F2-11": { key: "VPH_INTER", tipo: "porcentaje", denominadorKey: "VIVPAR_HAB" },
  "F2-13": { key: "PDER_SS", tipo: "porcentaje", denominadorKey: "POBTOT" },
};

// F1-12 no tiene una sola columna de denominador — su denominador es la
// suma de las 3 categorías de estado civil (ver nota arriba). Se detecta
// por este centinela en denominadorKey en vez de forzar una clave real.
const F1_12_DENOM_SENTINEL = "__F1_12_DENOM__";
const F1_12_CATEGORIAS = ["P12YM_SOLT", "P12YM_CASA", "P12YM_SEPA"] as const;

function resolverDenominador(registro: Record<string, number>, denominadorKey: string): number | undefined {
  if (denominadorKey === F1_12_DENOM_SENTINEL) {
    return F1_12_CATEGORIAS.reduce((acc, k) => acc + (registro[k] ?? 0), 0);
  }
  return registro[denominadorKey];
}

export const MOTIVO_CONECTOR_PENDIENTE =
  "Conector pendiente — disponible en el siguiente incremento de Fontana";

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

// Regresa hasta 4 celdas (nacional, estatal, distrital, municipal) —
// nunca una celda vacía sin motivo, mismo criterio ya fijado en la
// arquitectura de Fontana (Paso 3, §4, patrón de estado de consulta).
// Nacional siempre se intenta (no depende del territorio del proyecto);
// Distrital solo si el territorio es distrito_federal/distrito_local y
// se puede resolver el número de distrito.
export async function resolverIndicadorECEG(
  indicadorId: string,
  territorio: Territorio
): Promise<CeldaFontana[]> {
  const config = FONTANA_ECEG_CONFIG[indicadorId];
  if (!config) {
    return [
      { nivel: "nacional", motivo: MOTIVO_CONECTOR_PENDIENTE },
      { nivel: "estatal", motivo: MOTIVO_CONECTOR_PENDIENTE },
      { nivel: "distrital", motivo: MOTIVO_CONECTOR_PENDIENTE },
      { nivel: "municipal", motivo: MOTIVO_CONECTOR_PENDIENTE },
    ];
  }

  const nacional = await resolverNacional(indicadorId, config);

  if (!territorio.estado) {
    const motivo = "El proyecto no tiene un estado definido en su territorio";
    return [nacional, { nivel: "estatal", motivo }, { nivel: "distrital", motivo }, { nivel: "municipal", motivo }];
  }

  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, { nivel: "estatal", motivo }, { nivel: "distrital", motivo }, { nivel: "municipal", motivo }];
  }

  // El territorio del proyecto ya determina si el nivel Distrital, de
  // haber, es federal o local — nunca ambos a la vez para esta celda
  // única (para Municipal mostrando ambos simultáneamente, ver
  // resolverDistritosDeMunicipio, columnas inversas).
  const tipoDistrito: TipoDistrito = territorio.nivel === "distrito_local" ? "local" : "federal";

  const [estatal, distrital, municipal] = await Promise.all([
    resolverEstatal(config, estadoCve),
    resolverDistrital(config, estadoCve, territorio, tipoDistrito),
    resolverMunicipal(config, estadoCve, resolverNombreMunicipio(territorio)),
  ]);

  return [nacional, estatal, distrital, municipal];
}

// territorio.municipio guarda un nombre limpio SOLO cuando nivel es
// "municipal". Para distrito_federal/distrito_local, el wizard de
// territorio (por diseño, ya usado por Sefix y PESTEL — ver
// lib/moddulo/territorioLabel.ts) guarda una descripción larga tipo
// "Distrito Electoral Federal V con cabecera en Puerto Vallarta, ..." —
// hay que extraer la ciudad cabecera antes de buscarla en el catálogo
// INEGI de municipios, o la búsqueda nunca encuentra coincidencia.
function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

// Construye la celda final (valor o motivo) a partir de un registro ya
// resuelto (nacional agregado, o una fila real de Storage) — comparte la
// lógica de tipo "directo" vs "porcentaje" entre los 4 niveles.
export function celdaDesdeRegistro(
  nivel: CeldaFontana["nivel"],
  config: EcegIndicadorConfig,
  registro: Record<string, number> | undefined,
  naturalezaPorcentaje: "calculo_directo" | "estimacion_agregada",
  naturalezaDirecto: "dato_directo" | "estimacion_agregada",
  fuenteEtiqueta: string
): CeldaFontana {
  if (!registro) {
    return { nivel, motivo: "INEGI no reportó valor para este territorio" };
  }

  if (config.tipo === "directo") {
    const val = registro[config.key];
    if (typeof val !== "number") {
      return { nivel, motivo: "INEGI no reportó valor para este territorio" };
    }
    const unidad = ECEG_INDICATOR_MAP[config.key]?.unit;
    return { nivel, valor: val, unidad, naturaleza: naturalezaDirecto, fuenteEtiqueta };
  }

  const numerador = registro[config.key];
  const denominador = resolverDenominador(registro, config.denominadorKey!);
  if (typeof numerador !== "number" || !denominador) {
    return { nivel, motivo: "INEGI no reportó valor para este territorio" };
  }
  const valor = Math.round((numerador / denominador) * 10000) / 100;

  // F1-12 (estado civil): además del % de casada/unida (valor principal),
  // expone las 3 categorías crudas — mismo patrón que F1-2 (pirámide),
  // documentado en el registro.
  const distribucion =
    config.denominadorKey === F1_12_DENOM_SENTINEL
      ? F1_12_CATEGORIAS.reduce<Record<string, number>>((acc, k) => {
          acc[k] = registro[k] ?? 0;
          return acc;
        }, {})
      : undefined;

  return { nivel, valor, distribucion, unidad: "%", naturaleza: naturalezaPorcentaje, fuenteEtiqueta };
}

async function resolverEstatal(config: EcegIndicadorConfig, estadoCve: string): Promise<CeldaFontana> {
  try {
    const path = buildEcegStoragePath("nacional")!;
    const data = await fetchEcegFromStorage(path);
    return celdaDesdeRegistro("estatal", config, data[estadoCve], "calculo_directo", "dato_directo", FUENTE_ETIQUETA_ECEG);
  } catch {
    return { nivel: "estatal", motivo: "Error de conexión con la bodega de datos" };
  }
}

async function resolverMunicipal(
  config: EcegIndicadorConfig,
  estadoCve: string,
  municipioNombre: string | undefined
): Promise<CeldaFontana> {
  if (!municipioNombre) {
    return { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  }

  let municipioCve: string | null;
  try {
    municipioCve = await resolveMunicipioCve(estadoCve, municipioNombre);
  } catch {
    return { nivel: "municipal", motivo: "Error de conexión con el catálogo geográfico" };
  }
  if (!municipioCve) {
    return { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo INEGI` };
  }

  try {
    const path = buildEcegStoragePath("municipios", estadoCve)!;
    const data = await fetchEcegFromStorage(path);
    const featureKey = `${estadoCve}${municipioCve}`;
    return celdaDesdeRegistro("municipal", config, data[featureKey], "calculo_directo", "dato_directo", FUENTE_ETIQUETA_ECEG);
  } catch {
    return { nivel: "municipal", motivo: "Error de conexión con la bodega de datos" };
  }
}

// "federal" | "local" — cuál mecanismo de distrito usar. ECEG nunca
// publica distrito local (a diferencia de federal, donde 11/32 estados
// sí lo traen en su propio shapefile) — Local depende siempre de
// distritos_locales/{estado}.json (ver scripts/eceg-data-pipeline.ts,
// buildSeccionDistLocalMap).
export type TipoDistrito = "federal" | "local";

// Distrital — agregación sección→distrito ya construida y ya subida por
// el pipeline de Sefix (sefix/eceg_2020/distritos{,_locales}/{estadoCve}.json,
// mismas CURATED_COLUMNS que municipios/nacional). Requiere que el
// territorio sea distrito_federal/distrito_local (y que coincida con
// tipoDistrito) y que el número de distrito se pueda extraer del texto
// — si no, motivo explícito, nunca un valor inventado.
async function resolverDistrital(
  config: EcegIndicadorConfig,
  estadoCve: string,
  territorio: Territorio,
  tipoDistrito: TipoDistrito
): Promise<CeldaFontana> {
  const nivelEsperado = tipoDistrito === "federal" ? "distrito_federal" : "distrito_local";
  if (territorio.nivel !== nivelEsperado) {
    return { nivel: "distrital", motivo: "El proyecto no está definido a nivel distrital" };
  }

  const numeroDistrito = extraerNumeroDistrito(territorio.municipio ?? territorio.nombre, territorio.cve_distrito);
  if (!numeroDistrito) {
    return { nivel: "distrital", motivo: "No fue posible determinar el distrito electoral del territorio del proyecto" };
  }

  try {
    const path = buildEcegStoragePath(tipoDistrito === "federal" ? "distritos" : "distritos_locales", estadoCve)!;
    const data = await fetchEcegFromStorage(path);
    const featureKey = `${estadoCve}${numeroDistrito}`;
    const registro = data[featureKey];
    const celda = celdaDesdeRegistro("distrital", config, registro, "estimacion_agregada", "estimacion_agregada", FUENTE_ETIQUETA_ECEG);
    // _coberturaPct vive en el mismo registro (no es un indicador ECEG
    // real, ver nota de cobertura en scripts/eceg-data-pipeline.ts) —
    // solo tiene sentido adjuntarlo cuando sí hay valor que advertir.
    if ("valor" in celda && registro?._coberturaPct != null) {
      return { ...celda, coberturaPct: registro._coberturaPct };
    }
    return celda;
  } catch {
    return { nivel: "distrital", motivo: "Error de conexión con la bodega de datos" };
  }
}

// Forma real de distritos_municipios/{estado}.json — ver
// buildDistritosMunicipiosData en scripts/eceg-data-pipeline.ts.
// Exportado (2026-08-09): geografía electoral pura, reutilizada por
// lib/fontana/ingesta/index.ts (resolverMunicipiosDeDistritoFontana)
// para cruzar con valores de fuentes no-ECEG, sin duplicar este tipo.
export interface DistritosMunicipiosStorage {
  composicion: Record<string, Record<string, number>>;
  coberturaDistritos: Record<string, number>;
  coberturaMunicipios: Record<string, number>;
}

// Composición municipal de un distrito — para el modal "Ver datos
// municipales" (Fontana T10, cierre post-Familia 1). Reutiliza el mismo
// caché de fetchEcegFromStorage: 2 descargas reales (composición +
// municipios del estado), sin importar cuántos municipios tenga el
// distrito (hasta 119 en el caso real de Oaxaca) — nunca N llamadas.
export interface MunicipioDeDistrito {
  municipioCve: string;
  pctPobtot: number;
  // % de la población total del municipio que sí resolvió a ALGÚN
  // distrito (no solo a este) — ver nota de cobertura en
  // scripts/eceg-data-pipeline.ts. < 99 significa que pctPobtot de esta
  // fila no es confiable como fragmentación real (el modal debe avisar
  // cobertura incompleta, no fragmentación).
  coberturaMunicipioPct: number;
  celda: CeldaFontana;
}

export async function resolverMunicipiosDeDistrito(
  indicadorId: string,
  estadoCve: string,
  distritoCve: string,
  tipoDistrito: TipoDistrito = "federal"
): Promise<MunicipioDeDistrito[] | null> {
  const config = FONTANA_ECEG_CONFIG[indicadorId];
  if (!config) return null;

  const nivelStorage = tipoDistrito === "federal" ? "distritos_municipios" : "distritos_locales_municipios";
  const [distritosMunicipios, data] = await Promise.all([
    fetchEcegFromStorage<DistritosMunicipiosStorage>(buildEcegStoragePath(nivelStorage, estadoCve)!),
    fetchEcegFromStorage(buildEcegStoragePath("municipios", estadoCve)!),
  ]);

  const municipiosDelDistrito = distritosMunicipios.composicion[distritoCve];
  if (!municipiosDelDistrito) return null;

  return Object.entries(municipiosDelDistrito).map(([municipioCve, pctPobtot]) => ({
    municipioCve,
    pctPobtot,
    coberturaMunicipioPct: distritosMunicipios.coberturaMunicipios[municipioCve] ?? 100,
    celda: celdaDesdeRegistro(
      "municipal",
      config,
      data[`${estadoCve}${municipioCve}`],
      "calculo_directo",
      "dato_directo",
      FUENTE_ETIQUETA_ECEG
    ),
  }));
}

// Elemento (municipio o distrito) → nombre + celda — para el modal "Ver
// municipios"/"Ver distritos" de proyectos a nivel Estatal (Encargo 2,
// modo buscador+selección múltiple, cierre 2026-08-04). A diferencia de
// resolverMunicipiosDeDistrito (que reparte un distrito ENTRE municipios
// fragmentados, con pctPobtot/coberturaMunicipioPct), aquí cada elemento
// pertenece íntegro al estado — sin fragmentación que advertir.
export type TipoElementoEstado = "municipios" | "distritos_fed" | "distritos_loc";

export interface ElementoDeEstado {
  cve: string;
  nombre: string;
  celda: CeldaFontana;
}

const NIVEL_STORAGE_ELEMENTO: Record<TipoElementoEstado, EcegNivel> = {
  municipios: "municipios",
  distritos_fed: "distritos",
  distritos_loc: "distritos_locales",
};
const NIVEL_CELDA_ELEMENTO: Record<TipoElementoEstado, CeldaFontana["nivel"]> = {
  municipios: "municipal",
  distritos_fed: "distrital",
  distritos_loc: "distrital",
};
// municipios: dato_directo/calculo_directo (mismo criterio que resolverMunicipal).
// distritos_fed/loc: estimacion_agregada (mismo criterio que resolverDistrital,
// agregación sección→distrito, no publicación nativa de INEGI a ese nivel).
const NATURALEZA_PORCENTAJE_ELEMENTO: Record<TipoElementoEstado, "calculo_directo" | "estimacion_agregada"> = {
  municipios: "calculo_directo",
  distritos_fed: "estimacion_agregada",
  distritos_loc: "estimacion_agregada",
};
const NATURALEZA_DIRECTO_ELEMENTO: Record<TipoElementoEstado, "dato_directo" | "estimacion_agregada"> = {
  municipios: "dato_directo",
  distritos_fed: "estimacion_agregada",
  distritos_loc: "estimacion_agregada",
};

// Opciones ligeras (cve+nombre) del tipo de elemento — usadas tanto para
// el conteo (¿precarga completa o buscador?) como para el nombre de cada
// fila. Nunca dispara descarga del topojson nacional más de una vez por
// proceso (lib/geo/{municipios,distritos}.ts, caché de 2 niveles).
export async function getOpcionesElementoEstado(tipoElemento: TipoElementoEstado, estadoCve: string) {
  if (tipoElemento === "municipios") return getMunicipiosOptions(estadoCve);
  if (tipoElemento === "distritos_fed") return getDistritosFederalesOptions(estadoCve);
  return getDistritosLocalesOptions(estadoCve);
}

// Resuelve TODOS los elementos (municipios o distritos) de un estado para
// un indicador — una sola descarga de Storage (el archivo del estado
// completo, cacheado 30 min por fetchEcegFromStorage) + una sola
// resolución del catálogo de nombres (cacheada por lib/geo), sin importar
// cuántos elementos tenga el estado (hasta 570, Oaxaca municipios).
export async function resolverElementosDeEstado(
  indicadorId: string,
  estadoCve: string,
  tipoElemento: TipoElementoEstado,
  soloCves?: string[]
): Promise<ElementoDeEstado[] | null> {
  const config = FONTANA_ECEG_CONFIG[indicadorId];
  if (!config) return null;

  const nivelStorage = NIVEL_STORAGE_ELEMENTO[tipoElemento];
  const nivelCelda = NIVEL_CELDA_ELEMENTO[tipoElemento];
  const path = buildEcegStoragePath(nivelStorage, estadoCve);
  if (!path) return null;

  const [data, opciones] = await Promise.all([
    fetchEcegFromStorage(path),
    getOpcionesElementoEstado(tipoElemento, estadoCve),
  ]);

  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  return opcionesFiltradas.map(({ cve, nombre }) => ({
    cve,
    nombre,
    celda: celdaDesdeRegistro(
      nivelCelda,
      config,
      data[`${estadoCve}${cve}`],
      NATURALEZA_PORCENTAJE_ELEMENTO[tipoElemento],
      NATURALEZA_DIRECTO_ELEMENTO[tipoElemento],
      FUENTE_ETIQUETA_ECEG
    ),
  }));
}

// Nacional — ni ECEG ni ITER publican un total país; Fontana agrega los
// 32 registros estatales ya en Storage (sefix/eceg_2020/national.json,
// mismo archivo que ya lee resolverEstatal, sin nueva descarga).
// Excepción: F1-5 (escolaridad) usa la cifra oficial de INEGI, no una
// agregación de Fontana — ver cita en el registro. F1-9 (ocupantes por
// cuarto) usa promedio ponderado por VIVPAR_HAB — INEGI no publica un
// nacional directo de este indicador (verificado 2026-08-02 contra el
// comunicado nacional del Censo 2020, que solo reporta "ocupantes por
// vivienda", un indicador distinto).
const F1_5_ESCOLARIDAD_NACIONAL = 9.7; // años — INEGI, Comunicado 24/21, pág. 3/3

async function resolverNacional(indicadorId: string, config: EcegIndicadorConfig): Promise<CeldaFontana> {
  if (indicadorId === "F1-5") {
    return {
      nivel: "nacional",
      valor: F1_5_ESCOLARIDAD_NACIONAL,
      unidad: ECEG_INDICATOR_MAP[config.key]?.unit,
      naturaleza: "dato_directo",
      fuenteEtiqueta: "INEGI, Comunicado de Prensa Núm. 24/21 (25-ene-2021)",
    };
  }

  let registrosPorEstado: Record<string, Record<string, number>>;
  try {
    const path = buildEcegStoragePath("nacional")!;
    registrosPorEstado = await fetchEcegFromStorage(path);
  } catch {
    return { nivel: "nacional", motivo: "Error de conexión con la bodega de datos" };
  }

  if (indicadorId === "F1-9") {
    const valor = promedioPonderado(registrosPorEstado, config.key, "VIVPAR_HAB");
    if (valor === null) {
      return { nivel: "nacional", motivo: "INEGI no reportó valor para calcular el promedio nacional" };
    }
    return {
      nivel: "nacional",
      valor,
      unidad: ECEG_INDICATOR_MAP[config.key]?.unit,
      naturaleza: "estimacion_agregada",
      fuenteEtiqueta: `${FUENTE_ETIQUETA_ECEG} — promedio ponderado por vivienda calculado por Fontana (INEGI no publica un nacional directo de este indicador)`,
    };
  }

  if (config.tipo === "directo") {
    const valor = sumarConteo(registrosPorEstado, config.key);
    return {
      nivel: "nacional",
      valor,
      unidad: ECEG_INDICATOR_MAP[config.key]?.unit,
      naturaleza: "estimacion_agregada",
      fuenteEtiqueta: FUENTE_ETIQUETA_ECEG,
    };
  }

  const denomIsSentinel = config.denominadorKey === F1_12_DENOM_SENTINEL;
  const resultado = denomIsSentinel
    ? calcularPorcentajeEstadoCivil(registrosPorEstado, config.key)
    : calcularPorcentaje(registrosPorEstado, config.key, config.denominadorKey!);
  if (resultado === null) {
    return { nivel: "nacional", motivo: "INEGI no reportó valor para calcular el porcentaje nacional" };
  }
  return {
    nivel: "nacional",
    valor: resultado.valor,
    unidad: "%",
    naturaleza: "estimacion_agregada",
    fuenteEtiqueta: FUENTE_ETIQUETA_ECEG,
  };
}

function calcularPorcentajeEstadoCivil(
  registrosPorEstado: Record<string, Record<string, number>>,
  numCol: string
): { valor: number } | null {
  let numTotal = 0;
  let denomTotal = 0;
  for (const registro of Object.values(registrosPorEstado)) {
    numTotal += registro[numCol] ?? 0;
    denomTotal += resolverDenominador(registro, F1_12_DENOM_SENTINEL) ?? 0;
  }
  if (denomTotal === 0) return null;
  return { valor: Math.round((numTotal / denomTotal) * 10000) / 100 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas inversas (proyectos nivel "municipal" → Distrito Federal/Local)
// cierre 2026-08-05 — dado el municipio del proyecto, encuentra a qué
// distrito(s) pertenece. Inverso de resolverMunicipiosDeDistrito: en vez
// de "distrito → sus municipios", aquí es "municipio → los distritos que
// lo tocan". Mismo archivo de Storage (distritos_municipios/
// distritos_locales_municipios, ya cacheado 30 min) — se invierte en
// memoria iterando sus ~20-45 distritos por estado, sin artefacto nuevo
// (confirmado con datos reales de los 32 estados, 2026-08-05: máximo de
// distritos por municipio = 5 Federal, 12 Local — trivial en memoria).
// ─────────────────────────────────────────────────────────────────────────────

// Mismo umbral que el resto del incremento (CoberturaAdvertencia,
// FontanaMunicipiosModal) — un solo número, sin introducir uno nuevo.
const UMBRAL_COBERTURA_MUNICIPIO = 99;

export interface DistritoDeMunicipio {
  distritoCve: string;
  pctPobtot: number; // % del POBTOT del municipio que cae en este distrito
}

export type ClasificacionDistritoDeMunicipio =
  | { caso: "cobertura_incompleta"; coberturaMunicipioPct: number; distritos: DistritoDeMunicipio[] }
  | { caso: "sin_dominante"; distritos: DistritoDeMunicipio[] }
  | { caso: "dominante"; dominante: DistritoDeMunicipio; distritos: DistritoDeMunicipio[] };

// Invierte composicion[distrito][municipio] → distritos que tocan ESE
// municipio, y clasifica en los 3 casos ya diseñados. Cobertura
// incompleta tiene prioridad sobre dominante/sin-dominante — mismo
// orden ya usado en el modal de fragmentación (FontanaMunicipiosModal.tsx,
// FilaMunicipio): con cobertura incompleta, ni "dominante" ni
// "fragmentado" son medibles con precisión.
export async function clasificarDistritoDeMunicipio(
  estadoCve: string,
  municipioCve: string,
  tipoDistrito: TipoDistrito
): Promise<ClasificacionDistritoDeMunicipio | null> {
  const nivelStorage = tipoDistrito === "federal" ? "distritos_municipios" : "distritos_locales_municipios";
  const path = buildEcegStoragePath(nivelStorage, estadoCve);
  if (!path) return null;

  const data = await fetchEcegFromStorage<DistritosMunicipiosStorage>(path);
  const distritos: DistritoDeMunicipio[] = [];
  for (const [distritoCve, porMunicipio] of Object.entries(data.composicion)) {
    const pctPobtot = porMunicipio[municipioCve];
    if (pctPobtot != null) distritos.push({ distritoCve, pctPobtot });
  }
  if (distritos.length === 0) return null;

  const coberturaMunicipioPct = data.coberturaMunicipios[municipioCve] ?? 100;
  if (coberturaMunicipioPct < UMBRAL_COBERTURA_MUNICIPIO) {
    return { caso: "cobertura_incompleta", coberturaMunicipioPct, distritos };
  }

  const dominante = distritos.find((d) => d.pctPobtot >= 50) ?? (distritos.length === 1 ? distritos[0] : undefined);
  if (dominante) return { caso: "dominante", dominante, distritos };
  return { caso: "sin_dominante", distritos };
}

export interface CeldaDistritalDeMunicipio {
  nivel: "distrital_federal" | "distrital_local";
  valor?: number;
  unidad?: string;
  naturaleza?: NaturalezaDato;
  fuenteEtiqueta?: string;
  motivo?: string;
  municipioEnDistritoPct?: number;
  municipioCoberturaPct?: number;
  desglose?: { tipo: "distritos_fed" | "distritos_loc"; total: number };
}

const MOTIVO_DISTRITO_NO_DETERMINADO = "No fue posible determinar el distrito electoral de este municipio";

// Resuelve la celda de Distrito Federal o Distrito Local para un
// proyecto Municipal — los 3 casos de diseño ya aprobados. El caso
// "dominante" reutiliza celdaDesdeRegistro tal cual (mismo mecanismo ya
// usado por resolverDistrital), solo cambia CUÁL distrito se consulta
// (el dominante encontrado, no el distrito propio del proyecto).
export async function resolverDistritalDeMunicipio(
  indicadorId: string,
  estadoCve: string,
  municipioCve: string,
  tipoDistrito: TipoDistrito
): Promise<CeldaDistritalDeMunicipio> {
  const nivel = tipoDistrito === "federal" ? "distrital_federal" : "distrital_local";
  const config = FONTANA_ECEG_CONFIG[indicadorId];
  if (!config) return { nivel, motivo: MOTIVO_CONECTOR_PENDIENTE };

  let clasificacion: ClasificacionDistritoDeMunicipio | null;
  try {
    clasificacion = await clasificarDistritoDeMunicipio(estadoCve, municipioCve, tipoDistrito);
  } catch {
    return { nivel, motivo: "Error de conexión con la bodega de datos" };
  }
  if (!clasificacion) return { nivel, motivo: MOTIVO_DISTRITO_NO_DETERMINADO };

  if (clasificacion.caso === "cobertura_incompleta") {
    return {
      nivel,
      motivo: "Cobertura de datos incompleta para este municipio — no es posible determinar con precisión su distrito.",
      municipioCoberturaPct: clasificacion.coberturaMunicipioPct,
    };
  }

  if (clasificacion.caso === "sin_dominante") {
    return {
      nivel,
      motivo: "Este municipio no tiene un distrito dominante.",
      desglose: { tipo: tipoDistrito === "federal" ? "distritos_fed" : "distritos_loc", total: clasificacion.distritos.length },
    };
  }

  try {
    const path = buildEcegStoragePath(tipoDistrito === "federal" ? "distritos" : "distritos_locales", estadoCve)!;
    const data = await fetchEcegFromStorage(path);
    const registro = data[`${estadoCve}${clasificacion.dominante.distritoCve}`];
    const celda = celdaDesdeRegistro(
      "distrital",
      config,
      registro,
      "estimacion_agregada",
      "estimacion_agregada",
      FUENTE_ETIQUETA_ECEG
    );
    if ("valor" in celda) {
      return {
        nivel,
        valor: celda.valor,
        unidad: celda.unidad,
        naturaleza: celda.naturaleza,
        fuenteEtiqueta: celda.fuenteEtiqueta,
        municipioEnDistritoPct: clasificacion.dominante.pctPobtot,
      };
    }
    return { nivel, motivo: celda.motivo };
  } catch {
    return { nivel, motivo: "Error de conexión con la bodega de datos" };
  }
}

// Lista completa de distritos que tocan un municipio, con su valor de
// indicador — para el modal inverso (caso "sin_dominante" arriba).
// Mismo criterio que resolverMunicipiosDeDistrito: 2 descargas reales
// (composición ya cargada por clasificarDistritoDeMunicipio + el
// archivo distritos/distritos_locales), nunca N llamadas — y, a
// diferencia de aquel, el resultado real medido nunca supera 12
// elementos (máximo nacional, Local) — siempre precarga completa.
export interface DistritoDeMunicipioConValor {
  distritoCve: string;
  nombre: string;
  pctPobtot: number;
  celda: CeldaFontana;
}

export async function resolverDistritosDeMunicipio(
  indicadorId: string,
  estadoCve: string,
  municipioCve: string,
  tipoDistrito: TipoDistrito
): Promise<DistritoDeMunicipioConValor[] | null> {
  const config = FONTANA_ECEG_CONFIG[indicadorId];
  if (!config) return null;

  const clasificacion = await clasificarDistritoDeMunicipio(estadoCve, municipioCve, tipoDistrito);
  if (!clasificacion) return null;

  const path = buildEcegStoragePath(tipoDistrito === "federal" ? "distritos" : "distritos_locales", estadoCve)!;
  const [data, opciones] = await Promise.all([
    fetchEcegFromStorage(path),
    tipoDistrito === "federal" ? getDistritosFederalesOptions(estadoCve) : getDistritosLocalesOptions(estadoCve),
  ]);
  const nombrePorCve = new Map(opciones.map((o) => [o.cve, o.nombre]));

  return clasificacion.distritos.map(({ distritoCve, pctPobtot }) => ({
    distritoCve,
    nombre: nombrePorCve.get(distritoCve) ?? `Distrito ${distritoCve}`,
    pctPobtot,
    celda: celdaDesdeRegistro(
      "distrital",
      config,
      data[`${estadoCve}${distritoCve}`],
      "estimacion_agregada",
      "estimacion_agregada",
      FUENTE_ETIQUETA_ECEG
    ),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas Nacional (cierre 2026-08-06) — Nacional → Estatal (32, precarga
// completa) / Distrital Federal (300) / Distrital Local (679) / Municipal
// (2,477 — verificado con 2 fuentes independientes, ver plan de
// investigación; NO usar 2,469, cifra nunca medida directamente).
// Deliberadamente TipoElementoNacional es un tipo DISTINTO de
// TipoElementoEstado (aunque comparten 3 valores): la resolución de
// valores es estructuralmente distinta — Estatal siempre lee UN estado,
// Nacional puede necesitar leer hasta 32.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoElementoNacional = "estados" | "municipios" | "distritos_fed" | "distritos_loc";

export interface ElementoDeNacional extends ElementoDeEstado {
  estadoCve: string;
}

// Reverso de ESTADO_CVE_MAP — mismo patrón ya usado en lib/geo/municipios.ts
// y lib/geo/distritos.ts (cada uno con su propia copia privada); aquí se
// construye una tercera vez porque este módulo no importa esos archivos
// solo por este mapa. Costo trivial (32 entradas).
const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

// "Ver estados" — lee national.json (32 filas, YA cacheado por
// resolverEstatal/resolverNacional, sin nueva descarga) y mapea cada fila
// a un elemento — una sola lectura de Storage, sin importar que sean 32
// "filas" a mostrar. Siempre precarga completa (32 ≤ 119).
export async function resolverEstadosNacional(indicadorId: string): Promise<ElementoDeEstado[] | null> {
  const config = FONTANA_ECEG_CONFIG[indicadorId];
  if (!config) return null;

  const path = buildEcegStoragePath("nacional")!;
  const data = await fetchEcegFromStorage(path);

  return Object.entries(data).map(([estadoCve, registro]) => ({
    cve: estadoCve,
    nombre: CVE_ESTADO_NOMBRE[estadoCve] ?? estadoCve,
    celda: celdaDesdeRegistro("estatal", config, registro, "calculo_directo", "dato_directo", FUENTE_ETIQUETA_ECEG),
  }));
}

// Índice ligero (cve+nombre+estadoCve+estadoNombre) para el modo buscador
// de Nacional → Distritos Federales/Locales/Municipios — delega en las
// funciones de agregación nacional ya construidas y ya protegidas contra
// concurrencia (Fase 1, 2026-08-06). "estados" no aplica aquí — siempre
// pasa por resolverEstadosNacional (precarga completa, nunca buscador).
export async function getOpcionesElementoNacional(
  tipoElemento: Exclude<TipoElementoNacional, "estados">
): Promise<GeoOptionNacional[]> {
  if (tipoElemento === "municipios") return getMunicipiosOptionsNacional();
  if (tipoElemento === "distritos_fed") return getDistritosFederalesOptionsNacional();
  return getDistritosLocalesOptionsNacional();
}

// Resuelve valores para una selección de elementos que puede cruzar
// MÚLTIPLES estados (modo buscador, Nacional) — agrupa por estadoCve
// (nunca N llamadas por N elementos; una lectura de Storage POR ESTADO
// representado en la selección) y delega cada grupo a
// resolverElementosDeEstado ya existente, reutilizando toda su lógica de
// resolución sin duplicarla. Primer uso real del patrón "batch agrupado
// por estado" diseñado en el Encargo 2. Medido en frío (2026-08-06, caso
// extremo: selección de los 2,477 municipios, 32 grupos en paralelo):
// 5,713ms — mismo rango que la descarga+conversión única ya esperada, el
// guard de single-flight de Fase 1 protege este patrón sin cambios
// adicionales (verificado, no asumido).
export async function resolverElementosDeNacional(
  indicadorId: string,
  tipoElemento: Exclude<TipoElementoNacional, "estados">,
  seleccion: { estadoCve: string; cve: string }[]
): Promise<ElementoDeNacional[] | null> {
  const config = FONTANA_ECEG_CONFIG[indicadorId];
  if (!config) return null;

  const porEstado = new Map<string, string[]>();
  for (const { estadoCve, cve } of seleccion) {
    if (!porEstado.has(estadoCve)) porEstado.set(estadoCve, []);
    porEstado.get(estadoCve)!.push(cve);
  }

  const tipoElementoEstado: TipoElementoEstado = tipoElemento;
  const porGrupo = await Promise.all(
    [...porEstado.entries()].map(async ([estadoCve, cves]) => {
      const elementos = await resolverElementosDeEstado(indicadorId, estadoCve, tipoElementoEstado, cves);
      return (elementos ?? []).map((el) => ({ ...el, estadoCve }));
    })
  );

  return porGrupo.flat();
}
