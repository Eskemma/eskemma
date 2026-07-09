// functions/src/pestel/scrapers/inegi.ts
// Obtiene indicadores del INEGI vía la API BIE.
// Requiere INEGI_TOKEN. Si no está configurado, retorna [] sin error.

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
// Impacto actual en producción: fetchInegiIndicators siempre retorna [] →
// análisis PESTEL de Centinela nunca recibieron datos INEGI (no hay regresión).
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
