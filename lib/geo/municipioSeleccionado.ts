// lib/geo/municipioSeleccionado.ts
// Pure logic for `MunicipioSeleccionado` entries (Paso 2a of the geographic disambiguation,
// 26-09-24): how the territory form adds a typed municipality using the result of
// `desambiguarReferencia`, how saved entries without a `clave` are completed (lazy fill and
// scripts/migrar-municipios-clave.ts share this), and the dedup/replace rules. No React,
// firebase or network: importable from the client component, server routes and scripts.
//
// `nombre` policy: keeps what the user typed when it matched EXACTLY (accents intact, "Tonalá");
// for an alias/partial match or a picker choice it stores the OFFICIAL catalog name
// ("San Pedro Tlaquepaque"), which also makes name-based readers resolve it directly. Filling
// the `clave` of a SAVED entry never renames it (readers already resolve those names).

import type { MunicipioSeleccionado, Territorio } from "@/types/shared.types";
import { claveMunicipioDeEstado } from "./claveMunicipioEstado";
import type { CandidatoReferencia, ResultadoDesambiguacion } from "./desambiguar";
import { resolverEstadoCve } from "./estados";

/** Do two entries denote the same municipality of the same state? */
export function mismoMunicipio(a: MunicipioSeleccionado, b: MunicipioSeleccionado): boolean {
  if (a.estado !== b.estado) return false;
  if (a.clave && b.clave) return a.clave === b.clave;
  return claveMunicipioDeEstado(a.estado, a.nombre) === claveMunicipioDeEstado(b.estado, b.nombre);
}

/**
 * Adds `nuevo` unless the same municipality is already there. If it is there without a `clave`
 * and `nuevo` carries one, the existing entry is upgraded (never duplicated, never renamed).
 */
export function agregarMunicipioSeleccionado(
  actual: MunicipioSeleccionado[],
  nuevo: MunicipioSeleccionado
): MunicipioSeleccionado[] {
  const nombre = nuevo.nombre.trim();
  if (!nombre || !claveMunicipioDeEstado(nuevo.estado, nombre)) return actual;
  const entrada = { ...nuevo, nombre };
  const i = actual.findIndex((m) => mismoMunicipio(m, entrada));
  if (i === -1) return [...actual, entrada];
  if (!actual[i].clave && entrada.clave) return actual.map((m, k) => (k === i ? { ...m, clave: entrada.clave } : m));
  return actual;
}

/** Replaces `vieja` (matched by name+state) with `nueva` in place; appends if `vieja` is gone. */
export function reemplazarMunicipioSeleccionado(
  actual: MunicipioSeleccionado[],
  vieja: MunicipioSeleccionado,
  nueva: MunicipioSeleccionado
): MunicipioSeleccionado[] {
  const sinVieja = actual.filter((m) => !(m.estado === vieja.estado && m.nombre === vieja.nombre));
  const i = actual.findIndex((m) => m.estado === vieja.estado && m.nombre === vieja.nombre);
  if (i === -1) return agregarMunicipioSeleccionado(actual, nueva);
  const sinDuplicado = sinVieja.filter((m) => !mismoMunicipio(m, nueva));
  const posicion = Math.min(i, sinDuplicado.length);
  return [...sinDuplicado.slice(0, posicion), nueva, ...sinDuplicado.slice(posicion)];
}

/** Entry built from a candidate the user picked from a list (official name + stable key). */
export function municipioDesdeCandidato(estado: string, candidato: CandidatoReferencia): MunicipioSeleccionado {
  return { nombre: candidato.nombre, estado, clave: candidato.clave };
}

/** What the form should do with the answer of the disambiguation core for a typed municipality. */
export type AltaMunicipio =
  | { tipo: "agregar"; entrada: MunicipioSeleccionado; aviso?: string }
  | { tipo: "elegir"; candidatos: CandidatoReferencia[]; aviso: string }
  | { tipo: "precisar"; aviso: string }
  | { tipo: "sin_reconocer"; entrada: MunicipioSeleccionado; aviso: string };

export function decidirAltaMunicipio(
  estado: string,
  textoTecleado: string,
  resultado: ResultadoDesambiguacion
): AltaMunicipio {
  const texto = textoTecleado.trim();
  switch (resultado.estado) {
    case "unico": {
      const c = resultado.candidato;
      if (c.coincidencia === "exacta") return { tipo: "agregar", entrada: { nombre: texto, estado, clave: c.clave } };
      return {
        tipo: "agregar",
        entrada: municipioDesdeCandidato(estado, c),
        aviso: `«${texto}» se interpretó como ${c.nombre}.`,
      };
    }
    case "ambiguo":
      return {
        tipo: "elegir",
        candidatos: resultado.candidatos,
        aviso: `«${texto}» puede ser más de un municipio — ¿cuál quisiste decir?`,
      };
    case "demasiados":
      return {
        tipo: "precisar",
        aviso: `«${texto}» coincide con demasiados municipios — escribe más del nombre.`,
      };
    case "ninguno":
      return {
        tipo: "sin_reconocer",
        entrada: { nombre: texto, estado },
        aviso: `"${texto}" no se reconoce en el catálogo INEGI — agregado tal cual, verifica el nombre.`,
      };
  }
}

/**
 * The municipality entries of a saved territory, in the order the form has always read them:
 * `municipiosPorEstado`, else the legacy plain `municipiosSeleccionados` tied to `territorio.estado`.
 * (Territories that only have the scalar `municipio` have no list and yield `[]`.)
 */
export function municipiosDeTerritorio(
  territorio: Pick<Territorio, "municipiosPorEstado" | "municipiosSeleccionados" | "estado"> | null | undefined
): MunicipioSeleccionado[] {
  if (!territorio) return [];
  if (territorio.municipiosPorEstado?.length) return territorio.municipiosPorEstado;
  if (territorio.municipiosSeleccionados?.length && territorio.estado) {
    return territorio.municipiosSeleccionados.map((nombre) => ({ nombre, estado: territorio.estado! }));
  }
  return [];
}

/** Can an entry be resolved against the Mexican catalog? (foreign states have no catalog.) */
export function esResolubleEnCatalogo(entrada: MunicipioSeleccionado): boolean {
  return !entrada.clave && !!resolverEstadoCve(entrada.estado);
}

export type ClaseRelleno = "ya_tiene_clave" | "unico" | "ambiguo" | "demasiados" | "ninguno" | "sin_catalogo";

export interface PropuestaRelleno {
  entrada: MunicipioSeleccionado;
  clase: ClaseRelleno;
  /** `unico`: the same entry with its `clave` filled in (name untouched). */
  propuesta?: MunicipioSeleccionado;
  coincidencia?: CandidatoReferencia["coincidencia"];
  /** `unico`: the official candidate; `ambiguo`: all of them. */
  candidatos?: CandidatoReferencia[];
}

/**
 * Proposal to complete a SAVED entry. `resultado` is the core's answer for the entry name inside its
 * state (municipality type only); pass `null` when the entry cannot be resolved (no catalog).
 * Ambiguous entries are never filled: they need a human choice.
 */
export function proponerRelleno(
  entrada: MunicipioSeleccionado,
  resultado: ResultadoDesambiguacion | null
): PropuestaRelleno {
  if (entrada.clave) return { entrada, clase: "ya_tiene_clave" };
  if (!resultado || !resolverEstadoCve(entrada.estado)) return { entrada, clase: "sin_catalogo" };
  switch (resultado.estado) {
    case "unico":
      return {
        entrada,
        clase: "unico",
        propuesta: { ...entrada, clave: resultado.candidato.clave },
        coincidencia: resultado.candidato.coincidencia,
        candidatos: [resultado.candidato],
      };
    case "ambiguo":
      return { entrada, clase: "ambiguo", candidatos: resultado.candidatos };
    case "demasiados":
      return { entrada, clase: "demasiados", candidatos: resultado.exactas };
    case "ninguno":
      return { entrada, clase: "ninguno" };
  }
}

/** Applies the proposals that are safe (`unico`) to a list, leaving every other entry as it was. */
export function aplicarRellenos(actual: MunicipioSeleccionado[], propuestas: PropuestaRelleno[]): MunicipioSeleccionado[] {
  return actual.map((m) => {
    const p = propuestas.find((x) => x.clase === "unico" && x.entrada.estado === m.estado && x.entrada.nombre === m.nombre);
    return p?.propuesta ? { ...m, clave: p.propuesta.clave } : m;
  });
}
