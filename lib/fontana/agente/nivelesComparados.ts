// lib/fontana/agente/nivelesComparados.ts
// `nivelesComparados` de consultar_indicador (compararNiveles:true): el valor del indicador en cada
// nivel geográfico que el endpoint de familia ya resolvió — el MISMO cómputo que la tabla del panel.
// Extraído de tools.ts (26-09-26) para poder probarlo, y porque hasta hoy descartaba `coberturaPct`
// y `tipoDistritoPropio` de la celda distrital: el chat veía el valor pero no cuánta población
// cubría, así que no podía decirlo (incidente m4qUAX…, Yucatán D.F. 3102).

import { avisoCoberturaChat, esUnidadProporcion, type AvisoCoberturaChat } from "@/lib/fontana/coberturaDistrital";

/** Lo mínimo de una celda de la tabla que este armado necesita (CeldaTablaFontana es compatible). */
export interface CeldaParaChat {
  nivel: string;
  valor?: number;
  unidad?: string;
  naturaleza?: string;
  fuenteEtiqueta?: string;
  motivo?: string;
  coberturaPct?: number;
  tipoDistritoPropio?: "federal" | "local";
}

export interface NivelComparado {
  nivel: string;
  valor: number | null;
  unidad: string | null;
  naturaleza: string | null;
  fuenteEtiqueta: string | null;
  motivo: string | null;
  /** Solo nivel distrital con valor: % de la población del distrito que sí se pudo asignar. */
  coberturaPct: number | null;
  tipoDistritoPropio: "federal" | "local" | null;
  /** null = sin aviso (cobertura ≥ 99 % o no aplica). */
  avisoCobertura: AvisoCoberturaChat | null;
}

/** Campos de cobertura de una celda, listos para el resultado del chat. */
export function camposCobertura(celda: CeldaParaChat | undefined): Pick<NivelComparado, "coberturaPct" | "tipoDistritoPropio" | "avisoCobertura"> {
  const aplica = !!celda && celda.nivel === "distrital" && celda.valor !== undefined && typeof celda.coberturaPct === "number";
  return {
    coberturaPct: aplica ? celda!.coberturaPct! : null,
    tipoDistritoPropio: aplica ? celda!.tipoDistritoPropio ?? null : null,
    avisoCobertura: aplica ? avisoCoberturaChat(celda!.coberturaPct, { esProporcion: esUnidadProporcion(celda!.unidad) }) : null,
  };
}

export function armarNivelesComparados(
  celdas: CeldaParaChat[],
  naturalezaDelRegistry: (nivel: string) => string | null,
  fuenteDelIndicador: string | null
): NivelComparado[] {
  return celdas.map((c) => ({
    nivel: c.nivel,
    valor: c.valor ?? null,
    unidad: c.unidad ?? null,
    naturaleza: c.naturaleza ?? naturalezaDelRegistry(c.nivel),
    fuenteEtiqueta: c.fuenteEtiqueta ?? fuenteDelIndicador,
    motivo: c.valor === undefined ? c.motivo ?? "Nivel no cubierto." : null,
    ...camposCobertura(c),
  }));
}
