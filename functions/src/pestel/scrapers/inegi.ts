// functions/src/pestel/scrapers/inegi.ts
// Obtiene indicadores del INEGI vía la API BIE o BISE.
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
// IDs abajo (628229, 444612, 381016) nunca se probaron contra la API real.
// Auditados 2026-07-08: no están en catálogo BIE ni BISE.
// ErrorCode:100 con cualquier combinación fuente/área.
// IMPORTANTE: corregir el área de 0700 a 00 NO resolvería el problema;
// los IDs simplemente no existen en ningún catálogo de INEGI.
// Corrección pendiente: Query Builder (inegi.org.mx/app/querybuilder2/).
// Impacto en producción: fetchInegiIndicators retorna [] para BIE.
export const INEGI_DEFAULT_SERIES = ["628229", "444612", "381016"];

// IDs BISE verificados 2026-07-08
// GET /INDICATOR/{id}/es/14/false/BISE/2.0/{TOKEN}
// 1002000001 → pob. total: 126,014,024 nacional, 8,948,653 Jalisco
// 1002000002 → pob. masculina (~49% del total por entidad)
// 1002000003 → pob. femenina  (~51% del total por entidad)
// Sistema censal: actualiza cada 5-10 años.
// Usar con fuente="BISE" y area=cveEntidad (ej. "14" Jalisco).
export const BISE_POBLACION_SERIES = [
  "1002000001", "1002000002", "1002000003",
];

interface InegiResponse {
  Series?: Array<{
    OBSERVATIONS?: Array<{
      TIME_PERIOD: string;
      OBS_VALUE: string;
    }>;
  }>;
}

/**
 * Obtiene el valor más reciente de cada serie del INEGI (BIE o BISE).
 * @param {string[]} seriesIds IDs de las series a consultar
 * @param {"BIE"|"BISE"} fuente Sistema INEGI: BIE (económico) o BISE (censal)
 * @param {string} area Clave geográfica: "00" nacional, "14" Jalisco, etc.
 * @return {Promise<InegiDataPoint[]>}
 */
export async function fetchInegiIndicators(
  seriesIds: string[],
  fuente: "BIE" | "BISE" = "BIE",
  area = "0700"
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
      `/jsonxml/INDICATOR/${serieId}/es/${area}/false/${fuente}/2.0/${token}` +
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
