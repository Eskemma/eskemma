// app/api/moddulo/f2/generate-m1-express/route.ts
// POST { projectId }
// Genera un MapaPESTEL tripartito completo a partir del XPCTO y tipo de proyecto.
// No usa datos del formulario — Claude analiza el entorno directamente desde el XPCTO.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { getMapaPESTELExpressPrompt } from "@/lib/ai/phases/prompts";
import type { XPCTO, MapaPESTEL } from "@/types/moddulo.types";

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

  const { system, user } = getMapaPESTELExpressPrompt(
    project.type,
    xpcto as Record<string, unknown>
  );

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
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

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.mapaPESTEL": mapaPESTEL,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ mapaPESTEL }, { status: 200 });
}
