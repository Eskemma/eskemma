// functions/src/pestel/scrapers/inegi.ts
// Obtiene indicadores del INEGI vía la API BIE.
// Requiere INEGI_TOKEN. Si no está configurado, retorna [] sin error.

export interface InegiDataPoint {
  serieId: string;
  value: number;
  date: string;
}

// Series BIE del MVP:
// 628229 = INPC (inflación)
// 444612 = Tasa de desocupación
// 381016 = IGAE (proxy del PIB mensual)
export const INEGI_DEFAULT_SERIES = ["628229", "444612", "381016"];

interface InegiResponse {
  Series?: Array<{
    OBSERVATIONS?: Array<{
      TIME_PERIOD: string;
      OBS_VALUE: string;
    }>;
  }>;
}

/**
 * Obtiene el valor más reciente de cada serie BIE del INEGI.
 * @param {string[]} seriesIds IDs de las series a consultar
 * @return {Promise<InegiDataPoint[]>}
 */
export async function fetchInegiIndicators(
  seriesIds: string[]
): Promise<InegiDataPoint[]> {
  const token = process.env.INEGI_TOKEN;
  if (!token) {
    console.warn("[inegi] INEGI_TOKEN no configurado — saltando");
    return [];
  }

  const results: InegiDataPoint[] = [];

  for (const serieId of seriesIds) {
    const url =
      "https://www.inegi.org.mx/app/api/indicadores/desarrolladores" +
      `/jsonxml/INDICATOR/${serieId}/es/0700/false/BIE/2.0/${token}` +
      "?type=json";

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.warn(`[inegi] HTTP ${response.status} serie ${serieId}`);
        continue;
      }

      const data = (await response.json()) as InegiResponse;
      const observations = data.Series?.[0]?.OBSERVATIONS;

      if (observations && observations.length > 0) {
        const latest = observations[observations.length - 1];
        const value = parseFloat(latest.OBS_VALUE);
        if (!isNaN(value)) {
          results.push({serieId, value, date: latest.TIME_PERIOD});
        }
      }
    } catch (error) {
      console.warn(`[inegi] Error en serie ${serieId}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
