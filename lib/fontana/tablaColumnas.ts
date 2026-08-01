// lib/fontana/tablaColumnas.ts
// Set de columnas de la tabla comparativa por tipo de proyecto —
// Documentación Técnica §5.2: el tipo de proyecto decide el patrón de
// columnas OFRECIDO; el indicador decide cuáles de esas columnas
// muestran dato real (nunca una columna vacía sin motivo explícito).

import type { ProjectType } from "@/types/moddulo.types";

export type NivelTablaFontana = "nacional" | "estatal" | "distrital" | "municipal" | "ageb";

const COLUMNAS_ELECTORAL: NivelTablaFontana[] = ["nacional", "estatal", "distrital", "municipal"];
const COLUMNAS_NO_ELECTORAL: NivelTablaFontana[] = ["nacional", "estatal", "municipal", "ageb"];

export function columnasParaTipoProyecto(tipo: ProjectType): NivelTablaFontana[] {
  return tipo === "electoral" ? COLUMNAS_ELECTORAL : COLUMNAS_NO_ELECTORAL;
}

export const NOMBRE_NIVEL_TABLA: Record<NivelTablaFontana, string> = {
  nacional: "Nacional",
  estatal: "Estatal",
  distrital: "Distrital",
  municipal: "Municipal",
  ageb: "AGEB",
};

// Fontana no tiene, en este incremento, agregación nacional ni
// resolución distrital/AGEB — solo estatal y municipal (ver
// lib/fontana/ingesta/eceg.ts). Declarado explícitamente, nunca como
// columna vacía sin motivo.
export const MOTIVO_NIVEL_NO_CUBIERTO = "Nivel no cubierto en este incremento de Fontana";

// Forma de celda de la tabla comparativa — más amplia que CeldaFontana de
// lib/fontana/ingesta/eceg.ts (que solo resuelve estatal/municipal): esta
// cubre las 5 columnas posibles, con "valor" y "motivo" mutuamente
// excluyentes en la práctica (nunca ambos, nunca ninguno).
export interface CeldaTablaFontana {
  nivel: NivelTablaFontana;
  valor?: number;
  unidad?: string;
  naturaleza?: "dato_directo" | "calculo_directo" | "estimacion_modelada" | "estimacion_agregada" | "proxy_conceptual";
  fuenteEtiqueta?: string;
  motivo?: string;
}
