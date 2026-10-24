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
import { decidirCandadoM1Servidor, respuestaCandadoM1, type DecisionCandadoM1Servidor } from "@/lib/moddulo/candadoM1Servidor";
import { transformToMapaPESTEL, type RawDimension } from "@/lib/centinela/pestel/transformToMapaPESTEL";
import { aplicarVinculoUnico, prepararVinculoUnico } from "@/lib/centinela/pestel/vinculoUnico";
import { MENSAJE_CONFLICTO_IMPORT } from "@/lib/moddulo/textosVinculo";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; pestAnalysisId?: string; confirmReplace?: boolean; confirmar?: unknown; huella?: unknown };
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

  // ONE confirmation (paso 4): a different source and the H15 lock are asked together. The 409 `conflict`
  // keeps its code and message but now carries the real `lineas` and the `huella` to confirm against; a
  // request with `confirmar` + `huella` is the explicit confirmation (it also satisfies `confirmReplace`).
  const confirmaConHuella = body.confirmar === true && typeof body.huella === "string";
  if (existingMapa) {
    const sameLinkedProject = existingPestProjectId && existingPestProjectId === incomingPestProjectId;

    if (!sameLinkedProject) {
      if (!confirmReplace && !confirmaConHuella) {
        const d = decidirCandadoM1Servidor(project.phases?.exploracion, "vincular", { confirmar: false, huella: null });
        return NextResponse.json(
          {
            error: "conflict",
            message: MENSAJE_CONFLICTO_IMPORT,
            lineas: d.accion === "continuar" ? [] : d.lineas,
            huella: d.accion === "continuar" ? null : d.huella,
          },
          { status: 409 }
        );
      }
      // Usuario confirmó el reemplazo explícitamente — la confirmación con huella se valida abajo.
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
  // H15 lock (paso 4) INSIDE the transaction that writes, against the state read there: replacing an M1
  // that has an approval, edits or motors needs the confirmation tied to the fingerprint the user saw.
  const ref = adminDb.collection("moddulo_projects").doc(projectId);
  type Resultado =
    | "ok"
    | "no_encontrado"
    | "fase_cerrada"
    | "pestel_no_encontrado"
    | "pestel_ya_vinculado"
    | { candado: Exclude<DecisionCandadoM1Servidor, { accion: "continuar" }> };
  const resultado = await adminDb.runTransaction(async (tx): Promise<Resultado> => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.deletedAt) return "no_encontrado";
    const exp = snap.data()?.phases?.exploracion;
    if (exploracionCerrada(exp)) return "fase_cerrada";

    const linkedAhora = exp?.linkedSource as LinkedSourceRef<MapaPESTEL> | undefined;

    // Unicidad del vínculo: el PESTEL es del usuario y no apunta a OTRO Moddulo; el PESTEL (T22) que este
    // Moddulo tenía antes se desliga si todavía lo reclamaba. Lecturas antes de escrituras.
    const pestelAnteriorId = linkedAhora?.kind === "T22" && linkedAhora.sourceId ? linkedAhora.sourceId : null;
    const plan = await prepararVinculoUnico(tx, adminDb, {
      uid: session.uid,
      pestelProjectId: pestProjectId,
      modduloProjectId: projectId,
      pestelAnteriorId,
    });
    if (!plan.ok) return plan.codigo === "pestel_no_encontrado" ? "pestel_no_encontrado" : "pestel_ya_vinculado";

    const d = decidirCandadoM1Servidor(exp, "vincular", { confirmar: body.confirmar, huella: body.huella });
    if (d.accion !== "continuar") return { candado: d };
    tx.update(ref, {
      "phases.exploracion.linkedSource": linkedSource,
      "phases.exploracion.xpctoSnapshotAtGeneration": JSON.stringify(project.xpcto ?? {}),
      ...camposNuevoM1(FieldValue),
      // Ya no hace falta el puntero de "deshacer desvinculación" — este
      // import (primero, re-sync, o restauración manual) ya es el vínculo vigente.
      "phases.exploracion.lastUnlinkedLinkedSource": FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // El back-link del PESTEL en la MISMA transacción (antes no se escribía: tras «Vincular de nuevo» el
    // Moddulo apuntaba a un PESTEL que no lo reconocía).
    aplicarVinculoUnico(tx, adminDb, FieldValue, { pestelProjectId: pestProjectId, modduloProjectId: projectId }, plan);
    return "ok";
  });
  if (resultado === "pestel_no_encontrado") {
    return NextResponse.json({ error: "Sin permisos para este análisis PESTEL" }, { status: 403 });
  }
  if (resultado === "pestel_ya_vinculado") {
    return NextResponse.json(
      { error: "pestel_already_linked", message: "Este proyecto PESTEL ya está vinculado a otro proyecto de Moddulo." },
      { status: 409 }
    );
  }
  if (resultado === "no_encontrado") return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (resultado === "fase_cerrada") return respuestaFaseCerrada();
  if (typeof resultado === "object") return respuestaCandadoM1(resultado.candado);

  return NextResponse.json({ linkedSource }, { status: 200 });
}
