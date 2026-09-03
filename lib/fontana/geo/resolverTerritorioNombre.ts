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
