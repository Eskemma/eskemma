// app/api/centinela/pestel/project/[projectId]/data-sources/route.ts
// GET — returns manual data sources for a project (E4 entries).
// Used in E6 "voces del territorio" panel to show field evidence.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { DimensionCode } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

interface DataSourceDoc {
  id: string;
  content: string;
  dimensionCode: DimensionCode;
  source: string;
  reliabilityLevel: "HIGH" | "MEDIUM" | "LOW";
  capturedAt: { _seconds: number } | string;
  isManual: boolean;
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

  const snapshot = await adminDb
    .collection("pestel_data_sources")
    .where("projectId", "==", projectId)
    .where("isManual", "==", true)
    .get();

  const sources: DataSourceDoc[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<DataSourceDoc, "id">),
  }));

  // Sort in memory by capturedAt descending (avoids composite index requirement)
  sources.sort((a, b) => {
    const tsA =
      typeof a.capturedAt === "object" ? a.capturedAt._seconds : 0;
    const tsB =
      typeof b.capturedAt === "object" ? b.capturedAt._seconds : 0;
    return tsB - tsA;
  });

  return NextResponse.json({ sources }, { status: 200 });
}
