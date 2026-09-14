// app/api/moddulo/f2/generate-m1-express/route.ts
// POST { projectId }
// Generates a complete tripartite MapaPESTEL from real data sources (Google News,
// DOF, INEGI, Banxico, Sefix/INE, BISE population) plus the project's XPCTO.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { getMapaPESTELExpressPrompt } from "@/lib/ai/phases/prompts";
import type { XPCTO, MapaPESTEL, LinkedSourceRef } from "@/types/moddulo.types";
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

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string };
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
      console.error("[generate-m1-express] webEconomicContext error:", webEconomicResult.reason);
    }
    if (webLegalResult.status === "rejected") {
      console.error("[generate-m1-express] webLegalContext error:", webLegalResult.reason);
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
      else console.warn(`[generate-m1-express] Fontana insumos ${dimensiones[i]} falló:`, r.reason);
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

  // ── Build prompt and call Claude ──────────────────────────────
  const { system, user } = getMapaPESTELExpressPrompt(
    tipoProyecto,
    xpcto as Record<string, unknown>,
    archivos.length > 0 ? archivos : undefined,
    { news, dof, inegi, banxico, sefix, bise, webContext, fontana }
  );

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system,
    messages: [{ role: "user", content: user }],
  });

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let mapaPESTEL: MapaPESTEL;
  try {
    let jsonToParse = rawText.trim();
    const fenceMatch = jsonToParse.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
    if (fenceMatch) jsonToParse = fenceMatch[1].trim();
    mapaPESTEL = JSON.parse(jsonToParse) as MapaPESTEL;
  } catch {
    return NextResponse.json(
      { error: "Error al parsear respuesta de Claude", raw: rawText.slice(0, 500) },
      { status: 500 }
    );
  }

  // Verify all 6 PEST-L keys are present
  const EXPECTED_KEYS = ["P", "E", "S", "T", "Ec", "L"];
  const missingKeys = EXPECTED_KEYS.filter((k) => !(k in mapaPESTEL));
  if (missingKeys.length > 0) {
    console.warn(`[generate-m1-express] Faltan dimensiones en la respuesta: ${missingKeys.join(", ")}`);
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

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.linkedSource": linkedSource,
    "phases.exploracion.fuentesConsultadas": fuentesConsultadas,
    "phases.exploracion.xpctoSnapshotAtGeneration": JSON.stringify(project.xpcto ?? {}),
    // Ronda 13 (26-08-18) — propagación de cambios de territorio, Capa 2.
    "phases.exploracion.territorioSnapshotAtGeneration": JSON.stringify(
      extraerTerritorioEscalar(project.territorio as Territorio)
    ),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ mapaPESTEL, fuentesConsultadas }, { status: 200 });
}
