// lib/fontana/geo/resolverTerritorioNombre.ts
// Resuelve el nombre libre de un territorio (lo que teclea el usuario en el
// chat: "Jalisco", "Guadalajara", "Reforma, Chiapas") a un `Territorio`
// estructurado — SIEMPRE vía claveCanonicaMunicipio()/normalizeGeoName() +
// ESTADO_CVE_MAP, nunca comparación de string a mano (disciplina de
// docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md).
// Si el nombre no resuelve a una sola unidad, devuelve `ambiguo` con
// candidatos — nunca asume el primero.
//
// Extraído de app/api/fontana/consulta-territorio/route.ts (2026-09-01) para
// compartirlo con app/api/fontana/serie-temporal/route.ts.

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import {
  normalizeGeoName,
  claveCanonicaMunicipio,
  getMunicipiosOptionsNacional,
} from "@/lib/geo/municipios";
import type { Territorio } from "@/types/shared.types";
import type { IndicadorRegistro } from "@/lib/fontana/indicatorRegistry";

// 26-09-06, incidente Querétaro/Puebla (comparacion_territorios): cuando un
// nombre coincide con un ESTADO y con un MUNICIPIO homónimo (la capital, en
// general), resolverTerritorioNombre resuelve ESTADO por defecto salvo que
// el llamador pase `nivelHint:"municipal"` explícito — y hasta ahora esa
// decisión dependía de que el MODELO la intuyera caso por caso (heurística
// opcional, no determinística: acertaba a veces, fallaba otras, para el
// MISMO nombre en la MISMA conversación según el flujo).
//
// Fix consciente del indicador (mismo principio que nivelObjetivoSerie,
// lib/fontana/series/tipos.ts): antes de resolver el nombre, se consulta si
// el nivel "estatal" es viable para ESE indicador en el registry
// (`IndicadorRegistro.niveles`). Si "estatal" es `no_viable` y "municipal"
// SÍ está confirmado, forzar `nivelHint:"municipal"` de forma determinística
// — nunca depende de que el modelo lo intuya. Si "estatal" SÍ es viable, no
// se toca nada (la colisión se resuelve como hoy, estado gana, salvo que el
// llamador pida explícitamente lo contrario) — forzar municipal siempre,
// sin este chequeo, cambiaría el bug de un lado a otro para indicadores
// donde el estado SÍ es el nivel correcto.
export function nivelHintPorIndicador(
  registro: Pick<IndicadorRegistro, "niveles"> | null | undefined,
  nivelHintExplicito: string | null
): string | null {
  if (nivelHintExplicito) return nivelHintExplicito; // override explícito del llamador — siempre gana
  if (!registro) return null;
  const estatal = registro.niveles.find((n) => n.nivel === "estatal");
  const municipal = registro.niveles.find((n) => n.nivel === "municipal");
  if (estatal?.estado === "no_viable" && municipal?.estado === "confirmado") {
    return "municipal";
  }
  return null;
}

export type ResolucionTerritorio =
  | { ok: true; territorio: Territorio; label: string }
  | { ok: false; ambiguo: true; candidatos: { estado: string; municipio: string }[] }
  | { ok: false; noResuelto: true };

export async function resolverTerritorioNombre(
  nombre: string,
  estadoHint: string | null,
  nivelHint: string | null
): Promise<ResolucionTerritorio> {
  const norm = normalizeGeoName(nombre);

  // 1) ¿Es un ESTADO? (salvo que el usuario haya pedido explícitamente municipal)
  const cveEstadoDirecto = ESTADO_CVE_MAP[norm];
  if (cveEstadoDirecto && nivelHint !== "municipal" && !estadoHint) {
    const label = nombre.trim();
    return { ok: true, territorio: { nivel: "estatal", estado: label, nombre: label }, label };
  }

  // 2) Municipio — búsqueda nacional, join disciplinado por clave canónica.
  const todos = await getMunicipiosOptionsNacional();
  const hintCve = estadoHint ? ESTADO_CVE_MAP[normalizeGeoName(estadoHint)] : null;
  const matches = todos.filter((o) => {
    if (hintCve && o.estadoCve !== hintCve) return false;
    return claveCanonicaMunicipio(o.estadoCve, o.nombre) === claveCanonicaMunicipio(o.estadoCve, nombre);
  });

  if (matches.length === 1) {
    const m = matches[0];
    const label = `${m.nombre}, ${m.estadoNombre}`;
    return {
      ok: true,
      territorio: { nivel: "municipal", estado: m.estadoNombre, municipio: m.nombre, nombre: label },
      label,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      ambiguo: true,
      candidatos: matches.map((m) => ({ estado: m.estadoNombre, municipio: m.nombre })),
    };
  }

  // 3) Nada como municipio. Si era un estado y el hint pedía municipal, igual
  //    devolvemos el estado (mejor eso que "no resuelto").
  if (cveEstadoDirecto) {
    const label = nombre.trim();
    return { ok: true, territorio: { nivel: "estatal", estado: label, nombre: label }, label };
  }
  return { ok: false, noResuelto: true };
}
