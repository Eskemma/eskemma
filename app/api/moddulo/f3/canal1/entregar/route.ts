// app/api/moddulo/f3/canal1/entregar/route.ts
// POST { projectId, sesionId, storagePath }
// Pieza 5 del plan de escenarios (b)/(c) (2026-08-19) — primera
// implementación real de Canal 1 (api-push), declarada por contrato en
// APP_TO_F3_CONTRACTS (T10) pero nunca antes construida (ver comentario de
// ese contrato). Un clic en Escenario (a), sin formulario — moduloPIP y
// cobertura se derivan server-side (mismo criterio ya usado sin excepción
// por Canal 2/3 para cobertura: { completa: true }). pipItemId NUNCA viaja
// desde el cliente — se deriva de sesion.tareaPipIds[0] (confirmado por
// grep: siempre exactamente 1 elemento, escrito una sola vez al crear la
// sesión). Upsert sobre el mismo resultadoId en reentregas — ver Punto 3.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import type { TareaPIP, PIPItem } from "@/types/moddulo.types";
import type { ResultadoCanal1 } from "@/types/f3.types";
import type { FontanaSesion } from "@/types/fontana.types";

interface Body {
  projectId?: string;
  sesionId?: string;
  storagePath?: string;
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, sesionId, storagePath } = body;
  if (!projectId || !sesionId || !storagePath) {
    return NextResponse.json({ error: "projectId, sesionId y storagePath son requeridos" }, { status: 400 });
  }

  const sesionRef = adminDb.collection("fontana_sesiones").doc(sesionId);
  const sesionSnap = await sesionRef.get();
  if (!sesionSnap.exists || sesionSnap.data()?.uid !== session.uid) {
    return NextResponse.json({ error: "Sesión de Fontana no encontrada" }, { status: 404 });
  }
  const sesion = sesionSnap.data() as FontanaSesion;

  if (sesion.modduloProjectId !== projectId) {
    return NextResponse.json({ error: "La sesión no está vinculada a este proyecto" }, { status: 404 });
  }
  const pipItemId = sesion.tareaPipIds[0];
  if (!pipItemId) {
    return NextResponse.json({ error: "Esta sesión no corresponde a una tarea del PIP (Escenario a)" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];
  const tarea = tareas.find((t) => t.pipItemId === pipItemId);
  const asignacion = tarea?.asignaciones.find((a) => a.canal === "canal1" && a.tecnicaId === "T10");
  if (!tarea || !asignacion) {
    return NextResponse.json({ error: "Asignación de Canal 1 (T10) no encontrada en el tablero" }, { status: 404 });
  }

  const pip = (project.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];
  const moduloPIP = pip.find((p) => p.pipItemId === pipItemId)?.pregunta ?? "Resultado de Fontana";

  const extractoTexto = await extractTextPerFile({
    nombre: "fontana-contexto.json", tipo: "application/json", url: "", storagePath,
  });

  const resultadoId = sesion.entregaCanal1?.resultadoId ?? crypto.randomUUID();
  const esReentrega = !!sesion.entregaCanal1?.resultadoId;
  const fechaEntrega = new Date().toISOString();

  const resultado: ResultadoCanal1 = {
    moduloPIP,
    origen: { sourceKind: "T10", componente: "centinela", analisisId: resultadoId, fechaEntrega },
    cobertura: { completa: true },
    payload: { archivoUrl: storagePath, extractoTexto },
  };

  await adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .collection("f3Resultados")
    .doc(resultadoId)
    .set({ ...resultado, createdAt: FieldValue.serverTimestamp() });

  // Reentrega sobre un resultado que ya había sido aprobado en M2: invalida
  // esa aprobación anterior (misma lógica que la propagación de staleness
  // ya usada en el proyecto — el contenido de origen cambió, la aprobación
  // humana previa no se hereda en silencio) y limpia resultadoId de la
  // asignación para que vuelva a aparecer como candidata en el picker de M2
  // (F3ResultadosRecibidos filtra por `!a.resultadoId`).
  if (esReentrega && asignacion.resultadoId === resultadoId) {
    const tareasActualizadas = tareas.map((t) => ({
      pipItemId: t.pipItemId,
      asignaciones: t.pipItemId !== pipItemId ? t.asignaciones : t.asignaciones.map((a) =>
        a.asignacionId === asignacion.asignacionId
          ? { ...a, estado: "en_curso" as const, resultadoId: undefined }
          : a
      ),
    }));
    await adminDb.collection("moddulo_projects").doc(projectId).update({
      "phases.investigacion.f3TareasPIP": tareasActualizadas,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await sesionRef.update({ entregaCanal1: { fecha: fechaEntrega, resultadoId } });

  return NextResponse.json({ resultadoId, fecha: fechaEntrega }, { status: 200 });
}
