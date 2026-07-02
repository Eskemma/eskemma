// app/api/moddulo/chat/[phaseId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { getPhaseSystemPrompt } from "@/lib/ai/phases/prompts";
import { appendChatMessage, getProject } from "@/lib/moddulo/project";
import { buildPhaseContext } from "@/lib/moddulo/knowledge-injector";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PhaseId, ChatRequest, ChatAttachment } from "@/types/moddulo.types";
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
    const { message, projectId, currentFormData, chatHistory = [], xpctoContext, attachments } = body;

    if (message === undefined || !projectId) {
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

    // F1 con adjuntos → modo extracción XPCTO (A6)
    if (phaseId === "proposito" && attachments && attachments.length > 0) {
      return handleXpctoExtraction(attachments, projectId, session.uid);
    }

    // Preparar mensaje: si hay adjuntos, extraer texto (una sola vez) e inyectarlo
    let userMessageContent = message;
    if (attachments && attachments.length > 0) {
      // Extraer texto por archivo — usado tanto para el chat como para persistencia
      const perFileResults = await Promise.allSettled(attachments.map(extractTextPerFile));
      const perFileTexts = perFileResults.map((r) =>
        r.status === "fulfilled" ? r.value : "[Error procesando archivo]"
      );
      const attachmentTexts = perFileTexts.join("\n\n---\n\n");
      if (attachmentTexts) {
        userMessageContent = attachmentTexts + (message ? `\n\n---\n\n${message}` : "");
      }
      // Guardar refs + texto extraído en F2 (fire-and-forget)
      if (phaseId === "exploracion") {
        const entries = attachments.map((a, i) => ({
          nombre: a.nombre,
          url: a.url,
          tipo: a.tipo,
          cargadoEn: new Date().toISOString(),
          textoExtraido: perFileTexts[i].substring(0, 4000),
        }));
        adminDb.collection("moddulo_projects").doc(projectId).update({
          "phases.exploracion.archivosAdjuntos": FieldValue.arrayUnion(...entries),
          updatedAt: FieldValue.serverTimestamp(),
        }).catch((err) => console.error("[chat/route] Error guardando adjuntos F2:", err));
      }
    }

    const messages: { role: "user" | "assistant"; content: string }[] = [
      // Historial previo de la conversación
      ...chatHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      // Mensaje actual del usuario (con texto de adjuntos si los hay)
      { role: "user" as const, content: userMessageContent },
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
// ADJUNTOS — EXTRACCIÓN DE TEXTO
// ==========================================

async function extractTextFromAttachments(attachments: ChatAttachment[]): Promise<string> {
  const parts = await Promise.allSettled(attachments.map(extractTextPerFile));
  return parts
    .map((r) => (r.status === "fulfilled" ? r.value : `[Error procesando archivo]`))
    .join("\n\n---\n\n");
}

// ==========================================
// F1 — MODO EXTRACCIÓN XPCTO (A6)
// ==========================================

const XPCTO_EXTRACTION_SYSTEM = `Eres el asistente de extracción de variables XPCTO de Moddulo.
A partir del documento proporcionado por el usuario, extrae los valores
para las cinco variables del proyecto:
X (Hito/Meta de victoria): resultado cuantificable, ámbito, fecha, criterio de verificación
P (Sujeto/Actor principal): identidad, trayectoria, imagen, arquetipo, fronteras éticas
C (Capacidades): financiero, humano, organizacional, material
T (Tiempo): fecha inicio, fecha hito, hitos intermedios, restricciones
O (Justificación): problema público, beneficiarios, conexión P-O, criterio integridad

Para cada variable:
- Si encuentras información suficiente: extrae el valor propuesto
- Si la información es parcial: extrae lo que hay y marca los campos faltantes como "no encontrado"
- Si no encuentras información: marca confianza como "no_encontrado"

Responde ÚNICAMENTE con JSON válido:
{"x":{"resultado":"...","ambito":"...","fecha":"...","criterioVerificacion":"...","confianza":"alta|media|baja|no_encontrado"},"p":{"identidad":"...","trayectoria":"...","imagenActual":"...","arquetipoEstilo":"...","fronterasEticas":"...","confianza":"..."},"c":{"financiero":"...","humano":"...","organizacional":"...","material":"...","confianza":"..."},"t":{"fechaInicio":"...","fechaHito":"...","hitosIntermedios":"...","restricciones":"...","confianza":"..."},"o":{"problemaPublico":"...","beneficiarios":"...","conexionPO":"...","criterioIntegridad":"...","confianza":"..."}}`;

type XpctoConfianza = "alta" | "media" | "baja" | "no_encontrado";
interface XpctoExtraido {
  x: { resultado: string; ambito: string; fecha: string; criterioVerificacion: string; confianza: XpctoConfianza };
  p: { identidad: string; trayectoria: string; imagenActual: string; arquetipoEstilo: string; fronterasEticas: string; confianza: XpctoConfianza };
  c: { financiero: string; humano: string; organizacional: string; material: string; confianza: XpctoConfianza };
  t: { fechaInicio: string; fechaHito: string; hitosIntermedios: string; restricciones: string; confianza: XpctoConfianza };
  o: { problemaPublico: string; beneficiarios: string; conexionPO: string; criterioIntegridad: string; confianza: XpctoConfianza };
}

function construirMensajeConfirmacion(xpcto: XpctoExtraido): string {
  const lines = [
    "He analizado el documento que compartiste. A partir de él propongo los siguientes valores para las variables XPCTO. Revisa cada uno y confirma, corrige o complementa:\n",
  ];

  const varMap: [string, string, XpctoConfianza][] = [
    ["X — Hito", xpcto.x.resultado !== "no encontrado" ? xpcto.x.resultado : "No encontré información suficiente para esta variable", xpcto.x.confianza],
    ["P — Sujeto", xpcto.p.identidad !== "no encontrado" ? xpcto.p.identidad : "No encontré información suficiente para esta variable", xpcto.p.confianza],
    ["C — Capacidades", xpcto.c.financiero !== "no encontrado" ? xpcto.c.financiero : "No encontré información suficiente para esta variable", xpcto.c.confianza],
    ["T — Tiempo", xpcto.t.fechaInicio !== "no encontrado" ? xpcto.t.fechaInicio : "No encontré información suficiente para esta variable", xpcto.t.confianza],
    ["O — Justificación", xpcto.o.problemaPublico !== "no encontrado" ? xpcto.o.problemaPublico : "No encontré información suficiente para esta variable", xpcto.o.confianza],
  ];

  for (const [label, value, confianza] of varMap) {
    const nota = confianza === "no_encontrado" ? " _(sin datos)_" : confianza === "baja" ? " _(confianza baja — verificar)_" : "";
    lines.push(`**${label}:** ${value}${nota}`);
  }

  lines.push("\n¿Qué ajustes necesita esta propuesta?");
  return lines.join("\n");
}

async function handleXpctoExtraction(
  attachments: ChatAttachment[],
  projectId: string,
  userId: string
): Promise<Response> {
  const SSE_HEADERS = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  const encoder = new TextEncoder();

  try {
    const contenidoDocumentos = await extractTextFromAttachments(attachments);

    const extraction = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: XPCTO_EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: contenidoDocumentos }],
    });

    const rawText = extraction.content[0].type === "text" ? extraction.content[0].text : "{}";

    let xpctoExtraido: XpctoExtraido;
    try {
      xpctoExtraido = JSON.parse(rawText) as XpctoExtraido;
    } catch {
      const fallback = "No se pudo extraer el JSON. Por favor, intenta de nuevo con el documento.";
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: fallback })}\n\n`));
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          c.close();
        },
      });
      return new Response(stream, { headers: SSE_HEADERS });
    }

    // Guardar borrador en Firestore
    adminDb
      .collection("moddulo_projects")
      .doc(projectId)
      .update({
        "phases.proposito.xpctoBorrador": xpctoExtraido,
        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch((err) => console.error("[chat/route] Error guardando xpctoBorrador:", err));

    const respuesta = construirMensajeConfirmacion(xpctoExtraido);

    // Guardar el mensaje del asistente en historial
    appendChatMessage(projectId, "proposito", {
      id: crypto.randomUUID(),
      role: "assistant",
      content: respuesta,
      timestamp: new Date().toISOString(),
    }).catch((err) => console.error("[chat/route] Error guardando mensaje extracción:", err));

    const readableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: respuesta })}\n\n`));
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "extracted-data", extractedData: { "xpcto.borrador": xpctoExtraido } })}\n\n`
          )
        );
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      },
    });

    return new Response(readableStream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error("[chat/route] Error en extracción XPCTO:", error);
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: "Hubo un error al procesar el documento. ¿Puedes intentarlo de nuevo?" })}\n\n`));
        c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        c.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
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
