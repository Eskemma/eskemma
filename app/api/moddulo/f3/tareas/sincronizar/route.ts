// app/api/moddulo/f3/tareas/sincronizar/route.ts
// POST { projectId }
// Aplica la propagación PIP (F2) → tablero (F3): recalcula el diff
// server-side contra el snapshot persistido (nunca confía en uno mandado
// por el cliente, mismo criterio que el guard de progreso en
// tareas/generar), regenera SOLO las tareas de preguntas agregadas/editadas
// (M1 escopeado a esos ítems), retira del tablero las tareas de preguntas
// eliminadas (con nota congelada en el RDA), y preserva intacto el resto
// del tablero — asignaciones, activada, estado y resultadoId sin tocar.
//
// Camino adicional a tareas/generar, no un reemplazo: ese endpoint y su
// guard de "progreso real" siguen intactos para la regeneración completa.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject, attachNumero } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { TareaPIP, PIPItem } from "@/types/moddulo.types";
import { computePipCambios, type PipCambio } from "@/lib/moddulo/pipPropagation";
import { generarTareasParaPIPItems } from "@/lib/moddulo/f3TareasGenerator";
import { preguntaEliminadaToRDAItem } from "@/lib/moddulo/criterios-investigacion";

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

  const currentPip = (project.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];
  const tareasExistentes = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];

  if (tareasExistentes.length === 0) {
    return NextResponse.json(
      { error: "No hay tablero generado todavía — usa /tareas/generar primero" },
      { status: 400 }
    );
  }

  // Mismo fallback que detectPipStaleness() cuando no hay snapshot real
  // (tableros generados antes de que existiera pipSnapshotAtGeneration) —
  // el banner y la aplicación real deben ver exactamente el mismo diff.
  const raw = project.phases?.investigacion?.pipSnapshotAtGeneration as string | undefined;
  const cambios = computePipCambios(currentPip, tareasExistentes, raw);
  if (cambios.length === 0) {
    return NextResponse.json({ sincronizado: false, tareas: tareasExistentes }, { status: 200 });
  }

  const eliminadas = cambios.filter((c): c is Extract<PipCambio, { tipo: "eliminada" }> => c.tipo === "eliminada");
  const agregadasOEditadas = cambios.filter((c) => c.tipo === "agregada" || c.tipo === "editada");

  // M1 escopeado — solo los PIPItem agregados/editados pasan por Claude;
  // las tareas no tocadas por el diff nunca se regeneran.
  const pipItemIdsAfectados = new Set(agregadasOEditadas.map((c) => c.pipItemId));
  const pipItemsParaGenerar = currentPip.filter((p) => pipItemIdsAfectados.has(p.pipItemId));

  let tareasGeneradas: TareaPIP[] = [];
  if (pipItemsParaGenerar.length > 0) {
    try {
      tareasGeneradas = await generarTareasParaPIPItems(pipItemsParaGenerar);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Error generando el tablero: ${msg}` }, { status: 500 });
    }
  }

  const pipItemIdsEliminados = new Set(eliminadas.map((c) => c.pipItemId));
  const tareasGeneradasPorId = new Map(tareasGeneradas.map((t) => [t.pipItemId, t]));
  const existentesIds = new Set(tareasExistentes.map((t) => t.pipItemId));

  // Payload de escritura explícito { pipItemId, asignaciones } — nunca
  // spread de un objeto leído de getProject() (traería `numero` adjunto).
  const tareasFinal: { pipItemId: string; asignaciones: TareaPIP["asignaciones"] }[] = [];
  for (const t of tareasExistentes) {
    if (pipItemIdsEliminados.has(t.pipItemId)) continue; // se retira del tablero
    const reemplazo = tareasGeneradasPorId.get(t.pipItemId);
    tareasFinal.push(
      reemplazo
        ? { pipItemId: reemplazo.pipItemId, asignaciones: reemplazo.asignaciones } // editada — progreso previo se pierde, ya disclosed en el banner
        : { pipItemId: t.pipItemId, asignaciones: t.asignaciones } // no tocada por el diff — intacta
    );
  }
  for (const t of tareasGeneradas) {
    if (!existentesIds.has(t.pipItemId)) {
      tareasFinal.push({ pipItemId: t.pipItemId, asignaciones: t.asignaciones }); // agregada
    }
  }

  const updates: Record<string, unknown> = {
    "phases.investigacion.f3TareasPIP": tareasFinal,
    "phases.investigacion.pipSnapshotAtGeneration": JSON.stringify(currentPip),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Trazabilidad de preguntas eliminadas — escritura de campo puntual sobre
  // el mapa rda (mismo patrón que complete-phase/route.ts y rda/accept/route.ts),
  // no vía planRDAUpdate: no hay "vigentes" que recalcular, es un registro
  // histórico creado una sola vez con el texto ya congelado.
  for (const c of eliminadas) {
    const item = preguntaEliminadaToRDAItem(c);
    updates[`rda.${item.id}`] = { ...item, fechaCreacion: FieldValue.serverTimestamp() };
  }

  await adminDb.collection("moddulo_projects").doc(projectId).update(updates);

  // `numero` se adjunta solo para la respuesta al cliente (nunca se
  // persistió arriba) — el frontend actualiza su estado directamente desde
  // esta respuesta (sin pasar por getProject()), y sin esto perdería el
  // número de despliegue/texto de la pregunta en el render de TODO el
  // tablero, no solo de las tareas tocadas por este sincronizado.
  return NextResponse.json(
    {
      sincronizado: true,
      tareas: attachNumero(tareasFinal, currentPip),
      resumen: {
        agregadas: cambios.filter((c) => c.tipo === "agregada").length,
        editadas: cambios.filter((c) => c.tipo === "editada").length,
        eliminadas: eliminadas.length,
      },
    },
    { status: 200 }
  );
}
