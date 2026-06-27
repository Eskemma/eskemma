// app/api/centinela/pestel/project/[projectId]/previous-analysis/route.ts
// GET — returns the previous analysis (version = current - 1) for comparison
// in the E6 interpretation panel.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { PestlAnalysisV2 } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;

  // Verify project ownership
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(projectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Fetch all analyses for this project, sorted by version descending in memory
  const snapshot = await adminDb
    .collection("pestel_analyses")
    .where("projectId", "==", projectId)
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ analysis: null }, { status: 200 });
  }

  type AnalysisDoc = PestlAnalysisV2 & { id: string };
  const all: AnalysisDoc[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<AnalysisDoc, "id">),
  }));

  // Sort descending by version
  all.sort((a, b) => b.version - a.version);

  // Return the second-latest (index 1), which is the "previous"
  const previous = all[1] ?? null;

  return NextResponse.json({ analysis: previous }, { status: 200 });
}
