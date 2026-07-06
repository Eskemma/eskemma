// app/api/moddulo/f2/advisor/route.ts
// POST { projectId, motor, campo, mensajes }
// Chat SSE acotado al impacto de un cambio específico en el DVS F2.

import { type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type { XPCTO } from "@/types/moddulo.types";

export const runtime = "nodejs";

type Mensaje = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  let body: {
    projectId?: string;
    motor?: string;
    campo?: string;
    mensajes?: Mensaje[];
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const { projectId, motor, campo, mensajes = [] } = body;
  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId es requerido" }), { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return new Response(JSON.stringify({ error: "Proyecto no encontrado" }), { status: 404 });
  }

  const xpcto = (project.xpcto ?? {}) as Partial<XPCTO>;

  const systemPrompt = `Eres el Advisor de F2-Exploración en Moddulo.
Tu función es EXCLUSIVAMENTE analizar el impacto estratégico de cambios específicos en el DVS (Documento de Viabilidad Situacional).

PROYECTO: ${project.name} (${project.type})
XPCTO:
${JSON.stringify(xpcto, null, 2)}

MOTOR EN EDICIÓN: ${motor ?? "—"}
CAMPO EN EDICIÓN: ${campo ?? "—"}

REGLAS ESTRICTAS:
- Solo responde sobre el impacto del cambio específico que el usuario está realizando
- Señala cómo ese cambio afecta otros motores del DVS o fases posteriores (F3, F4)
- Si el cambio crea inconsistencias, las señalas con claridad
- No refactorices ni sugieras cambios fuera del alcance del campo en edición
- Responde en español, máximo 150 palabras por respuesta
- Tono directo, de colega estratégico, sin lisonja`;

  const stream = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    system: systemPrompt,
    messages: mensajes.length > 0 ? mensajes : [
      {
        role: "user",
        content: `Estoy editando "${campo ?? "un campo"}" en ${motor ?? "el DVS"}. ¿Qué impacto estratégico debo considerar?`,
      },
    ],
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
