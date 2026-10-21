// app/api/moddulo/f2/generate-dvs/route.ts
// POST { projectId, saveas?: "draft" | "final" }
// Genera el DVS estructurado de F2 mediante 4 llamadas paralelas a Claude.
// M2+M3 en paralelo, M4 después de M2, M5 después de M3+M4.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import type { ExploracionParaM1 } from "@/lib/moddulo/m1Servidor";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type Anthropic from "@anthropic-ai/sdk";
import {
  serializeMapaPESTEL,
  estadisticasMapa,
  MapaDemasiadoGrandeError,
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
import { reemplazarDVSConVersion } from "@/lib/moddulo/dvsVersiones";
import { respuestaMapaDemasiadoGrande } from "@/lib/moddulo/respuestaMapaDemasiadoGrande";
import { respuestaCandado } from "@/lib/moddulo/respuestaCandado";
import {
  ReemplazoRechazadoError,
  calcularImpactoReemplazoDVS,
  decidirCandadoReemplazo,
} from "@/lib/moddulo/impactoReemplazoDVS";
import {
  estadoParaImpactoDesdeProyecto,
  leerEstadoParaImpacto,
} from "@/lib/moddulo/impactoReemplazoServidor";
import {
  causaDeFalloModelo,
  codigoDeParseo,
  lineaMapa,
  origenDeAnalisis,
  type OrigenAnalisis,
  descripcionEstructural,
  medirLlamada,
  registrarErrorEstructural,
  registrarTotal,
  type MetaLlamada,
} from "@/lib/moddulo/registroModelo";
import {
  CompuertaM1Error,
  coincideCompuertaM1,
  decidirCompuertaM1,
  respuestaM1NoAprobado,
} from "@/lib/moddulo/compuertaM1";

// A full generation is 4+ sequential Claude calls (M2||M3 → M4 → M5, with one
// retry for M5): same ceiling as generate-m1-express. The route used to declare
// none, so the platform default applied.
export const maxDuration = 300;

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

  console.error(`[generate-dvs] ${motorName} parse failure ${descripcionEstructural(raw)}`);
  throw new Error(`${motorName}: JSON inválido`);
}

async function callClaude(system: string, user: string, maxTokens: number, meta: MetaLlamada): Promise<Anthropic.Message> {
  return medirLlamada("generate-dvs", meta, () =>
    anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }) as Promise<Anthropic.Message>
  );
}

// ── route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; saveas?: "draft" | "final"; confirmar?: boolean; huella?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, saveas = "final", confirmar, huella } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const xpcto = (project.xpcto ?? {}) as Partial<XPCTO>;

  // ── M1 gate (paso 4): with an M1 record AND a payload the motors are generated only from an APPROVED
  // M1, and from its frozen copy. Before the replace lock and before any Claude call, so the 409 costs
  // nothing. Projects without `m1` (or without payload) go through exactly as before.
  const compuerta = decidirCompuertaM1(project.phases?.exploracion as ExploracionParaM1 | undefined);
  if (compuerta.accion === "bloquea") return respuestaM1NoAprobado("generate-dvs", compuerta.motivo);
  // The fingerprint of the approval used by THIS generation, captured now: the final write compares the
  // document against it (never against a fingerprint re-read later).
  const huellaM1 = compuerta.accion === "pasa" ? compuerta.huella : null;

  // ── Replace lock, step 1 (BEFORE the legacy / multi-motor fork, so no path
  // can skip it, and before any Claude call so a 409 costs nothing). It reads
  // the RAW document, not getProject(): the in-transaction check must compute
  // the same fingerprint from the same shape. Note `saveas` defaults to "final":
  // a request that omits it is guarded too.
  let huellaConfirmada: string | null = null;
  if (saveas === "final") {
    const estado = await leerEstadoParaImpacto(adminDb, projectId);
    if (estado.dvs) {
      const candado = decidirCandadoReemplazo({
        decision: calcularImpactoReemplazoDVS(estado, "reemplazo_total"),
        confirmar: confirmar === true,
        huellaRecibida: huella,
      });
      if (candado.accion !== "continuar") return respuestaCandado(candado.accion, candado.decision);
      huellaConfirmada = huella ?? null;
    }
  }

  // ── Try new path: mapaPESTEL en phases.exploracion ───────────────────────
  const mapaPESTEL = (compuerta.accion === "pasa"
    ? compuerta.mapa
    : project.phases?.exploracion?.linkedSource?.payload) as Record<string, unknown> | undefined;

  if (mapaPESTEL && Object.keys(mapaPESTEL).length > 0) {
    return runMultiMotorPath(
      projectId, project.type, xpcto, mapaPESTEL, saveas,
      JSON.stringify(project.xpcto ?? {}), session.uid, huellaConfirmada, huellaM1,
      origenDeAnalisis(project.phases?.exploracion?.linkedSource?.kind)
    );
  }

  // ── Fallback: legacy single-call (pestel_analyses o form data) ────────────
  return runLegacyPath(projectId, project, xpcto, saveas, session.uid, huellaConfirmada, huellaM1);
}

// ── Multi-motor path ──────────────────────────────────────────────────────────

async function runMultiMotorPath(
  projectId: string,
  projectType: string,
  xpcto: Partial<XPCTO>,
  mapaPESTEL: Record<string, unknown>,
  saveas: "draft" | "final",
  xpctoSnapshot: string,
  uid: string,
  huellaConfirmada: string | null,
  huellaM1: string | null,
  origen: OrigenAnalisis
): Promise<NextResponse> {
  const t0 = Date.now();
  let resultado = "error";
  try {
    const r = await runMultiMotorInterno(projectId, projectType, xpcto, mapaPESTEL, saveas, xpctoSnapshot, uid, huellaConfirmada, huellaM1, origen, t0);
    resultado = r.status === 200 ? "ok" : `http_${r.status}`;
    return r;
  } finally {
    registrarTotal("generate-dvs", resultado, t0);
  }
}

async function runMultiMotorInterno(
  projectId: string,
  projectType: string,
  xpcto: Partial<XPCTO>,
  mapaPESTEL: Record<string, unknown>,
  saveas: "draft" | "final",
  xpctoSnapshot: string,
  uid: string,
  huellaConfirmada: string | null,
  huellaM1: string | null,
  origen: OrigenAnalisis,
  t0: number
): Promise<NextResponse> {
  // The M1 gate passed (huellaM1 set) = the frozen approved copy; no review record = the project's current analysis.
  const aprobado = huellaM1 !== null;
  const stops: Record<string, string | null | undefined> = {};
  const mapaDims = Object.keys(mapaPESTEL);
  console.log(`[generate-dvs] multi-motor path. dims=${mapaDims.join(",")}`);

  // Structural measurement line (numbers only) BEFORE the calls; then the serialization, which refuses a
  // block over the security cap instead of cutting it: nothing was written and the model was not called.
  const estMapa = estadisticasMapa(mapaPESTEL);
  console.log(lineaMapa("generate-dvs", estMapa));
  let mapaSerialized: string;
  try {
    mapaSerialized = serializeMapaPESTEL(mapaPESTEL);
  } catch (err) {
    if (err instanceof MapaDemasiadoGrandeError) {
      console.error(`[generate-dvs] mapa_demasiado_grande longitud=${err.longitud} senales=${err.estadisticas.senales} origen=${origen}`);
      return respuestaMapaDemasiadoGrande(origen, err);
    }
    throw err;
  }

  const xpctoRaw = xpcto as Record<string, unknown>;

  // M2 + M3 en paralelo
  let m2Raw: string;
  let m3Raw: string;
  try {
    const pM2 = getDVSM2Prompt(projectType, xpctoRaw, mapaSerialized, aprobado);
    const pM3 = getDVSM3Prompt(projectType, xpctoRaw, mapaSerialized, aprobado);
    const [resM2, resM3] = await Promise.all([
      callClaude(pM2.system, pM2.user, 3000, { motor: "M2", intento: 1, t0 }),
      callClaude(pM3.system, pM3.user, 3000, { motor: "M3", intento: 1, t0 }),
    ]);
    stops.M2 = resM2.stop_reason;
    stops.M3 = resM3.stop_reason;
    m2Raw = extractText(resM2);
    m3Raw = extractText(resM3);
  } catch (err) {
    registrarErrorEstructural("generate-dvs", "fallo del modelo M2/M3", err);
    return NextResponse.json({ error: "No se pudo generar M2/M3", motor: "M2/M3", codigo: "fallo_modelo", causa: causaDeFalloModelo(err) }, { status: 500 });
  }

  let m2: ContrasteXPCTO[];
  try {
    m2 = parseJSON<ContrasteXPCTO[]>(m2Raw, "M2");
  } catch {
    return NextResponse.json({ error: `M2: no se pudo parsear la respuesta`, motor: "M2", codigo: codigoDeParseo(stops.M2) }, { status: 500 });
  }

  let m3: ActorVetoF2[];
  try {
    const m3Parsed = parseJSON<Omit<ActorVetoF2, "actorId">[]>(m3Raw, "M3");
    // Identidad estable — generada una sola vez aquí, nunca confiada a
    // Claude (mismo criterio que PIPItem.pipItemId).
    m3 = m3Parsed.map((a) => ({ ...a, actorId: crypto.randomUUID() }));
  } catch {
    return NextResponse.json({ error: `M3: no se pudo parsear la respuesta`, motor: "M3", codigo: codigoDeParseo(stops.M3) }, { status: 500 });
  }

  // M4 después de M2
  const m2Veredictos = m2.map((v) => ({
    dimension: v.dimension,
    veredicto: v.veredicto,
    argumentacion: v.argumentacion,
  }));

  let m4Raw: string;
  try {
    const { system, user } = getDVSM4Prompt(mapaSerialized, m2Veredictos, aprobado);
    const resM4 = await callClaude(system, user, 2000, { motor: "M4", intento: 1, t0 });
    stops.M4 = resM4.stop_reason;
    m4Raw = extractText(resM4);
  } catch (err) {
    registrarErrorEstructural("generate-dvs", "fallo del modelo M4", err);
    return NextResponse.json({ error: "No se pudo generar M4", motor: "M4", codigo: "fallo_modelo", causa: causaDeFalloModelo(err) }, { status: 500 });
  }

  let m4: IncertidumbreF2[];
  try {
    m4 = parseJSON<IncertidumbreF2[]>(m4Raw, "M4");
  } catch {
    return NextResponse.json({ error: `M4: no se pudo parsear la respuesta`, motor: "M4", codigo: codigoDeParseo(stops.M4) }, { status: 500 });
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

  const isM5Empty = (parsed: { hei?: Partial<HEIF2>; pip?: unknown[] }) =>
    !parsed?.hei?.tensionCentral && !parsed?.hei?.contexto && !(parsed?.pip?.length);

  let m5: { hei: HEIF2; pip: PIPItem[] } | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let m5Raw: string;
    try {
      const { system, user } = getDVSM5Prompt(projectType, xpctoRaw, mapaSerialized, m3Actores, m4Incertidumbres, aprobado);
      const resM5 = await callClaude(system, user, 5000, { motor: "M5", intento: attempt, t0 });
      stops.M5 = resM5.stop_reason;
      m5Raw = extractText(resM5);
      console.log(`[generate-dvs] M5 attempt ${attempt} respuesta ${descripcionEstructural(m5Raw)}`);
    } catch (err) {
      registrarErrorEstructural("generate-dvs", `fallo del modelo M5 intento ${attempt}`, err);
      if (attempt === 2) {
        return NextResponse.json({ error: "No se pudo generar M5", motor: "M5", codigo: "fallo_modelo", causa: causaDeFalloModelo(err) }, { status: 500 });
      }
      continue;
    }

    try {
      const parsed = parseJSON<{ hei: HEIF2; pip: PIPItem[] }>(m5Raw, "M5");
      if (isM5Empty(parsed)) {
        console.error(`[generate-dvs] M5 attempt ${attempt} returned empty content`);
        if (attempt === 2) {
          return NextResponse.json({ error: "M5 generó contenido vacío. Intenta de nuevo.", motor: "M5", codigo: "respuesta_invalida" }, { status: 500 });
        }
        continue;
      }
      m5 = parsed;
      break;
    } catch {
      console.error(`[generate-dvs] M5 attempt ${attempt} parse failure ${descripcionEstructural(m5Raw)}`);
      if (attempt === 2) {
        return NextResponse.json({ error: "M5: no se pudo parsear la respuesta del modelo.", motor: "M5", codigo: codigoDeParseo(stops.M5) }, { status: 500 });
      }
    }
  }

  if (!m5) {
    return NextResponse.json({ error: "M5: falló después de 2 intentos.", motor: "M5", codigo: "respuesta_invalida" }, { status: 500 });
  }

  const dvs: DVSF2 = {
    hei: m5.hei,
    contrasteXPCTO: m2,
    semaforo: m3,
    incertidumbres: m4,
    pip: m5.pip,
  };

  return persistAndReturn(projectId, dvs, saveas, uid, huellaConfirmada, xpctoSnapshot, huellaM1);
}

// ── Legacy single-call path ───────────────────────────────────────────────────

async function runLegacyPath(
  projectId: string,
  project: Awaited<ReturnType<typeof getProject>>,
  xpcto: Partial<XPCTO>,
  saveas: "draft" | "final",
  uid: string,
  huellaConfirmada: string | null,
  huellaM1: string | null
): Promise<NextResponse> {
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const exploData = (project.phases?.exploracion?.data ?? {}) as Record<string, unknown>;
  const pestAnalysisId = project.phases?.exploracion?.linkedSource?.sourceAnalysisId;

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

  // Claude may fail here, before any write: answer a JSON 500 (like the
  // multi-motor path) so the client can say the previous analysis is untouched.
  let response: Anthropic.Message;
  const t0 = Date.now();
  try {
    response = await medirLlamada("generate-dvs", { motor: "legacy", intento: 1, t0 }, () =>
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: user }],
      })
    );
  } catch (err) {
    registrarErrorEstructural("generate-dvs", "fallo del modelo (ruta legada)", err);
    return NextResponse.json({ error: "No se pudo generar el análisis", motor: "legacy", codigo: "fallo_modelo", causa: causaDeFalloModelo(err) }, { status: 500 });
  }

  const rawText = extractText(response);
  let dvs: DVSF2;
  try {
    dvs = parseJSON<DVSF2>(rawText, "DVS");
  } catch {
    return NextResponse.json(
      { error: "Error al parsear la respuesta del modelo", codigo: codigoDeParseo(response.stop_reason) },
      { status: 500 }
    );
  }

  return persistAndReturn(projectId, dvs, saveas, uid, huellaConfirmada, undefined, huellaM1);
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
      // Identidad estable — nunca confiada al modelo.
      actorId: typeof a.actorId === "string" ? a.actorId : crypto.randomUUID(),
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
      // Identidad estable — generada una sola vez aquí, nunca recalculada.
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
    })),
  };
}

// ── persist ───────────────────────────────────────────────────────────────────

async function persistAndReturn(
  projectId: string,
  rawDvs: DVSF2,
  saveas: "draft" | "final",
  uid: string,
  huellaConfirmada: string | null,
  xpctoSnapshot?: string,
  huellaM1?: string | null
): Promise<NextResponse> {
  const dvs = sanitizeDVS(rawDvs);

  const hasM5Content = dvs.hei?.tensionCentral || dvs.hei?.contexto || (dvs.pip?.length ?? 0) > 0;
  if (!hasM5Content) {
    console.error(
      `[generate-dvs] M5 empty after sanitization — aborting save hei_claves=${Object.keys(rawDvs.hei ?? {}).join(",")} pip=${Array.isArray(rawDvs.pip) ? rawDvs.pip.length : 0}`
    );
    return NextResponse.json({ error: "M5 generó contenido vacío. Intenta de nuevo.", motor: "M5", codigo: "respuesta_invalida" }, { status: 500 });
  }

  if (saveas === "draft") {
    // The draft is written inside a transaction that re-reads the document and compares it with the
    // approval fingerprint captured at the start: if the M1 was reopened, edited or approved with other
    // content while the model was generating, nothing is written (409 m1_no_aprobado).
    const ref = adminDb.collection("moddulo_projects").doc(projectId);
    try {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists || snap.data()?.deletedAt) throw new CompuertaM1Error("no_aprobado");
        const c = coincideCompuertaM1(snap.data()?.phases?.exploracion, huellaM1 ?? null);
        if (!c.ok) throw new CompuertaM1Error(c.motivo);
        tx.update(ref, {
          "phases.exploracion.draftDVS": dvs,
          "phases.exploracion.motorAprobaciones": {},
          // Which approved M1 this draft comes from (the discriminator the screen uses to tell a dvs of
          // THIS M1 from a dvs of a previous one): the CAPTURED fingerprint, never a re-read one. Only for
          // projects with an approved M1; others are written as before.
          ...(huellaM1 && { "phases.exploracion.m1.generacion": { huella: huellaM1, en: FieldValue.serverTimestamp() } }),
          ...(xpctoSnapshot !== undefined && {
            "phases.exploracion.xpctoSnapshotAtGeneration": xpctoSnapshot,
          }),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (err) {
      if (err instanceof CompuertaM1Error) return respuestaM1NoAprobado("generate-dvs", err.motivo);
      throw err;
    }
  } else {
    // Replace lock, step 2: the ONLY writer of the final dvs on both paths. The
    // check runs INSIDE the same transaction that copies the previous dvs and
    // writes the new one, comparing against the fingerprint the user confirmed
    // (not the one computed by the pre-check), so a change in F3 — or another
    // replacement — while Claude was generating rejects the write.
    try {
      await reemplazarDVSConVersion(adminDb, projectId, {
        nuevoDvs: dvs,
        updates: {
          "phases.exploracion.estado": "lista",
          updatedAt: FieldValue.serverTimestamp(),
        },
        origen: "generate-dvs-final",
        uid,
        guardia: ({ proyecto, resultados }) => {
          // M1 gate again, inside the transaction, against the fingerprint captured at the start.
          const c = coincideCompuertaM1(
            (proyecto as { phases?: { exploracion?: ExploracionParaM1 } } | undefined)?.phases?.exploracion,
            huellaM1 ?? null
          );
          if (!c.ok) throw new CompuertaM1Error(c.motivo);
          const estado = estadoParaImpactoDesdeProyecto(proyecto, resultados);
          if (!estado.dvs) return; // nothing to replace (first generation)
          const candado = decidirCandadoReemplazo({
            decision: calcularImpactoReemplazoDVS(estado, "reemplazo_total"),
            confirmar: huellaConfirmada !== null,
            huellaRecibida: huellaConfirmada,
          });
          if (candado.accion !== "continuar") {
            throw new ReemplazoRechazadoError(candado.accion, candado.decision);
          }
        },
      });
    } catch (err) {
      if (err instanceof CompuertaM1Error) return respuestaM1NoAprobado("generate-dvs", err.motivo);
      if (err instanceof ReemplazoRechazadoError) {
        // Nothing was written: the state changed since the user confirmed.
        return respuestaCandado(err.accion, err.decision);
      }
      // Whether the commit reached the server is unknown (the copy and the
      // overwrite are one atomic commit, but a lost response is possible), so
      // this does NOT claim the previous analysis is untouched.
      registrarErrorEstructural("generate-dvs", "no se pudo confirmar el guardado del análisis", err);
      return NextResponse.json(
        {
          error: "reemplazo_escritura_incierta",
          mensaje: "No se pudo confirmar el guardado del análisis nuevo. Recarga la página para verificar el estado.",
        },
        { status: 500 }
      );
    }
  }
  return NextResponse.json({ dvs }, { status: 200 });
}
