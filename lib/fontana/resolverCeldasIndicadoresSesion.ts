// lib/fontana/resolverCeldasIndicadoresSesion.ts
// Resuelve las celdas geográficas (CeldaTablaFontana, el MISMO cómputo que
// la tabla comparativa) de TODOS los indicadores seleccionados de una
// sesión — la unión `minimos + seleccionUsuario` de F1/F2/F3/F5.
//
// Extraído del cuerpo de app/api/fontana/sesion/[sesionId]/contexto/route.ts
// (ahora un wrapper delgado) para poder llamarlo también desde
// generarReporteSesion sin un self-HTTP-call: el reporte de sesión debe
// incluir los indicadores heredados/consultados en la tabla aunque nunca
// hayan pasado por el chat (defecto Oaxaca, 26-09-10).
//
// F4 se EXCLUYE (shape `fila` de países, no `celdas`; nunca tiene minimos).
// Reutiliza /api/fontana/familia/[familiaId] vía fetch interno — mismo
// patrón que ya usaba contexto/route.ts, no se duplica construirCeldasTabla.

import type { FontanaSesion, FontanaContextoTerritorial } from "@/types/fontana.types";

interface FamiliaRespuesta {
  indicadores: { id: string; nombre: string; celdas: unknown[]; tieneSerie?: boolean }[];
}

export async function resolverCeldasIndicadoresSesion(
  sesion: FontanaSesion,
  // `timeoutMs`: solo el job del reporte de sesión lo pasa — familia/[id]
  // cae a MOTIVO_TIMEOUT_REPORTE por indicador que exceda el límite en vez
  // de colgar el job. `contexto/route.ts` (entrega a F3) NO lo pasa →
  // comportamiento sin cambios.
  opts: { cookie: string; baseUrl: string; timeoutMs?: number }
): Promise<FontanaContextoTerritorial["indicadores"]> {
  const idsPorFamilia: Record<string, string[]> = {};
  for (const [familia, seleccion] of Object.entries(sesion.indicadoresPorFamilia)) {
    const ids = [...seleccion.minimos, ...seleccion.seleccionUsuario];
    if (ids.length > 0) idsPorFamilia[familia] = ids;
  }

  // F1/F2/F3/F5 comparten el shape de celdas geográficas. F4 (comparación
  // internacional) tiene shape `fila` de países — se excluye (el agente
  // la consulta bajo demanda). Las familias se resuelven EN PARALELO —
  // cada fetch a familia/[id] es pesado (fan-out a fuentes externas) y
  // serializarlas duplicaba la latencia del reporte de sesión.
  const familias = ["F1", "F2", "F3", "F5"].filter((f) => idsPorFamilia[f]?.length > 0);

  const qsTimeout = opts.timeoutMs && opts.timeoutMs > 0 ? `&timeoutMs=${opts.timeoutMs}` : "";
  const porFamilia = await Promise.all(
    familias.map(async (familiaId) => {
      const res = await fetch(
        `${opts.baseUrl}/api/fontana/familia/${familiaId}?sesionId=${sesion.sesionId}${qsTimeout}`,
        { headers: { cookie: opts.cookie } }
      );
      if (!res.ok) return [];
      const data = (await res.json()) as FamiliaRespuesta;
      const idsSeleccionados = new Set(idsPorFamilia[familiaId]);
      return data.indicadores
        .filter((ind) => idsSeleccionados.has(ind.id))
        .map((ind) => ({
          id: ind.id,
          nombre: ind.nombre,
          celdas: ind.celdas as FontanaContextoTerritorial["indicadores"][number]["celdas"],
          tieneSerie: ind.tieneSerie ?? false,
        }));
    })
  );

  // Preserva el orden de familia (F1 → F2 → F3 → F5).
  return familias.flatMap((_, i) => porFamilia[i]);
}
