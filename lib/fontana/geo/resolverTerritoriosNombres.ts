// lib/fontana/geo/resolverTerritoriosNombres.ts
// Wrapper de LOTE sobre resolverTerritorioNombre (26-09-06, comparación de
// territorios arbitrarios) — resuelve N nombres en paralelo y particiona el
// resultado en resueltos/no-resueltos. No modifica resolverTerritorioNombre
// (sigue siendo la única función de resolución por nombre, 1 a la vez); esto
// es solo el patrón `agregacionPlural.desglosePorUnidad`/`noResueltas`
// (lib/fontana/tablaColumnas.ts) generalizado a territorios nombrados desde
// fuera del proyecto, en vez de a los municipios propios de un proyecto
// plural.

import { resolverTerritorioNombre, nivelHintPorIndicador } from "./resolverTerritorioNombre";
import type { Territorio } from "@/types/shared.types";
import type { IndicadorRegistro } from "@/lib/fontana/indicatorRegistry";

export interface ResolucionTerritoriosBatch {
  resueltos: { nombreIngresado: string; territorio: Territorio; label: string }[];
  noResueltos: { nombreIngresado: string; motivo: string; candidatos?: string[] }[];
}

export async function resolverTerritoriosNombres(
  nombres: {
    nombre: string;
    estadoHint?: string;
    // 26-09-07: nivel EXPLÍCITO pedido por el usuario para ESTE territorio
    // (ej. "municipios (capitales)" → "municipal") — paralelo a
    // `estadoHint`, no un valor único para todo el lote (a diferencia del
    // diseño anterior): cada territorio puede necesitar un nivel distinto.
    nivelHintExplicito?: string | null;
  }[],
  // Registry del indicador — se combina con `nivelHintExplicito` vía
  // nivelHintPorIndicador() por cada nombre: el override explícito del
  // usuario siempre gana; si no hay override, se fuerza municipal solo
  // cuando "estatal" es no_viable para ESTE indicador (mismo criterio ya
  // aprobado para el incidente Iztapalapa/Querétaro/Puebla).
  registro: Pick<IndicadorRegistro, "niveles"> | null | undefined
): Promise<ResolucionTerritoriosBatch> {
  const resultados = await Promise.all(
    nombres.map(async ({ nombre, estadoHint, nivelHintExplicito }) => ({
      nombreIngresado: nombre,
      resolucion: await resolverTerritorioNombre(
        nombre,
        estadoHint ?? null,
        nivelHintPorIndicador(registro, nivelHintExplicito ?? null)
      ),
    }))
  );

  const resueltos: ResolucionTerritoriosBatch["resueltos"] = [];
  const noResueltos: ResolucionTerritoriosBatch["noResueltos"] = [];

  for (const { nombreIngresado, resolucion } of resultados) {
    if (resolucion.ok) {
      resueltos.push({ nombreIngresado, territorio: resolucion.territorio, label: resolucion.label });
    } else if ("ambiguo" in resolucion && resolucion.ambiguo) {
      noResueltos.push({
        nombreIngresado,
        motivo: `«${nombreIngresado}» coincide con ${resolucion.candidatos.length} municipios — falta precisar el estado.`,
        candidatos: resolucion.candidatos.map((c) => `${c.municipio}, ${c.estado}`),
      });
    } else {
      noResueltos.push({ nombreIngresado, motivo: `«${nombreIngresado}» no se reconoce como estado o municipio de México.` });
    }
  }

  return { resueltos, noResueltos };
}
