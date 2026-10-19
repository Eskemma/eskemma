// app/api/moddulo/f2/generate-m1-express/route.ts
// POST { projectId }
// Generates a complete tripartite MapaPESTEL from real data sources (Google News,
// DOF, INEGI, Banxico, Sefix/INE, BISE population) plus the project's XPCTO.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { exploracionCerrada, respuestaFaseCerrada } from "@/lib/moddulo/faseCerrada";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { getMapaPESTELExpressPrompt } from "@/lib/ai/phases/prompts";
import type { XPCTO, MapaPESTEL, LinkedSourceRef } from "@/types/moddulo.types";
import { camposNuevoM1 } from "@/lib/moddulo/m1Escritura";
import { descripcionError, descripcionEstructural } from "@/lib/moddulo/registroModelo";
import { decidirCandadoM1Servidor, respuestaCandadoM1 } from "@/lib/moddulo/candadoM1Servidor";
import {
  fetchGoogleNewsRSS,
  getNewsTopicsForProject,
  type NewsItem,
} from "@/lib/centinela/pestel/scraper/googleNewsRSS";
import { fetchDOFRSS } from "@/lib/centinela/pestel/scraper/dof";
import {
  fetchInegiIndicators,
  INEGI_DEFAULT_SERIES,
  BISE_POBLACION_SERIES,
  type InegiDataPoint,
} from "@/lib/centinela/pestel/scraper/inegi";
import {
  fetchBanxicoSeries,
  BANXICO_DEFAULT_SERIES,
  type BanxicoDataPoint,
} from "@/lib/centinela/pestel/scraper/banxico";
import {
  buildSefixContext,
  resolveDistrictCabecera,
  type SefixContextData,
} from "@/lib/sefix/sefixContext";
import { getCveEntidad } from "@/lib/geo/estadoCve";
import type { Territorio } from "@/types/pestel.types";
import { extraerTerritorioEscalar } from "@/lib/territorio/staleness";
import { fetchWithCache, CACHE_TTL } from "@/lib/centinela/pestel/cache/indicatorCache";
import { isMexico } from "@/lib/centinela/pestel/utils/country";
import {
  fetchWebEconomicContext,
  fetchWebLegalContext,
} from "@/lib/search/webContextFetcher";
import type { WebContextResult } from "@/lib/search/SearchProvider";
import { resolverInsumosFontanaPestel } from "@/lib/fontana/tabla/insumosPestel";
import type { InsumoFontana } from "@/lib/fontana/pestelInsumos";

export const maxDuration = 300;

function getNewsTerritory(territorio: Territorio | undefined): string {
  if (!territorio) return "";
  if (territorio.nivel === "municipal" && territorio.municipio) {
    return territorio.municipio;
  }
  return territorio.estado ?? territorio.nombre ?? "";
}

// ── Two parallel halves of three dimensions (paso 2, 26-10-16) ─────────────────
type CodigoMitad = "respuesta_truncada" | "respuesta_invalida" | "fallo_modelo";
type Dim = "P" | "E" | "S" | "T" | "Ec" | "L";
const DIMENSIONES_ORDEN: readonly Dim[] = ["P", "E", "S", "T", "Ec", "L"];
const MITADES: readonly { id: "PES" | "TEcL"; dims: readonly Dim[] }[] = [
  { id: "PES", dims: ["P", "E", "S"] },
  { id: "TEcL", dims: ["T", "Ec", "L"] },
];
// Per half. Measured worst half over the 7 real express M1: ≈ 4.5k tokens (56 % of this cap).
const MAX_TOKENS_MITAD = 8000;
// Vercel Hobby with Fluid compute: 300 s, not extendable. A half is retried once only if less than
// 150 s have passed and the retry is expected to end before 240 s; each call also has its own timeout
// so a hung call cannot eat the whole budget (the SDK's own retries are off: this route owns the retry).
const UMBRAL_REINTENTO_MS = 150_000;
const PRESUPUESTO_REINTENTO_MS = 240_000;
const TIMEOUT_LLAMADA_MS = 170_000;
const LIMITE_RUTA_MS = 285_000;
const CODIGOS_REINTENTABLES: readonly CodigoMitad[] = ["fallo_modelo", "respuesta_invalida"];

interface ResultadoMitadOk {
  ok: true;
  mitad: string;
  dims: readonly Dim[];
  mapa: Record<string, unknown>;
  duracionMs: number;
  inputTokens: number;
  outputTokens: number;
}
interface ResultadoMitadFallida {
  ok: false;
  mitad: string;
  dims: readonly Dim[];
  codigo: CodigoMitad;
  duracionMs: number;
  inputTokens: number;
  outputTokens: number;
}

function listaDimensiones(dims: readonly string[]): string {
  return dims.length <= 1 ? dims.join("") : `${dims.slice(0, -1).join(", ")} y ${dims[dims.length - 1]}`;
}

/** One call to the model for one half, with its own log line, stop_reason and error code. */
async function intentarMitad(
  mitad: (typeof MITADES)[number],
  prompt: { system: string; user: string },
  intento: number,
  inicioRuta: number
): Promise<ResultadoMitadOk | ResultadoMitadFallida> {
  const etiqueta = `[generate-m1-express] mitad=${mitad.id} intento=${intento}`;
  const base = { mitad: mitad.id, dims: mitad.dims } as const;
  const inicio = Date.now();
  const timeout = Math.max(10_000, Math.min(TIMEOUT_LLAMADA_MS, LIMITE_RUTA_MS - (inicio - inicioRuta)));
  let response: { content: Array<{ type: string; text?: string }>; stop_reason?: string | null; usage?: { input_tokens?: number; output_tokens?: number } };
  try {
    response = (await anthropic.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS_MITAD,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      },
      { timeout, maxRetries: 0 }
    )) as typeof response;
  } catch (e) {
    // Name and status only: the SDK message can echo request details.
    const err = e as { name?: string; status?: number };
    console.error(
      `${etiqueta} fallo_modelo name=${err?.name ?? "desconocido"} status=${err?.status ?? "n/a"} ` +
        `duracion_ms=${Date.now() - inicio} desde_inicio_ms=${Date.now() - inicioRuta}`
    );
    return { ...base, ok: false, codigo: "fallo_modelo", duracionMs: Date.now() - inicio, inputTokens: 0, outputTokens: 0 };
  }
  const duracionMs = Date.now() - inicio;
  const stopReason = response.stop_reason ?? "desconocido";
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  console.log(
    `${etiqueta} stop_reason=${stopReason} input_tokens=${response.usage?.input_tokens ?? "n/a"} ` +
      `output_tokens=${response.usage?.output_tokens ?? "n/a"} duracion_ms=${duracionMs} ` +
      `desde_inicio_ms=${Date.now() - inicioRuta}`
  );
  const tokens = { duracionMs, inputTokens, outputTokens };

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  let parsed: unknown;
  try {
    let jsonToParse = rawText.trim();
    const fenceMatch = jsonToParse.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
    if (fenceMatch) jsonToParse = fenceMatch[1].trim();
    parsed = JSON.parse(jsonToParse);
  } catch {
    console.error(
      `${etiqueta} parseo fallido stop_reason=${stopReason} ${descripcionEstructural(rawText)}`
    );
    // Truncated (hit max_tokens) vs. otherwise invalid: the client words each case differently.
    return {
      ...base,
      ok: false,
      codigo: stopReason === "max_tokens" ? "respuesta_truncada" : "respuesta_invalida",
      ...tokens,
    };
  }

  // Exactly the three keys of this half, each an object.
  const obj = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  const claves = obj ? Object.keys(obj) : [];
  const valida =
    obj !== null &&
    claves.length === mitad.dims.length &&
    mitad.dims.every((d) => d in obj && obj[d] !== null && typeof obj[d] === "object" && !Array.isArray(obj[d]));
  if (!valida) {
    console.error(`${etiqueta} claves_invalidas esperadas=${mitad.dims.join(",")} recibidas=${claves.join(",")}`);
    return { ...base, ok: false, codigo: "respuesta_invalida", ...tokens };
  }
  return { ...base, ok: true, mapa: obj, ...tokens };
}

export async function POST(request: NextRequest) {
  const inicioRuta = Date.now();
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; confirmar?: unknown; huella?: unknown; verificar?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // F2 closed = read-only: refuse BEFORE reading sources or calling the model (no time, no tokens).
  if (exploracionCerrada(project.phases?.exploracion)) return respuestaFaseCerrada();

  // Guard: si el M1 proviene de un análisis de Centinela PESTEL vinculado,
  // el flujo express no debe sobrescribirlo — rompería el vínculo sin avisar
  // (mapaPESTEL quedaría huérfano mientras pestAnalysisId/pestProjectId
  // siguen apuntando al análisis original). El usuario debe desvincular
  // explícitamente antes de poder regenerar vía express.
  if (project.phases?.exploracion?.linkedSource?.sourceAnalysisId) {
    return NextResponse.json(
      {
        error: "pestel_linked",
        message: "Este proyecto tiene un análisis PESTEL importado de Centinela. Desvincúlalo antes de regenerar vía el flujo express.",
      },
      { status: 409 }
    );
  }

  // H15 lock (paso 4): a new analysis REPLACES the M1 on screen. If something would be lost (the M1 itself,
  // its edits or approval, the motors draft or their approvals) the server demands an explicit
  // confirmation tied to the fingerprint of what the user saw: 409 requiere_confirmacion / huella_vencida,
  // before reading sources or calling the model (the 409 costs nothing). It reads the RAW document, the
  // same shape the transaction below checks.
  const docCrudo = await adminDb.collection("moddulo_projects").doc(projectId).get();
  const decisionPrevia = decidirCandadoM1Servidor(docCrudo.data()?.phases?.exploracion, "nuevo_analisis", {
    confirmar: body.confirmar,
    huella: body.huella,
  });
  if (decisionPrevia.accion !== "continuar") return respuestaCandadoM1(decisionPrevia);
  // Only asking «what would be lost?»: the screen verifies before opening the modal (or going ahead).
  if (body.verificar === true) return NextResponse.json({ verificado: true }, { status: 200 });
  const huellaConfirmada = body.confirmar === true && typeof body.huella === "string" ? body.huella : null;

  const xpcto = (project.xpcto ?? {}) as Partial<XPCTO>;

  // Include any documents the consultant shared in F2 chat as enrichment context
  type ArchivoAdjunto = { nombre: string; textoExtraido?: string };
  type ProjectWithArchivos = {
    phases?: { exploracion?: { archivosAdjuntos?: ArchivoAdjunto[] } };
  };
  const archivosRaw =
    ((project as unknown) as ProjectWithArchivos).phases?.exploracion
      ?.archivosAdjuntos ?? [];
  const archivos = archivosRaw
    .filter((a) => a.textoExtraido && a.textoExtraido.trim().length > 0)
    .map((a) => ({ nombre: a.nombre, textoExtraido: a.textoExtraido as string }));

  // ── Fetch real data sources in parallel ──────────────────────
  const tipoProyecto = project.type ?? "ciudadano";
  const territorioNombre = project.territorio?.nombre ?? "";
  const estadoNombre = project.territorio?.estado ?? null;
  const nivelTerritorial = project.territorio?.nivel ?? "estatal";
  const paisProyecto = (project.territorio as Territorio | undefined)?.pais ?? null;
  const esMexico = isMexico(paisProyecto);

  // Resolve district cabecera once — shared by Google News (territory focus)
  // and Sefix (district-scoped electoral data). Avoids two calls to getEleccionesGeo.
  const resolvedCabecera =
    estadoNombre &&
    (nivelTerritorial === "distrito_federal" ||
      nivelTerritorial === "distrito_local" ||
      nivelTerritorial === "distrito")
      ? await resolveDistrictCabecera(
          estadoNombre,
          nivelTerritorial,
          project.territorio as Territorio
        )
      : null;

  // For district projects, use the resolved cabecera city name as the Google News
  // territory. Strip the numeric district code prefix from the CSV value
  // (e.g., "1405 PUERTO VALLARTA" → "PUERTO VALLARTA") — Sefix needs the full
  // key, but Google News should search the city name only.
  const newsTerritorioNombre = resolvedCabecera
    ? resolvedCabecera.replace(/^\d+\s+/, "")
    : getNewsTerritory(project.territorio as Territorio | undefined);

  const newsTopics = getNewsTopicsForProject(tipoProyecto, nivelTerritorial);
  const cveEntidad = estadoNombre ? getCveEntidad(estadoNombre) : null;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const month = today.slice(0, 7); // YYYY-MM
  const normTerr = newsTerritorioNombre.toLowerCase().replace(/\W+/g, "_");

  const [newsResult, dofResult, inegiResult, banxicoResult, sefixResult, biseResult] =
    await Promise.allSettled([
      fetchWithCache(
        "google_news",
        `google_news_${normTerr}_${today}`,
        CACHE_TTL.TTL_24H,
        () => fetchGoogleNewsRSS(newsTerritorioNombre, newsTopics, paisProyecto)
      ),
      esMexico
        ? fetchWithCache("dof", `dof_${today}`, CACHE_TTL.TTL_24H, () => fetchDOFRSS())
        : Promise.resolve([] as NewsItem[]),
      esMexico
        ? fetchInegiIndicators(INEGI_DEFAULT_SERIES)
        : Promise.resolve([] as InegiDataPoint[]),
      esMexico
        ? fetchWithCache(
            "banxico",
            `banxico_${month}`,
            CACHE_TTL.TTL_24H,
            () => fetchBanxicoSeries(BANXICO_DEFAULT_SERIES)
          )
        : Promise.resolve([] as BanxicoDataPoint[]),
      esMexico
        ? buildSefixContext({ tipoProyecto, estadoNombre, nivelTerritorial, resolvedCabecera })
        : Promise.resolve(null),
      esMexico && cveEntidad
        ? fetchWithCache(
            "inegi_bise",
            `inegi_bise_${cveEntidad}_${month}`,
            CACHE_TTL.TTL_7D,
            () => fetchInegiIndicators(BISE_POBLACION_SERIES, "BISE", cveEntidad)
          )
        : Promise.resolve([] as InegiDataPoint[]),
    ]);

  const news: NewsItem[] =
    newsResult.status === "fulfilled" ? newsResult.value : [];
  const dof: NewsItem[] =
    dofResult.status === "fulfilled" ? dofResult.value : [];
  const inegi: InegiDataPoint[] =
    inegiResult.status === "fulfilled" ? inegiResult.value : [];
  const banxico: BanxicoDataPoint[] =
    banxicoResult.status === "fulfilled" ? banxicoResult.value : [];
  const sefix: SefixContextData | null =
    sefixResult.status === "fulfilled" ? sefixResult.value : null;
  const bise: InegiDataPoint[] =
    biseResult.status === "fulfilled" ? biseResult.value : [];

  const fuentesConsultadas = {
    googleNews: news.length > 0,
    dof: dof.length > 0,
    inegi: inegi.length > 0,
    banxico: banxico.length > 0,
    sefix: sefix !== null,
    bise: bise.length > 0,
  };

  // ── Web context for non-Mexico projects ──────────────────────
  let webContext: { economic?: WebContextResult; legal?: WebContextResult } | undefined;
  if (!esMexico && project.territorio) {
    const territorio = project.territorio as import("@/types/pestel.types").Territorio;
    const [webEconomicResult, webLegalResult] = await Promise.allSettled([
      fetchWebEconomicContext(territorio),
      fetchWebLegalContext(territorio),
    ]);
    if (webEconomicResult.status === "rejected") {
      console.error(`[generate-m1-express] webEconomicContext error ${descripcionError(webEconomicResult.reason)}`);
    }
    if (webLegalResult.status === "rejected") {
      console.error(`[generate-m1-express] webLegalContext error ${descripcionError(webLegalResult.reason)}`);
    }
    webContext = {
      economic: webEconomicResult.status === "fulfilled" ? webEconomicResult.value : undefined,
      legal: webLegalResult.status === "fulfilled" ? webLegalResult.value : undefined,
    };
  }

  // Integración PESTEL↔Fontana (26-09-13) — Express, mismo runtime
  // Next.js, importa `resolverInsumosFontanaPestel` directo (sin HTTP,
  // a diferencia del path Controlado que sí necesita el endpoint interno
  // por el límite de runtime cruzado con `functions/`). Fail-open: si
  // Fontana no resuelve (territorio incompleto, error de fuente), el
  // resto del análisis sigue igual, sin ese bloque.
  //
  // `timeoutMs: 25_000` (corrección post-verificación, 26-09-13 —
  // bug real reportado por Raúl): esta llamada NO tenía timeout,
  // dejando cada indicador resolverse sin límite — un solo indicador
  // externo lento (ej. SESNSP en frío) colgaba TODA la petición hasta
  // que la plataforma la mataba a los 300s (`maxDuration`), sin ningún
  // error visible ("Relanzar análisis" no hacía nada). Decisión de
  // Raúl: Express es la vía RÁPIDA (para eso existe la vía Controlada,
  // más exhaustiva) — 25s por indicador, aceptando que un indicador
  // lento caiga honestamente a "sin_dato" (nunca se finge que el dato
  // no existía) en vez de colgar el análisis completo. Los indicadores
  // de una misma dimensión resuelven en PARALELO (`Promise.all` dentro
  // de `resolverCeldasParaTerritorio`), así que el tiempo real ≈ el más
  // lento de ellos, no la suma.
  let fontana: Partial<Record<"E" | "S" | "Ec", InsumoFontana[]>> | undefined;
  if (project.territorio) {
    const territorioFontana = project.territorio as import("@/types/shared.types").Territorio;
    const dimensiones: ("E" | "S" | "Ec")[] = ["E", "S", "Ec"];
    const resultados = await Promise.allSettled(
      dimensiones.map((d) => resolverInsumosFontanaPestel(d, territorioFontana, tipoProyecto, { timeoutMs: 25_000 }))
    );
    fontana = {};
    resultados.forEach((r, i) => {
      if (r.status === "fulfilled") fontana![dimensiones[i]] = r.value;
      else console.warn(`[generate-m1-express] Fontana insumos ${dimensiones[i]} falló ${descripcionError(r.reason)}`);
    });
  }

  console.log(
    `[generate-m1-express] pais=${paisProyecto ?? "México (legacy)"} esMexico=${esMexico} ` +
      `Sources: news=${news.length}, dof=${dof.length}, ` +
      `inegi=${inegi.length}, banxico=${banxico.length}, ` +
      `sefix=${sefix ? sefix.resultadosList.length + " cargos" : "no disponible"}, ` +
      `bise=${bise.length}, ` +
      `webEconomic=${webContext?.economic?.disponible ?? false}, ` +
      `webLegal=${webContext?.legal?.disponible ?? false}`
  );

  // ── Build prompts and call Claude: two parallel halves of three dimensions ──
  // One call for the six dimensions needed ≈ 8.9k tokens and was cut at max_tokens (8000) on a real
  // project. Each half gets the whole project context and all sources; only the dimensions it writes,
  // their depth instructions and a line naming what the other half covers change.
  const contextoFuentes = { news, dof, inegi, banxico, sefix, bise, webContext, fontana };
  const xpctoPrompt = xpcto as Record<string, unknown>;
  const archivosPrompt = archivos.length > 0 ? archivos : undefined;
  const promptsMitad = MITADES.map((m) => {
    const prompt = getMapaPESTELExpressPrompt(tipoProyecto, xpctoPrompt, archivosPrompt, contextoFuentes, {
      dimensiones: m.dims,
      compacto: true,
    });
    console.log(
      `[generate-m1-express] mitad=${m.id} prompt: system=${prompt.system.length} user=${prompt.user.length} caracteres`
    );
    return prompt;
  });

  let tokensIntentosPerdidos = { input: 0, output: 0 };
  let resultados = await Promise.all(MITADES.map((m, i) => intentarMitad(m, promptsMitad[i], 1, inicioRuta)));
  const fallidas = resultados.filter((r) => !r.ok);
  // One retry, only of the failed half, only for transient failures, only if the route has time left.
  // Nothing is retried when both halves failed or when a half was truncated (it would truncate again).
  if (fallidas.length === 1 && fallidas[0].ok === false && CODIGOS_REINTENTABLES.includes(fallidas[0].codigo)) {
    const falla = fallidas[0];
    const hermana = resultados.find((r) => r.ok);
    const desdeInicio = Date.now() - inicioRuta;
    const estimado = Math.max(falla.duracionMs, hermana?.duracionMs ?? 0, 60_000);
    if (desdeInicio < UMBRAL_REINTENTO_MS && desdeInicio + estimado < PRESUPUESTO_REINTENTO_MS) {
      const i = MITADES.findIndex((m) => m.id === falla.mitad);
      const reintento = await intentarMitad(MITADES[i], promptsMitad[i], 2, inicioRuta);
      tokensIntentosPerdidos = { input: falla.inputTokens, output: falla.outputTokens };
      resultados = resultados.map((r, j) => (j === i ? reintento : r));
    } else {
      console.warn(
        `[generate-m1-express] mitad=${falla.mitad} sin reintento por tiempo: desde_inicio_ms=${desdeInicio} ` +
          `estimado_ms=${estimado}`
      );
    }
  }

  // Total over EVERY attempt, including the one that was retried.
  const salidaTokens = resultados.reduce((a, r) => a + r.outputTokens, tokensIntentosPerdidos.output);
  const entradaTokens = resultados.reduce((a, r) => a + r.inputTokens, tokensIntentosPerdidos.input);
  console.log(
    `[generate-m1-express] total duracion_ms=${Date.now() - inicioRuta} mitades=${resultados.length} ` +
      `input_tokens=${entradaTokens} output_tokens=${salidaTokens}`
  );

  const fallo = resultados.filter((r): r is ResultadoMitadFallida => !r.ok);
  if (fallo.length > 0) {
    // Any failed half discards everything: a partial M1 would be read, edited and approved as if whole.
    const dims = DIMENSIONES_ORDEN.filter((c) => fallo.some((f) => f.dims.includes(c)));
    const codigo = (["respuesta_truncada", "respuesta_invalida", "fallo_modelo"] as const).find((c) =>
      fallo.some((f) => f.codigo === c)
    )!;
    return NextResponse.json(
      {
        error: "No se pudo generar el análisis completo",
        codigo,
        dimensiones: listaDimensiones(dims),
      },
      { status: 500 }
    );
  }
  const mapasMitad = resultados as ResultadoMitadOk[];
  const mapaPESTEL = {} as MapaPESTEL;
  for (const c of DIMENSIONES_ORDEN) {
    const fuente = mapasMitad.find((r) => c in r.mapa);
    if (fuente) (mapaPESTEL as Record<string, unknown>)[c] = fuente.mapa[c];
  }

  // Ensure origenInternacional: boolean on all signals
  const SIGNAL_KEYS = ["senalesFavorables", "senalesAdversas", "senalesInciertas"] as const;
  for (const dimKey of Object.keys(mapaPESTEL)) {
    const dim = (mapaPESTEL as Record<string, unknown>)[dimKey];
    if (!dim || typeof dim !== "object") continue;
    for (const key of SIGNAL_KEYS) {
      const arr = (dim as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) continue;
      (dim as Record<string, unknown>)[key] = arr.map((s: unknown) => ({
        ...(s as object),
        origenInternacional:
          typeof (s as { origenInternacional?: unknown }).origenInternacional === "boolean"
            ? (s as { origenInternacional: boolean }).origenInternacional
            : false,
      }));
    }
  }

  const linkedSource: LinkedSourceRef<MapaPESTEL> = {
    kind: "express",
    componente: "moddulo",
    sourceId: projectId,
    payload: mapaPESTEL,
  };

  // The write is a transaction that re-reads the document: while the model was generating (up to minutes)
  // the project may have been closed, approved or edited from another tab. F2 closed → 409 fase_cerrada;
  // the lock is checked again against the fingerprint the user confirmed (a state that now needs a
  // confirmation nobody gave → 409, the generated M1 is discarded and nothing is written).
  const ref = adminDb.collection("moddulo_projects").doc(projectId);
  type ResultadoEscritura =
    | { t: "ok" }
    | { t: "no_encontrado" }
    | { t: "fase_cerrada" }
    | { t: "candado"; d: Exclude<ReturnType<typeof decidirCandadoM1Servidor>, { accion: "continuar" }> };
  let escritura: ResultadoEscritura;
  try {
    escritura = await adminDb.runTransaction(async (tx): Promise<ResultadoEscritura> => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()?.deletedAt) return { t: "no_encontrado" };
      const exp = snap.data()?.phases?.exploracion;
      if (exploracionCerrada(exp)) return { t: "fase_cerrada" };
      const d = decidirCandadoM1Servidor(exp, "nuevo_analisis", { confirmar: huellaConfirmada !== null, huella: huellaConfirmada });
      if (d.accion !== "continuar") return { t: "candado", d };
      tx.update(ref, {
        "phases.exploracion.linkedSource": linkedSource,
        "phases.exploracion.fuentesConsultadas": fuentesConsultadas,
        "phases.exploracion.xpctoSnapshotAtGeneration": JSON.stringify(project.xpcto ?? {}),
        // Ronda 13 (26-08-18) — propagación de cambios de territorio, Capa 2.
        "phases.exploracion.territorioSnapshotAtGeneration": JSON.stringify(
          extraerTerritorioEscalar(project.territorio as Territorio)
        ),
        // New M1 in draft: no stale approval/edits, no motors draft from the previous one (m1Escritura.ts).
        ...camposNuevoM1(FieldValue),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { t: "ok" };
    });
  } catch (e) {
    const err = e as { name?: string; code?: unknown };
    console.error(`[generate-m1-express] fallo_guardado name=${err?.name ?? "desconocido"} code=${String(err?.code ?? "n/a")}`);
    return NextResponse.json(
      { error: "No se pudo guardar el análisis generado", codigo: "fallo_guardado" },
      { status: 500 }
    );
  }
  if (escritura.t === "no_encontrado") return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (escritura.t === "fase_cerrada") return respuestaFaseCerrada();
  if (escritura.t === "candado") return respuestaCandadoM1(escritura.d);

  return NextResponse.json({ mapaPESTEL, fuentesConsultadas }, { status: 200 });
}
