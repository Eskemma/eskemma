// lib/geo/formatDistrito.ts
import { resolverEstadoCve } from "./estados";
// Nomenclatura compartida de distritos electorales (26-08-16) — mismo
// formato ya usado por Sefix, ahora estándar para TODO el ecosistema
// (ver CLAUDE.md, sección "Nomenclatura de Distritos Electorales").
// Función pura, sin dependencias server-only — a diferencia de
// lib/geo/distritos.ts (importa firebase-admin/storage), este archivo
// es seguro de importar como VALOR tanto desde componentes cliente
// (TerritorySelector.tsx) como desde adaptadores server-side
// (lib/fontana/ingesta/eceg.ts).
//
// No confundir con GeoOptionDistrito.nombre (lib/geo/distritos.ts,
// formato legado "D.F. 001 – JUAREZ", sin cve de estado) — ese campo
// NO cambia de forma porque Sefix lo parsea con split("–"); este
// formato nuevo se construye al CONSUMIR ese campo, nunca en la fuente
// compartida.

/**
 * Formatea el label de un distrito electoral con clave autosuficiente
 * (no depende de contexto externo para ser inequívoco): prefijo +
 * cve de estado (2 dígitos) + cve de distrito (2 dígitos) + cabecera.
 * Ej: "D.F. 1405 PUERTO VALLARTA", "D.L. 0927 IZTAPALAPA".
 *
 * Cae a `nombreFallback` cuando falta `cabecera` o `estadoCve` — mismo
 * criterio de "nunca fabricar un dato que no se tiene" ya establecido
 * en este workstream.
 */
export function formatDistritoLabel(
  nivel: "distrito_federal" | "distrito_local",
  estadoCve: string | null,
  distritoCve: string,
  cabecera: string | undefined,
  nombreFallback: string
): string {
  const prefijo = nivel === "distrito_federal" ? "D.F." : "D.L.";
  if (!cabecera || !estadoCve) return nombreFallback;
  const distritoCve2 = distritoCve.slice(-2);
  return `${prefijo} ${estadoCve}${distritoCve2} ${cabecera.toUpperCase()}`;
}

/**
 * Un distrito SELECCIONADO de un proyecto (`Territorio.distritosSeleccionados[i]`: `cve` de 3 dígitos,
 * `nombre` = cabecera) en la forma canónica con el estado entre paréntesis:
 * "D.F. 3102 PROGRESO (Yucatán)". Sin ella el chat solo vería la cabecera ("PROGRESO", "MERIDA"),
 * que puede ser varios distritos. Cae al nombre crudo si no se puede armar la clave.
 */
export function etiquetaDistritoSeleccionado(
  nivel: "distrito_federal" | "distrito_local" | "distrito" | string,
  d: { cve: string; nombre: string; estado?: string },
  estadoDefault?: string
): string {
  const estado = d.estado ?? estadoDefault;
  const estadoCve = estado ? resolverEstadoCve(estado) : null;
  const tipo = nivel === "distrito_local" ? "distrito_local" : "distrito_federal";
  const base = formatDistritoLabel(tipo, estadoCve, d.cve, d.nombre, d.nombre);
  return estado ? `${base} (${estado})` : base;
}
