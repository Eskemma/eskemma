// lib/dev/fontanaInegiSandbox.ts
// Sandbox de diagnóstico — NO es código de producto. Verifica viabilidad
// de la API BIE/BISE v2.0 de INEGI para Familia 1 (sociodemográficos)
// de Fontana. Ver plan: docs/BIE_tabla_equivalencias.xlsx fue descartado
// como fuente de IDs de vivienda/urbano-rural — cubre solo el dominio
// económico/empresarial del BIE (Cuentas nacionales, Sector externo,
// Manufacturas, encuestas económicas, Finanzas públicas, Minería,
// Transporte), no Censo de Población y Vivienda. No se inventa ningún
// ID de indicador — ver bloque ⚠️ PENDIENTE abajo.

export interface InegiTestCase {
  id: string;
  source: "BIE" | "BISE";
  area: string;
  label: string;
}

export type InegiErrorKind =
  | "token_missing"
  | "token_invalid"
  | "indicator_not_found"
  | "network_error"
  | "timeout"
  | "empty_response"
  | "malformed_response";

export interface InegiTestResult {
  case: InegiTestCase;
  ok: boolean;
  httpStatus?: number;
  value?: number;
  unit?: string;
  date?: string;
  responseTimeMs: number;
  errorKind?: InegiErrorKind;
  errorDetail?: string;
  requestUrl: string; // token enmascarado
  rawResponse: unknown;
}

// Verificado 2026-07-08 vía GET /INDICATOR/{id}/es/14/false/BISE/2.0/{TOKEN}
// 1002000001 → pob. total: nacional 126,014,024 (2020)
// 1002000002 → pob. masculina (confirmado por magnitud, ~49% del total por entidad)
// 1002000003 → pob. femenina  (confirmado por magnitud, ~51% del total por entidad)
// Re-verificado en esta sesión (2026-07-24): Jalisco (area=14) 2020 = 8,348,151
// (el valor "8,948,653" documentado en la verificación 2026-07-08 no corresponde
// a ningún año de la serie histórica completa 1910-2020 — error de transcripción,
// no dato desactualizado; no vive en ningún fallback/caché, solo en comentarios).
// Re-verificado en esta sesión (2026-07-24) a nivel municipal:
// 1002000001 / BISE / area="14039" → COBER_GEO:"14039", 2020: 1,385,629
// 1002000001 / BIE   / area="14039" → ErrorCode:100 (BIE no soporta este nivel para esta serie)
// ⚠️ area="14039" es Guadalajara, no Zapopan (corregido 2026-07-24 tras
// cruzar contra el archivo ITER real: conjunto_de_datos_iter_14CSV20.csv,
// columna MUN="039" → NOM_MUN="Guadalajara", POBTOT=1,385,629, coincide
// exacto. Zapopan es MUN="120" en el catálogo real, no "039" — la
// etiqueta original de este archivo estaba mal, no el dato de la API).
//
// ⚠️ PENDIENTE — 2026-07-24: se buscaron IDs de "población urbana/rural" y
// "vivienda con piso de tierra" en docs/BIE_tabla_equivalencias.xlsx (52,042
// filas, columna RUTA_BIE): cero coincidencias — el archivo no cubre Censo
// de Población y Vivienda. Tampoco existe endpoint de catálogo/búsqueda en
// la API BIE v2.0. Antes de agregar estos indicadores aquí, obtener el ID
// exacto vía Query Builder (https://www.inegi.org.mx/app/querybuilder2/) y
// verificarlo contra la API real siguiendo el protocolo de CLAUDE.md.
export const FONTANA_TEST_CASES: InegiTestCase[] = [
  { id: "1002000001", source: "BISE", area: "00", label: "Población total (Nacional)" },
  { id: "1002000001", source: "BISE", area: "14", label: "Población total (Jalisco, estatal)" },
  { id: "1002000001", source: "BISE", area: "14039", label: "Población total (Guadalajara, municipal)" },
  { id: "1002000002", source: "BISE", area: "00", label: "Población masculina (Nacional)" },
  { id: "1002000003", source: "BISE", area: "00", label: "Población femenina (Nacional)" },
  {
    id: "1002000001",
    source: "BIE",
    area: "14039",
    label: "[caso negativo esperado] Población total vía BIE a nivel municipal",
  },
];

interface InegiSeries {
  INDICADOR?: string;
  UNIT?: string;
  OBSERVATIONS?: Array<{ TIME_PERIOD: string; OBS_VALUE: string }>;
}

interface InegiSuccessResponse {
  Series?: InegiSeries[];
}

function maskToken(url: string, token: string): string {
  return url.replace(token, `***${token.slice(-4)}`);
}

async function runOne(testCase: InegiTestCase, token: string | undefined): Promise<InegiTestResult> {
  const baseResult = { case: testCase, requestUrl: "" };

  if (!token) {
    return {
      ...baseResult,
      ok: false,
      responseTimeMs: 0,
      errorKind: "token_missing",
      errorDetail: "INEGI_TOKEN no está configurado en el entorno.",
      rawResponse: null,
    };
  }

  const url =
    "https://www.inegi.org.mx/app/api/indicadores/desarrolladores" +
    `/jsonxml/INDICATOR/${testCase.id}/es/${testCase.area}/false/${testCase.source}/2.0/${token}` +
    "?type=json";
  const requestUrl = maskToken(url, token);

  const start = performance.now();
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch (err) {
    const responseTimeMs = performance.now() - start;
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      ...baseResult,
      ok: false,
      responseTimeMs,
      requestUrl,
      errorKind: isTimeout ? "timeout" : "network_error",
      errorDetail: err instanceof Error ? err.message : String(err),
      rawResponse: null,
    };
  }
  const responseTimeMs = performance.now() - start;

  // INEGI responde con HTTP no-2xx (confirmado: 400) incluso para errores
  // que sí traen detalle útil en el body (ej. ErrorCode:100 para indicador
  // inexistente en esa combinación fuente/área) — hay que leer el body
  // siempre, no solo cuando response.ok.
  let rawResponse: unknown;
  try {
    rawResponse = await response.json();
  } catch (err) {
    return {
      ...baseResult,
      ok: false,
      httpStatus: response.status,
      responseTimeMs,
      requestUrl,
      errorKind: response.ok
        ? "malformed_response"
        : response.status === 401 || response.status === 403
          ? "token_invalid"
          : "network_error",
      errorDetail: err instanceof Error ? err.message : `HTTP ${response.status}: ${err}`,
      rawResponse: null,
    };
  }

  // El API responde un array plano (no {Series:[...]}) en casos de error,
  // ej: ["ErrorInfo:...","ErrorDetails:...","ErrorCode:100"]
  if (Array.isArray(rawResponse)) {
    return {
      ...baseResult,
      ok: false,
      httpStatus: response.status,
      responseTimeMs,
      requestUrl,
      errorKind: "indicator_not_found",
      errorDetail: rawResponse.join(" | "),
      rawResponse,
    };
  }

  if (!response.ok) {
    return {
      ...baseResult,
      ok: false,
      httpStatus: response.status,
      responseTimeMs,
      requestUrl,
      errorKind: response.status === 401 || response.status === 403 ? "token_invalid" : "network_error",
      errorDetail: `HTTP ${response.status}`,
      rawResponse,
    };
  }

  const data = rawResponse as InegiSuccessResponse;
  const series = data.Series?.[0];
  const observations = series?.OBSERVATIONS;

  if (!observations || observations.length === 0) {
    return {
      ...baseResult,
      ok: false,
      httpStatus: response.status,
      responseTimeMs,
      requestUrl,
      errorKind: "empty_response",
      errorDetail: "Respuesta sin Series[0].OBSERVATIONS o vacío.",
      rawResponse,
    };
  }

  const latest = observations[0]; // la API ya regresa orden descendente por fecha
  const value = parseFloat(latest.OBS_VALUE);
  if (isNaN(value)) {
    return {
      ...baseResult,
      ok: false,
      httpStatus: response.status,
      responseTimeMs,
      requestUrl,
      errorKind: "malformed_response",
      errorDetail: `OBS_VALUE no numérico: "${latest.OBS_VALUE}"`,
      rawResponse,
    };
  }

  return {
    ...baseResult,
    ok: true,
    httpStatus: response.status,
    responseTimeMs,
    requestUrl,
    value,
    unit: series?.UNIT,
    date: latest.TIME_PERIOD,
    rawResponse,
  };
}

export async function runFontanaInegiDiagnostics(): Promise<InegiTestResult[]> {
  const token = process.env.INEGI_TOKEN;
  const results = await Promise.allSettled(FONTANA_TEST_CASES.map((testCase) => runOne(testCase, token)));

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          case: FONTANA_TEST_CASES[i],
          ok: false,
          responseTimeMs: 0,
          requestUrl: "",
          errorKind: "network_error" as const,
          errorDetail: r.reason instanceof Error ? r.reason.message : String(r.reason),
          rawResponse: null,
        }
  );
}
