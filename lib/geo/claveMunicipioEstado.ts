// lib/geo/claveMunicipioEstado.ts
// Clave de comparación de un municipio TECLEADO por el usuario dentro de un estado
// (dedup del selector de territorio). Función pura, importable desde componentes cliente.
//
// Antes el dedup era `trim().toLowerCase()`: "Tlaquepaque" y "San Pedro Tlaquepaque",
// o "Zúñiga" y "Zuniga", se agregaban dos veces (doble conteo en agregación aditiva).
// Ahora usa los alias verificados del estado + plegado de acentos/mayúsculas/Ñ/Ü.
// Sin CVE de estado (p. ej. un departamento de Colombia) solo aplican acentos/mayúsculas.

import { resolverEstadoCve } from "./estados";
import { claveComparacionMunicipio } from "./municipioCanonico";

export function claveMunicipioDeEstado(estado: string | undefined, nombre: string): string {
  return claveComparacionMunicipio(resolverEstadoCve(estado) ?? "", nombre);
}
