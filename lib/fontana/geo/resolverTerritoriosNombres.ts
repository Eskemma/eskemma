// lib/fontana/geo/resolverTerritoriosNombres.ts
// Wrapper de LOTE sobre resolverReferenciaTerritorio (26-09-06, comparación de
// territorios arbitrarios) — resuelve N nombres en paralelo y particiona el
// resultado en resueltos/no-resueltos. No modifica resolverReferenciaTerritorio
// (sigue siendo la única función de resolución por nombre, 1 a la vez); esto
// es solo el patrón `agregacionPlural.desglosePorUnidad`/`noResueltas`
// (lib/fontana/tablaColumnas.ts) generalizado a territorios nombrados desde
// fuera del proyecto, en vez de a los municipios propios de un proyecto
// plural.

import { resolverReferenciaTerritorio, type CandidatoTerritorio } from "./resolverReferenciaTerritorio";
import type { Territorio } from "@/types/shared.types";
import type { IndicadorRegistro } from "@/lib/fontana/indicatorRegistry";

export interface ResolucionTerritoriosBatch {
  resueltos: {
    nombreIngresado: string;
    territorio: Territorio;
    label: string;
    /** true si apunta al propio territorio del proyecto ("este distrito"). */
    esTerritorioDelProyecto?: boolean;
    aviso?: string;
  }[];
  noResueltos: {
    nombreIngresado: string;
    motivo: string;
    /** Etiquetas de las opciones (para mostrar). */
    candidatos?: string[];
    /** Las mismas opciones con su clave estable: lo que se re-envía como `claveTerritorio`. */
    opciones?: CandidatoTerritorio[];
  }[];
}

export async function resolverTerritoriosNombres(
  nombres: {
    nombre: string;
    estadoHint?: string;
    // 26-09-07: nivel EXPLÍCITO pedido por el usuario para ESTE territorio
    // (ej. "municipios (capitales)" → "municipal") — paralelo a
    // `estadoHint`, no un valor único para todo el lote: cada territorio
    // puede necesitar un nivel distinto.
    nivelHintExplicito?: string | null;
    /** Paso 3: clave elegida de una lista de candidatos ofrecida antes (se verifica en el servidor). */
    claveTerritorio?: string | null;
    /** Paso 3: tipo dicho explícitamente por el usuario (estado, municipio, país, distrito_federal, distrito_local). */
    tipoTerritorio?: string | null;
  }[],
  // Registry del indicador: el adaptador decide con él qué tipos considerar (estado/municipio/país/
  // distrito). El override explícito del usuario siempre gana; si no hay, se acota por los niveles
  // que ESTE indicador admite (mismo criterio del incidente Iztapalapa/Querétaro/Puebla).
  registro: Pick<IndicadorRegistro, "niveles"> | null | undefined,
  // Territorio activo de la sesión: "este distrito" / "nivel estatal" se resuelven contra él.
  territorioActivo?: Territorio | null
): Promise<ResolucionTerritoriosBatch> {
  const resultados = await Promise.all(
    nombres.map(async ({ nombre, estadoHint, nivelHintExplicito, claveTerritorio, tipoTerritorio }) => ({
      nombreIngresado: nombre,
      resolucion: await resolverReferenciaTerritorio({
        texto: nombre,
        estadoHint: estadoHint ?? null,
        nivelHint: nivelHintExplicito ?? null,
        claveTerritorio: claveTerritorio ?? null,
        tipoTerritorio: tipoTerritorio ?? null,
        registro,
        territorioActivo: territorioActivo ?? null,
      }),
    }))
  );

  const resueltos: ResolucionTerritoriosBatch["resueltos"] = [];
  const noResueltos: ResolucionTerritoriosBatch["noResueltos"] = [];

  for (const { nombreIngresado, resolucion } of resultados) {
    if (resolucion.ok) {
      resueltos.push({
        nombreIngresado,
        territorio: resolucion.territorio,
        label: resolucion.label,
        esTerritorioDelProyecto: resolucion.esTerritorioDelProyecto,
        aviso: resolucion.aviso,
      });
    } else if (resolucion.referencia === "ambiguo") {
      noResueltos.push({
        nombreIngresado,
        motivo: resolucion.mensaje,
        candidatos: resolucion.candidatos.map((c) => c.etiqueta),
        opciones: resolucion.candidatos,
      });
    } else if (resolucion.referencia === "demasiados") {
      noResueltos.push({
        nombreIngresado,
        motivo: resolucion.mensaje,
        candidatos: resolucion.exactas.map((c) => c.etiqueta),
        opciones: resolucion.exactas,
      });
    } else if (resolucion.referencia === "noResuelto") {
      noResueltos.push({ nombreIngresado, motivo: `«${nombreIngresado}» no se reconoce como territorio de México (estado, municipio, país o distrito).` });
    } else {
      noResueltos.push({ nombreIngresado, motivo: resolucion.mensaje });
    }
  }

  return { resueltos, noResueltos };
}
