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
import { getProject, attachNumero } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { TareaPIP, PIPItem } from "@/types/moddulo.types";
import { asignacionEtiquetaCompleta } from "@/lib/moddulo/asignacionLabel";
import { generarTareasParaPIPItems } from "@/lib/moddulo/f3TareasGenerator";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; confirmar?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, confirmar } = body;
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

  // Guard — regenerar sobrescribe el arreglo completo, así que una tarea con
  // progreso real (algo distinto de "recién propuesta, sin tocar") se
  // perdería en silencio. "Progreso real" es deliberadamente amplio: no solo
  // resultados aprobados, también una vía que el usuario desactivó a mano
  // (esa decisión es tan real como un resultado recibido). Sin `confirmar`,
  // se detiene y reporta qué se perdería — el diff/merge selectivo que
  // permitiría regenerar sin pedir esto queda para un incremento aparte.
  const existingTareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
  const tieneProgresoReal = (t: TareaPIP) =>
    (t.asignaciones ?? []).some((a) => a.estado !== "pendiente" || !!a.resultadoId || a.activada === false);
  const tareasConProgreso = existingTareas.filter(tieneProgresoReal);

  if (tareasConProgreso.length > 0 && confirmar !== true) {
    const resultadosSnap = await adminDb
      .collection("moddulo_projects").doc(projectId).collection("f3Resultados").get();
    const aprobadoPorResultadoId = new Map<string, boolean>(
      resultadosSnap.docs.map((d) => [d.id, (d.data() as { aprobado?: boolean }).aprobado === true])
    );

    let conResultadoAprobado = 0;
    let desactivadas = 0;
    const tareasAfectadas = tareasConProgreso.map((t) => {
      const pregunta = pip.find((p) => p.numero === t.numero)?.pregunta ?? "Necesidad de información";
      const motivos: string[] = [];
      for (const a of t.asignaciones ?? []) {
        if (!(a.estado !== "pendiente" || !!a.resultadoId || a.activada === false)) continue;
        const etiqueta = asignacionEtiquetaCompleta(a);
        if (a.resultadoId && aprobadoPorResultadoId.get(a.resultadoId)) {
          conResultadoAprobado += 1;
          motivos.push(`Resultado aprobado en ${etiqueta}`);
        } else if (a.resultadoId) {
          motivos.push(`Resultado recibido (pendiente de aprobación) en ${etiqueta}`);
        }
        if (a.activada === false) {
          desactivadas += 1;
          motivos.push(`Vía desactivada: ${etiqueta}`);
        } else if (a.estado !== "pendiente" && !a.resultadoId) {
          motivos.push(`Estado "${a.estado}" en ${etiqueta}`);
        }
      }
      return { numero: t.numero, pregunta, motivos };
    });

    const partes: string[] = [];
    if (conResultadoAprobado > 0) {
      partes.push(`${conResultadoAprobado} resultado${conResultadoAprobado === 1 ? "" : "s"} ya aprobado${conResultadoAprobado === 1 ? "" : "s"}`);
    }
    if (desactivadas > 0) {
      partes.push(`${desactivadas} vía${desactivadas === 1 ? "" : "s"} desactivada${desactivadas === 1 ? "" : "s"}`);
    }
    const mensaje = partes.length > 0
      ? `Regenerar el tablero eliminará ${partes.join(" y ")}. ¿Confirmas?`
      : "Regenerar el tablero sobrescribirá el progreso ya registrado en algunas tareas. ¿Confirmas?";

    return NextResponse.json(
      { error: "progreso_existente", mensaje, resumen: { conResultadoAprobado, desactivadas, tareasAfectadas } },
      { status: 409 }
    );
  }

  let tareas: TareaPIP[];
  try {
    tareas = await generarTareasParaPIPItems(pip);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error generando el tablero: ${msg}` }, { status: 500 });
  }

  // Nunca se escribe el `numero` adjunto en lectura (ver getProject()) de
  // vuelta a Firestore — el payload se construye explícitamente desde
  // { pipItemId, asignaciones }. También se persiste el snapshot del PIP
  // vigente, base para la próxima detección de propagación
  // (lib/moddulo/pipPropagation.ts) si el usuario vuelve a editar el PIP.
  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.investigacion.f3TareasPIP": tareas.map((t) => ({ pipItemId: t.pipItemId, asignaciones: t.asignaciones })),
    "phases.investigacion.pipSnapshotAtGeneration": JSON.stringify(pip),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // `numero` se adjunta solo para la respuesta al cliente (nunca se
  // persistió arriba) — sin esto, el frontend actualiza su estado
  // directamente desde esta respuesta (sin pasar por getProject()) y
  // pierde el número de despliegue/texto de la pregunta en el render.
  return NextResponse.json({ tareas: attachNumero(tareas, pip) }, { status: 200 });
}
