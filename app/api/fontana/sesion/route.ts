// app/api/fontana/sesion/route.ts
// GET  ?moddulo_project_id=&tarea_pip=  — recupera sesión existente o
//      regresa la precarga para el wizard de escenario (a).
// GET  ?sesion_id=  — recupera una sesión directo por ID (Escenarios
//      b/c — sesión suelta con o sin modduloProjectId vinculado después;
//      nunca tiene un pipItemId real que poner en la URL de escenario a).
// POST { modduloProjectId, pipItemId } — crea la sesión al confirmar el
//      wizard de escenario (a). Idempotente: si ya existe una sesión
//      para ese proyecto, la regresa sin duplicar.
// POST { territorio, tipoProyecto } — crea una sesión SUELTA (Escenarios
//      b/c, sin proyecto), con los indicadores por defecto ya poblados
//      (derivarIndicadoresPorDefecto).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PIPItem, TareaPIP, ProjectType } from "@/types/moddulo.types";
import type { Territorio } from "@/types/shared.types";
import type { FontanaSesion } from "@/types/fontana.types";
import { familiaVacia } from "@/types/fontana.types";
import { derivarMinimosPorFamilia } from "@/lib/fontana/pipMinimos";
import { derivarIndicadoresPorDefecto } from "@/lib/fontana/defaultIndicadores";
import { buscarSesionPorProyectoConTerritorioActual } from "@/lib/fontana/sesionTerritorio";

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

const findExistingSesion = buscarSesionPorProyectoConTerritorioActual;

// Bug crítico (2026-08-19) — corregido: la sesión de Fontana era un
// singleton por (uid, modduloProjectId), ignorando a qué tarea PIP
// correspondía la solicitud actual. Si el usuario abre Fontana desde una
// tarea PIP distinta a la que originó la sesión (o el tablero se
// regeneró/editó después), `canal1/entregar` fallaba en vivo porque
// `tareaPipIds[0]` ya no correspondía a ninguna asignación canal1+T10
// real. Repuntar aquí, en el único lugar que resuelve "sesión existente
// para este proyecto", corrige ambos flujos de entrada (GET y POST) de
// una sola vez.
//
// Fusiona, no reemplaza (decisión explícita — nunca perder en silencio
// la exploración libre que el usuario ya había hecho): los mínimos
// viejos que ya no correspondan a la tarea nueva pasan a
// `seleccionUsuario` (deduplicados contra lo que ya hubiera ahí y contra
// los mínimos nuevos), en vez de desaparecer.
async function repuntarSiCorresponde(
  sesion: FontanaSesion,
  pipItemIdActual: string,
  pip: PIPItem[],
  f3Tareas: TareaPIP[]
): Promise<FontanaSesion> {
  if (sesion.tareaPipIds[0] === pipItemIdActual) return sesion;

  const { pregunta, justificacion } = resolverPreguntaYJustificacion(pip, f3Tareas, pipItemIdActual);
  const minimosNuevosF1 = derivarMinimosPorFamilia(pregunta, justificacion, "F1-");
  const minimosNuevosF2 = derivarMinimosPorFamilia(pregunta, justificacion, "F2-");

  function fusionar(minimosViejos: string[], seleccionViejos: string[], minimosNuevos: string[]): string[] {
    const nuevosSet = new Set(minimosNuevos);
    const liberados = minimosViejos.filter((id) => !nuevosSet.has(id));
    return [...new Set([...seleccionViejos, ...liberados])];
  }

  const indicadoresPorFamilia: FontanaSesion["indicadoresPorFamilia"] = {
    ...sesion.indicadoresPorFamilia,
    F1: {
      minimos: minimosNuevosF1,
      seleccionUsuario: fusionar(sesion.indicadoresPorFamilia.F1.minimos, sesion.indicadoresPorFamilia.F1.seleccionUsuario, minimosNuevosF1),
    },
    F2: {
      minimos: minimosNuevosF2,
      seleccionUsuario: fusionar(sesion.indicadoresPorFamilia.F2.minimos, sesion.indicadoresPorFamilia.F2.seleccionUsuario, minimosNuevosF2),
    },
  };

  // entregaCanal1 queda obsoleto al repuntar (Punto A) — el botón de
  // "Entregar a Moddulo F3" debe volver a su estado inicial para la
  // tarea nueva, nunca arrastrar "ya entregado" de la tarea anterior.
  await adminDb.collection(COLLECTION).doc(sesion.sesionId).update({
    tareaPipIds: [pipItemIdActual],
    indicadoresPorFamilia,
    entregaCanal1: FieldValue.delete(),
  });

  return { ...sesion, tareaPipIds: [pipItemIdActual], indicadoresPorFamilia, entregaCanal1: undefined };
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sesionIdParam = searchParams.get("sesion_id");
  const modduloProjectId = searchParams.get("moddulo_project_id");
  const tareaPipParam = searchParams.get("tarea_pip");

  // Carga directa por sesionId — Escenarios (b)/(c): una sesión suelta
  // nunca tiene un pipItemId real que poner en la URL de escenario (a).
  if (sesionIdParam) {
    const doc = await adminDb.collection(COLLECTION).doc(sesionIdParam).get();
    if (!doc.exists || doc.data()?.uid !== session.uid) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }
    const sesion = { sesionId: doc.id, ...doc.data() } as FontanaSesion;
    return NextResponse.json({ existe: true, sesion }, { status: 200 });
  }

  if (!modduloProjectId) {
    return NextResponse.json({ error: "moddulo_project_id o sesion_id es requerido" }, { status: 400 });
  }

  const project = await getProject(modduloProjectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const pip = (project.phases?.investigacion?.pip ?? project.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];
  const f3Tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];

  const existente = await findExistingSesion(session.uid, modduloProjectId);
  if (existente) {
    const sesionVigente = tareaPipParam
      ? await repuntarSiCorresponde(existente, tareaPipParam, pip, f3Tareas)
      : existente;
    return NextResponse.json({ existe: true, sesion: sesionVigente }, { status: 200 });
  }

  if (!tareaPipParam) {
    return NextResponse.json({ error: "tarea_pip es requerido" }, { status: 400 });
  }
  const pipItemId = tareaPipParam;

  const { pregunta, justificacion } = resolverPreguntaYJustificacion(pip, f3Tareas, pipItemId);
  // minimosPreview es un string[] plano (family-agnostic) — FontanaOnboarding.tsx
  // solo cuenta y lista IDs, sin distinguir familia.
  const minimosPreview = [
    ...derivarMinimosPorFamilia(pregunta, justificacion, "F1-"),
    ...derivarMinimosPorFamilia(pregunta, justificacion, "F2-"),
  ];

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

  let body: { modduloProjectId?: string; pipItemId?: string; territorio?: Territorio; tipoProyecto?: ProjectType };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { modduloProjectId, pipItemId, territorio, tipoProyecto } = body;

  // Sesión suelta (Escenarios b/c) — sin modduloProjectId, territorio +
  // tipoProyecto elegidos por el usuario en TerritorySelector. Siempre
  // crea una sesión nueva (a diferencia de escenario a, no hay
  // "buscar existente por proyecto" posible sin proyecto).
  if (!modduloProjectId) {
    if (!territorio || !tipoProyecto) {
      return NextResponse.json(
        { error: "modduloProjectId, o territorio y tipoProyecto, son requeridos" },
        { status: 400 }
      );
    }
    const nowIso = new Date().toISOString();
    const defaults = derivarIndicadoresPorDefecto();
    const nuevaSesion: Omit<FontanaSesion, "sesionId"> = {
      uid: session.uid,
      tareaPipIds: [],
      tipoProyecto,
      territorio,
      indicadoresPorFamilia: {
        F1: { minimos: [], seleccionUsuario: defaults.F1 },
        F2: { minimos: [], seleccionUsuario: defaults.F2 },
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

  if (typeof pipItemId !== "string") {
    return NextResponse.json({ error: "modduloProjectId y pipItemId son requeridos" }, { status: 400 });
  }

  const project = await getProject(modduloProjectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Mínimos recalculados server-side — nunca se confía el valor que pudo
  // haber viajado al cliente en el GET previo.
  const pip = (project.phases?.investigacion?.pip ?? project.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];
  const f3Tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];

  const existente = await findExistingSesion(session.uid, modduloProjectId);
  if (existente) {
    const sesionVigente = await repuntarSiCorresponde(existente, pipItemId, pip, f3Tareas);
    return NextResponse.json({ sesionId: sesionVigente.sesionId, sesion: sesionVigente }, { status: 200 });
  }

  const { pregunta, justificacion } = resolverPreguntaYJustificacion(pip, f3Tareas, pipItemId);
  const minimosF1 = derivarMinimosPorFamilia(pregunta, justificacion, "F1-");
  const minimosF2 = derivarMinimosPorFamilia(pregunta, justificacion, "F2-");

  const nowIso = new Date().toISOString();
  const nuevaSesion: Omit<FontanaSesion, "sesionId"> = {
    uid: session.uid,
    modduloProjectId,
    tareaPipIds: [pipItemId],
    tipoProyecto: project.type,
    territorio: project.territorio ?? { nivel: "nacional", nombre: "México" },
    indicadoresPorFamilia: {
      F1: { minimos: minimosF1, seleccionUsuario: [] },
      F2: { minimos: minimosF2, seleccionUsuario: [] },
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
