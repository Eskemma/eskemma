// app/api/moddulo/f2/generate-dvs/route.ts
// POST { projectId, saveas?: "draft" | "final" }
// Genera el DVS estructurado de F2 mediante 4 llamadas paralelas a Claude.
// M2+M3 en paralelo, M4 después de M2, M5 después de M3+M4.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type Anthropic from "@anthropic-ai/sdk";
import {
  serializeMapaPESTEL,
  getDVSM2Prompt,
  getDVSM3Prompt,
  getDVSM4Prompt,
  getDVSM5Prompt,
  getDVSGenerationPrompt,
} from "@/lib/ai/phases/prompts";
import type {
  DVSF2,
  XPCTO,
  ContrasteXPCTO,
  ActorVetoF2,
  IncertidumbreF2,
  HEIF2,
  PIPItem,
} from "@/types/moddulo.types";
import { DIMENSION_META } from "@/types/pestel.types";
import { buildPhaseContext } from "@/lib/moddulo/knowledge-injector";

// ── helpers ──────────────────────────────────────────────────────────────────

function extractText(response: Anthropic.Message): string {
  if (response.stop_reason === "max_tokens") {
    console.warn("[generate-dvs] stop_reason=max_tokens — response truncated");
  }
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseJSON<T>(raw: string, motorName: string): T {
  let s = raw.trim();

  // Strip markdown fences
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fence) s = fence[1].trim();

  // Direct parse
  try {
    return JSON.parse(s) as T;
  } catch { /* fall through */ }

  // Find first JSON array or object in the text (Claude sometimes adds preamble)
  const arrayStart = s.indexOf("[");
  const objectStart = s.indexOf("{");

  if (arrayStart !== -1) {
    const candidate = s.slice(arrayStart);
    // Find the matching close bracket
    let depth = 0;
    let end = -1;
    for (let i = 0; i < candidate.length; i++) {
      if (candidate[i] === "[") depth++;
      else if (candidate[i] === "]") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      try { return JSON.parse(candidate.slice(0, end + 1)) as T; } catch { /* fall through */ }
    }
  }

  if (objectStart !== -1) {
    const candidate = s.slice(objectStart);
    let depth = 0;
    let end = -1;
    for (let i = 0; i < candidate.length; i++) {
      if (candidate[i] === "{") depth++;
      else if (candidate[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      try { return JSON.parse(candidate.slice(0, end + 1)) as T; } catch { /* fall through */ }
    }
  }

  console.error(`[generate-dvs] ${motorName} parse failure. Raw (300 chars):`, s.slice(0, 300));
  throw new Error(`${motorName}: JSON inválido`);
}

async function callClaude(system: string, user: string, maxTokens: number): Promise<Anthropic.Message> {
  return anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  }) as Promise<Anthropic.Message>;
}

// ── route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; saveas?: "draft" | "final" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, saveas = "final" } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const xpcto = (project.xpcto ?? {}) as Partial<XPCTO>;

  // ── Try new path: mapaPESTEL en phases.exploracion ───────────────────────
  const mapaPESTEL = project.phases?.exploracion?.mapaPESTEL as Record<string, unknown> | undefined;

  if (mapaPESTEL && Object.keys(mapaPESTEL).length > 0) {
    return runMultiMotorPath(
      projectId, project.type, xpcto, mapaPESTEL, saveas,
      JSON.stringify(project.xpcto ?? {})
    );
  }

  // ── Fallback: legacy single-call (pestel_analyses o form data) ────────────
  return runLegacyPath(projectId, project, xpcto, saveas);
}

// ── Multi-motor path ──────────────────────────────────────────────────────────

async function runMultiMotorPath(
  projectId: string,
  projectType: string,
  xpcto: Partial<XPCTO>,
  mapaPESTEL: Record<string, unknown>,
  saveas: "draft" | "final",
  xpctoSnapshot: string
): Promise<NextResponse> {
  const mapaDims = Object.keys(mapaPESTEL);
  console.log(`[generate-dvs] multi-motor path. dims=${mapaDims.join(",")}`);

  const mapaSerialized = serializeMapaPESTEL(mapaPESTEL);
  console.log(`[generate-dvs] mapaSerialized length=${mapaSerialized.length} chars`);

  const xpctoRaw = xpcto as Record<string, unknown>;

  // M2 + M3 en paralelo
  let m2Raw: string;
  let m3Raw: string;
  try {
    const pM2 = getDVSM2Prompt(projectType, xpctoRaw, mapaSerialized);
    const pM3 = getDVSM3Prompt(projectType, xpctoRaw, mapaSerialized);
    const [resM2, resM3] = await Promise.all([
      callClaude(pM2.system, pM2.user, 3000),
      callClaude(pM3.system, pM3.user, 3000),
    ]);
    m2Raw = extractText(resM2);
    m3Raw = extractText(resM3);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error en M2/M3: ${msg}`, motor: "M2/M3" }, { status: 500 });
  }

  let m2: ContrasteXPCTO[];
  try {
    m2 = parseJSON<ContrasteXPCTO[]>(m2Raw, "M2");
  } catch {
    return NextResponse.json({ error: `M2: no se pudo parsear la respuesta`, motor: "M2", raw: m2Raw.slice(0, 400) }, { status: 500 });
  }

  let m3: ActorVetoF2[];
  try {
    m3 = parseJSON<ActorVetoF2[]>(m3Raw, "M3");
  } catch {
    return NextResponse.json({ error: `M3: no se pudo parsear la respuesta`, motor: "M3", raw: m3Raw.slice(0, 400) }, { status: 500 });
  }

  // M4 después de M2
  const m2Veredictos = m2.map((v) => ({
    dimension: v.dimension,
    veredicto: v.veredicto,
    argumentacion: v.argumentacion,
  }));

  let m4Raw: string;
  try {
    const { system, user } = getDVSM4Prompt(mapaSerialized, m2Veredictos);
    const resM4 = await callClaude(system, user, 2000);
    m4Raw = extractText(resM4);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error en M4: ${msg}`, motor: "M4" }, { status: 500 });
  }

  let m4: IncertidumbreF2[];
  try {
    m4 = parseJSON<IncertidumbreF2[]>(m4Raw, "M4");
  } catch {
    return NextResponse.json({ error: `M4: no se pudo parsear la respuesta`, motor: "M4", raw: m4Raw.slice(0, 400) }, { status: 500 });
  }

  // M5 después de M3 + M4
  const m3Actores = m3.map((a) => ({
    nombre: a.nombre ?? "",
    nivelRiesgo: a.nivelRiesgo ?? "",
    motivacion: a.motivacion ?? "",
  }));
  const m4Incertidumbres = m4.map((i) => ({
    descripcion: i.descripcion ?? "",
    urgencia: i.urgencia ?? "",
    destino: i.destino ?? "",
  }));

  let m5Raw: string;
  try {
    const { system, user } = getDVSM5Prompt(projectType, xpctoRaw, mapaSerialized, m3Actores, m4Incertidumbres);
    const resM5 = await callClaude(system, user, 3000);
    m5Raw = extractText(resM5);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error en M5: ${msg}`, motor: "M5" }, { status: 500 });
  }

  let m5: { hei: HEIF2; pip: PIPItem[] };
  try {
    m5 = parseJSON<{ hei: HEIF2; pip: PIPItem[] }>(m5Raw, "M5");
  } catch {
    return NextResponse.json({ error: `M5: no se pudo parsear la respuesta`, motor: "M5", raw: m5Raw.slice(0, 400) }, { status: 500 });
  }

  const dvs: DVSF2 = {
    hei: m5.hei,
    contrasteXPCTO: m2,
    semaforo: m3,
    incertidumbres: m4,
    pip: m5.pip,
  };

  return persistAndReturn(projectId, dvs, saveas, xpctoSnapshot);
}

// ── Legacy single-call path ───────────────────────────────────────────────────

async function runLegacyPath(
  projectId: string,
  project: Awaited<ReturnType<typeof getProject>>,
  xpcto: Partial<XPCTO>,
  saveas: "draft" | "final"
): Promise<NextResponse> {
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const exploData = (project.phases?.exploracion?.data ?? {}) as Record<string, unknown>;
  const pestAnalysisId = project.phases?.exploracion?.pestAnalysisId as string | undefined;

  let pestelContext = "";
  if (pestAnalysisId) {
    try {
      const snap = await adminDb.collection("pestel_analyses").doc(pestAnalysisId).get();
      if (snap.exists) {
        const analysis = snap.data()!;
        const dims = (analysis.dimensions ?? []) as Array<{
          code: string; classification: string; mainSignal: string; narrative: string;
          senalesFavorables?: Array<{ descripcion: string; fuente: string }>;
          senalesAdversas?: Array<{ descripcion: string; fuente: string }>;
          senalesInciertas?: Array<{ descripcion: string; fuente: string }>;
        }>;
        const dimLines = dims.map((d) => {
          const label = DIMENSION_META[d.code as keyof typeof DIMENSION_META]?.label ?? d.code;
          const fav = (d.senalesFavorables ?? []).map((s) => `  + ${s.descripcion} (${s.fuente})`).join("\n");
          const adv = (d.senalesAdversas ?? []).map((s) => `  - ${s.descripcion} (${s.fuente})`).join("\n");
          const inc = (d.senalesInciertas ?? []).map((s) => `  ? ${s.descripcion} (${s.fuente})`).join("\n");
          return `[${d.code}] ${label} — ${d.classification}\nNarrativa: ${d.narrative}${fav ? "\n" + fav : ""}${adv ? "\n" + adv : ""}${inc ? "\n" + inc : ""}`;
        });
        pestelContext = `== ANÁLISIS PESTEL ==\n${dimLines.join("\n\n")}`;
      }
    } catch { /* non-blocking */ }
  }

  if (!pestelContext && Object.keys(exploData).length > 0) {
    pestelContext = `== DATOS EXPLORATORIOS ==\n${JSON.stringify(exploData, null, 2)}`;
  }

  const knowledgeContext = await buildPhaseContext({ phaseId: "exploracion", projectType: project.type });
  const { system, user } = getDVSGenerationPrompt(project.type, xpcto as Record<string, unknown>, pestelContext);
  const systemPrompt = knowledgeContext ? `${knowledgeContext}\n\n${system}` : system;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: user }],
  });

  const rawText = extractText(response);
  let dvs: DVSF2;
  try {
    dvs = parseJSON<DVSF2>(rawText, "DVS");
  } catch {
    return NextResponse.json(
      { error: "Error al parsear respuesta de Claude", raw: rawText.slice(0, 500) },
      { status: 500 }
    );
  }

  return persistAndReturn(projectId, dvs, saveas);
}

// ── sanitize ──────────────────────────────────────────────────────────────────
// Firestore rejects undefined values; replace them with empty strings / empty arrays.

function sanitizeDVS(dvs: DVSF2): DVSF2 {
  const str = (v: unknown, fallback = "") =>
    typeof v === "string" ? v : fallback;
  const arr = <T>(v: unknown): T[] =>
    Array.isArray(v) ? (v as T[]) : [];

  return {
    hei: {
      tensionCentral: str(dvs.hei?.tensionCentral),
      contexto: str(dvs.hei?.contexto),
      condicionesFavorables: arr(dvs.hei?.condicionesFavorables),
      condicionesAdversas: arr(dvs.hei?.condicionesAdversas),
      premisaEstrategica: str(dvs.hei?.premisaEstrategica),
    },
    contrasteXPCTO: arr<Record<string, unknown>>(dvs.contrasteXPCTO).map((c) => ({
      dimension: str(c.dimension) as ContrasteXPCTO["dimension"],
      veredicto: str(c.veredicto, "requiere_investigacion") as ContrasteXPCTO["veredicto"],
      argumentacion: str(c.argumentacion),
      senalesPESTEL: arr<string>(c.senalesPESTEL),
    })),
    semaforo: arr<Record<string, unknown>>(dvs.semaforo).map((a) => ({
      nombre: str(a.nombre),
      tipo: str(a.tipo),
      nivelRiesgo: str(a.nivelRiesgo, "ambar") as "rojo" | "ambar" | "verde",
      capacidadVeto: str(a.capacidadVeto),
      motivacion: str(a.motivacion),
      requiereInvestigacion: typeof a.requiereInvestigacion === "boolean" ? a.requiereInvestigacion : false,
    })),
    incertidumbres: arr<Record<string, unknown>>(dvs.incertidumbres).map((i) => ({
      descripcion: str(i.descripcion),
      urgencia: str(i.urgencia, "media") as "alta" | "media" | "baja",
      resolucion: str(i.resolucion, "media") as "alta" | "media" | "baja",
      destino: str(i.destino, "F3") as "F3" | "SIP",
    })),
    pip: arr<Record<string, unknown>>(dvs.pip).map((p, idx) => ({
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
    })),
  };
}

// ── persist ───────────────────────────────────────────────────────────────────

async function persistAndReturn(
  projectId: string,
  rawDvs: DVSF2,
  saveas: "draft" | "final",
  xpctoSnapshot?: string
): Promise<NextResponse> {
  const dvs = sanitizeDVS(rawDvs);

  const hasM5Content = dvs.hei?.tensionCentral || dvs.hei?.contexto || (dvs.pip?.length ?? 0) > 0;
  if (!hasM5Content) {
    // Option B: log and continue — M5 will be editable manually in the frontend
    console.error("[generate-dvs] M5 returned empty after sanitization", {
      rawHei: rawDvs.hei,
      pipCount: rawDvs.pip?.length ?? 0,
    });
  }

  if (saveas === "draft") {
    await adminDb.collection("moddulo_projects").doc(projectId).update({
      "phases.exploracion.draftDVS": dvs,
      "phases.exploracion.motorAprobaciones": {},
      ...(xpctoSnapshot !== undefined && {
        "phases.exploracion.xpctoSnapshotAtGeneration": xpctoSnapshot,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await adminDb.collection("moddulo_projects").doc(projectId).update({
      "phases.exploracion.dvs": dvs,
      "phases.exploracion.estado": "lista",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  return NextResponse.json({ dvs }, { status: 200 });
}
