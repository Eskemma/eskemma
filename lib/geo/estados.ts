// lib/geo/estados.ts
// Catálogo de los 32 estados + resolución ÚNICA de "nombre de estado" → estado.
// LÓGICA PURA (sin firebase, topojson ni red): importable desde servidor,
// cliente y scripts de pipeline. Reemplaza las ~18 implementaciones que había
// (15 copias de `resolveEstadoCve` en adaptadores de Fontana, `resolveEstadoName`
// de Sefix y `getCveEntidad` de lib/geo) que discrepaban entre sí para
// "México", "CDMX", los nombres oficiales largos y las entradas con espacios.
// Ver el diagnóstico del 2026-09-19 y docs/ecosistema/T10-fontana/
// claves-geograficas-no-confiables.md.
//
// DOS REPRESENTACIONES del mismo dato canónico — nunca colapsadas en una:
//   · clave interna (`clave`): para COMPARAR / UNIR / nombrar archivos.
//     MAYÚSCULAS, sin acentos, Ñ/Ü conservadas (mismo patrón que
//     `normalizeGeoName`, que ya usa Sefix). Ej.: "ESTADO DE MEXICO".
//   · nombre a mostrar (`nombre`): para el usuario. Capitalización normal,
//     CON acentos, en forma corta. Ej.: "Estado de México", "Michoacán".
//     (Los distritos electorales siguen otra convención de display — ver
//     ./display.ts.)
//
// Regla sobre "México": aquí "México" es el ESTADO (CVE 15), igual que en la
// copia de Cloud Functions y en las fuentes de datos (DERFE, SESNSP, ENIGH…).
// El PAÍS "México" (selector de país del proyecto, `territorio.pais`, y el
// `nombre` de un territorio de nivel "nacional") es un contexto aparte: NUNCA
// se debe pasar `territorio.pais` ni el `nombre` de un territorio nacional a
// estas funciones — para "alcance nacional" existe `esNacional`. (La
// desambiguación de texto libre —"dame la votación en México"— queda pendiente
// para la capa conversacional, no se resuelve aquí.)

import { normalizarNombreMunicipio } from "./municipioCanonico";

export interface EstadoCatalogo {
  /** CVE de 2 dígitos (INE/INEGI). */
  cve: string;
  /** Clave interna: MAYÚSCULAS sin acentos. Es la llave de ESTADO_CVE_MAP. */
  clave: string;
  /** Nombre corto a mostrar al usuario, con acentos. */
  nombre: string;
}

export const ESTADOS: readonly EstadoCatalogo[] = [
  { cve: "01", clave: "AGUASCALIENTES", nombre: "Aguascalientes" },
  { cve: "02", clave: "BAJA CALIFORNIA", nombre: "Baja California" },
  { cve: "03", clave: "BAJA CALIFORNIA SUR", nombre: "Baja California Sur" },
  { cve: "04", clave: "CAMPECHE", nombre: "Campeche" },
  { cve: "05", clave: "COAHUILA", nombre: "Coahuila" },
  { cve: "06", clave: "COLIMA", nombre: "Colima" },
  { cve: "07", clave: "CHIAPAS", nombre: "Chiapas" },
  { cve: "08", clave: "CHIHUAHUA", nombre: "Chihuahua" },
  { cve: "09", clave: "CIUDAD DE MEXICO", nombre: "Ciudad de México" },
  { cve: "10", clave: "DURANGO", nombre: "Durango" },
  { cve: "11", clave: "GUANAJUATO", nombre: "Guanajuato" },
  { cve: "12", clave: "GUERRERO", nombre: "Guerrero" },
  { cve: "13", clave: "HIDALGO", nombre: "Hidalgo" },
  { cve: "14", clave: "JALISCO", nombre: "Jalisco" },
  { cve: "15", clave: "ESTADO DE MEXICO", nombre: "Estado de México" },
  { cve: "16", clave: "MICHOACAN", nombre: "Michoacán" },
  { cve: "17", clave: "MORELOS", nombre: "Morelos" },
  { cve: "18", clave: "NAYARIT", nombre: "Nayarit" },
  { cve: "19", clave: "NUEVO LEON", nombre: "Nuevo León" },
  { cve: "20", clave: "OAXACA", nombre: "Oaxaca" },
  { cve: "21", clave: "PUEBLA", nombre: "Puebla" },
  { cve: "22", clave: "QUERETARO", nombre: "Querétaro" },
  { cve: "23", clave: "QUINTANA ROO", nombre: "Quintana Roo" },
  { cve: "24", clave: "SAN LUIS POTOSI", nombre: "San Luis Potosí" },
  { cve: "25", clave: "SINALOA", nombre: "Sinaloa" },
  { cve: "26", clave: "SONORA", nombre: "Sonora" },
  { cve: "27", clave: "TABASCO", nombre: "Tabasco" },
  { cve: "28", clave: "TAMAULIPAS", nombre: "Tamaulipas" },
  { cve: "29", clave: "TLAXCALA", nombre: "Tlaxcala" },
  { cve: "30", clave: "VERACRUZ", nombre: "Veracruz" },
  { cve: "31", clave: "YUCATAN", nombre: "Yucatán" },
  { cve: "32", clave: "ZACATECAS", nombre: "Zacatecas" },
];

/** clave interna → CVE. `lib/sefix/eleccionesConstants.ts` la re-exporta como ESTADO_CVE_MAP. */
export const ESTADO_CVE_POR_CLAVE: Record<string, string> = Object.fromEntries(
  ESTADOS.map((e) => [e.clave, e.cve])
);

// Alias VERIFICADOS (nunca inferidos por regla): clave normalizada de la
// entrada → CVE. Cada uno existe por evidencia real:
//   · "MEXICO": DERFE, SESNSP, STPS y ENIGH llaman "México" al Estado de
//     México; la copia de Cloud Functions ya lo resolvía a 15.
//   · nombres oficiales largos: ENIGH y los CSV antiguos del INE
//     (`storage.ts` DERFE_NOMBRE_MAP, pregenerate-semanal.ts).
//   · CDMX / DF / DISTRITO FEDERAL / EDOMEX: entradas de usuario y las
//     claves que ya aceptaba `resolveEstadoName` de Sefix.
export const ALIAS_ESTADO: Record<string, string> = {
  MEXICO: "15",
  EDOMEX: "15",
  "EDO MEX": "15",
  CDMX: "09",
  DF: "09",
  "DISTRITO FEDERAL": "09",
  "COAHUILA DE ZARAGOZA": "05",
  "MICHOACAN DE OCAMPO": "16",
  "VERACRUZ DE IGNACIO DE LA LLAVE": "30",
};

const ESTADO_POR_CVE: Record<string, EstadoCatalogo> = Object.fromEntries(
  ESTADOS.map((e) => [e.cve, e])
);

/** Centinela de "todo el país" (clave interna y nombre a mostrar). */
export const ESTADO_NACIONAL_CLAVE = "NACIONAL";
export const ESTADO_NACIONAL_NOMBRE = "Nacional";

export type EstadoResuelto =
  | { esNacional: false; cve: string; clave: string; nombre: string }
  | {
      esNacional: true;
      cve: null;
      clave: typeof ESTADO_NACIONAL_CLAVE;
      nombre: typeof ESTADO_NACIONAL_NOMBRE;
    };

/**
 * Forma de comparación de una entrada de estado: MAYÚSCULAS sin acentos (Ñ/Ü
 * conservadas), espacios recortados/colapsados, "_" y puntuación tratados como
 * separador ("nuevo_leon", "D.F." → "NUEVO LEON", "DF").
 */
function claveEntrada(input: string): string {
  return normalizarNombreMunicipio(input.replace(/_/g, " ").replace(/\./g, "").replace(/,/g, " "));
}

/**
 * ¿La entrada declara EXPLÍCITAMENTE alcance nacional ("Nacional", "NACIONAL")?
 * Vacío/undefined NO cuenta: cada módulo decide qué significa "sin estado" en
 * su borde (Sefix lo trata como nacional; los adaptadores de Fontana como
 * "sin estado"). El país "México" tampoco es nacional.
 */
export function esAlcanceNacional(input: string | null | undefined): boolean {
  return typeof input === "string" && claveEntrada(input) === ESTADO_NACIONAL_CLAVE;
}

/**
 * Resuelve el nombre de un estado (cualquier capitalización, con/sin acentos,
 * alias, nombre oficial largo, "nuevo_leon", espacios de más) o el centinela
 * "Nacional". `null` si no se reconoce (nunca se adivina).
 */
export function resolverEstado(input: string | null | undefined): EstadoResuelto | null {
  if (typeof input !== "string") return null;
  const clave = claveEntrada(input);
  if (!clave) return null;
  if (clave === ESTADO_NACIONAL_CLAVE) {
    return {
      esNacional: true,
      cve: null,
      clave: ESTADO_NACIONAL_CLAVE,
      nombre: ESTADO_NACIONAL_NOMBRE,
    };
  }
  const cve = ESTADO_CVE_POR_CLAVE[clave] ?? ALIAS_ESTADO[clave];
  if (!cve) return null;
  const e = ESTADO_POR_CVE[cve];
  return { esNacional: false, cve: e.cve, clave: e.clave, nombre: e.nombre };
}

/**
 * Solo el CVE de un ESTADO REAL, o null (no reconocido, o "Nacional", que no
 * tiene CVE). Es la firma que tenían las 15 copias de `resolveEstadoCve`.
 */
export function resolverEstadoCve(input: string | null | undefined): string | null {
  const r = resolverEstado(input);
  return r && !r.esNacional ? r.cve : null;
}

/** Nombre a mostrar (con acentos, forma corta) de un CVE de estado; null si no existe. */
export function nombreEstadoDisplay(cve: string): string | null {
  return ESTADO_POR_CVE[cve]?.nombre ?? null;
}

/**
 * Clave de ALMACENAMIENTO (nombre de archivo/carpeta en Storage) de una
 * entidad: clave interna con espacios → "_" (MAYÚSCULAS, sin acentos, Ñ/Ü
 * conservadas). Normaliza por dentro — el llamador ya no tiene que pasar la
 * entrada en mayúsculas (antes `toStorageKey("Jalisco")` daba "J"). El
 * centinela `__EXTRANJERO__` se conserva tal cual. No mapea "ESTADO DE MEXICO"
 * → "MEXICO" (eso es una convención de los archivos históricos de DERFE que
 * vive en lib/sefix/storage.ts).
 */
export function claveAlmacenamiento(entidad: string): string {
  if (entidad === "__EXTRANJERO__") return entidad;
  return normalizarNombreMunicipio(entidad)
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_ÑÜ]/g, "");
}

/**
 * Clave para indexar/consultar datos de una FUENTE que trae los estados por
 * NOMBRE ("México", "Distrito Federal", "Michoacán de Ocampo"…): la clave
 * interna del estado si se reconoce, o el nombre normalizado si no (p. ej.
 * "NACIONAL" ya es una clave válida; un nombre ajeno se conserva tal cual).
 * Se usa en AMBOS lados — al construir el índice con los nombres del archivo y
 * al consultarlo con el territorio del proyecto — para que "Estado de México"
 * encuentre la fila que la fuente llama "México". Antes cada lado normalizaba
 * por su cuenta y esos nombres no coincidían (huelgas de Edomex → 0 silencioso).
 */
export function claveEstadoDatos(nombre: string): string {
  return resolverEstado(nombre)?.clave ?? normalizarNombreMunicipio(nombre);
}

/**
 * Llave "snake" de un estado por su clave interna ("ESTADO DE MEXICO" →
 * "estado_de_mexico"): la que une el pipeline semanal de Sefix
 * (`por_entidad` en Storage), la API `semanal-origen-matriz` y los componentes
 * de la UI (SemanalView, OrigenCharts). UNA sola definición: antes eran tres
 * copias de `lower + _` (SemanalView, la ruta y `ESTADO_MAP` escrito a mano) y
 * si una cambiaba el heatmap de origen quedaba vacío en silencio. Verificado
 * 2026-09-20 contra Storage: las 32 llaves de `por_entidad` (edad/origen/sexo)
 * coinciden con las de los 32 estados del catálogo.
 */
export function claveEstadoSnake(clave: string): string {
  return clave.toLowerCase().replace(/\s+/g, "_");
}

/** Los 32 estados en orden alfabético por clave (el orden de los selectores de Sefix). */
export const ESTADOS_ALFABETICOS: readonly EstadoCatalogo[] = [...ESTADOS].sort((a, b) =>
  a.clave.localeCompare(b.clave)
);

/**
 * Nombres a mostrar de los 32 estados en orden alfabético (es): la lista del selector
 * de territorio, cuyos valores se GUARDAN en `territorio.estado`.
 */
export const NOMBRES_ESTADO_ORDENADOS: readonly string[] = ESTADOS.map((e) => e.nombre).sort((a, b) =>
  a.localeCompare(b, "es")
);
