// app/api/centinela/pestel/project/[projectId]/history/route.ts
// GET — returns the analysis history for a project (version, confidence, date).
// Used by E8 HistoryChart.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

interface HistoryEntry {
  id: string;
  version: number;
  globalConfidence: number;
  analyzedAt: string;
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

  // No orderBy to avoid requiring a composite index — sort in memory instead.
  const snap = await adminDb
    .collection("pestel_analyses")
    .where("projectId", "==", projectId)
    .get();

  const history: HistoryEntry[] = snap.docs.map((doc) => {
    const data = doc.data();
    const analyzedAt =
      data.analyzedAt?._seconds
        ? new Date(data.analyzedAt._seconds * 1000).toISOString()
        : typeof data.analyzedAt === "string"
        ? data.analyzedAt
        : new Date().toISOString();

    return {
      id: doc.id,
      version: data.version ?? 1,
      globalConfidence: data.globalConfidence ?? 0,
      analyzedAt,
    };
  });

  history.sort((a, b) => a.version - b.version);

  return NextResponse.json({ history }, { status: 200 });
}
