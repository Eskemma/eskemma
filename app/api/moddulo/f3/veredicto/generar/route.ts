// app/api/moddulo/f3/veredicto/generar/route.ts
// POST { projectId }
// M4 — Veredicto sobre la Hipótesis Estratégica Inicial. Contrasta la HEI
// de F2 con la síntesis de F3 (M3). Bloqueado (400) si queda alguna
// TareaPIP sin cobertura — ver lib/moddulo/f3Suficiencia.ts.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type Anthropic from "@anthropic-ai/sdk";
import { tareasSinCubrir, contarTareasCubiertas } from "@/lib/moddulo/f3Suficiencia";
import type { TareaPIP, SintesisF3, HEIF2, VeredictoHEI } from "@/types/moddulo.types";

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseVeredictoJSON(raw: string): Omit<VeredictoHEI, "aprobadoPorUsuario"> {
  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  const s = (fence ? fence[1] : raw).trim();
  return JSON.parse(s) as Omit<VeredictoHEI, "aprobadoPorUsuario">;
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

  const tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
  const sintesis = project.phases?.investigacion?.f3Sintesis as SintesisF3 | undefined;
  const hei = project.phases?.exploracion?.dvs?.hei as HEIF2 | undefined;

  if (!hei) {
    return NextResponse.json({ error: "No hay HEI de F2 contra la cual emitir veredicto" }, { status: 400 });
  }
  if (!sintesis) {
    return NextResponse.json({ error: "No hay síntesis (M3) generada todavía" }, { status: 400 });
  }

  const pendientes = tareasSinCubrir(tareas);
  if (pendientes.length > 0) {
    const { cubiertas, total } = contarTareasCubiertas(tareas);
    return NextResponse.json(
      {
        error: "tareas_sin_cubrir",
        message: `Quedan ${pendientes.length} tarea(s) del PIP sin cobertura (${cubiertas} de ${total} cubiertas).`,
        pendientes: pendientes.map((t) => t.numero),
      },
      { status: 400 }
    );
  }

  const system = `Eres M4, el motor de Veredicto sobre la Hipótesis Estratégica Inicial (HEI) de la Fase 3 (Moddulo). Contrastas la HEI formulada en F2 con la síntesis de hallazgos de F3 y emites un veredicto: "validada" (la evidencia confirma la premisa), "ajustada" (la evidencia matiza uno o más componentes) o "refutada" (la evidencia contradice la premisa de forma sustantiva).

Responde ÚNICAMENTE con JSON: {"resultado": "validada|ajustada|refutada", "contraste": "contraste punto a punto entre la HEI original y la evidencia", "argumentacion": "...", "premisaResultante": "la premisa estratégica resultante"}`;

  const user = `HEI de F2:\n${JSON.stringify(hei, null, 2)}\n\nSíntesis de hallazgos (M3):\n${JSON.stringify(sintesis, null, 2)}`;

  let raw: string;
  try {
    const res = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
    }) as Anthropic.Message;
    raw = extractText(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error llamando a Claude: ${msg}` }, { status: 500 });
  }

  let parsed: Omit<VeredictoHEI, "aprobadoPorUsuario">;
  try {
    parsed = parseVeredictoJSON(raw);
  } catch {
    return NextResponse.json({ error: "No se pudo parsear la respuesta de Claude", raw: raw.slice(0, 400) }, { status: 500 });
  }

  const veredicto: VeredictoHEI = { ...parsed, aprobadoPorUsuario: false };

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.investigacion.f3Veredicto": veredicto,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ veredicto }, { status: 200 });
}
