// lib/moddulo/abreviaturaEstado.ts
// Abreviatura del estado para el label de padrón de Moddulo F2 ("GUADALAJARA, JAL.").
// Antes vivía en exploracion/page.tsx como una tabla keyada por NOMBRE normalizado
// con los alias escritos a mano (`normalizeParaAbrev` + `ESTADOS_ABREV`). Ahora la
// tabla va por CVE y el nombre se resuelve con el helper central, así que cualquier
// alias que reconozca `resolverEstado` ("Distrito Federal", "Edo. Méx.", nombres
// oficiales largos…) funciona igual. Los VALORES no cambian.
//
// Las abreviaturas son una decisión de presentación de ESTE módulo: otras vistas
// usan otras convenciones ("TAMPS" en OrigenCharts, "Edo. México" en semanalUtils).
// Unificarlas es una decisión de diseño pendiente; no se toca aquí.

import { resolverEstadoCve } from "@/lib/geo/estados";

export const ABREVIATURA_ESTADO_POR_CVE: Record<string, string> = {
  "01": "AGS.",
  "02": "BC.",
  "03": "BCS.",
  "04": "CAMP.",
  "05": "COAH.",
  "06": "COL.",
  "07": "CHIS.",
  "08": "CHIH.",
  "09": "CDMX",
  "10": "DGO.",
  "11": "GTO.",
  "12": "GRO.",
  "13": "HGO.",
  "14": "JAL.",
  "15": "EDOMEX.",
  "16": "MICH.",
  "17": "MOR.",
  "18": "NAY.",
  "19": "NL.",
  "20": "OAX.",
  "21": "PUE.",
  "22": "QRO.",
  "23": "Q.ROO.",
  "24": "SLP.",
  "25": "SIN.",
  "26": "SON.",
  "27": "TAB.",
  "28": "TAMS.",
  "29": "TLAX.",
  "30": "VER.",
  "31": "YUC.",
  "32": "ZAC.",
};

/** Abreviatura del estado, o null si el nombre no es un estado mexicano (p. ej. un departamento de Colombia). */
export function abreviaturaEstado(nombre: string | null | undefined): string | null {
  const cve = resolverEstadoCve(nombre);
  return cve ? ABREVIATURA_ESTADO_POR_CVE[cve] ?? null : null;
}
