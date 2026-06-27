// app/api/centinela/pestel/project/[projectId]/latest-analysis/route.ts
// GET /api/centinela/pestel/project/[projectId]/latest-analysis
// Returns { analysisId, analyzedAt } for the most recent vigente analysis,
// or { analysisId: null } if none exists.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;

  // Verify ownership
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(projectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Fetch all analyses for this project and sort in memory
  // (avoids requiring a composite Firestore index on projectId + analyzedAt)
  const snap = await adminDb
    .collection("pestel_analyses")
    .where("projectId", "==", projectId)
    .get();

  if (snap.empty) {
    return NextResponse.json({ analysisId: null });
  }

  type AnalysisDoc = {
    id: string;
    vigente?: boolean;
    analyzedAt?: { _seconds: number } | string;
  };

  const docs: AnalysisDoc[] = snap.docs.map((d) => ({
    id: d.id,
    vigente: d.data().vigente,
    analyzedAt: d.data().analyzedAt,
  }));

  // Prefer vigente:true; among those take the most recent
  const getSeconds = (doc: AnalysisDoc): number => {
    const v = doc.analyzedAt;
    if (!v) return 0;
    if (typeof v === "object" && "_seconds" in v) return v._seconds;
    return new Date(v as string).getTime() / 1000;
  };

  const vigentes = docs.filter((d) => d.vigente !== false);
  const pool = vigentes.length > 0 ? vigentes : docs;
  pool.sort((a, b) => getSeconds(b) - getSeconds(a));

  const latest = pool[0];
  return NextResponse.json({
    analysisId: latest.id,
    analyzedAt: latest.analyzedAt ?? null,
  });
}
