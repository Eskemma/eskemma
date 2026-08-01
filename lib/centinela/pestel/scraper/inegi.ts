// lib/centinela/pestel/scraper/inegi.ts
// Fetches indicators from the INEGI API (BIE or BISE).
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
// IMPORTANTE: corregir el área de 0700 a 00 NO resolvería el problema — los IDs
// simplemente no existen en ningún catálogo de INEGI (BIE ni BISE).
// Corrección pendiente: usar Query Builder (inegi.org.mx/app/querybuilder2/)
// para obtener IDs válidos verificados antes de producción.
// Impacto actual: fetchInegiIndicators siempre retorna [] con estos IDs.
export const INEGI_DEFAULT_SERIES = ["628229", "444612", "381016"];

// IDs BISE verificados 2026-07-08 vía GET /INDICATOR/{id}/es/14/false/BISE/2.0/{TOKEN}
// 1002000001 → pob. total: nacional 126,014,024 (2020), Jalisco 8,348,151 (area=14)
// 1002000002 → pob. masculina (confirmado por magnitud, ~49% del total por entidad)
// 1002000003 → pob. femenina  (confirmado por magnitud, ~51% del total por entidad)
// Sistema censal: actualiza cada 5-10 años (Censo / Conteo de Población y Vivienda).
// Usar con fuente="BISE" y area=cveEntidad (ej. "14" para Jalisco).
export const BISE_POBLACION_SERIES = ["1002000001", "1002000002", "1002000003"];

interface InegiResponse {
  Series?: Array<{
    OBSERVATIONS?: Array<{
      TIME_PERIOD: string;
      OBS_VALUE: string;
    }>;
  }>;
}

export async function fetchInegiIndicators(
  seriesIds: string[],
  fuente: "BIE" | "BISE" = "BIE",
  area: string = "0700"
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
        `/jsonxml/INDICATOR/${serieId}/es/${area}/false/${fuente}/2.0/${token}` +
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
