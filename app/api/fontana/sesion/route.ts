// app/api/fontana/sesion/route.ts
// GET  ?moddulo_project_id=&tarea_pip=  — recupera sesión existente o
//      regresa la precarga para el wizard de escenario (a).
// POST { modduloProjectId, tareaPip } — crea la sesión al confirmar el
//      wizard. Idempotente: si ya existe una sesión para ese proyecto,
//      la regresa sin duplicar.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import type { PIPItem, TareaPIP } from "@/types/moddulo.types";
import type { FontanaSesion } from "@/types/fontana.types";
import { familiaVacia } from "@/types/fontana.types";
import { derivarMinimosFamilia1 } from "@/lib/fontana/pipMinimos";

const COLLECTION = "fontana_sesiones";

function resolverPreguntaYJustificacion(
  pip: PIPItem[],
  f3Tareas: TareaPIP[],
  pipItemId: string
): { pregunta: string; justificacion?: string } {
  const item = pip.find((p) => p.pipItemId === pipItemId);
  const tarea = f3Tareas.find((t) => t.pipItemId === pipItemId);
  const asignacion = tarea?.asignaciones.find(
    (a) => a.canal === "canal1" && a.tecnicaId === "T10"
  );
  return { pregunta: item?.pregunta ?? "", justificacion: asignacion?.justificacion };
}

async function findExistingSesion(uid: string, modduloProjectId: string) {
  const snap = await adminDb
    .collection(COLLECTION)
    .where("uid", "==", uid)
    .where("modduloProjectId", "==", modduloProjectId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { sesionId: doc.id, ...doc.data() } as FontanaSesion;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const modduloProjectId = searchParams.get("moddulo_project_id");
  const tareaPipParam = searchParams.get("tarea_pip");

  if (!modduloProjectId) {
    return NextResponse.json({ error: "moddulo_project_id es requerido" }, { status: 400 });
  }

  const project = await getProject(modduloProjectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const existente = await findExistingSesion(session.uid, modduloProjectId);
  if (existente) {
    return NextResponse.json({ existe: true, sesion: existente }, { status: 200 });
  }

  if (!tareaPipParam) {
    return NextResponse.json({ error: "tarea_pip es requerido" }, { status: 400 });
  }
  const pipItemId = tareaPipParam;

  const pip = (project.phases?.investigacion?.pip ?? project.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];
  const f3Tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
  const { pregunta, justificacion } = resolverPreguntaYJustificacion(pip, f3Tareas, pipItemId);
  const minimosPreview = derivarMinimosFamilia1(pregunta, justificacion);

  return NextResponse.json(
    {
      existe: false,
      proyecto: { nombre: project.name, tipo: project.type, territorio: project.territorio ?? null },
      pipItemId,
      minimosPreview,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { modduloProjectId?: string; pipItemId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { modduloProjectId, pipItemId } = body;
  if (!modduloProjectId || typeof pipItemId !== "string") {
    return NextResponse.json({ error: "modduloProjectId y pipItemId son requeridos" }, { status: 400 });
  }

  const project = await getProject(modduloProjectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const existente = await findExistingSesion(session.uid, modduloProjectId);
  if (existente) {
    return NextResponse.json({ sesionId: existente.sesionId, sesion: existente }, { status: 200 });
  }

  // Mínimos recalculados server-side — nunca se confía el valor que pudo
  // haber viajado al cliente en el GET previo.
  const pip = (project.phases?.investigacion?.pip ?? project.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];
  const f3Tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
  const { pregunta, justificacion } = resolverPreguntaYJustificacion(pip, f3Tareas, pipItemId);
  const minimos = derivarMinimosFamilia1(pregunta, justificacion);

  const nowIso = new Date().toISOString();
  const nuevaSesion: Omit<FontanaSesion, "sesionId"> = {
    uid: session.uid,
    modduloProjectId,
    tareaPipIds: [pipItemId],
    tipoProyecto: project.type,
    territorio: project.territorio ?? { nivel: "nacional", nombre: "México" },
    indicadoresPorFamilia: {
      F1: { minimos, seleccionUsuario: [] },
      F2: familiaVacia(),
      F3: familiaVacia(),
      F4: familiaVacia(),
      F5: familiaVacia(),
    },
    fechaUltimoGuardado: nowIso,
    versionSesion: 1,
  };

  const ref = await adminDb.collection(COLLECTION).add(nuevaSesion);
  const sesion: FontanaSesion = { sesionId: ref.id, ...nuevaSesion };

  return NextResponse.json({ sesionId: ref.id, sesion }, { status: 200 });
}
