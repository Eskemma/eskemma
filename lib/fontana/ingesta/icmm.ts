// lib/fontana/ingesta/icmm.ts
// Adaptador de F2-18 (Ingreso Corriente para los Municipios de México,
// ICMM) — INEGI, descarga directa vía la pestaña "Datos abiertos" de la
// página del programa (no el dashboard interactivo de la misma página,
// ver nota abajo).
//
// Verificado EN VIVO 2026-08-09:
//   https://www.inegi.org.mx/contenidos/investigacion/icmm/datosabiertos/conjunto_de_datos_icmm_2022_csv.zip
//     HTTP 200, application/x-zip-compressed, 109,107 bytes. ZIP con
//     estándar de datos abiertos INEGI completo:
//       conjunto_de_datos/conjunto_de_datos_icmm_2022.csv → 12,510 filas,
//         columnas ent,mun,est,icpth (sin encabezado repetido, un valor
//         por fila — 5 filas por combinación ent/mun, una por "est").
//       catalogos/est.csv → confirma el significado de "est": 1=Valor,
//         2=Error estándar, 3=Límite inferior IC90%, 4=Límite superior
//         IC90%, 5=Coeficiente de variación (%).
//       catalogos/ent.csv → 0=Nacional + 32 entidades, códigos INEGI
//         estándar. catalogos/mun.csv → 2,501 municipios con nombre.
//       metadatos/metadatos_icmm_2022.txt → confirma periodicidad
//         "Bienalmente", metodología SEBLUP (small-area estimation).
//     También confirmado el mismo patrón para 2020
//     (conjunto_de_datos_icmm_2020_csv.zip, 98,845 bytes) — se usa 2022
//     por ser la edición más reciente.
//
//   Hallazgo importante que corrigió un diagnóstico previo: la página
//   https://www.inegi.org.mx/investigacion/icmm/ embebe un dashboard de
//   Tableau Public en su pestaña principal (public.tableau.com, perfil
//   real confirmado "inegiinforma", 19 workbooks) — ESA no es la vía que
//   usa este adaptador, y de hecho resultó imposible de recorrer sin
//   ejecutar JavaScript real (perfil protegido con AWS WAF). La pestaña
//   "Datos abiertos" de la MISMA página sirve el ZIP de arriba de forma
//   directa, sin Tableau ni navegador — confirmado descargando y
//   parseando el archivo real. No se encontró por exploración de URLs a
//   ciegas (varios intentos fallaron con 404 silenciosos) — se localizó
//   por una captura de pantalla real de la página, aportada por Raúl.
//
// ⚠️ BUG REAL encontrado y corregido en verificación en vivo 2026-08-09:
// el "mun" (CVE_MUN) del catálogo propio de ICMM (catalogos/mun.csv) NO
// coincide con la numeración estándar CVE_MUN que usa el resto de
// Fontana (lib/geo/municipios.ts) — comparado nombre a nombre por
// estado: Jalisco 125/125 y Aguascalientes 11/11 coinciden en NOMBRE
// pero con hasta 90/125 CVEs desalineados (ej. cve=024 en geo = "San
// Gabriel", cve=024 en el catálogo propio de ICMM = "Cocula"). Usar
// resolveMunicipioCve (numeración de lib/geo/municipios.ts) para leer
// el archivo de ICMM habría devuelto el valor de un municipio DISTINTO
// sin ningún error visible (confirmado: Oaxaca de Juárez con el CVE de
// geo traía el valor real de Santiago Niltepec) — mismo tipo de bug de
// numeración ya documentado en este proyecto (ITER, ver
// conapoMarginacion.ts). Fix: el join municipal se hace por NOMBRE
// normalizado (normalizeGeoName), nunca por CVE cruzado entre
// catálogos — el archivo de ICMM se parsea junto con su propio
// catalogos/mun.csv para construir un índice estado+nombre→valor, y
// CUALQUIER consumidor externo (que sí necesita CVE de geo para el
// resto del sistema — desgloses por distrito, índice nacional, etc.)
// sigue recibiendo el CVE del catálogo geo estándar, solo que el VALOR
// se resuelve traduciendo ese CVE a nombre primero.
//
// Costo del fix por nombre — inventario COMPLETO de los 32 municipios
// (de 2,477 nacional, ~1.3%) cuyo nombre no calza exacto entre los dos
// catálogos de INEGI y por tanto devuelven "no reconocido" en vez de un
// valor (verificado contra los 32 estados completos, no solo Oaxaca):
//
//   (a) 24 son solo diferencia de FORMATO de nombre — el municipio
//   existe en ambos catálogos, mismo territorio, distinto nombre
//   publicado:
//     - Nuevo León (10): abreviatura vs. forma completa — "Dr. Arroyo"/
//       "Dr. Coss"/"Dr. González" (geo) vs. "Doctor Arroyo"/"Doctor
//       Coss"/"Doctor González" (ICMM); "Gral. Bravo"/"Gral. Escobedo"/
//       "Gral. Terán"/"Gral. Treviño"/"Gral. Zaragoza"/"Gral. Zuazua"
//       (geo) vs. "General..." (ICMM); "Carmen" (geo) vs. "El Carmen"
//       (ICMM).
//     - Oaxaca (4): nombre corto vs. nombre oficial largo — "Juchitán
//       de Zaragoza" (ICMM) vs. "Heroica Ciudad de Juchitán de
//       Zaragoza" (geo); "Villa Hidalgo" (ICMM) vs. "Villa Hidalgo
//       Yalalag" (geo); "Villa de Santiago Chazumba" (ICMM) vs.
//       "Santiago Chazumba" (geo); "Heroica Villa Tezoatlán de Segura y
//       Luna, Cuna de la Independencia de Oaxaca" (ICMM) vs. "H Villa
//       Tezoatlán Segura y Luna Cuna Ind Oax" (geo, misma entidad
//       abreviada).
//     - Veracruz (3): "Cosamaloapan"/"Ozuluama"/"Zontecomatlán" (geo)
//       vs. "Cosamaloapan de Carpio"/"Ozuluama de Mascareñas"/
//       "Zontecomatlán de López y Fuentes" (ICMM, con apellido/sufijo
//       histórico).
//     - Chiapas (2): "Cintalapa" vs. "Cintalapa de Figueroa";
//       "Villacomaltitlán" (geo, sin espacio) vs. "Villa Comaltitlán"
//       (ICMM, con espacio).
//     - Coahuila (1): "Cuatrociénegas" (geo) vs. "Cuatro Ciénegas"
//       (ICMM) — solo espaciado.
//     - Durango (1): "Simón Bolívar" (geo) vs. "General Simón Bolívar"
//       (ICMM).
//     - Morelos (1): "Jonacatepec" (geo) vs. "Jonacatepec de Leandro
//       Valle" (ICMM).
//     - San Luis Potosí (1): "Ahualulco" (geo) vs. "Ahualulco del
//       Sonido 13" (ICMM).
//     - Tlaxcala (1): "Zitlaltépec de Trinidad Sánchez Santos" (geo)
//       vs. "Ziltlaltépec de Trinidad Sánchez Santos" (ICMM) — "Zit"
//       vs. "Zilt", diferencia de captura entre catálogos.
//
//   (b) 8 están AUSENTES por completo del catálogo de ICMM (no es
//   diferencia de nombre, no hay ninguna fila para ellos) — los 8 son
//   municipios de creación reciente (2019-2021), posteriores o
//   simultáneos a la base censal/muestral que usa la edición 2022 de
//   ICMM (ENIGH 2022 + Censo 2020), verificado en fuentes de prensa/
//   congresos estatales, no un error de captura:
//     - Baja California: San Felipe (vigente desde 2021-07-02,
//       separado de Mexicali/Ensenada).
//     - Campeche: Dzitbalché (vigente desde 2021-01-01, separado de
//       Calkiní).
//     - Guerrero (4): Ñuu Savi, Las Vigas, San Nicolás, Santa Cruz del
//       Rincón (los 4 constituidos 2021-08-31, separados de Ayutla de
//       los Libres/Cuajinicuilapa/Malinaltepec — Guerrero pasó de 81 a
//       85 municipios).
//     - Sinaloa (2): Eldorado, Juan José Ríos (aprobados 2021, en
//       funciones desde 2024-11-01, separados de Culiacán/Guasave).
//
// No es un error de INEGI que valga la pena reportar — es la
// inconsistencia esperada entre catálogos de distintas publicaciones/
// vintages del propio INEGI (mismo tipo de punto ciego ya documentado
// en CLAUDE.md para otros casos de este proyecto). Decisión deliberada:
// NO se intenta fuzzy-matching de abreviaturas/sufijos para "recuperar"
// estos 32 — mismo principio que motivó el fix de este archivo (preferir
// "no reconocido" explícito a un match adivinado que podría acertar mal
// en otro caso no revisado).
//
// ent=0,mun=0 = Nacional. INEGI publica esta fila directamente en el
// archivo — Fontana NO agrega/calcula el nacional aquí (a diferencia de
// F2-1/F2-2/F2-14), solo lo lee tal cual. Estatal (mun=0 por entidad) no
// tiene el problema de numeración de arriba — sin ambigüedad, 32
// entidades, mismos códigos ESTADO_CVE_MAP en ambos catálogos
// (verificado).
//
// naturaleza: estimacion_modelada en los 3 niveles (nunca dato_directo
// ni calculo_directo) — ICMM es una estimación en áreas pequeñas
// (SEBLUP) que la propia fuente genera a partir de la ENIGH + registros
// administrativos + Censo 2020, no un conteo directo ni un cálculo de
// Fontana. Mismo criterio conceptual que F2-3/F2-4 (estimaciones/índices
// propios de la fuente, tratados con cautela): tampoco se agrega a
// Distrital (ver index.ts, calcularValorDistritoPonderado) — sin
// metodología de agregación municipio→distrito validada para una
// estimación modelada.
//
// est=5 (Coeficiente de variación %) se conserva en cada celda vía
// coeficienteVariacionPct (lib/fontana/ingesta/types.ts) — no se expone
// visualmente todavía, pero es la señal de confiabilidad que la propia
// fuente ya cuantifica (metadatos: CV<15% alta precisión, [15,30)
// moderada, ≥30% baja — Fontana no reclasifica ni oculta esto, solo lo
// transporta).

import JSZip from "jszip";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, getMunicipiosOptions } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_ICMM = "INEGI (Ingreso Corriente para los Municipios de México 2022)";

const URL_ICMM_2022 = "https://www.inegi.org.mx/contenidos/investigacion/icmm/datosabiertos/conjunto_de_datos_icmm_2022_csv.zip";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 día — el archivo es estático (edición 2022, sin revisión posterior confirmada)

interface ValorConCV {
  valor: number;
  cv: number | null;
}

interface CacheIcmm {
  nacional: ValorConCV | null;
  porEstado: Map<string, ValorConCV>; // estadoCve (2 díg.) -> {valor, cv} — sin ambigüedad de numeración
  // Join por NOMBRE, no por CVE — ver nota de cabecera. Clave:
  // `${estadoCve}|${normalizeGeoName(nombreIcmmPropio)}`.
  porMunicipioPorNombre: Map<string, ValorConCV>;
  ts: number;
}

let cache: CacheIcmm | null = null;
let enVuelo: Promise<CacheIcmm> | null = null; // single-flight, mismo patrón que conapoMarginacion.ts/coneval.ts

function claveMunicipioPorNombre(estadoCve: string, nombre: string): string {
  return `${estadoCve}|${normalizeGeoName(nombre)}`;
}

async function descargarYParsearIcmm(): Promise<CacheIcmm> {
  const res = await fetch(URL_ICMM_2022);
  if (!res.ok) throw new Error(`ICMM HTTP ${res.status} en ${URL_ICMM_2022}`);
  const zipBuf = Buffer.from(await res.arrayBuffer());
  const zip = await JSZip.loadAsync(zipBuf);

  const entryDatos = Object.values(zip.files).find(
    (f) => !f.dir && /conjunto_de_datos_icmm_\d{4}\.csv$/i.test(f.name)
  );
  const entryMun = Object.values(zip.files).find((f) => !f.dir && /catalogos\/mun\.csv$/i.test(f.name));
  if (!entryDatos || !entryMun) {
    throw new Error(
      `ZIP de ICMM (${URL_ICMM_2022}) no contiene los archivos esperados (conjunto_de_datos/catalogos/mun.csv)`
    );
  }

  // Catálogo propio de ICMM: cve_ent,cve_mun,descrip — el mun aquí NO es
  // el CVE_MUN estándar (ver nota de cabecera), solo sirve para traducir
  // ent+mun(ICMM) -> nombre, que es la clave real de join.
  const nombrePorClaveIcmm = new Map<string, string>(); // `${entIcmm.padStart(2,"0")}${munIcmm.padStart(3,"0")}` -> nombre
  const textoMun = await entryMun.async("text");
  for (const fila of textoMun.split("\n").slice(1)) {
    const f = fila.trim();
    if (!f) continue;
    const [entStr, munStr, ...resto] = f.split(",");
    const nombre = resto.join(",").trim();
    if (!entStr || !munStr || !nombre) continue;
    nombrePorClaveIcmm.set(`${entStr.padStart(2, "0")}${munStr.padStart(3, "0")}`, nombre);
  }

  // est=1 (Valor) y est=5 (Coeficiente de variación %) — únicos 2 de los
  // 5 "est" que Fontana usa; 2/3/4 (error estándar, límites de IC90%) se
  // ignoran, no hay consumo previsto para ellos.
  const valores = new Map<string, number>();
  const cvs = new Map<string, number>();
  const textoDatos = await entryDatos.async("text");
  for (const fila of textoDatos.split("\n").slice(1)) {
    const f = fila.trim();
    if (!f) continue;
    const [entStr, munStr, estStr, icpthStr] = f.split(",");
    const est = Number(estStr);
    const icpth = Number(icpthStr);
    if (!Number.isFinite(icpth)) continue;
    const clave = `${entStr.padStart(2, "0")}${munStr.padStart(3, "0")}`;
    if (est === 1) valores.set(clave, icpth);
    else if (est === 5) cvs.set(clave, icpth);
  }

  const CLAVE_NACIONAL = "00000";
  const nacional = valores.has(CLAVE_NACIONAL)
    ? { valor: valores.get(CLAVE_NACIONAL)!, cv: cvs.get(CLAVE_NACIONAL) ?? null }
    : null;

  const porEstado = new Map<string, ValorConCV>();
  const porMunicipioPorNombre = new Map<string, ValorConCV>();
  for (const [clave, valor] of valores) {
    if (clave === CLAVE_NACIONAL) continue;
    const cv = cvs.get(clave) ?? null;
    if (clave.endsWith("000")) {
      porEstado.set(clave.slice(0, 2), { valor, cv });
    } else {
      const nombreIcmm = nombrePorClaveIcmm.get(clave);
      if (!nombreIcmm) continue;
      const estadoCve = clave.slice(0, 2);
      porMunicipioPorNombre.set(claveMunicipioPorNombre(estadoCve, nombreIcmm), { valor, cv });
    }
  }

  return { nacional, porEstado, porMunicipioPorNombre, ts: Date.now() };
}

async function cargarIcmm(): Promise<CacheIcmm> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache;
  if (enVuelo) return enVuelo;

  enVuelo = descargarYParsearIcmm();
  try {
    const resultado = await enVuelo;
    cache = resultado;
    return resultado;
  } finally {
    enVuelo = null;
  }
}

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

// Reverso de ESTADO_CVE_MAP — mismo patrón ya usado en eceg.ts/conapoMarginacion.ts/coneval.ts.
const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

function celdaDesdeValor(
  nivel: CeldaFontana["nivel"],
  v: ValorConCV | null | undefined,
  motivoVacio: string
): CeldaFontana {
  if (!v) return { nivel, motivo: motivoVacio };
  const celda: CeldaFontana = {
    nivel,
    valor: Math.round(v.valor * 100) / 100,
    unidad: "pesos (ICPTH trimestral)",
    naturaleza: "estimacion_modelada",
    fuenteEtiqueta: FUENTE_ETIQUETA_ICMM,
  };
  return v.cv != null ? { ...celda, coeficienteVariacionPct: Math.round(v.cv * 100) / 100 } : celda;
}

export async function resolverIngresoCorrienteMunicipal(territorio: Territorio): Promise<CeldaFontana[]> {
  let datos: CacheIcmm;
  try {
    datos = await cargarIcmm();
  } catch {
    const motivo = "Error de conexión con INEGI (ICMM)";
    return [{ nivel: "nacional", motivo }, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const nacional = celdaDesdeValor("nacional", datos.nacional, "INEGI no reportó el valor nacional de ICMM");

  if (!territorio.estado) {
    return [
      nacional,
      { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" },
      { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" },
    ];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const estatal = celdaDesdeValor("estatal", datos.porEstado.get(estadoCve), "INEGI no reportó ICMM para este territorio");

  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    municipal = celdaDesdeValor(
      "municipal",
      datos.porMunicipioPorNombre.get(claveMunicipioPorNombre(estadoCve, municipioNombre)),
      `Municipio "${municipioNombre}" no reconocido en el catálogo de ICMM`
    );
  }

  return [nacional, estatal, municipal];
}

// Desglose "Ver municipios" en proyectos nivel "estatal" — mismo patrón
// que resolverMunicipiosEstadoMarginacion (conapoMarginacion.ts): el
// archivo ya está completo en memoria, filtrar por estado es solo
// iterar el Map. El CVE devuelto en cada elemento es el de
// lib/geo/municipios.ts (el que el resto del sistema necesita para
// agrupar por distrito/nacional) — el valor se resuelve traduciendo ese
// CVE a nombre primero (ver nota de cabecera, join por nombre). Nunca
// aplica a distritos_fed/distritos_loc — ICMM no publica por distrito
// electoral.
export async function resolverMunicipiosEstadoIcmm(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const [datos, opciones] = await Promise.all([cargarIcmm(), getMunicipiosOptions(estadoCve)]);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => ({
    cve,
    nombre,
    celda: celdaDesdeValor(
      "municipal",
      datos.porMunicipioPorNombre.get(claveMunicipioPorNombre(estadoCve, nombre)),
      "INEGI no reportó ICMM para este municipio"
    ),
  }));
}

// Desglose "Ver estados" en proyectos nivel "nacional" — mismo patrón
// que resolverEstadosMarginacion. El archivo ya trae los 32 estados
// completos en memoria — sin llamada nueva. Sin problema de numeración
// (a diferencia de municipal): los 32 códigos de entidad coinciden entre
// el catálogo propio de ICMM y ESTADO_CVE_MAP (verificado).
export async function resolverEstadosIcmm(): Promise<ElementoDeEstado[]> {
  const datos = await cargarIcmm();
  return Array.from(datos.porEstado.entries()).map(([cve, v]): ElementoDeEstado => ({
    cve,
    nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
    celda: celdaDesdeValor("estatal", v, "INEGI no reportó ICMM para este estado"),
  }));
}
