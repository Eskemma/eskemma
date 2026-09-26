// lib/geo/candidatosGeo.ts
// Búsqueda de entidades geográficas por NOMBRE que NO oculta la ambigüedad:
// devuelve TODOS los candidatos, clasificados. LÓGICA PURA (sin firebase/red):
// los catálogos de distritos son JSON estáticos y el de municipios se INYECTA
// (el de INE es server-only/async — ver `MunicipioCatalogo`).
//
// Por qué existe (diagnóstico 2026-09-19, datos reales de Storage):
//   · un mismo nombre puede ser hasta 4 cosas distintas. "Querétaro" = Estado
//     (22) + Municipio + distritos federales 2203/2204/2206 + distritos locales
//     2201-2206. 12 estados tienen esa triple homonimia Estado/Municipio/Distrito
//     en algún año (Aguascalientes, Campeche, Colima, Chihuahua, Durango,
//     Guanajuato, Puebla, Querétaro, San Luis Potosí, Tlaxcala, Veracruz,
//     Zacatecas) y Sinaloa tiene municipio homónimo sin cabecera homónima;
//   · un mismo nombre de cabecera lo comparten varios distritos del mismo estado
//     (2024: 37 nombres federales y 90 locales — Mérida ×3 = 3103/3104/3106);
//   · el NOMBRE de una cabecera cambia entre años en 136 de 313 códigos federales
//     y 342 de 692 locales (lib/geo/cabeceras_historicas.json): unos son renombres
//     de la misma cabecera y otros el mismo código reasignado a otro territorio
//     (redistritación). Por eso la identidad de un distrito es
//     (tipo, año, código de 4 dígitos) y cada candidato declara su `anio`.
//
// Esta capa NO decide cuál elegir ni notifica al usuario: eso (interfaz de
// desambiguación) queda pendiente de diseño, ligado a la interpretación de texto
// libre/Sefix-AI (CLAUDE.md, "Geografía compartida").

import cabecerasFed from "./cabeceras_fed.json";
import cabecerasLoc from "./cabeceras_loc.json";
import cabecerasHistoricas from "./cabeceras_historicas.json";
import { claveCabecera } from "./cabeceraNombres";
import { nombreDistritoDisplay, nombreMunicipioDisplay } from "./display";
import { esAlcanceNacional, nombreEstadoDisplay, resolverEstado } from "./estados";
import { claveCanonicaMunicipio, claveComparacionMunicipio } from "./municipioCanonico";

export type TipoCandidatoGeo = "estado" | "municipio" | "distrito_local" | "distrito_federal";

export interface CandidatoGeo {
  tipo: TipoCandidatoGeo;
  /**
   * Estado: CVE de 2 dígitos ("22"). Municipio: `${estadoCve}:${claveCanonica}`.
   * Distrito: código de 4 dígitos (CVE estado + distrito: "0927").
   */
  clave: string;
  estadoCve: string;
  /** Nombre a mostrar según la convención de lib/geo/display.ts (distrito: "0927 IZTAPALAPA"). */
  nombre: string;
  /**
   * "exacta": el texto es (una forma histórica de) el nombre. "parcial": el texto
   * es solo una parte, por palabras completas, de un nombre conocido ("Querétaro"
   * ⊂ "SANTIAGO DE QUERETARO" cuando ese código nunca se llamó solo QUERETARO). Es
   * una señal para quien desambigua; solo los distritos pueden ser "parcial".
   */
  coincidencia: "exacta" | "parcial";
  /**
   * Distritos: año de la fuente del nombre. El catálogo estático es la vintage
   * 2025 (mgs_2025_INE); si el llamador cruza con opciones de un año concreto,
   * ese año es el que manda. Estado/municipio: sin año.
   */
  anio?: number;
  /**
   * Distritos con variación confirmada de nombre entre años: {año → nombre}
   * (clave interna). Ausente si el código conserva el mismo nombre en todos los
   * años. NO implica que sea el mismo territorio en todos ellos.
   */
  nombresPorAnio?: Record<string, string>;
}

/** Un municipio de un catálogo externo (p. ej. `getMunicipiosOptions(estadoCve)` de lib/geo/municipios.ts). */
export interface MunicipioCatalogo {
  estadoCve: string;
  nombre: string;
}

/** Año de la vintage del catálogo estático de cabeceras (topojson INE 2025). */
export const ANIO_CATALOGO_CABECERAS = 2025;

type CatalogoCodigos = Record<string, string>;
type Historicas = Record<string, Record<string, string>>;
const HIST = cabecerasHistoricas as unknown as { federal: Historicas; local: Historicas };

/** Nombres históricos {año → nombre} de un código de distrito, o undefined si nunca cambió. */
export function nombresHistoricosDistrito(
  tipo: "distrito_federal" | "distrito_local",
  codigo: string
): Record<string, string> | undefined {
  return HIST[tipo === "distrito_federal" ? "federal" : "local"][codigo];
}

function candidatosDistrito(
  tipo: "distrito_federal" | "distrito_local",
  catalogo: CatalogoCodigos,
  claveTexto: string,
  estadoCve: string | undefined
): CandidatoGeo[] {
  const out: CandidatoGeo[] = [];
  for (const [codigo, cabecera] of Object.entries(catalogo)) {
    const estado = codigo.slice(0, 2);
    if (estadoCve && estado !== estadoCve) continue;
    const historicos = nombresHistoricosDistrito(tipo, codigo);
    const conocidos = [cabecera, ...(historicos ? Object.values(historicos) : [])].map(claveCabecera);
    const exacta = conocidos.includes(claveTexto);
    if (!exacta && !conocidos.some((n) => ` ${n} `.includes(` ${claveTexto} `))) continue;
    out.push({
      tipo,
      clave: codigo,
      estadoCve: estado,
      nombre: nombreDistritoDisplay(estado, codigo.slice(2), cabecera),
      coincidencia: exacta ? "exacta" : "parcial",
      anio: ANIO_CATALOGO_CABECERAS,
      ...(historicos ? { nombresPorAnio: { ...historicos } } : {}),
    });
  }
  return out;
}

/**
 * Todas las entidades (Estado, Municipio, Distrito federal, Distrito local) que
 * se llaman `texto`. Un solo candidato → lista de 1; ninguno → `[]`; varios →
 * la lista completa, sin elegir. Orden estable: estado, municipio, distrito
 * federal, distrito local; dentro de cada tipo por clave.
 *
 * - `estadoCve`: restringe TODOS los tipos a ese estado (los call sites de Sefix
 *   ya conocen el estado; sin él, "Tonalá" devuelve Chiapas y Jalisco).
 * - `municipios`: catálogo inyectado. Sin él no se buscan municipios (el de INE
 *   es async/server-only; el núcleo se mantiene puro).
 * - `tipos`: limita a ciertos tipos.
 */
export function buscarCandidatosPorNombre(
  texto: string | null | undefined,
  opts: { estadoCve?: string; municipios?: MunicipioCatalogo[]; tipos?: TipoCandidatoGeo[] } = {}
): CandidatoGeo[] {
  if (!texto || !texto.trim()) return [];
  // "Nacional" es el centinela de alcance (lib/geo/estados.ts), no un nombre: no debe
  // coincidir por palabra con "SANTIAGO PINOTEPA NACIONAL" ni "…CUNA DE LA INDEPENDENCIA NACIONAL".
  if (esAlcanceNacional(texto)) return [];
  const { estadoCve, municipios = [], tipos } = opts;
  const quiere = (t: TipoCandidatoGeo) => !tipos || tipos.includes(t);
  const claveTexto = claveCabecera(texto);
  const out: CandidatoGeo[] = [];

  if (quiere("estado")) {
    const e = resolverEstado(texto);
    if (e && !e.esNacional && (!estadoCve || e.cve === estadoCve)) {
      out.push({ tipo: "estado", clave: e.cve, estadoCve: e.cve, nombre: nombreEstadoDisplay(e.cve) ?? e.nombre, coincidencia: "exacta" });
    }
  }

  if (quiere("municipio")) {
    const vistos = new Set<string>();
    for (const m of municipios) {
      if (estadoCve && m.estadoCve !== estadoCve) continue;
      if (claveComparacionMunicipio(m.estadoCve, m.nombre) !== claveComparacionMunicipio(m.estadoCve, texto)) continue;
      const clave = `${m.estadoCve}:${claveCanonicaMunicipio(m.estadoCve, m.nombre)}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push({ tipo: "municipio", clave, estadoCve: m.estadoCve, nombre: nombreMunicipioDisplay(m.nombre).nombre, coincidencia: "exacta" });
    }
    out.sort((a, b) => (a.tipo === "municipio" && b.tipo === "municipio" ? a.clave.localeCompare(b.clave) : 0));
  }

  if (quiere("distrito_federal")) out.push(...candidatosDistrito("distrito_federal", cabecerasFed as CatalogoCodigos, claveTexto, estadoCve));
  if (quiere("distrito_local")) out.push(...candidatosDistrito("distrito_local", cabecerasLoc as CatalogoCodigos, claveTexto, estadoCve));
  return out;
}

const CATALOGO_POR_TIPO: Record<"distrito_federal" | "distrito_local", CatalogoCodigos> = {
  distrito_federal: cabecerasFed as CatalogoCodigos,
  distrito_local: cabecerasLoc as CatalogoCodigos,
};

const TIPOS_DISTRITO: readonly ("distrito_federal" | "distrito_local")[] = ["distrito_federal", "distrito_local"];

function candidatoDeCodigo(tipo: "distrito_federal" | "distrito_local", codigo: string): CandidatoGeo | null {
  const cabecera = CATALOGO_POR_TIPO[tipo][codigo];
  if (!cabecera) return null;
  const estado = codigo.slice(0, 2);
  const historicos = nombresHistoricosDistrito(tipo, codigo);
  return {
    tipo,
    clave: codigo,
    estadoCve: estado,
    nombre: nombreDistritoDisplay(estado, codigo.slice(2), cabecera),
    coincidencia: "exacta",
    anio: ANIO_CATALOGO_CABECERAS,
    ...(historicos ? { nombresPorAnio: { ...historicos } } : {}),
  };
}

/** Cabecera tal como está en el catálogo vigente ("PUERTO VALLARTA", "CD. ALTAMIRANO"), o null. */
export function cabeceraDeDistrito(tipo: "distrito_federal" | "distrito_local", codigo: string): string | null {
  return CATALOGO_POR_TIPO[tipo][codigo] ?? null;
}

/** Distritos vigentes con ese código de 4 dígitos (estado + distrito). Uno por tipo que exista. */
export function buscarDistritosPorCodigo(
  codigo: string,
  tipos: readonly ("distrito_federal" | "distrito_local")[] = TIPOS_DISTRITO
): CandidatoGeo[] {
  return tipos.map((t) => candidatoDeCodigo(t, codigo)).filter((c): c is CandidatoGeo => c !== null);
}

/** Todos los distritos vigentes de un estado (por tipo), ordenados por código. */
export function distritosDeEstado(
  estadoCve: string,
  tipos: readonly ("distrito_federal" | "distrito_local")[] = TIPOS_DISTRITO
): CandidatoGeo[] {
  const out: CandidatoGeo[] = [];
  for (const t of tipos) {
    for (const codigo of Object.keys(CATALOGO_POR_TIPO[t]).sort()) {
      if (codigo.startsWith(estadoCve)) {
        const c = candidatoDeCodigo(t, codigo);
        if (c) out.push(c);
      }
    }
  }
  return out;
}
