// lib/centinela/pestel/scraper/banxico.ts
// Fetches latest values from Banco de México SIE API.
// Requires BANXICO_TOKEN env var. Returns [] without error if token is absent.

export interface BanxicoDataPoint {
  serieId: string;
  date: string;
  value: number;
}

// Series SIE:
// SP1     = INPC (inflación Banxico)
// SF43718 = Tipo de cambio Fix (pesos/dólar)
// SF61745 = Tasa objetivo de política monetaria
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
