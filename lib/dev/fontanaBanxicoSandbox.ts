// lib/dev/fontanaBanxicoSandbox.ts
// Sandbox de diagnóstico — NO es código de producto. Verifica viabilidad
// del SIE (Sistema de Información Económica) de Banxico como fuente de
// F1-17 (remesas per cápita) de Fontana. Mismo protocolo que
// fontanaInegiSandbox.ts: llamadas reales, evidencia literal fechada,
// ningún ID de serie asumido por plausibilidad.
//
// Hallazgo principal de esta sesión (2026-07-31): Banxico SÍ desagrega
// remesas por entidad federativa — cuadro CA79 ("Remesas por entidad
// federativa", https://www.banxico.org.mx/SieInternet/
// consultarDirectorioInternetAction.do?accion=consultarCuadroAnalitico&
// idCuadro=CA79). Esto contradice el supuesto inicial de que Banxico solo
// publicaría un total nacional — no hace falta el fallback de "promedio
// nacional aplicado" (proxy_conceptual) para el nivel estatal: F1-17
// puede ser dato_directo en estatal.
//
// Mecanismo de descubrimiento (para que sea reproducible, no solo el
// resultado): el HTML del cuadro CA79 trae 33 inputs ocultos
// `<input type="hidden" name="series" value="SE#####">` en el mismo
// orden que las 33 filas de la tabla visible (32 entidades + "Total"),
// orden alfabético en español. Cruzando ese orden posicional contra la
// API real de series (`GET /series/{id}?locale=es`, campo `titulo`) se
// verificaron las 33 series completas — no es una muestra, es el
// universo completo de la tabla — el 2026-07-31.

export interface BanxicoTestCase {
  serieId: string;
  entidad: string;
  label: string;
}

export type BanxicoErrorKind =
  | "token_missing"
  | "token_invalid"
  | "series_not_found"
  | "network_error"
  | "timeout"
  | "empty_response"
  | "malformed_response";

export interface BanxicoTestResult {
  case: BanxicoTestCase;
  ok: boolean;
  httpStatus?: number;
  value?: number;
  unit?: string;
  date?: string;
  periodicidad?: string;
  responseTimeMs: number;
  errorKind?: BanxicoErrorKind;
  errorDetail?: string;
  requestUrl: string; // token enmascarado
  rawResponse: unknown;
}

// Verificado 2026-07-31 vía GET /SieAPIRest/service/v1/series/{id}?locale=es
// — campo "titulo" literal de la API, las 33 series del cuadro CA79
// (SE29670..SE29702), sin excepción:
//
// SE29670 Aguascalientes           SE29687 Nayarit
// SE29671 Baja California          SE29688 Nuevo León
// SE29672 Baja California Sur      SE29689 Oaxaca
// SE29673 Campeche                 SE29690 Puebla
// SE29674 Coahuila                 SE29691 Querétaro
// SE29675 Colima                   SE29692 Quintana Roo
// SE29676 Chiapas                  SE29693 San Luis Potosí
// SE29677 Chihuahua                SE29694 Sinaloa
// SE29678 Ciudad de México (fila "Distrito Federal" en el cuadro,
//         titulo real de la API dice "Ciudad de México" — usar el
//         nombre de la API como fuente de verdad al mapear contra el
//         territorio del proyecto en Fase 5, no el de la fila del cuadro)
// SE29679 Durango                  SE29695 Sonora
// SE29680 Estado de México         SE29696 Tabasco
// SE29681 Guanajuato               SE29697 Tamaulipas
// SE29682 Guerrero                 SE29698 Tlaxcala
// SE29683 Hidalgo                  SE29699 Veracruz
// SE29684 Jalisco                  SE29700 Yucatán
// SE29685 Michoacán                SE29701 Zacatecas
// SE29686 Morelos                  SE29702 TOTAL (nacional)
//
// Todas: periodicidad "Trimestral", cifra "Flujos" (SE29702 Total es
// "Saldos"), unidad "Millones de Dólares". Confirmado con /datos/oportuno
// para 4 series (Aguascalientes, Baja California, Jalisco, Total) —
// último dato disponible fecha "01/01/2026" (trimestre Ene-Mar 2026):
// SE29670=221.495629, SE29671=368.251693, SE29684=1,212.106033 (coincide
// exacto con el valor "Ene-Mar 2026" visible en la tabla del cuadro CA79
// para Jalisco), SE29702=14,698.428632.
//
// Mapeo completo, clave = nombre de entidad tal como lo regresa la API
// (campo "titulo", sin el prefijo "Ingresos por Remesas Familiares").
// Fase 5 (producción) debe cruzar estos nombres contra el catálogo de
// entidades ya usado por el resto de Fontana (ESTADO_CVE_MAP en
// lib/sefix/eleccionesConstants.ts) — no asumido aquí, ese archivo no
// se leyó en esta sesión.
export const BANXICO_REMESAS_ESTATAL_SERIES: Record<string, string> = {
  Aguascalientes: "SE29670",
  "Baja California": "SE29671",
  "Baja California Sur": "SE29672",
  Campeche: "SE29673",
  Coahuila: "SE29674",
  Colima: "SE29675",
  Chiapas: "SE29676",
  Chihuahua: "SE29677",
  "Ciudad de México": "SE29678",
  Durango: "SE29679",
  "Estado de México": "SE29680",
  Guanajuato: "SE29681",
  Guerrero: "SE29682",
  Hidalgo: "SE29683",
  Jalisco: "SE29684",
  Michoacán: "SE29685",
  Morelos: "SE29686",
  Nayarit: "SE29687",
  "Nuevo León": "SE29688",
  Oaxaca: "SE29689",
  Puebla: "SE29690",
  Querétaro: "SE29691",
  "Quintana Roo": "SE29692",
  "San Luis Potosí": "SE29693",
  Sinaloa: "SE29694",
  Sonora: "SE29695",
  Tabasco: "SE29696",
  Tamaulipas: "SE29697",
  Tlaxcala: "SE29698",
  Veracruz: "SE29699",
  Yucatán: "SE29700",
  Zacatecas: "SE29701",
};

export const BANXICO_REMESAS_TOTAL_SERIE = "SE29702";

// ⚠️ PENDIENTE — nivel municipal (relevante para el nivel "municipal"
// que Fontana siempre intenta resolver): el cuadro CE166 ("Ingresos por
// remesas, distribución por municipio") existe y aparece referenciado
// en la estructura de información del SIE
// (consultarDirectorioInternetAction.do?accion=consultarCuadro&
// idCuadro=CE166), pero esa página es el árbol de metadatos del SIE
// completo (21 MB, sin IDs de serie individuales visibles en esta
// sesión) — no se confirmaron IDs de serie por municipio. No se asume
// ningún ID. Fase 5 debe tratar el nivel municipal como no disponible
// (motivo explícito: "Banxico no publica remesas a nivel municipal con
// un mecanismo de serie individual confirmado") salvo que una
// investigación posterior confirme series por municipio en CE166.
export const FONTANA_BANXICO_TEST_CASES: BanxicoTestCase[] = [
  { serieId: "SE29670", entidad: "Aguascalientes", label: "Remesas — Aguascalientes (primera fila del cuadro)" },
  { serieId: "SE29684", entidad: "Jalisco", label: "Remesas — Jalisco (territorio de referencia de Fontana)" },
  { serieId: "SE29678", entidad: "Ciudad de México", label: "Remesas — Ciudad de México (fila 'Distrito Federal' en el cuadro, título real distinto)" },
  { serieId: "SE29702", entidad: "TOTAL", label: "Remesas — Total nacional (control, cifra tipo Saldos no Flujos)" },
  { serieId: "SE00000", entidad: "N/A", label: "[caso negativo esperado] Serie inexistente" },
];

interface BanxicoSerieMeta {
  idSerie?: string;
  titulo?: string;
  periodicidad?: string;
  cifra?: string;
  unidad?: string;
}

interface BanxicoMetaResponse {
  bmx?: { series?: BanxicoSerieMeta[] };
}

interface BanxicoDatosResponse {
  bmx?: { series?: Array<{ datos?: Array<{ fecha: string; dato: string }> }> };
}

function maskToken(url: string, token: string): string {
  return url.replace(token, `***${token.slice(-4)}`);
}

async function runOne(testCase: BanxicoTestCase, token: string | undefined): Promise<BanxicoTestResult> {
  const baseResult = { case: testCase, requestUrl: "" };

  if (!token) {
    return {
      ...baseResult,
      ok: false,
      responseTimeMs: 0,
      errorKind: "token_missing",
      errorDetail: "BANXICO_TOKEN no está configurado en el entorno.",
      rawResponse: null,
    };
  }

  const metaUrl = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${testCase.serieId}?locale=es`;
  const datosUrl = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${testCase.serieId}/datos/oportuno`;
  const requestUrl = maskToken(`${metaUrl} + ${datosUrl}`, token);

  const start = performance.now();
  let metaResponse: Response;
  let datosResponse: Response;
  try {
    [metaResponse, datosResponse] = await Promise.all([
      fetch(metaUrl, { headers: { "Bmx-Token": token }, signal: AbortSignal.timeout(10000) }),
      fetch(datosUrl, { headers: { "Bmx-Token": token }, signal: AbortSignal.timeout(10000) }),
    ]);
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

  if (metaResponse.status === 401 || metaResponse.status === 403) {
    return {
      ...baseResult,
      ok: false,
      httpStatus: metaResponse.status,
      responseTimeMs,
      requestUrl,
      errorKind: "token_invalid",
      errorDetail: `HTTP ${metaResponse.status} en metadatos de serie`,
      rawResponse: null,
    };
  }

  if (!metaResponse.ok || !datosResponse.ok) {
    const rawResponse = await metaResponse.json().catch(() => null);
    return {
      ...baseResult,
      ok: false,
      httpStatus: metaResponse.ok ? datosResponse.status : metaResponse.status,
      responseTimeMs,
      requestUrl,
      errorKind: "series_not_found",
      errorDetail: `HTTP meta:${metaResponse.status} datos:${datosResponse.status}`,
      rawResponse,
    };
  }

  const metaData = (await metaResponse.json()) as BanxicoMetaResponse;
  const datosData = (await datosResponse.json()) as BanxicoDatosResponse;
  const meta = metaData.bmx?.series?.[0];
  const datos = datosData.bmx?.series?.[0]?.datos;
  const rawResponse = { meta: metaData, datos: datosData };

  if (!meta?.titulo) {
    return {
      ...baseResult,
      ok: false,
      httpStatus: metaResponse.status,
      responseTimeMs,
      requestUrl,
      errorKind: "series_not_found",
      errorDetail: "Metadatos sin campo 'titulo' — serie no reconocida por el SIE.",
      rawResponse,
    };
  }

  const latest = datos?.[datos.length - 1];
  if (!latest) {
    return {
      ...baseResult,
      ok: false,
      httpStatus: metaResponse.status,
      responseTimeMs,
      requestUrl,
      errorKind: "empty_response",
      errorDetail: "Metadatos existen pero /datos/oportuno no regresó observaciones.",
      rawResponse,
    };
  }

  const value = parseFloat(latest.dato.replace(",", ""));
  if (isNaN(value)) {
    return {
      ...baseResult,
      ok: false,
      httpStatus: metaResponse.status,
      responseTimeMs,
      requestUrl,
      errorKind: "malformed_response",
      errorDetail: `dato no numérico: "${latest.dato}"`,
      rawResponse,
    };
  }

  return {
    ...baseResult,
    ok: true,
    httpStatus: metaResponse.status,
    responseTimeMs,
    requestUrl,
    value,
    unit: meta.unidad,
    date: latest.fecha,
    periodicidad: meta.periodicidad,
    rawResponse,
  };
}

export async function runFontanaBanxicoDiagnostics(): Promise<BanxicoTestResult[]> {
  const token = process.env.BANXICO_TOKEN;
  const results = await Promise.allSettled(
    FONTANA_BANXICO_TEST_CASES.map((testCase) => runOne(testCase, token))
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          case: FONTANA_BANXICO_TEST_CASES[i],
          ok: false,
          responseTimeMs: 0,
          requestUrl: "",
          errorKind: "network_error" as const,
          errorDetail: r.reason instanceof Error ? r.reason.message : String(r.reason),
          rawResponse: null,
        }
  );
}