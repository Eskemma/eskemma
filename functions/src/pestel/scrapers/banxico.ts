// functions/src/pestel/scrapers/banxico.ts
// Obtiene series del Banco de México vía la API SIE.
// Requiere BANXICO_TOKEN. Si no está configurado, retorna [] sin error.

export interface BanxicoDataPoint {
  date: string;
  value: number;
}

// Series SIE del MVP:
// SP1     = INPC (inflación)
// SF43718 = Tipo de cambio Fix (pesos/dólar)
// SF61745 = Tasa objetivo de política monetaria
export const BANXICO_DEFAULT_SERIES = ["SP1", "SF43718", "SF61745"];

interface BanxicoResponse {
  bmx?: {
    series?: Array<{
      datos?: Array<{fecha: string; dato: string}>;
    }>;
  };
}

/**
 * Obtiene el dato más reciente de una serie SIE de Banxico.
 * @param {string} serieId ID de la serie SIE
 * @return {Promise<BanxicoDataPoint[]>}
 */
export async function fetchBanxicoSeries(
  serieId: string
): Promise<BanxicoDataPoint[]> {
  const token = process.env.BANXICO_TOKEN;
  if (!token) {
    console.warn("[banxico] BANXICO_TOKEN no configurado — saltando", serieId);
    return [];
  }

  const url =
    "https://www.banxico.org.mx/SieAPIRest/service/v1/series/" +
    `${serieId}/datos/oportuno`;

  try {
    const response = await fetch(url, {
      headers: {"Bmx-Token": token},
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn(`[banxico] HTTP ${response.status} serie ${serieId}`);
      return [];
    }

    const data = (await response.json()) as BanxicoResponse;
    const datos = data.bmx?.series?.[0]?.datos || [];

    return datos
      .filter((d) => d.dato !== "N/E" && d.dato !== "N/D")
      .map((d) => ({
        date: d.fecha,
        value: parseFloat(d.dato.replace(",", ".")),
      }))
      .filter((d) => !isNaN(d.value));
  } catch (error) {
    console.warn(`[banxico] Error en serie ${serieId}:`, error);
    return [];
  }
}
