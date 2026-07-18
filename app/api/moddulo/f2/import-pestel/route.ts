// app/api/moddulo/f2/import-pestel/route.ts
// POST { projectId, pestAnalysisId }
// Importa un análisis de Centinela PESTEL al proyecto Moddulo F2.
// Transforma las señales tripartitas al formato MapaPESTEL de F2.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { MapaPESTEL } from "@/types/moddulo.types";
import { transformToMapaPESTEL, type RawDimension } from "@/lib/centinela/pestel/transformToMapaPESTEL";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; pestAnalysisId?: string; confirmReplace?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, pestAnalysisId, confirmReplace } = body;
  if (!projectId || !pestAnalysisId) {
    return NextResponse.json(
      { error: "projectId y pestAnalysisId son requeridos" },
      { status: 400 }
    );
  }

  // Verify Moddulo project ownership
  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Load PESTEL analysis
  const analysisSnap = await adminDb
    .collection("pestel_analyses")
    .doc(pestAnalysisId)
    .get();

  if (!analysisSnap.exists) {
    return NextResponse.json({ error: "Análisis PESTEL no encontrado" }, { status: 404 });
  }

  const analysis = analysisSnap.data()!;

  // Verify PESTEL analysis ownership via its parent project
  const pestelProjectSnap = await adminDb
    .collection("pestel_projects")
    .doc(analysis.projectId as string)
    .get();

  if (!pestelProjectSnap.exists || pestelProjectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos para este análisis PESTEL" }, { status: 403 });
  }

  // Guard: protect against overwriting mapaPESTEL from a genuinely different
  // source (express, or a different Centinela PESTEL project). Compares
  // pestProjectId — not pestAnalysisId — because Centinela can renew the
  // analysis (new pestAnalysisId) for the SAME linked project; that case must
  // re-sync, not be blocked as a conflict.
  //
  // confirmReplace lets an explicit user action (relink or "Analizar con
  // PESTEL" upgrade) bypass this — it's the same forceLink pattern used in
  // link-moddulo/route.ts for territory mismatches. Without it, a different
  // source always 409s: this guard exists specifically to stop SILENT
  // overwrites, not deliberate ones the user confirmed.
  const existingAnalysisId = project.phases?.exploracion?.pestAnalysisId as string | undefined;
  const existingPestProjectId = project.phases?.exploracion?.pestProjectId as string | undefined;
  const existingMapa = project.phases?.exploracion?.mapaPESTEL as MapaPESTEL | undefined;
  const incomingPestProjectId = analysis.projectId as string;

  if (existingMapa) {
    const sameLinkedProject = existingPestProjectId && existingPestProjectId === incomingPestProjectId;

    if (!sameLinkedProject) {
      if (!confirmReplace) {
        return NextResponse.json(
          { error: "conflict", message: "Este proyecto ya tiene un análisis PESTEL importado. Para vincularlo a uno diferente, contacta soporte." },
          { status: 409 }
        );
      }
      // Usuario confirmó el reemplazo explícitamente — continúa abajo y sobrescribe.
    } else if (existingAnalysisId === pestAnalysisId) {
      // Same analysis already imported — return existing data idempotently.
      return NextResponse.json({ pestProjectId: existingPestProjectId, mapaPESTEL: existingMapa }, { status: 200 });
    }
    // Same linked PESTEL project (renewed analysis), o confirmReplace — fall through to re-sync/overwrite.
  }

  const mapaPESTEL: MapaPESTEL = transformToMapaPESTEL(
    (analysis.dimensions ?? []) as RawDimension[]
  );

  const pestProjectId = analysis.projectId as string;

  // Save to Moddulo project. On re-sync (M1 refreshed from a renewed
  // Centinela analysis), M2-M5 fueron aprobados contra el M1 anterior —
  // se limpia motorAprobaciones para forzar re-aprobación, pero NO se borra
  // draftDVS: el cliente regenera automáticamente al detectar el cambio de
  // mapaPESTEL, y si esa regeneración falla, el usuario debe seguir viendo
  // el último draftDVS válido en vez de una pantalla en blanco sin salida.
  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.pestAnalysisId": pestAnalysisId,
    "phases.exploracion.pestProjectId": pestProjectId,
    "phases.exploracion.mapaPESTEL": mapaPESTEL,
    "phases.exploracion.xpctoSnapshotAtGeneration": JSON.stringify(project.xpcto ?? {}),
    "phases.exploracion.motorAprobaciones": {},
    // Ya no hace falta el puntero de "deshacer desvinculación" — este
    // import (primero, re-sync, o restauración manual) ya es el vínculo vigente.
    "phases.exploracion.lastUnlinkedPestAnalysisId": FieldValue.delete(),
    "phases.exploracion.lastUnlinkedPestProjectId": FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ mapaPESTEL, pestProjectId }, { status: 200 });
}
