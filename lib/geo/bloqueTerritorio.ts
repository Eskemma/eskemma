// lib/geo/bloqueTerritorio.ts
// Bloque de TERRITORIO para system prompts (26-09-26, Paso 4a). Fuente única de cómo se le presenta
// al modelo el territorio estructurado de un proyecto/sesión: nivel legible, nombre canónico (los
// distritos como `D.F. 3102 PROGRESO (Yucatán)`, ver "Nomenclatura de Distritos" en CLAUDE.md),
// estado/municipio y la lista de unidades cuando el territorio es plural.
//
// Extraído de lib/fontana/agente/systemPrompt.ts sin cambiar su salida (las pruebas de Fontana la
// fijan); lo consumen Fontana y el chat/advisor de Moddulo.
//
// Módulo PURO (sin firebase/red/React).

import type { Territorio } from "@/types/shared.types";
import { esTerritorioParcial } from "@/lib/moddulo/territorioPlural";
import { etiquetaDistritoSeleccionado } from "@/lib/geo/formatDistrito";

export const NIVEL_LEGIBLE: Record<string, string> = {
  nacional: "Nacional (todo México)",
  estatal: "Estatal",
  municipal: "Municipal",
  distrito: "Distrito electoral federal",
  distrito_federal: "Distrito electoral federal",
  distrito_local: "Distrito electoral local",
};

/**
 * Lista legible de las unidades de un territorio plural, o null si es singular.
 * `tope`: máximo de unidades a listar (el resto se resume como «y N más»); sin tope lista todas.
 */
export function unidadesPlurales(territorio: Territorio, tope?: number): { lista: string; total: number } | null {
  if (!esTerritorioParcial(territorio)) return null;
  let items: string[] | null = null;
  if (territorio.distritosSeleccionados && territorio.distritosSeleccionados.length > 1) {
    items = territorio.distritosSeleccionados.map((d) =>
      etiquetaDistritoSeleccionado(territorio.nivel, d, territorio.estado)
    );
  } else if (territorio.municipiosPorEstado && territorio.municipiosPorEstado.length > 1) {
    items = territorio.municipiosPorEstado.map((m) => `${m.nombre} (${m.estado})`);
  } else if (territorio.municipiosSeleccionados && territorio.municipiosSeleccionados.length > 1) {
    items = territorio.municipiosSeleccionados;
  } else if (territorio.estadosSeleccionados && territorio.estadosSeleccionados.length > 1) {
    items = territorio.estadosSeleccionados;
  }
  if (!items) return null;
  const visibles = tope !== undefined && items.length > tope ? items.slice(0, tope) : items;
  const resto = items.length - visibles.length;
  return { lista: visibles.join(", ") + (resto > 0 ? ` y ${resto} más` : ""), total: items.length };
}

/** Líneas comunes: Nivel, Territorio (canónico), Estado, Municipio. */
export function lineasBaseTerritorio(territorio: Territorio): string[] {
  const nivel = NIVEL_LEGIBLE[territorio.nivel] ?? territorio.nivel;
  const distritoUnico =
    (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") &&
    territorio.distritosSeleccionados?.length === 1
      ? etiquetaDistritoSeleccionado(territorio.nivel, territorio.distritosSeleccionados[0], territorio.estado)
      : null;
  const nombre =
    distritoUnico ||
    territorio.nombre ||
    [territorio.estado, territorio.municipio].filter(Boolean).join(" › ") ||
    "(sin nombre)";
  return [
    `- Nivel: ${nivel}`,
    `- Territorio: ${nombre}`,
    territorio.estado ? `- Estado: ${territorio.estado}` : null,
    territorio.municipio ? `- Municipio: ${territorio.municipio}` : null,
  ].filter((l): l is string => l !== null);
}

/** Máximo de unidades plurales que se listan en los prompts de Moddulo (acota el tamaño del prompt). */
export const TOPE_UNIDADES_PROMPT_MODDULO = 20;

/**
 * Bloque de territorio del chat y el advisor de Moddulo. Devuelve "" si el proyecto no tiene
 * territorio (proyectos legados): el prompt queda exactamente como antes.
 * Las reglas viven aquí (no en el prompt base): el bloque es una sección más y no toca la guía de fase.
 */
export function bloqueTerritorioModdulo(territorio: Territorio | null | undefined): string {
  if (!territorio || !territorio.nivel) return "";
  const lineas = [
    "TERRITORIO DEL PROYECTO (dato estructurado y fijo — es la fuente de verdad, no lo infieras del texto libre del XPCTO):",
    ...lineasBaseTerritorio(territorio),
    territorio.pais
      ? `- País: ${territorio.pais}`
      : "- País: no declarado (no asumas uno; si lo necesitas, pregúntaselo al usuario)",
  ];
  const plural = unidadesPlurales(territorio, TOPE_UNIDADES_PROMPT_MODDULO);
  if (plural) {
    lineas.push(
      `- Este proyecto abarca VARIAS unidades (${plural.total}): ${plural.lista}. No las combines ni inventes cifras por unidad.`
    );
  }
  lineas.push(
    "",
    "Reglas sobre el territorio:",
    "- «Este distrito», «mi municipio», «aquí» o «el territorio» se refieren SIEMPRE al territorio de este bloque.",
    "- Si el usuario nombra un lugar distinto, no cambies de alcance en silencio: confirma si se trata de otro territorio (este proyecto sigue siendo el de arriba).",
    "- No puedes modificar el territorio desde el chat; si hay que cambiarlo, indícale que use «Editar territorio» en la fase de Propósito."
  );
  return lineas.join("\n");
}
