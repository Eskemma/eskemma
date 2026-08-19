// app/api/moddulo/f3/canal3/revisar-territorio/route.ts
// POST { projectId, resultadoId }
// Ronda 13 (26-08-18) — propagación de cambios de territorio, Capa 2
// (Canal 3). Re-ejecuta la evaluación de compatibilidad territorial EN
// VIVO contra el territorio actual del proyecto — nunca automático, solo
// bajo demanda explícita del usuario (botón "Revisar" en el banner de
// staleness). No desvincula ni invalida la fuente: solo actualiza el
// veredicto guardado y el snapshot, dejando la decisión al analista
// (mismo principio "colaborador estratégico, no oráculo" de todo el
// proyecto). Recalcula server-side, nunca confía en un veredicto mandado
// por el cliente — mismo criterio que /f3/tareas/sincronizar.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { evaluarCompatibilidad } from "@/lib/moddulo/canal3Evaluation";
import { extraerTerritorioEscalar } from "@/lib/territorio/staleness";
import type { ResultadoFuenteExterna } from "@/types/f3.types";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; resultadoId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, resultadoId } = body;
  if (!projectId || !resultadoId) {
    return NextResponse.json({ error: "projectId y resultadoId son requeridos" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const resultadoRef = adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .collection("f3Resultados")
    .doc(resultadoId);
  const resultadoSnap = await resultadoRef.get();
  if (!resultadoSnap.exists) {
    return NextResponse.json({ error: "Resultado no encontrado" }, { status: 404 });
  }
  const resultado = resultadoSnap.data() as ResultadoFuenteExterna;
  if (resultado.origen.sourceKind !== "external" || !resultado.metadatosFuente) {
    return NextResponse.json({ error: "Este resultado no es de Canal 3 — no aplica" }, { status: 400 });
  }

  // Recalcula EN VIVO contra el territorio actual del proyecto — la
  // fuente (metadatosFuente.territorioDeclarado) nunca cambia, es un dato
  // fijo declarado por el usuario al vincular.
  const compatibilidad = evaluarCompatibilidad(project, resultado.metadatosFuente);

  await resultadoRef.update({
    compatibilidad,
    proyectoTerritorioSnapshotAtVinculacion: project.territorio
      ? JSON.stringify(extraerTerritorioEscalar(project.territorio))
      : null,
  });

  return NextResponse.json({ compatibilidad }, { status: 200 });
}
