// app/api/moddulo/f3/tareas/generar/route.ts
// POST { projectId }
// M1 — Gestor de tareas de investigación. Toma el PIP heredado de F2 y
// evalúa, para cada necesidad de información, las 35 técnicas del catálogo
// MMEE: propone una asignación PRIMARIA de Canal 1 si alguna técnica del
// ecosistema aporta (aunque sea parcialmente), y agrega una asignación
// COMPLEMENTARIA de Canal 2 cuando hay una parte que requiere gestión
// humana directa (entrevistas de élite, negociación, acceso restringido) —
// nunca se omite esta parte solo porque exista una primaria. Escribe el
// tablero como DRAFT — el usuario aprueba/reasigna cada asignación vía
// /tareas/aprobar antes de activar el canal.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type Anthropic from "@anthropic-ai/sdk";
import { TECNICA_TITULOS, APP_TO_F3_CONTRACTS } from "@/types/f3.types";
import type { TareaPIP, AsignacionCanal, PIPItem } from "@/types/moddulo.types";
import type { TecnicaId } from "@/types/shared.types";

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

type AsignacionClaude = Omit<AsignacionCanal, "asignacionId" | "estadoApp" | "activada">;
interface TareaClaude {
  numero: number;
  asignaciones: AsignacionClaude[];
}

function parseTareasJSON(raw: string): TareaClaude[] {
  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  const s = (fence ? fence[1] : raw).trim();
  const parsed = JSON.parse(s) as { tareas: TareaClaude[] };
  return parsed.tareas;
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
  if (pip.length === 0) {
    return NextResponse.json({ error: "No hay PIP heredado de F2 para generar el tablero" }, { status: 400 });
  }

  const catalogo = Object.entries(TECNICA_TITULOS)
    .map(([id, titulo]) => `${id}: ${titulo}`)
    .join("\n");

  const system = `Eres M1, el Gestor de tareas de investigación de la Fase 3 (Moddulo). Traduces el Programa de Investigación Profunda (PIP) en un tablero de tareas concretas, evaluando el catálogo completo de 35 técnicas del ecosistema Eskemma (MMEE):

${catalogo}

Para cada ítem del PIP, evalúa en este orden de prioridad:
1. Primero evalúa si alguna técnica del ecosistema aporta, aunque sea parcialmente, a responder la pregunta. Si sí, agrega una asignación { tipo: "primaria", canal: "canal1", tecnicaId, justificacion }. No la fuerces si de verdad ninguna técnica aplica — en ese caso, la primaria puede ser canal2 o canal3 directamente.
2. Después, evalúa si hay una parte de la pregunta que requiere gestión humana directa (entrevistas de élite, negociación, acceso restringido) que ninguna técnica automatizada del ecosistema puede cubrir. Si la hay, agrega SIEMPRE una asignación adicional { tipo: "complementaria", canal: "canal2", justificacion } — nunca omitas esta parte solo porque ya exista una asignación primaria de Canal 1; ambas piezas de evidencia son necesarias.
3. Cada asignación lleva: justificacion (por qué esa asignación cubre esa parte de la pregunta, 1-2 frases), estado siempre "pendiente" en esta propuesta inicial.

No incluyas asignacionId ni estadoApp — esos se calculan automáticamente después.

Ejemplo de referencia: una pregunta sobre viabilidad de una coalición partidista debe generar una asignación primaria a la técnica de monitoreo de medios (T34) para señales públicas, más una asignación complementaria de Canal 2 para entrevistas con dirigencia partidista.

Responde ÚNICAMENTE con JSON: {"tareas": [{"numero": N, "asignaciones": [{"tipo": "primaria"|"complementaria", "canal": "canal1"|"canal2"|"canal3", "tecnicaId": "T##" (solo si canal es canal1), "justificacion": "...", "estado": "pendiente"}]}]}`;

  const user = `PIP heredado de F2:\n${JSON.stringify(pip, null, 2)}`;

  let raw: string;
  try {
    const res = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      system,
      messages: [{ role: "user", content: user }],
    }) as Anthropic.Message;
    raw = extractText(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error llamando a Claude: ${msg}` }, { status: 500 });
  }

  let tareasClaude: TareaClaude[];
  try {
    tareasClaude = parseTareasJSON(raw);
  } catch {
    return NextResponse.json({ error: "No se pudo parsear la respuesta de Claude", raw: raw.slice(0, 400) }, { status: 500 });
  }

  // asignacionId, estadoApp y activada nunca se confían al modelo — se
  // calculan aquí, mismo criterio que familiaMetodologica/NOMBRES_COMERCIALES.
  //
  // asignacionId se deriva del CONTENIDO de la asignación (pregunta + canal
  // + vía), no de la posición en el arreglo — dos generaciones distintas del
  // tablero que propongan la misma pregunta con la misma vía producen el
  // mismo ID. Esto es lo que permitiría en el futuro tratar una regeneración
  // como diff/merge en vez de reemplazo total (ver documento de diseño
  // pendiente), y es la base de estabilidad que necesitaría un resultadoId
  // determinístico de Canal 1 (ej. `canal1_${asignacionId}`). Colisión (dos
  // asignaciones con mismo tipo/canal/técnica para la misma pregunta, caso
  // no previsto por el prompt de arriba pero no imposible) se resuelve con
  // un sufijo de desempate, sin sacrificar la estabilidad del caso común.
  const tareas: TareaPIP[] = tareasClaude.map((t) => {
    const idsUsados = new Set<string>();
    return {
      numero: t.numero,
      asignaciones: t.asignaciones.map((a) => {
        const base = `${t.numero}_${a.canal}_${a.tipo}${
          a.canal === "canal1" && a.tecnicaId ? `_${a.tecnicaId}` : ""
        }`;
        let asignacionId = base;
        let sufijo = 1;
        while (idsUsados.has(asignacionId)) {
          asignacionId = `${base}_${sufijo}`;
          sufijo += 1;
        }
        idsUsados.add(asignacionId);
        return {
          ...a,
          asignacionId,
          activada: true,
          ...(a.canal === "canal1" && a.tecnicaId
            ? { estadoApp: APP_TO_F3_CONTRACTS[a.tecnicaId as TecnicaId] ? ("disponible" as const) : ("proximamente" as const) }
            : {}),
        };
      }),
    };
  });

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.investigacion.f3TareasPIP": tareas,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ tareas }, { status: 200 });
}
