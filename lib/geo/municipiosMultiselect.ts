// lib/geo/municipiosMultiselect.ts
// Lógica PURA de la multiselección de municipios de TerritorySelector (Paso 4c, 26-09-26): convierte el
// catálogo de un estado (con la `clave` estable que calcula /api/geo/options) en opciones del picker y
// aplica un cambio de selección sobre `municipiosPorEstado` con las reglas de siempre (dedup por clave,
// nombre oficial del catálogo, entradas sin clave —alta libre o fuera de México— intactas).

import type { MunicipioSeleccionado } from "@/types/shared.types";
import { etiquetaDesambiguacionMunicipio } from "./etiquetasDesambiguacionMunicipio";
import { nombreMunicipioDisplay } from "./display";
import { agregarMunicipioSeleccionado } from "./municipioSeleccionado";

/** Fila del catálogo de un estado tal como la sirve /api/geo/options?tipo=municipios. */
export interface MunicipioCatalogo {
  cve: string;
  nombre: string;
  clave?: string;
}

export interface OpcionMunicipio {
  value: string; // clave estable
  label: string;
}

/** Etiqueta del picker: nombre de display y, si es homónimo del mismo estado, su «Dto. NN». */
function etiquetaOpcion(estadoCve: string, m: MunicipioCatalogo): string {
  const nombre = nombreMunicipioDisplay(m.nombre).nombre;
  const dto = m.clave?.includes("#") ? etiquetaDesambiguacionMunicipio(estadoCve, m.cve) : null;
  return dto ? `${nombre} (${dto})` : nombre;
}

/**
 * Opciones del picker de UN estado: el catálogo con clave + las entradas ya seleccionadas con clave que
 * el catálogo no trae (por ejemplo mientras carga, o un municipio creado después del catálogo), para que
 * su etiqueta se vea igual. Sin clave → no hay valor estable: esas entradas no van en el picker.
 */
export function opcionesMunicipios(
  estadoCve: string,
  catalogo: MunicipioCatalogo[],
  seleccionados: MunicipioSeleccionado[]
): OpcionMunicipio[] {
  const opciones: OpcionMunicipio[] = [];
  const vistas = new Set<string>();
  for (const m of catalogo) {
    if (!m.clave || vistas.has(m.clave)) continue;
    vistas.add(m.clave);
    opciones.push({ value: m.clave, label: etiquetaOpcion(estadoCve, m) });
  }
  for (const s of seleccionados) {
    if (!s.clave || vistas.has(s.clave)) continue;
    vistas.add(s.clave);
    opciones.push({ value: s.clave, label: s.nombre });
  }
  return opciones;
}

/** Claves seleccionadas de un estado (las entradas sin clave no entran en el picker). */
export function clavesSeleccionadas(actual: MunicipioSeleccionado[], estadoNombre: string): string[] {
  return actual.filter((m) => m.estado === estadoNombre && m.clave).map((m) => m.clave as string);
}

/**
 * Aplica la selección del picker de UN estado: agrega las claves nuevas (con el nombre OFICIAL del catálogo)
 * y quita las que ya no están. No toca otros estados ni las entradas sin clave. Una entrada guardada sin
 * clave con el mismo nombre que la elegida se completa (no se duplica), como en `agregarMunicipioSeleccionado`.
 */
export function aplicarSeleccionMunicipios(
  actual: MunicipioSeleccionado[],
  estadoNombre: string,
  nuevasClaves: string[],
  catalogo: MunicipioCatalogo[]
): MunicipioSeleccionado[] {
  const previas = new Set(clavesSeleccionadas(actual, estadoNombre));
  const quedan = new Set(nuevasClaves);
  let resultado = actual.filter((m) => !(m.estado === estadoNombre && m.clave && !quedan.has(m.clave)));
  for (const clave of nuevasClaves) {
    if (previas.has(clave)) continue;
    const fila = catalogo.find((m) => m.clave === clave);
    if (!fila) continue;
    resultado = agregarMunicipioSeleccionado(resultado, {
      nombre: nombreMunicipioDisplay(fila.nombre).nombre,
      estado: estadoNombre,
      clave,
    });
  }
  return resultado;
}
