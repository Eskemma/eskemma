// lib/fontana/familias.ts
// Fuente ÚNICA de la metadata de las 5 familias de indicadores de Fontana
// (nombre, descripción de una línea, color de acento). Antes vivía
// duplicada y desincronizada en ≥4 sitios (FontanaIndicadoresAccordion,
// FontanaFamiliaTabs, tools.ts, FontanaCanvasItemCard) — el agente
// conversacional no tenía acceso a ninguna y adivinaba a qué familia
// pertenece un tema. Todos esos consumidores + el system prompt del
// agente importan de aquí.
//
// Metadata FIJA del ecosistema (no cambia por sesión). La LISTA de
// indicadores dentro de cada familia SÍ cambia (Familia 4 creció de 9 a
// 11) — esa nunca se hardcodea aquí: sale del registry vía el endpoint
// /api/fontana/familia/[familiaId] (tool listar_indicadores_familia).

import type { FamiliaFontanaId } from "@/types/fontana.types";

export interface FamiliaFontanaMeta {
  id: FamiliaFontanaId;
  nombre: string;
  descripcion: string;
  color: string;
}

export const FAMILIAS_FONTANA: FamiliaFontanaMeta[] = [
  {
    id: "F1",
    nombre: "Sociodemográficos",
    descripcion: "Indicadores derivados del Censo de Población y Vivienda 2020 (INEGI).",
    color: "#026988",
  },
  {
    id: "F2",
    nombre: "Socioeconómicos",
    descripcion: "Pobreza, marginación, bienestar y acceso a servicios — CONAPO, Bienestar, INEGI.",
    color: "#DB6015",
  },
  {
    id: "F3",
    nombre: "Geopolíticos",
    descripcion: "Seguridad pública, gasto federalizado y organizaciones sociales — SESNSP, INEGI, SHCP, DOF, RFOSC.",
    color: "#D10F3F",
  },
  {
    id: "F4",
    nombre: "Comparación internacional",
    descripcion: "México frente a un set fijo de países de referencia — Banco Mundial, CEPALSTAT, PNUD, RSF, Transparencia Internacional.",
    color: "#248CC1",
  },
  {
    id: "F5",
    nombre: "Características territoriales",
    descripcion: "Clima, tradiciones, actividad económica, zonas urbanas y riesgos ambientales — CONAGUA, INEGI/DENUE, SEDATU/CONAPO, INECC.",
    color: "#FFD14A",
  },
];

export const FAMILIA_META: Record<FamiliaFontanaId, FamiliaFontanaMeta> = Object.fromEntries(
  FAMILIAS_FONTANA.map((f) => [f.id, f])
) as Record<FamiliaFontanaId, FamiliaFontanaMeta>;