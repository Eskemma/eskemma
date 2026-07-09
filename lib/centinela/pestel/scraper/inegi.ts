// lib/centinela/pestel/scraper/inegi.ts
// Fetches economic indicators from the INEGI BIE API.
// Requires INEGI_TOKEN env var. Returns [] without error if token is absent.

export interface InegiDataPoint {
  serieId: string;
  value: number;
  date: string;
}

// PROTOCOLO: Todo ID de serie externa debe verificarse con una llamada real
// a la API antes de su primer uso en producción. Documentar: fecha + respuesta
// exacta que confirma la identidad. Nunca asumir por plausibilidad.
//
// ⚠️  IDs PENDIENTES DE VERIFICACIÓN — 2026-07-08
// Los IDs abajo (628229, 444612, 381016) nunca se probaron contra la API real.
// Auditados el 2026-07-08: no están en el catálogo BIE (BIE_tabla_equivalencias.xlsx)
// ni en BISE. Devuelven ErrorCode:100 con cualquier combinación de fuente/área.
// INPC e IGAE tampoco existen en el BIE. Área 0700 es incorrecta para indicadores
// nacionales (debe ser 00). Corrección pendiente: usar Query Builder de INEGI
// (inegi.org.mx/app/querybuilder2/) para obtener IDs válidos verificados.
// Impacto actual: fetchInegiIndicators siempre retorna [] con estos IDs.
export const INEGI_DEFAULT_SERIES = ["628229", "444612", "381016"];

interface InegiResponse {
  Series?: Array<{
    OBSERVATIONS?: Array<{
      TIME_PERIOD: string;
      OBS_VALUE: string;
    }>;
  }>;
}

export async function fetchInegiIndicators(
  seriesIds: string[]
): Promise<InegiDataPoint[]> {
  const token = process.env.INEGI_TOKEN;
  if (!token) {
    console.warn("[inegi] INEGI_TOKEN no configurado — saltando");
    return [];
  }

  const results = await Promise.allSettled(
    seriesIds.map(async (serieId): Promise<InegiDataPoint | null> => {
      const url =
        "https://www.inegi.org.mx/app/api/indicadores/desarrolladores" +
        `/jsonxml/INDICATOR/${serieId}/es/0700/false/BIE/2.0/${token}` +
        "?type=json";

      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        console.warn(`[inegi] HTTP ${response.status} serie ${serieId}`);
        return null;
      }

      const data = (await response.json()) as InegiResponse;
      const observations = data.Series?.[0]?.OBSERVATIONS;
      if (!observations || observations.length === 0) return null;

      const latest = observations[observations.length - 1];
      const value = parseFloat(latest.OBS_VALUE);
      if (isNaN(value)) return null;

      return { serieId, value, date: latest.TIME_PERIOD };
    })
  );

  return results
    .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}
