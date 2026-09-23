// lib/moddulo/abreviaturaEstado.ts
// Abreviatura del estado para el label de padrón de Moddulo F2 ("GUADALAJARA, JAL.").
// Antes vivía en exploracion/page.tsx como una tabla keyada por NOMBRE normalizado
// con los alias escritos a mano; luego fue una tabla por CVE propia de este módulo.
// Desde 26-09-23 las letras salen de UNA sola tabla compartida
// (`lib/geo/abreviaturasEstado.ts`, forma con punto = código + "." salvo CDMX) y el
// nombre se resuelve con el helper central, así que cualquier alias que reconozca
// `resolverEstado` ("Distrito Federal", "Edo. Méx.", nombres oficiales largos…)
// funciona igual. Cambios visibles al unificar: Colima pasa a COLI (COL es Colombia),
// Tamaulipas a TAMPS y Quintana Roo a QROO, todos con punto final.
// Solo display: nada lee ni une datos con este valor.

import { resolverEstadoCve } from "@/lib/geo/estados";
import { abreviaturaConPunto } from "@/lib/geo/abreviaturasEstado";

/** Abreviatura del estado, o null si el nombre no es un estado mexicano (p. ej. un departamento de Colombia). */
export function abreviaturaEstado(nombre: string | null | undefined): string | null {
  return abreviaturaConPunto(resolverEstadoCve(nombre));
}
