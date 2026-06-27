// app/api/centinela/pestel/project/[projectId]/variable-configs/route.ts
// GET — returns the PEST-L variable configuration for a project (E3).
// Used in E7 to build the weighted scorecard.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { PestlDimensionConfig } from "@/types/pestel.types";

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
    return NextResponse.json(
      { error: "Proyecto no encontrado" },
      { status: 404 }
    );
  }

  // pestel_variable_configs uses projectId as document ID
  const configSnap = await adminDb
    .collection("pestel_variable_configs")
    .doc(projectId)
    .get();

  if (!configSnap.exists) {
    return NextResponse.json({ configs: [] }, { status: 200 });
  }

  const data = configSnap.data()!;
  const configs = (data.dimensions ?? []) as PestlDimensionConfig[];

  return NextResponse.json({ configs }, { status: 200 });
}
