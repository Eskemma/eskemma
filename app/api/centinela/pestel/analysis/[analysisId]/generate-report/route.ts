// app/api/centinela/pestel/analysis/[analysisId]/generate-report/route.ts
// POST — generates a report format using Claude with streaming.
// Returns a plain-text ReadableStream so the client can display text progressively.

import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { buildReportPrompt, type ReportFormat } from "@/lib/pestel/reportPrompts";
import { MARCA_INFORME_NO_GUARDADO, construirInforme } from "@/lib/pestel/informesSync";
import {
  esErrorDocumentoLleno,
  evaluarTamanoDocumento,
  reportarTamano,
} from "@/lib/pestel/informesTamano";
import type {
  PestlAnalysisV2,
  PestlDimensionConfig,
  PESTELProject,
} from "@/types/pestel.types";

// El id se genera ANTES del stream y viaja en el header X-Informe-Id: el
// cliente lo necesita para guardar ediciones (PATCH .../informes/[informeId]).
async function persistInforme(
  informeId: string,
  analysisId: string,
  format: ReportFormat,
  text: string,
  analysis: PestlAnalysisV2,
  variableConfigs: PestlDimensionConfig[]
): Promise<void> {
  const informe = construirInforme({
    id: informeId,
    format,
    texto: text,
    analysis,
    variableConfigs,
  });
  // Alerta de tamaño: `analysis` ya trae el documento completo (con sus informes previos).
  // Se evalúa ANTES de escribir, para que el rastro exista aunque la escritura falle.
  reportarTamano(analysisId, evaluarTamanoDocumento(analysis, informe), "generar un informe");
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
  "insights_por_tipo",
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
      { error: "format inválido. Usa: executive, technical, foda, scenarios, insights_por_tipo" },
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
  const informeId = crypto.randomUUID();
  let accumulated = "";
  const readable = new ReadableStream({
    async start(controller) {
      // Si el cliente se desconecta (cierra la pestaña, pierde red), enqueue
      // lanza sobre el stream cancelado. No se aborta: se sigue consumiendo
      // la generación para poder guardarla (acotada por maxDuration).
      let clienteConectado = true;
      const enviar = (texto: string) => {
        if (!clienteConectado) return;
        try {
          controller.enqueue(encoder.encode(texto));
        } catch {
          clienteConectado = false;
        }
      };

      let completo = false;
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            accumulated += event.delta.text;
            enviar(event.delta.text);
          }
        }
        completo = true;
      } catch (err) {
        console.error("[generate-report] stream error:", err);
        if (clienteConectado) {
          try {
            controller.error(err);
          } catch {
            // stream ya cerrado
          }
        }
      }

      // Un informe interrumpido NO se guarda: quedaría como si fuera completo.
      // Se guarda ANTES de cerrar el stream para que, cuando el cliente vea el
      // fin, el informe ya exista y pueda editarse (PATCH) sin carrera.
      if (completo && accumulated) {
        let guardado = false;
        try {
          await persistInforme(
            informeId,
            analysisId,
            format as ReportFormat,
            accumulated,
            analysisData,
            variableConfigs
          );
          guardado = true;
        } catch (e) {
          console.error(
            esErrorDocumentoLleno(e)
              ? "[informes][limite-1MB] documento lleno, el informe NO se guardó:"
              : "[generate-report] persist error:",
            e
          );
        }
        // El usuario debe enterarse: el stream ya mandó sus headers, así que el
        // aviso viaja como una marca al final del texto (el cliente la separa).
        if (!guardado) enviar(MARCA_INFORME_NO_GUARDADO);
      }

      if (completo && clienteConectado) {
        try {
          controller.close();
        } catch {
          // cliente ya se fue
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Report-Format": format as string,
      "X-Informe-Id": informeId,
      "Cache-Control": "no-store",
    },
  });
}
