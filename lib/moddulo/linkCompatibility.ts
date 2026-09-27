// lib/moddulo/linkCompatibility.ts
// Lógica de compatibilidad tipo/territorio compartida entre la vinculación
// Moddulo↔Centinela (Canal 1) y Canal 3 (fuente externa). Movida desde
// app/api/centinela/pestel/project/[projectId]/link-moddulo/route.ts, donde
// vivía como lógica local/inline — no duplicar en un tercer lugar.
//
// Consolidada 26-08-13: existían 3 copias independientes de esta misma
// lógica (esta, app/components/centinela/pestel/ModduloButton.tsx, y
// checkTerritoryMatchInverse en el sidebar de F2). Auditadas línea por
// línea antes de fusionar — el cuerpo era idéntico en las 3, la única
// diferencia real era que checkTerritoryMatchInverse aceptaba AMBOS
// parámetros como nullable (porque ModduloProject.territorio es opcional y
// el estado projectTerritory del sidebar puede quedarse en null), mientras
// esta versión solo garantizaba el segundo. La firma de abajo adopta la más
// permisiva de las dos para no romper ese call site. La lógica interna es
// simétrica en a/b: el orden de los argumentos no cambia el resultado,
// porque a.nivel === b.nivel ya está garantizado antes de usarse.

import type { Territorio } from "@/types/shared.types";
import { resolverEstadoCve } from "@/lib/geo/estados";
import { claveComparacionMunicipio } from "@/lib/geo/municipioCanonico";
import {
  claveTextoGeo,
  relacionDeConjuntos,
  unidadesDeTerritorio,
  type RelacionTerritorial,
} from "@/lib/geo/unidadesTerritoriales";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";

export type TerritoryMatch = "exact" | "approximate" | "mismatch";
export type { RelacionTerritorial };

// Paso 2b (26-09-24): la comparación es POR CONJUNTOS de unidades (lib/geo/unidadesTerritoriales.ts),
// no por el primer elemento de las listas plurales. Antes: un municipal plural se comparaba solo por
// su primer municipio (el proyecto ZMG de 8 municipios daba "mismatch" contra "Guadalajara" aunque
// Guadalajara está en la ZMG) y un estatal plural daba "exact" con solo coincidir el primer estado.
//
// Comparaciones por CLAVE, no por cadena exacta (2026-09-20). Antes todo era `!==`
// y daba "mismatch" para el MISMO territorio escrito distinto. Caso real: el proyecto
// Moddulo `nZvpYu…` (Iztapalapa, distrito local 27: `municipio:"IZTAPALAPA"`,
// `cve_distrito:"027"`) contra la sesión Fontana `1qEjT…` del mismo distrito
// (`municipio:"Distrito Electoral Local 27 en la CDMX"`, sin `cve_distrito`).
// Los municipios realmente distintos siguen dando "mismatch".
//
// Política (Variante B, aprobada): solo se comparan por conjuntos territorios del MISMO nivel.
// Niveles distintos → "mismatch" (la contención entre niveles —nacional cubre todo, estatal ⊃
// municipal, municipal vs distrito— queda diferida como Paso 2c, con mensajes propios).
// El contrato de 3 valores no cambia: quien solo lee `TerritoryMatch` sigue igual.

export interface ComparacionTerritorial {
  match: TerritoryMatch;
  /** Relación entre los conjuntos de unidades; "no_comparable" cuando no se pudo decidir por conjuntos. */
  relacion: RelacionTerritorial;
}

/** Comparación de dos estados (texto). Mexicano en ambos lados → por CVE; si no → texto plegado. */
function mismoEstado(a: string, b: string): boolean {
  const ca = resolverEstadoCve(a);
  const cb = resolverEstadoCve(b);
  return ca && cb ? ca === cb : claveTextoGeo(a) === claveTextoGeo(b);
}

function mismoMunicipio(estado: string | undefined, a: string, b: string): boolean {
  const cve = resolverEstadoCve(estado) ?? "";
  return claveComparacionMunicipio(cve, a) === claveComparacionMunicipio(cve, b);
}

const esDistrito = (nivel: string) => ["distrito_federal", "distrito_local", "distrito"].includes(nivel);

// Paso 2c (26-09-27): contención entre NIVELES DISTINTOS — solo lo resoluble hoy sin un catálogo
// nuevo: nacional cubre cualquier territorio del mismo país, y un estatal cubre un municipal/distrital
// de alguno de sus estados. Nunca concede "exact" (contener no es ser el mismo territorio).
//
// Municipal↔distrito queda DIFERIDO (junto con el "distrito hermano", ver systemPrompt.ts y CLAUDE.md):
// el catálogo de composición sí existe (distritos_municipios/{estado}.json en Cloud Storage, `composicion:
// Record<distritoCve, Record<municipioCve, pctPobtot>>`, ya usado por lib/fontana/tabla/sintesisDistrital.ts
// y lib/fontana/ingesta/eceg.ts), pero (a) es SERVER-ONLY — se lee con fetchEcegFromStorage (Admin Storage)
// — mientras que checkTerritoryMatch/compararTerritorios se llama hoy desde componentes CLIENTE
// ("use client": ModduloButton.tsx, FontanaModduloButton.tsx, F3Tablero.tsx) además de una ruta de
// servidor, como función SÍNCRONA; y (b) es PORCENTUAL, no una partición limpia — un municipio puede
// repartirse entre varios distritos, así que "contenido" exigiría decidir un umbral (¿80%? ¿90%?), no es
// un simple ⊆ de conjuntos. Resolverlo de verdad implica volver la función async y exponer un endpoint
// para los consumidores cliente — cambio de arquitectura, no una extensión de esta pieza.
function relacionPorContencionDeNivel(a: Territorio, b: Territorio): RelacionTerritorial | null {
  const mismoPais =
    !a.pais || !b.pais || claveTextoGeo(a.pais) === claveTextoGeo(b.pais);
  if (!mismoPais) return null;

  if (a.nivel === "nacional") return "cubre";
  if (b.nivel === "nacional") return "cubierto";

  const esMunicipalODistrito = (n: string) => n === "municipal" || esDistrito(n);
  if (a.nivel === "estatal" && esMunicipalODistrito(b.nivel)) {
    const ua = unidadesDeTerritorio(a);
    const ub = unidadesDeTerritorio(b);
    if (ub.estados.size === 0) return null;
    return [...ub.estados].every((e) => ua.claves.has(e)) ? "cubre" : null;
  }
  if (b.nivel === "estatal" && esMunicipalODistrito(a.nivel)) {
    const ua = unidadesDeTerritorio(a);
    const ub = unidadesDeTerritorio(b);
    if (ua.estados.size === 0) return null;
    return [...ua.estados].every((e) => ub.claves.has(e)) ? "cubierto" : null;
  }
  return null;
}

export function compararTerritorios(
  a: Territorio | null | undefined,
  b: Territorio | null | undefined
): ComparacionTerritorial {
  if (!a || !b) return { match: "approximate", relacion: "no_comparable" };
  if (a.nivel !== b.nivel) {
    const relacionContencion = relacionPorContencionDeNivel(a, b);
    // Contener nunca es "ser el mismo territorio": siempre approximate, nunca exact.
    return relacionContencion ? { match: "approximate", relacion: relacionContencion } : { match: "mismatch", relacion: "no_comparable" };
  }
  if (a.pais && b.pais && claveTextoGeo(a.pais) !== claveTextoGeo(b.pais)) {
    return { match: "mismatch", relacion: "disjunto" };
  }

  const ua = unidadesDeTerritorio(a);
  const ub = unidadesDeTerritorio(b);
  let relacion = relacionDeConjuntos(ua.claves, ub.claves);

  if (relacion === "no_comparable" && esDistrito(a.nivel)) {
    // Sin número de distrito resoluble en algún lado (texto libre legado): se conserva la
    // comparación por cabecera y por estado de siempre.
    if (a.estado && b.estado && !mismoEstado(a.estado, b.estado)) return { match: "mismatch", relacion: "disjunto" };
    if (a.municipio && b.municipio) {
      const ca = extraerCiudadCabecera(a.municipio);
      const cb = extraerCiudadCabecera(b.municipio);
      if (ca && cb && !mismoMunicipio(a.estado ?? b.estado, ca, cb)) return { match: "mismatch", relacion: "disjunto" };
    }
    return { match: "approximate", relacion: "no_comparable" };
  }

  switch (relacion) {
    case "disjunto":
      return { match: "mismatch", relacion };
    case "no_comparable":
      // Falta el dato para decidir (p. ej. municipal sin municipio): pide confirmación.
      return { match: "approximate", relacion };
    case "igual": {
      // "exact" solo con datos estructurados en AMBOS lados; nacional y estatal siempre lo son.
      const estructural = a.nivel === "nacional" || a.nivel === "estatal" || (ua.estructural && ub.estructural);
      return { match: estructural ? "exact" : "approximate", relacion };
    }
    default:
      // cubre / cubierto / traslape: hay unidades en común pero no son el mismo territorio.
      return { match: "approximate", relacion };
  }
}

export function checkTerritoryMatch(
  a: Territorio | null | undefined,
  b: Territorio | null | undefined
): TerritoryMatch {
  return compararTerritorios(a, b).match;
}

/**
 * Texto para el aviso de "approximate" según por qué no es un "exact". Un solo lugar para los 5
 * sitios que lo muestran (2 de servidor, 3 de UI): decir "parecen coincidir" cuando en realidad
 * uno contiene al otro engañaría a quien confirma la vinculación.
 */
export function explicarTerritorioApproximate(relacion: RelacionTerritorial): string {
  switch (relacion) {
    case "cubre":
    case "cubierto":
      return "Uno de los territorios contiene al otro y además abarca otras unidades, así que no son el mismo territorio. Revisa que la parte en común sea la que necesitas antes de vincular.";
    case "traslape":
      return "Los territorios comparten algunas unidades, pero cada uno incluye otras que el otro no. Revisa que la parte en común sea la que necesitas antes de vincular.";
    default:
      return "Los territorios parecen coincidir pero no se pudo verificar con un identificador confiable. Revisa que sean el mismo territorio antes de vincular.";
  }
}

export function esTipoCompatible(tipoA: string, tipoB: string): boolean {
  return tipoA === tipoB;
}
