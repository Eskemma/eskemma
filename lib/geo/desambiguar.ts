// lib/geo/desambiguar.ts
// Reference resolution core (design of 26-09-23, step 1 of the disambiguation
// standard). Given what a user TYPED ("Pachuca", "Santiago", "Oaxaca",
// "México"), return ONE of four outcomes, always with stable keys:
//
//   · unico      → exactly one entity: use it.
//   · ambiguo    → 2..maxCandidatos entities: ask the user (picker / chat question).
//   · demasiados → more than maxCandidatos: do NOT list; ask for the state or a
//                  more specific name ("San Juan" matches 63 municipalities). Carries
//                  the exact matches (`exactas`) so the caller can still offer them.
//   · ninguno    → nothing recognised (no fuzzy guessing here).
//
// PURE (no firebase / network / UI): the municipality catalog is INJECTED, as in
// candidatosGeo.ts (the INE catalog is async and server-only). The form picker and
// the chat tool are two presentations of this same result.
//
// Rules (agreed with Raúl):
//   1. Several exact municipalities (2+): only they are listed, the partial matches are
//      ignored ("Cuauhtémoc" → the 4 exact municipalities, not the 5 that merely contain it).
//   2. A partial match (whole words, "Pachuca" ⊂ "PACHUCA DE SOTO") applies when there is
//      NO exact municipality: a single partial resolves on its own, flagged
//      `coincidencia: "parcial"` so the caller can show the official name.
//   2b. ONE exact municipality that ALSO has partial matches is NOT resolved alone
//      ("Santiago" is a municipality of Nuevo León but also 64 others contain the word):
//      the result is `ambiguo` with the exact one listed first, or `demasiados` (carrying
//      the exact ones in `exactas`) past the cap. An alias hit is not listed against itself.
//   3. The type dimension is never guessed: "Colima" is a state AND a municipality,
//      "Oaxaca" is a state AND (partially) "Oaxaca de Juárez". Without `tipos` both are
//      returned and the caller decides; a caller that already knows the level passes
//      `tipos`.
//   4. "México" always asks (country vs Estado de México) unless the caller fixes it
//      with `mexico` or narrows `tipos`. MEX is reserved for the country.
//   5. A state given by the caller (`estadoCve`) narrows every type BEFORE searching.
//
// Stable keys: state = 2-digit CVE; municipality = `${estadoCve}:${claveCanonica}`
// (BY NAME — never the INE `cve` of lib/geo/municipios.ts: that numbering diverges from
// INEGI's CVE_MUN, see docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md);
// district = 4-digit code; country = "MEX".
// The ONE exception to name-only keys: two real municipalities of the same state can
// share a name (Oaxaca: SAN JUAN MIXTEPEC 208/209, SAN PEDRO MIXTEPEC 316/317 — exactly
// those 4 in the whole country). A name cannot tell them apart, so each gets the suffix
// `#<cve>` (INE numbering, used ONLY to tell the pair apart, never to join data) and the
// label carries the district ("Dto. 08"), as the existing picker does.
//
// Out of scope here (later steps): compositions of several units, migrating saved
// territories, `checkTerritoryMatch`, fuzzy "did you mean" suggestions for `ninguno`.

import { buscarCandidatosPorNombre, type CandidatoGeo, type MunicipioCatalogo } from "./candidatosGeo";
import { esAlcanceNacional, nombreEstadoDisplay } from "./estados";
import { nombreMunicipioDisplay } from "./display";
import { etiquetaDesambiguacionMunicipio } from "./etiquetasDesambiguacionMunicipio";
import {
  ALIAS_COLOQUIAL_MUNICIPIO,
  claveCanonicaMunicipio,
  claveComparacionMunicipio,
  normalizarNombreMunicipio,
  plegarDiacriticosGeo,
} from "./municipioCanonico";

export type TipoReferencia = "pais" | "estado" | "municipio" | "distrito_federal" | "distrito_local";

export const TIPOS_REFERENCIA: readonly TipoReferencia[] = [
  "pais",
  "estado",
  "municipio",
  "distrito_federal",
  "distrito_local",
];

/** How the text matched: literally, as a known alias ("Tlaquepaque", "CDMX"), or as whole words inside a longer name. */
export type CoincidenciaReferencia = "exacta" | "alias" | "parcial";

export interface CandidatoReferencia {
  tipo: TipoReferencia;
  /** Stable key (see file header). */
  clave: string;
  /** Owning state CVE; absent for the country. */
  estadoCve?: string;
  /** Display name per lib/geo/display.ts (district: "0927 IZTAPALAPA"). */
  nombre: string;
  /** Unambiguous label for a picker or chat question: "Pachuca de Soto, Hidalgo". */
  etiqueta: string;
  coincidencia: CoincidenciaReferencia;
}

/** A catalog municipality; `cve` (INE) is optional and only used to tell same-name pairs apart. */
export interface MunicipioCatalogoRef extends MunicipioCatalogo {
  cve?: string;
}

export interface OpcionesDesambiguar {
  /** Narrows every type to this state before searching. */
  estadoCve?: string;
  /** Municipality catalog (injected). Without it no municipalities are searched. */
  municipios?: MunicipioCatalogoRef[];
  /** Limits the types considered. Default: all. */
  tipos?: readonly TipoReferencia[];
  /** Fixes what the bare text "México" means; unset → it asks. */
  mexico?: "pais" | "estado";
  /** Largest list worth showing; beyond it the result is `demasiados`. Default 8. */
  maxCandidatos?: number;
}

export type ResultadoDesambiguacion =
  | { estado: "unico"; candidato: CandidatoReferencia }
  | { estado: "ambiguo"; candidatos: CandidatoReferencia[] }
  | { estado: "demasiados"; total: number; estadosCve: string[]; exactas: CandidatoReferencia[] }
  | { estado: "ninguno" };

export const MAX_CANDIDATOS_POR_DEFECTO = 8;
/** Below this many letters a partial (whole-word) municipality match is not attempted. */
const MIN_LETRAS_PARCIAL = 3;
const CVE_ESTADO_MEXICO = "15";

/** Plain comparison form: accent-free uppercase, "_" and dots as separators, Ñ/Ü folded. */
function formaPlana(s: string): string {
  return plegarDiacriticosGeo(normalizarNombreMunicipio(s.replace(/[_.,]/g, " ")));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function etiquetaDe(tipo: TipoReferencia, nombre: string, estadoCve?: string): string {
  if (tipo === "pais") return `${nombre} (país)`;
  if (tipo === "estado") return nombre;
  const estado = estadoCve ? nombreEstadoDisplay(estadoCve) : null;
  if (tipo === "municipio") return estado ? `${nombre}, ${estado}` : nombre;
  const prefijo = tipo === "distrito_federal" ? "Distrito federal" : "Distrito local";
  return estado ? `${prefijo} ${nombre} (${estado})` : `${prefijo} ${nombre}`;
}

function candidatoPais(): CandidatoReferencia {
  return { tipo: "pais", clave: "MEX", nombre: "México", etiqueta: etiquetaDe("pais", "México"), coincidencia: "exacta" };
}

/** Adapts a state / district hit of candidatosGeo.ts, flagging state aliases ("CDMX", "Edomex"). */
function desdeCandidatoGeo(c: CandidatoGeo, texto: string): CandidatoReferencia {
  let coincidencia: CoincidenciaReferencia = c.coincidencia === "parcial" ? "parcial" : "exacta";
  if (coincidencia === "exacta" && c.tipo === "estado") {
    const oficial = nombreEstadoDisplay(c.clave);
    if (oficial && formaPlana(texto) !== formaPlana(oficial)) coincidencia = "alias";
  }
  return {
    tipo: c.tipo,
    clave: c.clave,
    estadoCve: c.estadoCve,
    nombre: c.nombre,
    etiqueta: etiquetaDe(c.tipo, c.nombre, c.estadoCve),
    coincidencia,
  };
}

/** Does the plain form of what was typed equal a colloquial alias ("NEZA") of this municipality? */
function coincideAliasColoquial(m: MunicipioCatalogoRef, objetivoPlano: string): boolean {
  const oficial = ALIAS_COLOQUIAL_MUNICIPIO[m.estadoCve]?.[objetivoPlano];
  return !!oficial && formaPlana(oficial) === formaPlana(m.nombre);
}

/**
 * Municipality candidates for `texto`. "exacta": same name, alias-aware and Ñ/Ü-folded
 * (`claveComparacionMunicipio`; "Tlaquepaque" → SAN PEDRO TLAQUEPAQUE is flagged "alias").
 * "parcial": `texto` as whole words inside a longer name. Same-name pairs inside a state
 * are kept as TWO candidates (see the file header).
 */
function candidatosMunicipio(
  texto: string,
  catalogo: MunicipioCatalogoRef[],
  modo: "exacta" | "parcial",
  estadoCve?: string
): CandidatoReferencia[] {
  const objetivo = formaPlana(texto);
  if (modo === "parcial" && objetivo.replace(/\s/g, "").length < MIN_LETRAS_PARCIAL) return [];
  const patron = modo === "parcial" ? new RegExp(`\\b${escapeRegExp(objetivo)}\\b`) : null;

  // Group by stable key so same-name rows are not silently collapsed.
  const grupos = new Map<string, MunicipioCatalogoRef[]>();
  for (const m of catalogo) {
    if (estadoCve && m.estadoCve !== estadoCve) continue;
    const coincide = patron
      ? patron.test(formaPlana(m.nombre))
      : claveComparacionMunicipio(m.estadoCve, m.nombre) === claveComparacionMunicipio(m.estadoCve, texto) ||
        coincideAliasColoquial(m, objetivo);
    if (!coincide) continue;
    const clave = `${m.estadoCve}:${claveCanonicaMunicipio(m.estadoCve, m.nombre)}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), m]);
  }

  const out: CandidatoReferencia[] = [];
  for (const [clave, filas] of grupos) {
    filas.forEach((m, i) => {
      const repetido = filas.length > 1;
      const nombre = nombreMunicipioDisplay(m.nombre).nombre;
      const dto = repetido && m.cve ? etiquetaDesambiguacionMunicipio(m.estadoCve, m.cve) : null;
      const base = etiquetaDe("municipio", nombre, m.estadoCve);
      out.push({
        tipo: "municipio",
        clave: repetido ? `${clave}#${m.cve ?? i + 1}` : clave,
        estadoCve: m.estadoCve,
        nombre,
        etiqueta: dto ? `${base} (${dto})` : base,
        coincidencia:
          modo === "parcial" ? "parcial" : formaPlana(texto) === formaPlana(m.nombre) ? "exacta" : "alias",
      });
    });
  }
  return out;
}

const ORDEN_TIPO: Record<TipoReferencia, number> = {
  pais: 0,
  estado: 1,
  municipio: 2,
  distrito_federal: 3,
  distrito_local: 4,
};

/** Sorts candidates and maps their count to the result shape (0 / 1 / list / too many). */
function cerrar(candidatos: CandidatoReferencia[], maxCandidatos: number): ResultadoDesambiguacion {
  // By type, then exact/alias hits before partial ones, then by key (stable).
  const rangoCoincidencia = (c: CandidatoReferencia) => (c.coincidencia === "parcial" ? 1 : 0);
  const ordenados = [...candidatos].sort(
    (a, b) =>
      ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] ||
      rangoCoincidencia(a) - rangoCoincidencia(b) ||
      a.clave.localeCompare(b.clave)
  );
  if (ordenados.length === 0) return { estado: "ninguno" };
  if (ordenados.length === 1) return { estado: "unico", candidato: ordenados[0] };
  if (ordenados.length > maxCandidatos) {
    const estadosCve = [...new Set(ordenados.map((c) => c.estadoCve).filter((e): e is string => !!e))].sort();
    const exactas = ordenados.filter((c) => c.coincidencia !== "parcial");
    return { estado: "demasiados", total: ordenados.length, estadosCve, exactas };
  }
  return { estado: "ambiguo", candidatos: ordenados };
}

/**
 * Resolves what the user typed to one entity, a short list to ask about, "too many"
 * (ask for the state), or nothing. See the file header for the rules.
 */
export function desambiguarReferencia(
  texto: string | null | undefined,
  opts: OpcionesDesambiguar = {}
): ResultadoDesambiguacion {
  if (!texto || !texto.trim()) return { estado: "ninguno" };
  // "Nacional" is the scope sentinel of lib/geo/estados.ts, not a place name.
  if (esAlcanceNacional(texto)) return { estado: "ninguno" };

  const { estadoCve, municipios = [], mexico, maxCandidatos = MAX_CANDIDATOS_POR_DEFECTO } = opts;
  const tipos = opts.tipos ?? TIPOS_REFERENCIA;
  const quiere = (t: TipoReferencia) => tipos.includes(t);

  const candidatos: CandidatoReferencia[] = [];

  // Rule 4: bare "México" is the country or the Estado de México. Only when the search
  // is not already inside a state.
  const esMexicoSuelto = formaPlana(texto) === "MEXICO" && !estadoCve;
  if (esMexicoSuelto) {
    if (quiere("pais") && mexico !== "estado") candidatos.push(candidatoPais());
    if (quiere("estado") && mexico !== "pais") {
      const nombre = nombreEstadoDisplay(CVE_ESTADO_MEXICO) ?? "Estado de México";
      candidatos.push({
        tipo: "estado",
        clave: CVE_ESTADO_MEXICO,
        estadoCve: CVE_ESTADO_MEXICO,
        nombre,
        etiqueta: nombre,
        coincidencia: "alias",
      });
    }
    // Bare "México" is only ever the country or the state: skip the generic search, which
    // would add noise such as the federal district "NUEVO MEXICO".
    if (candidatos.length) return cerrar(candidatos, maxCandidatos);
  }

  // States and districts come from candidatosGeo.ts (exact; districts also whole-word).
  // Municipalities are searched here so same-name pairs are not collapsed.
  const tiposGeo = tipos.filter(
    (t): t is Exclude<TipoReferencia, "pais" | "municipio"> => t !== "pais" && t !== "municipio"
  );
  const hallados = buscarCandidatosPorNombre(texto, { estadoCve, tipos: tiposGeo }).map((c) =>
    desdeCandidatoGeo(c, texto)
  );
  if (quiere("municipio") && municipios.length) {
    hallados.push(...candidatosMunicipio(texto, municipios, "exacta", estadoCve));
  }

  // Rule 1 within a type: exact hits make that type's partial hits noise.
  const conExactas = new Set(hallados.filter((c) => c.coincidencia !== "parcial").map((c) => c.tipo));
  for (const c of hallados) {
    if (c.coincidencia === "parcial" && conExactas.has(c.tipo)) continue;
    candidatos.push(c);
  }

  // Rules 2 / 2b: partial municipalities are added when there is no exact municipality, or
  // exactly ONE (which then must not resolve alone). 2+ exact ones are already a question.
  const exactosMunicipio = candidatos.filter((c) => c.tipo === "municipio" && c.coincidencia !== "parcial");
  if (quiere("municipio") && municipios.length && exactosMunicipio.length <= 1) {
    const yaListados = new Set(exactosMunicipio.map((c) => c.clave));
    candidatos.push(
      ...candidatosMunicipio(texto, municipios, "parcial", estadoCve).filter((c) => !yaListados.has(c.clave))
    );
  }

  return cerrar(candidatos, maxCandidatos);
}
