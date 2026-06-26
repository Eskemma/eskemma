// app/api/moddulo/chat/[phaseId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { getPhaseSystemPrompt } from "@/lib/ai/phases/prompts";
import { appendChatMessage, getProject } from "@/lib/moddulo/project";
import { buildPhaseContext } from "@/lib/moddulo/knowledge-injector";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PhaseId, ChatRequest } from "@/types/moddulo.types";
import { PHASE_ORDER } from "@/types/moddulo.types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ phaseId: string }> }
) {
  try {
    // Autenticación
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { phaseId } = await params;

    // Validar phaseId
    if (!PHASE_ORDER.includes(phaseId as PhaseId)) {
      return NextResponse.json({ error: "Fase inválida" }, { status: 400 });
    }

    const body: ChatRequest = await request.json();
    const { message, projectId, currentFormData, chatHistory = [], xpctoContext } = body;

    if (!message || !projectId) {
      return NextResponse.json(
        { error: "message y projectId son requeridos" },
        { status: 400 }
      );
    }

    // Fetch project to get type and phase data for knowledge injection
    const project = await getProject(projectId, session.uid);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // KPIs confirmed in F6 — used in F7 and F8
    const kpisSeleccionados =
      (project.phases?.tactica?.data?.kpisSeleccionados as string[] | undefined) ?? undefined;

    // Knowledge context is prepended to the phase system prompt
    const knowledgeContext = await buildPhaseContext({
      phaseId: phaseId as PhaseId,
      projectType: project.type,
      maniobra:
        (project.phases?.diagnostico?.data?.maniobra as string | undefined) ?? undefined,
      kpisSeleccionados,
    });

    const baseSystemPrompt = getPhaseSystemPrompt(phaseId as PhaseId, currentFormData, xpctoContext);
    const systemPrompt = knowledgeContext
      ? `${knowledgeContext}\n\n${baseSystemPrompt}`
      : baseSystemPrompt;

    if (process.env.NODE_ENV === "development") {
      console.log(`=== KNOWLEDGE CONTEXT F${phaseId} ===`);
      console.log("Longitud del contexto:", knowledgeContext.length, "caracteres");
      console.log("Preview (primeros 500 chars):", knowledgeContext.substring(0, 500));
      console.log("=== FIN KNOWLEDGE CONTEXT ===");
    }

    const messages: { role: "user" | "assistant"; content: string }[] = [
      // Historial previo de la conversación
      ...chatHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      // Mensaje actual del usuario
      { role: "user" as const, content: message },
    ];

    // Streaming con Claude
    const stream = await anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    // Crear ReadableStream para el cliente
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullText = "";

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullText += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`)
            );
          }
        }

        // Al terminar el stream, intentar extraer datos estructurados
        const { extractedData, reasoning } = extractDataFromResponse(fullText, phaseId as PhaseId);

        if (extractedData && Object.keys(extractedData).length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "extracted-data", extractedData, reasoning })}\n\n`
            )
          );
        }

        // Guardar el mensaje de Moddulo en Firestore (sin bloquear el stream)
        const assistantMessage = {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: fullText,
          timestamp: new Date().toISOString(),
          extractedData: extractedData ?? undefined,
          reasoning: reasoning ?? undefined,
        };

        appendChatMessage(projectId, phaseId as PhaseId, assistantMessage).catch(
          (err) => console.error("[chat/route] Error guardando mensaje:", err)
        );

        // Auto-persistencia de datos extraídos por fase:
        // - F1: campos xpcto.* → project.xpcto (dot-notation)
        // - F2+: campos pestl.*, semaforo.*, hipotesis.*, etc. → phases[phaseId].data (dot-notation)
        if (extractedData && Object.keys(extractedData).length > 0) {
          const xpctoUpdates: Record<string, unknown> = {};
          const phaseDataUpdates: Record<string, unknown> = {};

          for (const [key, value] of Object.entries(extractedData)) {
            if (key.startsWith("xpcto.")) {
              xpctoUpdates[key] = value;
            } else if (
              key.startsWith("pestl.") ||
              key.startsWith("semaforo.") ||
              key.startsWith("hipotesis.")
            ) {
              phaseDataUpdates[`phases.${phaseId as string}.data.${key}`] = value;
            }
          }

          const combinedUpdates = { ...xpctoUpdates, ...phaseDataUpdates };
          if (Object.keys(combinedUpdates).length > 0) {
            adminDb
              .collection("moddulo_projects")
              .doc(projectId)
              .update({ ...combinedUpdates, updatedAt: FieldValue.serverTimestamp() })
              .catch((err) => console.error("[chat/route] Error guardando datos:", err));
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      },
    });

    // Guardar el mensaje del usuario en Firestore
    appendChatMessage(projectId, phaseId as PhaseId, {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    }).catch((err) =>
      console.error("[chat/route] Error guardando mensaje de usuario:", err)
    );

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[chat/route] Error:", error);
    return NextResponse.json(
      { error: "Error al procesar el mensaje" },
      { status: 500 }
    );
  }
}

// ==========================================
// EXTRACCIÓN DE DATOS ESTRUCTURADOS
// ==========================================

function extractDataFromResponse(
  text: string,
  _phaseId: PhaseId
): { extractedData: Record<string, unknown> | null; reasoning: string | null } {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) return { extractedData: null, reasoning: null };

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    const reasoning = typeof parsed.__reasoning === "string" ? parsed.__reasoning : null;

    // Separar __reasoning del resto de datos del formulario
    const { __reasoning: _, ...formData } = parsed;
    const extractedData = Object.keys(formData).length > 0 ? formData : null;

    return { extractedData, reasoning };
  } catch {
    return { extractedData: null, reasoning: null };
  }
}
