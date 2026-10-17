// app/api/moddulo/f2/import-pestel/route.ts
// POST { projectId, pestAnalysisId }
// Importa un análisis de Centinela PESTEL al proyecto Moddulo F2.
// Transforma las señales tripartitas al formato MapaPESTEL de F2.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { exploracionCerrada, respuestaFaseCerrada } from "@/lib/moddulo/faseCerrada";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { MapaPESTEL, LinkedSourceRef } from "@/types/moddulo.types";
import { camposNuevoM1 } from "@/lib/moddulo/m1Escritura";
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

  // F2 closed = read-only: nothing is read or written.
  if (exploracionCerrada(project.phases?.exploracion)) return respuestaFaseCerrada();

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
  const existingLinkedSource = project.phases?.exploracion?.linkedSource as LinkedSourceRef<MapaPESTEL> | undefined;
  const existingAnalysisId = existingLinkedSource?.sourceAnalysisId;
  const existingPestProjectId = existingLinkedSource?.sourceId;
  const existingMapa = existingLinkedSource?.payload;
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
      return NextResponse.json({ linkedSource: existingLinkedSource }, { status: 200 });
    }
    // Same linked PESTEL project (renewed analysis), o confirmReplace — fall through to re-sync/overwrite.
  }

  const mapaPESTEL: MapaPESTEL = transformToMapaPESTEL(
    (analysis.dimensions ?? []) as RawDimension[]
  );

  const pestProjectId = analysis.projectId as string;
  const linkedSource: LinkedSourceRef<MapaPESTEL> = {
    kind: "T22",
    componente: "centinela",
    sourceId: pestProjectId,
    sourceAnalysisId: pestAnalysisId,
    payload: mapaPESTEL,
  };

  // Save to Moddulo project. The imported M1 is a NEW M1 in draft (m1Escritura.ts): the user reviews and
  // approves it, M2–M5 are generated from that approval. The motors draft and the motor approvals made
  // against the previous M1 are discarded (since 3b nothing regenerates them automatically, so keeping
  // the old draft only left motors that no longer belong to the M1 on screen). The finalized Reporte F2
  // (`dvs`) is not touched.
  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.linkedSource": linkedSource,
    "phases.exploracion.xpctoSnapshotAtGeneration": JSON.stringify(project.xpcto ?? {}),
    ...camposNuevoM1(FieldValue),
    // Ya no hace falta el puntero de "deshacer desvinculación" — este
    // import (primero, re-sync, o restauración manual) ya es el vínculo vigente.
    "phases.exploracion.lastUnlinkedLinkedSource": FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ linkedSource }, { status: 200 });
}
