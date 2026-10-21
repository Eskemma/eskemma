// app/api/moddulo/projects/[projectId]/complete-phase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getProject } from "@/lib/moddulo/project";
import { PHASE_ORDER } from "@/types/moddulo.types";
import type { PhaseId } from "@/types/moddulo.types";
import { planRDAUpdate } from "@/lib/moddulo/rda";
import { analizarM1, type ExploracionParaM1 } from "@/lib/moddulo/m1Servidor";
import { motivoNoCerrarF2 } from "@/lib/moddulo/pantallaM1";

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

    // Idempotent (commit 5): a Fase 2 that is already closed is NOT closed again. completedAt, currentPhase and
    // RDA are never rewritten; the only thing a retry may still complete is `data.aprobadoEn` (the approval
    // date, written in the SAME transaction as the close, so it can only be missing in projects closed before
    // that, or if a past close was partial), and only when it is absent. Present = zero writes. The check runs
    // again inside the transaction (another request may have closed it meanwhile).
    const nextPhaseCerrada = PHASE_ORDER[PHASE_ORDER.indexOf(phaseId) + 1] ?? phaseId;
    if (phaseId === "exploracion" && project.phases?.exploracion?.status === "completed") {
      const ref0 = adminDb.collection("moddulo_projects").doc(projectId);
      const r0 = await adminDb.runTransaction(async (tx): Promise<"no_encontrado" | "ok"> => {
        const snap = await tx.get(ref0);
        if (!snap.exists || snap.data()?.deletedAt) return "no_encontrado";
        const exp = snap.data()?.phases?.exploracion;
        if (exp?.status === "completed" && !exp?.data?.aprobadoEn) {
          tx.update(ref0, {
            "phases.exploracion.data.aprobadoEn": exp.completedAt ?? new Date().toISOString(),
          });
        }
        return "ok";
      });
      if (r0 === "no_encontrado") return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
      return NextResponse.json({ success: true, yaCerrada: true, nextPhase: nextPhaseCerrada });
    }

    // F2 closes only with a FINALIZED Reporte F2 and, when the project has an M1 under review, with that M1
    // APPROVED and the Reporte F2 generated from it (paso 4, H). A project with no `m1` record (created before the review existed) or with no payload
    // is not asked for an approval it can never have: it only needs its Reporte F2. The «Cerrar Fase 2» button is
    // already off in both situations; this is the server saying the same.
    if (phaseId === "exploracion") {
      const exploracion = project.phases?.exploracion as ExploracionParaM1 | undefined;
      const a = analizarM1(exploracion);
      // The same pure decision the «Cerrar Fase 2» button uses. With an approved M1 the finalized Reporte F2 must
      // come from THIS M1 (m1.generacion.huella === m1.aprobacion.huella, i.e. no `motoresSinGenerar`).
      // Only a project WITH an `m1` record is under review: a payload without `m1` that estadoM1 reads as «borrador»
      // (no report, no motors) is a project from before the review existed.
      const estado = a.m1 ? a.estado.estado : a.payload ? "anterior" : "sin_m1";
      const motivo = motivoNoCerrarF2({
        estado,
        hayDvs: !!exploracion?.dvs,
        motoresSinGenerar: a.estado.motoresSinGenerar,
        // The finalized Reporte F2 must come from THIS approval (finalization seal, or the compatibility rule for a
        // `dvs` finalized before the seal). A phase that is already closed never gets here (idempotent path above).
        dvsDeOtroAnalisis: a.estado.dvsDeOtroAnalisis,
      });
      if (motivo) return NextResponse.json({ error: motivo }, { status: 409 });
    }

    const phaseIndex = PHASE_ORDER.indexOf(phaseId);
    const nextPhase = PHASE_ORDER[phaseIndex + 1] ?? phaseId;

    const ahora = new Date().toISOString();
    const updates: Record<string, unknown> = {
      [`phases.${phaseId}.status`]: "completed",
      [`phases.${phaseId}.completedAt`]: ahora,
      currentPhase: nextPhase,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Fase 2: the approval date goes in the same write as the close (key-wise, so pestl/semaforo/hipotesis stay).
    if (phaseId === "exploracion") {
      updates["phases.exploracion.data.aprobadoEn"] = ahora;
    }

    if (reportText) {
      updates[`phases.${phaseId}.reportText`] = reportText;
    }

    if (phaseId === "proposito") {
      updates.fasesCompletadas = FieldValue.arrayUnion(1);
      updates.faseActual = 2;
    }

    // RDA — generación de ítems nuevos + reconciliación automática,
    // barriendo todas las fases con evaluador disponible (no solo la que
    // se está cerrando). Evaluado server-side contra los datos que
    // getProject ya trajo — no se confía en nada calculado por el cliente.
    const { nuevos, resueltos } = planRDAUpdate(project);
    for (const item of nuevos) {
      updates[`rda.${item.id}`] = { ...item, fechaCreacion: FieldValue.serverTimestamp() };
    }
    for (const id of resueltos) {
      updates[`rda.${id}.estado`] = "resuelto";
      updates[`rda.${id}.fechaResolucion`] = FieldValue.serverTimestamp();
      updates[`rda.${id}.resueltoPor`] = "sistema";
    }

    const ref = adminDb.collection("moddulo_projects").doc(projectId);
    const resultado = await adminDb.runTransaction(async (tx): Promise<"ok" | "ya_cerrada" | "no_encontrado"> => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()?.deletedAt) return "no_encontrado";
      if (phaseId === "exploracion" && snap.data()?.phases?.exploracion?.status === "completed") return "ya_cerrada";
      tx.update(ref, updates);
      return "ok";
    });
    if (resultado === "no_encontrado") return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    if (resultado === "ya_cerrada") return NextResponse.json({ success: true, yaCerrada: true, nextPhase });

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
