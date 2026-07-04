// app/api/moddulo/projects/[projectId]/complete-phase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getProject } from "@/lib/moddulo/project";
import { PHASE_ORDER } from "@/types/moddulo.types";
import type { PhaseId } from "@/types/moddulo.types";

interface CompletePhaseBody {
  phaseId: PhaseId;
  reportText?: string; // markdown generado por Claude
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { projectId } = await params;
    const body: CompletePhaseBody = await request.json();
    const { phaseId, reportText } = body;

    if (!phaseId || !PHASE_ORDER.includes(phaseId)) {
      return NextResponse.json({ error: "phaseId inválido" }, { status: 400 });
    }

    const project = await getProject(projectId, session.uid);
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const collaborator = project.collaborators.find((c) => c.uid === session.uid);
    if (!collaborator || collaborator.role === "analyst" || collaborator.role === "client") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const phaseIndex = PHASE_ORDER.indexOf(phaseId);
    const nextPhase = PHASE_ORDER[phaseIndex + 1] ?? phaseId;

    const updates: Record<string, unknown> = {
      [`phases.${phaseId}.status`]: "completed",
      [`phases.${phaseId}.completedAt`]: new Date().toISOString(),
      currentPhase: nextPhase,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (reportText) {
      updates[`phases.${phaseId}.reportText`] = reportText;
    }

    if (phaseId === "proposito") {
      updates.fasesCompletadas = FieldValue.arrayUnion(1);
      updates.faseActual = 2;
    }

    await adminDb.collection("moddulo_projects").doc(projectId).update(updates);

    // Auto-transition to "completed" when all 9 phases are done
    const updatedPhases = {
      ...(project.phases ?? {}),
      [phaseId]: { ...(project.phases?.[phaseId] ?? {}), status: "completed" },
    };
    const allDone = PHASE_ORDER.every((p) => updatedPhases[p]?.status === "completed");
    if (allDone && project.status !== "completed") {
      await adminDb.collection("moddulo_projects").doc(projectId).update({
        status: "completed",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, nextPhase });
  } catch (error) {
    console.error("[complete-phase] Error:", error);
    return NextResponse.json({ error: "Error al completar la fase" }, { status: 500 });
  }
}
