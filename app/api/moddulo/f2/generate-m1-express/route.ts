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
import type { XPCTO, MapaPESTEL } from "@/types/moddulo.types";
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
  type SefixContextData,
} from "@/lib/sefix/sefixContext";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import type { Territorio } from "@/types/pestel.types";

function getNewsTerritory(territorio: Territorio | undefined): string {
  if (!territorio) return "";
  if (territorio.nivel === "municipal" && territorio.municipio) {
    return territorio.municipio;
  }
  return territorio.estado ?? territorio.nombre ?? "";
}

function getCveEntidad(estadoNombre: string): string | null {
  const normalized = estadoNombre
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return ESTADO_CVE_MAP[normalized] ?? null;
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

  const newsTerritorioNombre = getNewsTerritory(
    project.territorio as Territorio | undefined
  );
  const newsTopics = getNewsTopicsForProject(tipoProyecto, nivelTerritorial);
  const cveEntidad = estadoNombre ? getCveEntidad(estadoNombre) : null;

  const [newsResult, dofResult, inegiResult, banxicoResult, sefixResult, biseResult] =
    await Promise.allSettled([
      fetchGoogleNewsRSS(newsTerritorioNombre, newsTopics),
      fetchDOFRSS(),
      fetchInegiIndicators(INEGI_DEFAULT_SERIES),
      fetchBanxicoSeries(BANXICO_DEFAULT_SERIES),
      buildSefixContext({ tipoProyecto, estadoNombre, nivelTerritorial }),
      cveEntidad
        ? fetchInegiIndicators(BISE_POBLACION_SERIES, "BISE", cveEntidad)
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

  console.log(
    `[generate-m1-express] Sources: news=${news.length}, dof=${dof.length}, ` +
      `inegi=${inegi.length}, banxico=${banxico.length}, ` +
      `sefix=${sefix ? sefix.resultadosList.length + " cargos" : "no disponible"}, ` +
      `bise=${bise.length}`
  );

  // ── Build prompt and call Claude ──────────────────────────────
  const { system, user } = getMapaPESTELExpressPrompt(
    tipoProyecto,
    xpcto as Record<string, unknown>,
    archivos.length > 0 ? archivos : undefined,
    { news, dof, inegi, banxico, sefix, bise }
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

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.mapaPESTEL": mapaPESTEL,
    "phases.exploracion.fuentesConsultadas": fuentesConsultadas,
    "phases.exploracion.xpctoSnapshotAtGeneration": JSON.stringify(project.xpcto ?? {}),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ mapaPESTEL, fuentesConsultadas }, { status: 200 });
}
