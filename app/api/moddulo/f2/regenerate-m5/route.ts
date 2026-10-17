// app/api/moddulo/f2/regenerate-m5/route.ts
// POST { projectId }
// Regenera solo M5 (HEI + PIP) usando M3/M4 del draftDVS existente.
// Preserva M2, M3 y M4 aprobados; solo sobreescribe hei y pip.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type Anthropic from "@anthropic-ai/sdk";
import { serializeMapaPESTEL, getDVSM5Prompt } from "@/lib/ai/phases/prompts";
import { buildPhaseContext } from "@/lib/moddulo/knowledge-injector";
import { codigoDeParseo, medirLlamada, registrarTotal } from "@/lib/moddulo/registroModelo";
import type { XPCTO, HEIF2, PIPItem } from "@/types/moddulo.types";

function extractText(response: Anthropic.Message): string {
  if (response.stop_reason === "max_tokens") {
    console.warn("[regenerate-m5] stop_reason=max_tokens — response truncated");
  }
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseM5JSON(raw: string): { hei: HEIF2; pip: PIPItem[] } {
  let s = raw.trim();

  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fence) s = fence[1].trim();

  try { return JSON.parse(s) as { hei: HEIF2; pip: PIPItem[] }; } catch { /* fall through */ }

  const objStart = s.indexOf("{");
  if (objStart !== -1) {
    const candidate = s.slice(objStart);
    let depth = 0;
    let end = -1;
    for (let i = 0; i < candidate.length; i++) {
      if (candidate[i] === "{") depth++;
      else if (candidate[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      try { return JSON.parse(candidate.slice(0, end + 1)) as { hei: HEIF2; pip: PIPItem[] }; } catch { /* fall through */ }
    }
  }

  console.error("[regenerate-m5] parse failure. Raw (300 chars):", s.slice(0, 300));
  throw new Error("M5: JSON inválido");
}

function sanitizeM5(raw: { hei?: Partial<HEIF2>; pip?: unknown[] }): { hei: HEIF2; pip: PIPItem[] } {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const hei: HEIF2 = {
    tensionCentral: str(raw.hei?.tensionCentral),
    contexto: str(raw.hei?.contexto),
    condicionesFavorables: arr<string>(raw.hei?.condicionesFavorables),
    condicionesAdversas: arr<string>(raw.hei?.condicionesAdversas),
    premisaEstrategica: str(raw.hei?.premisaEstrategica),
  };

  const pip: PIPItem[] = arr<Record<string, unknown>>(raw.pip).map((p, idx) => ({
    // Identidad estable — regenerate-m5 reemplaza el PIP completo (sin
    // correlación con el anterior, igual que hoy), así que cada ítem recibe
    // un pipItemId nuevo.
    pipItemId: typeof p.pipItemId === "string" ? p.pipItemId : crypto.randomUUID(),
    numero: typeof p.numero === "number" ? p.numero : idx + 1,
    pregunta: str(p.pregunta),
    metodo: str(p.metodo),
    vinculoHito: str(p.vinculoHito),
    orden: typeof p.orden === "number" ? p.orden
      : typeof p.numero === "number" ? p.numero : idx + 1,
    profundidad: (["exploratoria", "confirmatoria", "descriptiva"] as const)
      .includes(p.profundidad as PIPItem["profundidad"])
      ? (p.profundidad as PIPItem["profundidad"])
      : "exploratoria",
  }));

  return { hei, pip };
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { projectId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId } = body;
  if (!projectId) return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });

  const project = await getProject(projectId, session.uid);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const draftDVS = project.phases?.exploracion?.draftDVS as Record<string, unknown> | undefined;
  if (!draftDVS) return NextResponse.json({ error: "No existe draftDVS para este proyecto" }, { status: 400 });

  const mapaPESTEL = project.phases?.exploracion?.linkedSource?.payload as Record<string, unknown> | undefined;
  if (!mapaPESTEL || Object.keys(mapaPESTEL).length === 0) {
    return NextResponse.json({ error: "No hay mapaPESTEL para generar M5" }, { status: 400 });
  }

  const xpcto = (project.xpcto ?? {}) as Partial<XPCTO>;
  const xpctoRaw = xpcto as Record<string, unknown>;

  // Extraer M3 y M4 del draftDVS existente para dar contexto a M5
  const m3Actores = (Array.isArray(draftDVS.semaforo) ? draftDVS.semaforo as Array<Record<string, unknown>> : [])
    .map((a) => ({
      nombre: typeof a.nombre === "string" ? a.nombre : "",
      nivelRiesgo: typeof a.nivelRiesgo === "string" ? a.nivelRiesgo : "",
      motivacion: typeof a.motivacion === "string" ? a.motivacion : "",
    }));

  const m4Incertidumbres = (Array.isArray(draftDVS.incertidumbres) ? draftDVS.incertidumbres as Array<Record<string, unknown>> : [])
    .map((i) => ({
      descripcion: typeof i.descripcion === "string" ? i.descripcion : "",
      urgencia: typeof i.urgencia === "string" ? i.urgencia : "",
      destino: typeof i.destino === "string" ? i.destino : "",
    }));

  const mapaSerialized = serializeMapaPESTEL(mapaPESTEL);

  let m5Raw: string;
  let stopReason: string | null | undefined;
  try {
    const { system, user } = getDVSM5Prompt(
      project.type ?? "electoral",
      xpctoRaw,
      mapaSerialized,
      m3Actores,
      m4Incertidumbres
    );
    const knowledgeContext = await buildPhaseContext({ phaseId: "exploracion", projectType: project.type });
    const systemPrompt = knowledgeContext ? `${knowledgeContext}\n\n${system}` : system;
    const res = await medirLlamada("regenerate-m5", { motor: "M5", intento: 1, t0 }, () =>
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: user }],
      }) as Promise<Anthropic.Message>
    );
    stopReason = res.stop_reason;
    m5Raw = extractText(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    registrarTotal("regenerate-m5", "fallo_modelo", t0);
    return NextResponse.json({ error: `Error llamando al modelo: ${msg}`, codigo: "fallo_modelo" }, { status: 500 });
  }

  let m5: { hei: HEIF2; pip: PIPItem[] };
  try {
    const parsed = parseM5JSON(m5Raw);
    m5 = sanitizeM5(parsed);
  } catch {
    registrarTotal("regenerate-m5", codigoDeParseo(stopReason), t0);
    return NextResponse.json({ error: "M5: no se pudo parsear la respuesta del modelo", codigo: codigoDeParseo(stopReason), raw: m5Raw.slice(0, 400) }, { status: 500 });
  }

  if (!m5.hei.tensionCentral && !m5.hei.contexto && m5.pip.length === 0) {
    console.error("[regenerate-m5] M5 returned empty after sanitization", { raw: m5Raw.slice(0, 400) });
    registrarTotal("regenerate-m5", "respuesta_invalida", t0);
    return NextResponse.json({ error: "El modelo devolvió M5 vacío. Intenta de nuevo.", codigo: "respuesta_invalida" }, { status: 500 });
  }

  // Merge: preserva M2, M3, M4 — solo sobreescribe hei y pip
  const updatedDVS = { ...draftDVS, hei: m5.hei, pip: m5.pip };

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.draftDVS": updatedDVS,
    updatedAt: FieldValue.serverTimestamp(),
  });

  registrarTotal("regenerate-m5", "ok", t0);
  return NextResponse.json({ hei: m5.hei, pip: m5.pip });
}
