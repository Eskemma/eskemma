// app/api/moddulo/f2/unlink-pestel/route.ts
// POST { projectId }
// Desvincula explícitamente un proyecto Moddulo de su análisis de Centinela
// PESTEL. Limpia los punteros y el M1 asociado, dejando F2 listo para
// regenerar vía el flujo express. Contraparte deliberada del guard 409 en
// generate-m1-express/route.ts: sin esta acción, un proyecto vinculado a
// Centinela nunca podría volver a usar express.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

  const pestProjectId = project.phases?.exploracion?.pestProjectId as string | undefined;
  const pestAnalysisId = project.phases?.exploracion?.pestAnalysisId as string | undefined;
  if (!pestProjectId && !pestAnalysisId) {
    return NextResponse.json(
      { error: "not_linked", message: "Este proyecto no está vinculado a ningún análisis de Centinela PESTEL." },
      { status: 400 }
    );
  }

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.pestAnalysisId": FieldValue.delete(),
    "phases.exploracion.pestProjectId": FieldValue.delete(),
    "phases.exploracion.mapaPESTEL": FieldValue.delete(),
    "phases.exploracion.fuentesConsultadas": FieldValue.delete(),
    "phases.exploracion.xpctoSnapshotAtGeneration": FieldValue.delete(),
    // Conserva el pestAnalysisId/pestProjectId anteriores para permitir
    // deshacer ("Vincular de nuevo") sin pasar por el picker.
    ...(pestAnalysisId && { "phases.exploracion.lastUnlinkedPestAnalysisId": pestAnalysisId }),
    ...(pestProjectId && { "phases.exploracion.lastUnlinkedPestProjectId": pestProjectId }),
    // M1 desaparece — M2-M5 aprobados contra él quedan obsoletos, se fuerza
    // re-aprobación. draftDVS NO se borra: si el usuario restaura el vínculo
    // o regenera vía express y la regeneración falla, sigue teniendo su
    // último estado válido visible en vez de pantalla en blanco.
    "phases.exploracion.motorAprobaciones": {},
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Write-back: clear the reverse reference on the PESTEL project if it
  // still points to this Moddulo project (symmetry with link-moddulo).
  if (pestProjectId) {
    const pestelSnap = await adminDb.collection("pestel_projects").doc(pestProjectId).get();
    if (pestelSnap.exists && pestelSnap.data()?.modduloProjectId === projectId) {
      await adminDb.collection("pestel_projects").doc(pestProjectId).update({
        modduloProjectId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
