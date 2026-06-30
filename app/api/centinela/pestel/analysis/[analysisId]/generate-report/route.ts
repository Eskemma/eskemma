// app/api/centinela/pestel/analysis/[analysisId]/generate-report/route.ts
// POST — generates a report format using Claude with streaming.
// Returns a plain-text ReadableStream so the client can display text progressively.

import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { buildReportPrompt, type ReportFormat } from "@/lib/pestel/reportPrompts";
import { buildScorecard } from "@/lib/pestel/matrizUtils";
import type {
  PestlAnalysisV2,
  PestlDimensionConfig,
  PESTELProject,
  InformeGenerado,
  DimensionCode,
  DimensionAnalysis,
} from "@/types/pestel.types";
import { DIMENSION_META } from "@/types/pestel.types";

const FORMAT_MAP: Record<ReportFormat, InformeGenerado["formato"]> = {
  executive: "ejecutivo",
  technical: "tecnico",
  foda: "foda_lista",
  scenarios: "escenarios",
};

async function persistInforme(
  analysisId: string,
  format: ReportFormat,
  text: string,
  analysis: PestlAnalysisV2,
  variableConfigs: PestlDimensionConfig[]
): Promise<void> {
  const scorecard = buildScorecard(analysis.dimensions, variableConfigs);
  const scorecardItems = scorecard.dimensions.map((ds) => ({
    code: ds.code,
    label: DIMENSION_META[ds.code]?.label ?? ds.code,
    confidence: ds.confidence,
    classification: analysis.dimensions.find((d) => d.code === ds.code)?.classification ?? "NEUTRAL",
    dimWeight: ds.dimWeight,
    score: ds.score,
  }));
  const mapaPESTEL: Partial<Record<DimensionCode, Partial<DimensionAnalysis>>> = {};
  for (const dim of analysis.dimensions) {
    mapaPESTEL[dim.code] = {
      code: dim.code,
      mainSignal: dim.mainSignal,
      classification: dim.classification,
      confidence: dim.confidence,
    };
  }
  const informe: InformeGenerado = {
    id: crypto.randomUUID(),
    formato: FORMAT_MAP[format],
    contenidoTexto: text,
    datosEstructurados: { scorecard: scorecardItems, mapaPESTEL },
    generadoEn: new Date().toISOString(),
  };
  await adminDb.collection("pestel_analyses").doc(analysisId).update({
    informes: FieldValue.arrayUnion(informe),
  });
}

// Increase Vercel function timeout for streaming (seconds)
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

const VALID_FORMATS: ReportFormat[] = [
  "executive",
  "technical",
  "foda",
  "scenarios",
];

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { format } = body as { format?: unknown };

  if (!format || !VALID_FORMATS.includes(format as ReportFormat)) {
    return NextResponse.json(
      { error: "format inválido. Usa: executive, technical, foda, scenarios" },
      { status: 400 }
    );
  }

  // Fetch analysis and verify ownership
  const analysisSnap = await adminDb
    .collection("pestel_analyses")
    .doc(analysisId)
    .get();

  if (!analysisSnap.exists) {
    return NextResponse.json(
      { error: "Análisis no encontrado" },
      { status: 404 }
    );
  }

  const analysisData = { id: analysisSnap.id, ...analysisSnap.data() } as PestlAnalysisV2 & { id: string; userId?: string };

  // Verify the analysis belongs to a project owned by the session user
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(analysisData.projectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const project = {
    id: projectSnap.id,
    ...projectSnap.data(),
  } as PESTELProject & { id: string };

  // Fetch variable configs for scorecard weights
  const configSnap = await adminDb
    .collection("pestel_variable_configs")
    .doc(analysisData.projectId)
    .get();

  const variableConfigs = configSnap.exists
    ? ((configSnap.data()?.dimensions ?? []) as PestlDimensionConfig[])
    : [];

  // Build the prompt
  const { systemPrompt, userPrompt, maxTokens } = buildReportPrompt(
    format as ReportFormat,
    {
      analysis: analysisData,
      variableConfigs,
      projectName: project.nombre,
      projectType: project.tipo,
      territorioNombre: project.territorio?.nombre ?? project.territorio?.estado ?? "México",
    }
  );

  // Stream Claude response
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const encoder = new TextEncoder();
  let accumulated = "";
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            accumulated += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
        if (accumulated) {
          persistInforme(
            analysisId,
            format as ReportFormat,
            accumulated,
            analysisData,
            variableConfigs
          ).catch((e) => console.error("[generate-report] persist error:", e));
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Report-Format": format as string,
      "Cache-Control": "no-store",
    },
  });
}
