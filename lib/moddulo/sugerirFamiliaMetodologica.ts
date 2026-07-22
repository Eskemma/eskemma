// lib/moddulo/sugerirFamiliaMetodologica.ts
// Sugerencia de familia metodológica para Canal 2 (carga manual) a partir de
// texto libre — coincidencia simple de palabras clave, nunca bloqueante.
// Declarativa: el usuario puede editar el resultado siempre.

import type { FamiliaMetodologica } from "@/types/f3.types";

const CUALITATIVA_KEYWORDS = ["entrevista", "grupo focal", "focus group", "observación", "etnografía"];
const CUANTITATIVA_KEYWORDS = ["encuesta", "panel", "exit poll", "sondeo"];
const DOCUMENTAL_KEYWORDS = ["revisión documental", "hemerográfica", "hemerografía", "análisis documental"];

export function sugerirFamiliaMetodologica(texto: string): FamiliaMetodologica {
  const t = texto.toLowerCase();
  if (CUALITATIVA_KEYWORDS.some((k) => t.includes(k))) return "cualitativa";
  if (CUANTITATIVA_KEYWORDS.some((k) => t.includes(k))) return "cuantitativa";
  if (DOCUMENTAL_KEYWORDS.some((k) => t.includes(k))) return "documental";
  return "mixta";
}
