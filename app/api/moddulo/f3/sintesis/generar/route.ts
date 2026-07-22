// app/api/moddulo/f3/sintesis/generar/route.ts
// POST { projectId }
// M3 — Síntesis de hallazgos. Cruza los resultados aprobados (M2) con el
// tablero de tareas (M1), identifica convergencias, contradicciones y
// vacíos residuales (con destino RDA/SIP), y produce los insumos de FODA
// Propio y FODA de Adversarios (línea base para F4, no el FODA final).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type Anthropic from "@anthropic-ai/sdk";
import type { TareaPIP, PIPItem, SintesisF3, ActorVetoF2 } from "@/types/moddulo.types";
import { tareasConSustentoUnico } from "@/lib/moddulo/triangulacion";

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseSintesisJSON(raw: string): SintesisF3 {
  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  const s = (fence ? fence[1] : raw).trim();
  return JSON.parse(s) as SintesisF3;
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

  const pip = (project.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];
  const tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
  const actoresVeto = (project.phases?.exploracion?.dvs?.semaforo ?? []) as ActorVetoF2[];

  // Las asignaciones desactivadas por el usuario ya quedan trazadas aparte
  // en el RDA (asignacion_desactivada, calculado en vivo desde
  // evaluarDesactivaciones) — incluirlas también aquí generaría un vacío
  // residual duplicando la misma decisión. Se filtran del payload que ve
  // Claude, pero la TAREA nunca desaparece del arreglo: si el filtrado deja
  // asignaciones vacío, se marca `sinViasActivas: true` explícitamente para
  // que M3 la trate como sin cobertura (vacío de tarea completa) en vez de
  // simplemente no verla.
  const tareasParaPrompt = tareas.map((t) => {
    const activas = (t.asignaciones ?? []).filter((a) => a.activada !== false);
    return activas.length > 0
      ? { numero: t.numero, asignaciones: activas }
      : { numero: t.numero, asignaciones: activas, sinViasActivas: true };
  });

  const resultadosSnap = await adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .collection("f3Resultados")
    .get();
  const resultadosAprobados = resultadosSnap.docs
    .map((d) => ({ resultadoId: d.id, ...d.data() }))
    .filter((r) => (r as { aprobado?: boolean }).aprobado === true);

  // Triangulación informativa: usa `tareas` SIN filtrar (no `tareasParaPrompt`)
  // — activada solo gatea la suficiencia de M4, nunca qué evidencia cuenta
  // para esta señal de M3.
  const sustentoUnico = tareasConSustentoUnico(tareas, resultadosAprobados);

  const system = `Eres M3, el motor de Síntesis de hallazgos de la Fase 3 (Moddulo). Cruzas los resultados de investigación aprobados con las tareas del PIP y produces un cuerpo coherente de evidencia.

Cada tarea del PIP puede tener varias asignaciones (vías para responderla) en vez de un solo canal. El tablero que recibes ya viene FILTRADO a solo las asignaciones que el usuario dejó activas — las que desactivó no aparecen, porque esa decisión ya se registra aparte y no debe duplicarse aquí. Identifica:
- convergencias: hallazgos consistentes entre dos o más resultados. Cada convergencia lleva un campo booleano \`sustentoUnico\`: márcalo \`true\` únicamente cuando la convergencia dependa principalmente de resultados de una tarea que aparece en la lista "Tareas con sustento metodológico único" (más abajo) — es decir, cuando toda la evidencia detrás de ese hallazgo viene de la misma familia metodológica, sin variedad. Es puramente informativo para el usuario, nunca cambia si algo es o no convergencia.
- contradicciones: hallazgos que se oponen entre sí — no las resuelvas, solo repórtalas.
- vaciosResiduales: dos tipos, NUNCA omitas el segundo tipo solo porque la tarea ya tenga otra asignación cubierta:
  1. Tarea completa sin ninguna asignación (de las activas) con resultado aprobado — vacío SIN asignacionId, con destino "alta urgencia y resolución pendiente" (RDA) o "naturaleza continua o baja resolución" (SIP). Si una tarea trae el campo \`sinViasActivas: true\`, trátala igual que si ninguna asignación tuviera resultado — genera este vacío de tarea completa para ella también, aunque su arreglo de asignaciones venga vacío.
  2. Una asignación específica (de las activas) sin resultado aprobado, aunque otra asignación de esa misma tarea sí tenga resultado — vacío CON asignacionId (el de esa asignación específica), mismo criterio de destino RDA/SIP. Esto es obligatorio: una vía pendiente no debe desaparecer de la síntesis solo porque otra vía ya aportó su parte.
- fodaPropioInsumo: fortalezas/oportunidades/debilidades/amenazas del proyecto, cada una respaldada por al menos un hallazgo.
- fodaAdversariosInsumo: un FODA por cada actor de veto relevante (más profundo para riesgo "rojo" que "ambar"/"verde").

Responde ÚNICAMENTE con JSON con esta forma exacta:
{"convergencias": [{"texto": "...", "sustentoUnico": true|false}], "contradicciones": [...], "vaciosResiduales": [{"numero": N, "asignacionId": "opcional, solo para vacíos de complementaria", "pregunta": "...", "urgencia": "alta|media|baja", "destino": "RDA|SIP"}], "fodaPropioInsumo": {"fortalezas": [...], "oportunidades": [...], "debilidades": [...], "amenazas": [...]}, "fodaAdversariosInsumo": {"<nombre actor>": {"fortalezas": [...], "oportunidades": [...], "debilidades": [...], "amenazas": [...]}}}`;

  const user = `PIP:\n${JSON.stringify(pip, null, 2)}\n\nTablero de tareas (M1, ya filtrado a asignaciones activas):\n${JSON.stringify(tareasParaPrompt, null, 2)}\n\nResultados aprobados (M2):\n${JSON.stringify(resultadosAprobados, null, 2)}\n\nActores de veto (Semáforo F2):\n${JSON.stringify(actoresVeto, null, 2)}\n\nTareas con sustento metodológico único (todas sus fuentes con resultado aprobado son de la misma familia metodológica): ${JSON.stringify(sustentoUnico)}`;

  let raw: string;
  try {
    const res = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: user }],
    }) as Anthropic.Message;
    raw = extractText(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error llamando a Claude: ${msg}` }, { status: 500 });
  }

  let sintesis: SintesisF3;
  try {
    sintesis = parseSintesisJSON(raw);
  } catch {
    return NextResponse.json({ error: "No se pudo parsear la respuesta de Claude", raw: raw.slice(0, 400) }, { status: 500 });
  }

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.investigacion.f3Sintesis": sintesis,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ sintesis }, { status: 200 });
}
