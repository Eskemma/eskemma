// lib/geo/clavesMunicipioCatalogo.ts
// Clave estable de cada municipio de un estado a partir de su catálogo (Paso 4c, 26-09-26): la MISMA
// regla que `desambiguarReferencia` (lib/geo/desambiguar.ts), calculada en el servidor dentro de
// /api/geo/options para que la multiselección del formulario no duplique la regla de homónimos.
//
//   clave = `${estadoCve}:${claveCanonicaMunicipio(estadoCve, nombre)}`  (POR NOMBRE, nunca el `cve` INE)
//   excepción: si dos municipios del MISMO estado comparten clave (Oaxaca: SAN JUAN MIXTEPEC 208/209 y
//   SAN PEDRO MIXTEPEC 316/317 — exactamente esos 4 en todo el país) cada uno lleva el sufijo `#<cve>`
//   (el cve INE solo distingue el par; nunca se usa para unir datos).
//
// Módulo PURO.

import { claveCanonicaMunicipio } from "./municipioCanonico";

export interface FilaCatalogoMunicipio {
  cve: string;
  nombre: string;
}

/** Opción de /api/geo/options?tipo=municipios con la clave estable (aditiva). */
export interface GeoOptionMunicipio extends FilaCatalogoMunicipio {
  clave?: string;
}

/** `estadoCve` (2 dígitos) + filas del catálogo del estado → clave estable por fila. */
export function clavesDeMunicipiosDelEstado(estadoCve: string, filas: FilaCatalogoMunicipio[]): string[] {
  const base = filas.map((f) => `${estadoCve}:${claveCanonicaMunicipio(estadoCve, f.nombre)}`);
  const conteo = new Map<string, number>();
  for (const c of base) conteo.set(c, (conteo.get(c) ?? 0) + 1);
  return base.map((c, i) => ((conteo.get(c) ?? 0) > 1 ? `${c}#${filas[i].cve}` : c));
}
