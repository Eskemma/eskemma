// app/api/moddulo/f2/generate-dvs/route.ts
// POST { projectId }
// Genera el DVS estructurado de F2 usando Claude y lo guarda en Firestore.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { buildPhaseContext } from "@/lib/moddulo/knowledge-injector";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { getDVSGenerationPrompt } from "@/lib/ai/phases/prompts";
import type { DVSF2, XPCTO } from "@/types/moddulo.types";
import { DIMENSION_META } from "@/types/pestel.types";

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
  const exploData = (project.phases?.exploracion?.data ?? {}) as Record<string, unknown>;
  const pestAnalysisId = project.phases?.exploracion?.pestAnalysisId as string | undefined;

  // Build PESTEL context string if a linked analysis exists
  let pestelContext = "";
  if (pestAnalysisId) {
    try {
      const snap = await adminDb.collection("pestel_analyses").doc(pestAnalysisId).get();
      if (snap.exists) {
        const analysis = snap.data()!;
        const dims = (analysis.dimensions ?? []) as Array<{
          code: string;
          classification: string;
          mainSignal: string;
          narrative: string;
          senalesFavorables?: Array<{ descripcion: string; fuente: string }>;
          senalesAdversas?: Array<{ descripcion: string; fuente: string }>;
          senalesInciertas?: Array<{ descripcion: string; fuente: string }>;
        }>;

        const dimLines = dims.map((d) => {
          const label = DIMENSION_META[d.code as keyof typeof DIMENSION_META]?.label ?? d.code;
          const favorable = (d.senalesFavorables ?? []).map((s) => `  + ${s.descripcion} (${s.fuente})`).join("\n");
          const adversa = (d.senalesAdversas ?? []).map((s) => `  - ${s.descripcion} (${s.fuente})`).join("\n");
          const incierta = (d.senalesInciertas ?? []).map((s) => `  ? ${s.descripcion} (${s.fuente})`).join("\n");
          return `[${d.code}] ${label} — ${d.classification}\nSeñal principal: ${d.mainSignal}\nNarrativa: ${d.narrative}${favorable ? "\nFavorables:\n" + favorable : ""}${adversa ? "\nAdversas:\n" + adversa : ""}${incierta ? "\nInciertas:\n" + incierta : ""}`;
        });

        pestelContext = `== ANÁLISIS PESTEL VINCULADO ==\nConfianza global: ${analysis.globalConfidence ?? "N/A"}%\n\n${dimLines.join("\n\n")}`;
      }
    } catch {
      // Non-blocking: continue without PESTEL context
    }
  }

  // If no PESTEL context, use form data as context
  if (!pestelContext && Object.keys(exploData).length > 0) {
    pestelContext = `== DATOS EXPLORATORIOS DEL FORMULARIO ==\n${JSON.stringify(exploData, null, 2)}`;
  }

  const knowledgeContext = await buildPhaseContext({
    phaseId: "exploracion",
    projectType: project.type,
  });

  const { system, user } = getDVSGenerationPrompt(
    project.type,
    xpcto as Record<string, unknown>,
    pestelContext
  );

  const systemPrompt = knowledgeContext ? `${knowledgeContext}\n\n${system}` : system;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: user }],
  });

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let dvs: DVSF2;
  try {
    let jsonToParse = rawText.trim();
    const fenceMatch = jsonToParse.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
    if (fenceMatch) jsonToParse = fenceMatch[1].trim();
    dvs = JSON.parse(jsonToParse) as DVSF2;
  } catch {
    return NextResponse.json(
      { error: "Error al parsear respuesta de Claude", raw: rawText.slice(0, 500) },
      { status: 500 }
    );
  }

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.dvs": dvs,
    "phases.exploracion.estado": "lista",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ dvs }, { status: 200 });
}
