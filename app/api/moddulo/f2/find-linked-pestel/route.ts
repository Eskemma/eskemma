// app/api/moddulo/f2/find-linked-pestel/route.ts
// GET ?moddulo_project_id=X  — find pestel_projects by modduloProjectId (fallback path)
// GET ?pestel_project_id=Y   — fetch fresh currentStage by direct ID (happy path)

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const modduloProjectId = searchParams.get("moddulo_project_id");
  const pestelProjectId = searchParams.get("pestel_project_id");

  // Mode 2: direct lookup by pestel_project_id to get fresh currentStage
  if (pestelProjectId) {
    const doc = await adminDb
      .collection("pestel_projects")
      .doc(pestelProjectId)
      .get();
    if (!doc.exists || doc.data()?.userId !== session.uid) {
      return NextResponse.json({ found: false });
    }
    return NextResponse.json({
      found: true,
      sourceId: doc.id,
      currentStage: doc.data()?.currentStage ?? 3,
    });
  }

  // Mode 1: query by modduloProjectId — fallback + repair
  if (modduloProjectId) {
    const snap = await adminDb
      .collection("pestel_projects")
      .where("modduloProjectId", "==", modduloProjectId)
      .where("userId", "==", session.uid)
      .get();

    if (snap.empty) {
      return NextResponse.json({ found: false });
    }

    // Sort in memory: most recent first (handles duplicate edge case without
    // requiring a composite index)
    const doc = snap.docs.sort((a, b) => {
      const aTime = (a.data().createdAt as Timestamp)?.seconds ?? 0;
      const bTime = (b.data().createdAt as Timestamp)?.seconds ?? 0;
      return bTime - aTime;
    })[0];

    // Repair: write sourceId (+ kind/componente, ausentes precisamente
    // porque este es el caso de "el lado Moddulo nunca los tuvo") de vuelta
    // a Moddulo si faltaban.
    try {
      await adminDb
        .collection("moddulo_projects")
        .doc(modduloProjectId)
        .update({
          "phases.exploracion.linkedSource.sourceId": doc.id,
          "phases.exploracion.linkedSource.kind": "T22",
          "phases.exploracion.linkedSource.componente": "centinela",
          updatedAt: FieldValue.serverTimestamp(),
        });
    } catch {
      // Non-fatal: still return the found project to the client
    }

    return NextResponse.json({
      found: true,
      sourceId: doc.id,
      currentStage: doc.data().currentStage ?? 3,
    });
  }

  return NextResponse.json(
    { error: "Se requiere moddulo_project_id o pestel_project_id" },
    { status: 400 }
  );
}
