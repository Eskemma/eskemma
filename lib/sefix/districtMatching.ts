// lib/sefix/districtMatching.ts
// Pure functions shared between the widget (page.tsx) and server-side
// context builders (sefixContext, generate-m1-express/route.ts).
// No async — callers are responsible for pre-fetching GeoEleccionesOpcion[].
//
// Resuelven el DISTRITO de Sefix (opción "{CVE estado}{distrito} {CABECERA}",
// p. ej. "0927 IZTAPALAPA") que corresponde al territorio de un proyecto.
// Devuelven la LISTA de candidatos: ya no eligen "el primero" en silencio.
// Hallazgos reales (diagnóstico 2026-09-19, ver lib/geo/candidatosGeo.ts):
//   · un nombre de cabecera lo comparten varios distritos del mismo estado (2024:
//     37 nombres federales, 90 locales — Mérida = 3103/3104/3106);
//   · el territorio ESTRUCTURADO del wizard nuevo (`cve_distrito:"027"`,
//     `municipio:"IZTAPALAPA"`) nunca resolvía: la opción trae cve === nombre
//     ("0927 IZTAPALAPA"), así que compararla con "027" jamás coincidía;
//   · el número del texto legado ("Distrito Electoral Federal IV, con cabecera en
//     Mérida") se ignoraba y se devolvía el primer Mérida.
// El código (CVE estado + número) identifica el distrito DENTRO de un año; el
// nombre cambia entre años (lib/geo/cabeceras_historicas.json), por eso las
// estrategias por código verifican que el nombre sea compatible cuando el año
// de las opciones no es el de la vintage del catálogo del selector.

import type { GeoEleccionesOpcion } from "./storage";
import { cabeceraSinPrefijo, claveCabecera, codigoDeOpcion, nombresCabeceraCompatibles } from "@/lib/geo/cabeceraNombres";
import { resolverEstadoCve } from "@/lib/geo/estados";
import { normalizeGeoName } from "@/lib/geo/municipioCanonico";
import { extraerNumeroDistrito } from "@/lib/moddulo/distritoElectoral";

export type EstrategiaDistrito = "cve_distrito" | "numero_texto" | "nombre" | "cabecera";

export interface DistritoCandidato {
  /** Nombre de la opción de Sefix (formato de display: prefijo + cabecera en MAYÚSCULAS sin acento). */
  nombre: string;
  /** Código de 4 dígitos (CVE estado + distrito) de la opción, o null si no lo trae (extranjero). */
  codigo: string | null;
  /** Año de las opciones contra las que se resolvió (si el llamador lo indicó). */
  anio?: number;
  estrategia: EstrategiaDistrito;
}

/**
 * Año desde el cual la numeración del catálogo del selector (topojson INE 2025) ==
 * la numeración de los CSV de resultados. Antes de ese año un mismo código pudo ser
 * otro territorio (redistritación), así que la estrategia por código exige además
 * un nombre de cabecera compatible.
 */
export const ANIO_NUMERACION_VIGENTE = 2024;

// Ciudad de la frase legada "... con cabecera en {ciudad}, ..." (la coma la delimita,
// por eso se extrae ANTES de que claveCabecera quite la puntuación), ya en clave.
const cabeceraDelTexto = (texto: string | null | undefined): string | null => {
  const m = texto ? normalizeGeoName(texto).match(/CON CABECERA EN ([^,]+)/) : null;
  return m ? claveCabecera(m[1]) || null : null;
};

export function buscarDistritoCandidatos(
  opciones: GeoEleccionesOpcion[],
  territorio: {
    nombre?: string | null;
    cve_distrito?: string | null;
    estado?: string | null;
    municipio?: string | null;
  },
  ctx: { estadoCve?: string | null; anio?: number } = {}
): DistritoCandidato[] {
  const { anio } = ctx;
  const estadoCve = ctx.estadoCve ?? resolverEstadoCve(territorio.estado) ?? undefined;
  const nuevo = (o: GeoEleccionesOpcion, estrategia: EstrategiaDistrito): DistritoCandidato => ({
    nombre: o.nombre,
    codigo: codigoDeOpcion(o.nombre),
    ...(anio !== undefined ? { anio } : {}),
    estrategia,
  });

  const textoLegado = territorio.municipio ?? territorio.nombre ?? null;
  // Cabecera de referencia: la frase legada "... con cabecera en X ..." o, en el
  // territorio estructurado, `municipio` (ya es la cabecera limpia: "IZTAPALAPA").
  const cabeceraRef = cabeceraDelTexto(textoLegado) ?? cabeceraDelTexto(territorio.nombre) ?? territorio.municipio ?? null;

  // (a)/(b) Por CÓDIGO: cve_distrito estructurado (a) o número del texto legado (b).
  const cveNumerico = territorio.cve_distrito && /^\d+$/.test(territorio.cve_distrito) ? territorio.cve_distrito : null;
  const numeroTexto = cveNumerico ? null : extraerNumeroDistrito(textoLegado ?? territorio.nombre, null);
  const numero = cveNumerico ?? numeroTexto;
  if (estadoCve && numero && parseInt(numero, 10) > 0 && parseInt(numero, 10) < 100) {
    const codigo = `${estadoCve}${String(parseInt(numero, 10)).padStart(2, "0")}`;
    const opcion = opciones.find((o) => codigoDeOpcion(o.nombre) === codigo);
    if (opcion) {
      const numeracionVigente = anio === undefined || anio >= ANIO_NUMERACION_VIGENTE;
      const nombreCompatible = !!cabeceraRef && nombresCabeceraCompatibles(cabeceraSinPrefijo(opcion.nombre), cabeceraRef);
      // Con nombre de referencia se exige que sea compatible (protege contra un
      // código reasignado); sin él, el número solo basta en la numeración vigente.
      const aceptar = cabeceraRef ? nombreCompatible : numeracionVigente;
      if (aceptar) return [nuevo(opcion, cveNumerico ? "cve_distrito" : "numero_texto")];
    }
  }

  // (c) Nombre exacto de la opción.
  const claveNombre = territorio.nombre ? claveCabecera(territorio.nombre) : "";
  if (claveNombre) {
    const porNombre = opciones.filter((o) => o.nombre && claveCabecera(o.nombre) === claveNombre);
    if (porNombre.length > 0) return porNombre.map((o) => nuevo(o, "nombre"));
  }

  // (d) Cabecera de la frase legada "... con cabecera en {ciudad}, ...". Todas las
  // opciones con esa cabecera: si son varias, la ambigüedad se devuelve, no se oculta.
  const cabeceraLegada = cabeceraDelTexto(territorio.nombre);
  if (cabeceraLegada) {
    const porCabecera = opciones.filter((o) => claveCabecera(cabeceraSinPrefijo(o.nombre)) === cabeceraLegada);
    if (porCabecera.length > 0) return porCabecera.map((o) => nuevo(o, "cabecera"));
  }

  return [];
}

/**
 * TEMPORAL — toma el primer candidato como hacía `matchDistrito`. Con más de uno
 * la ambigüedad sigue sin resolverse: solo se deja constancia (`console.warn`, para
 * medir cuántas veces ocurre en producción). La interfaz de desambiguación al
 * usuario depende del diseño de interpretación de texto libre/Sefix-AI (CLAUDE.md,
 * "Geografía compartida"); cuando exista, los call sites usan la lista completa.
 */
export function primerCandidatoTemporal(candidatos: DistritoCandidato[], contexto: string): string | null {
  if (candidatos.length > 1) {
    console.warn(
      `[sefix] distrito ambiguo (${contexto}): ${candidatos.length} candidatos [${candidatos.map((c) => c.nombre).join(" | ")}] — se toma el primero (TEMPORAL)`
    );
  }
  return candidatos[0]?.nombre ?? null;
}

/**
 * Formats a raw CSV cabecera value into a human-readable district label.
 * Raw format: "{2-digit-state-code}{2-digit-district-padded} {CITY_IN_CAPS}"
 * e.g. "1405 PUERTO VALLARTA" → "Dtto. Elect. Federal 05 - Puerto Vallarta"
 */
export function formatDistritoCabecera(
  raw: string,
  tipo: "federal" | "local"
): string {
  const m = raw.match(/^(\d{2})(\d{2})\s+(.+)$/);
  if (!m) return raw;
  const num = m[2]; // Already zero-padded from source (e.g. "05")
  const city = m[3]
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const tipoLabel = tipo === "federal" ? "Federal" : "Local";
  return `Dtto. Elect. ${tipoLabel} ${num} - ${city}`;
}
