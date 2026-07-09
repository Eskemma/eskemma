// functions/src/pestel/scrapers/banxico.ts
// Obtiene series del Banco de México vía la API SIE.
// Requiere BANXICO_TOKEN. Si no está configurado, retorna [] sin error.

export interface BanxicoDataPoint {
  date: string;
  value: number;
}

// PROTOCOLO: Todo ID de serie externa debe verificarse con una llamada real
// a la API antes de su primer uso en producción. Documentar: fecha + campo
// de metadato exacto que confirma la identidad. Nunca asumir por plausibilidad.
//
// Series SIE — verificadas el 2026-07-08 vía:
//   GET /SieAPIRest/service/v1/series/{id}  →  campo "titulo" + "cifra" + "unidad"
// SP1     → titulo:"IPC Por objeto del gasto Nacional I n d i c e G e n e r a l"
//            cifra:"Indices"  unidad:"Sin Unidad"  periodicidad:"Mensual"  → INPC
// SF43718 → titulo:"Tipo de cambio Pesos por dólar E.U.A. ... FIX"
//            cifra:"Tipo de Cambio"  unidad:"Pesos por Dólar"  → Tipo de cambio FIX
// SF61745 → titulo:"Tasa objetivo"  → Tasa objetivo de política monetaria
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
