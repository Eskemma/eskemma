// lib/centinela/pestel/scraper/banxico.ts
// Fetches latest values from Banco de México SIE API.
// Requires BANXICO_TOKEN env var. Returns [] without error if token is absent.

export interface BanxicoDataPoint {
  serieId: string;
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
      datos?: Array<{ fecha: string; dato: string }>;
    }>;
  };
}

async function fetchLatestForSerie(
  serieId: string,
  token: string
): Promise<BanxicoDataPoint | null> {
  const url =
    "https://www.banxico.org.mx/SieAPIRest/service/v1/series/" +
    `${serieId}/datos/oportuno`;

  const response = await fetch(url, {
    headers: { "Bmx-Token": token },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    console.warn(`[banxico] HTTP ${response.status} serie ${serieId}`);
    return null;
  }

  const data = (await response.json()) as BanxicoResponse;
  const datos = (data.bmx?.series?.[0]?.datos ?? []).filter(
    (d) => d.dato !== "N/E" && d.dato !== "N/D"
  );

  const latest = datos[datos.length - 1];
  if (!latest) return null;

  const value = parseFloat(latest.dato.replace(",", "."));
  if (isNaN(value)) return null;

  return { serieId, date: latest.fecha, value };
}

export async function fetchBanxicoSeries(
  seriesIds: string[]
): Promise<BanxicoDataPoint[]> {
  const token = process.env.BANXICO_TOKEN;
  if (!token) {
    console.warn("[banxico] BANXICO_TOKEN no configurado — saltando");
    return [];
  }

  const results = await Promise.allSettled(
    seriesIds.map((id) => fetchLatestForSerie(id, token))
  );

  return results.flatMap((r) =>
    r.status === "fulfilled" && r.value ? [r.value] : []
  );
}
