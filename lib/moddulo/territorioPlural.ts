// lib/moddulo/territorioPlural.ts
// Fase 0 del rediseño de territorio (26-08-13) — adaptador de lectura para
// Territorio.distritosSeleccionados (campo aditivo, ver types/shared.types.ts).
//
// Consumidores que aún no migraron a pluralidad real (Fontana, Sefix,
// PESTEL scraping, sidebar de Moddulo F2 — migración prevista en Fase 3)
// pueden seguir usando resolverPrimerDistrito() para obtener UN valor
// utilizable sin romper con proyectos ya existentes en Firestore, que no
// tienen esta clave. No fabrica el valor legado si no existe — cae al
// mismo texto libre que el consumidor ya usaba antes de este cambio.
//
// El campo `esParcial` sigue el mismo criterio que `granularidadReal` en
// lib/sefix/storage.ts: el dato resuelto viaja acompañado de la metadata
// de qué tan completo es, y es el CONSUMIDOR quien decide cómo comunicarlo
// (o si lo comunica) — nunca se muestra un subconjunto de datos como si
// fuera el total sin declararlo explícitamente en algún punto de la UI.

import type { Territorio } from "@/types/shared.types";

export interface TerritorioEfectivo {
  /** Nombre del distrito/municipio efectivo a usar, o undefined si no hay ninguno. */
  valor: string | undefined;
  /** Clave estructurada del distrito efectivo, si existe (viene de distritosSeleccionados). */
  cve: string | undefined;
  /**
   * true cuando el territorio tiene MÁS de un elemento seleccionado pero
   * este helper solo devolvió el primero — el consumidor debe declarar
   * explícitamente que solo cubrió una parte del territorio real del
   * proyecto (ej. "Cifras solo del primer distrito de N declarados").
   */
  esParcial: boolean;
}

/**
 * Resuelve un único distrito/municipio "efectivo" desde un Territorio que
 * puede tener varios seleccionados, para consumidores que todavía asumen
 * singularidad (ver Fase 3 — migración de consumidores).
 *
 * Prioridad: (1) primer elemento de distritosSeleccionados si existe,
 * (2) territorio.municipio, (3) territorio.nombre — mismo fallback que ya
 * usaban Fontana/Sefix/el sidebar de F2 antes de este cambio.
 */
export function resolverPrimerDistrito(
  territorio: Territorio | null | undefined
): TerritorioEfectivo {
  const lista = territorio?.distritosSeleccionados;
  if (lista && lista.length > 0) {
    return {
      valor: lista[0].nombre,
      cve: lista[0].cve,
      esParcial: lista.length > 1,
    };
  }
  return {
    valor: territorio?.municipio ?? territorio?.nombre,
    cve: territorio?.cve_distrito,
    esParcial: false,
  };
}

export interface ElementoEfectivo {
  valor: string | undefined;
  esParcial: boolean;
}

/**
 * Versión genérica de la misma resolución "primer elemento + esParcial",
 * para los campos plurales de Fase 2 (estadosSeleccionados/
 * municipiosSeleccionados) que — a diferencia de distritosSeleccionados —
 * son arrays planos de string, sin `cve` estructurado. No duplica la
 * lógica de resolverPrimerDistrito; ambas comparten el mismo criterio
 * (primer elemento gana, esParcial cuando hay más de uno).
 */
export function resolverPrimerElemento(
  lista: string[] | undefined,
  fallback: string | undefined
): ElementoEfectivo {
  if (lista && lista.length > 0) {
    return { valor: lista[0], esParcial: lista.length > 1 };
  }
  return { valor: fallback, esParcial: false };
}

/**
 * Resuelve el municipio "efectivo" desde Territorio.municipiosPorEstado
 * (Decisión 2, 26-08-16) — mismo patrón que resolverPrimerDistrito: primer
 * elemento gana, esParcial cuando hay más de uno. Cae a
 * resolverPrimerElemento(municipiosSeleccionados, municipio) cuando
 * municipiosPorEstado está ausente (proyectos anteriores a esta decisión,
 * ej. O2RBnCPiyGJ6u6kyk1rS — ZMG, 10 municipios sin estado por entrada).
 */
export function resolverPrimerMunicipio(
  territorio: Territorio | null | undefined
): TerritorioEfectivo {
  const lista = territorio?.municipiosPorEstado;
  if (lista && lista.length > 0) {
    return {
      valor: lista[0].nombre,
      cve: undefined,
      esParcial: lista.length > 1,
    };
  }
  const fallback = resolverPrimerElemento(territorio?.municipiosSeleccionados, territorio?.municipio);
  return { valor: fallback.valor, cve: undefined, esParcial: fallback.esParcial };
}

/**
 * Dispatcher por `nivel` — determina si el territorio tiene más de una
 * unidad seleccionada, leyendo el array plural correcto según el nivel
 * (un territorio Estatal plural tiene su pluralidad en
 * estadosSeleccionados, no en distritosSeleccionados). Usado por
 * lib/moddulo/canal3Evaluation.ts para advertir cuando una comparación de
 * territorio solo consideró la primera de varias unidades.
 */
export function esTerritorioParcial(territorio: Territorio | null | undefined): boolean {
  if (!territorio) return false;
  if (territorio.distritosSeleccionados) return resolverPrimerDistrito(territorio).esParcial;
  if (territorio.nivel === "estatal") {
    return resolverPrimerElemento(territorio.estadosSeleccionados, territorio.estado).esParcial;
  }
  if (territorio.nivel === "municipal") {
    return resolverPrimerMunicipio(territorio).esParcial;
  }
  return false;
}
