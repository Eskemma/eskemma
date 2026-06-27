// app/api/centinela/pestel/project/[projectId]/data-source/route.ts
// POST /api/centinela/pestel/project/[projectId]/data-source
// Add a manual data entry (E4 — assisted mode).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { DimensionCode, ReliabilityLevel } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
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

  const body = (await request.json()) as {
    content?: string;
    dimensionCode?: DimensionCode;
    source?: string;
    reliabilityLevel?: ReliabilityLevel;
  };

  const { content, dimensionCode, source, reliabilityLevel } = body;

  if (!content || !dimensionCode) {
    return NextResponse.json(
      { error: "content y dimensionCode son requeridos" },
      { status: 400 }
    );
  }

  const validCodes: DimensionCode[] = ["P", "E", "S", "T", "L"];
  if (!validCodes.includes(dimensionCode)) {
    return NextResponse.json(
      { error: "dimensionCode inválido" },
      { status: 400 }
    );
  }

  const validLevels: ReliabilityLevel[] = ["HIGH", "MEDIUM", "LOW"];
  const level: ReliabilityLevel = validLevels.includes(reliabilityLevel as ReliabilityLevel)
    ? (reliabilityLevel as ReliabilityLevel)
    : "MEDIUM";

  const docRef = adminDb.collection("pestel_data_sources").doc();

  await docRef.set({
    projectId,
    userId: session.uid,
    content,
    dimensionCode,
    source: source ?? "Carga manual",
    capturedAt: FieldValue.serverTimestamp(),
    reliabilityLevel: level,
    isManual: true,
  });

  return NextResponse.json({ dataSourceId: docRef.id }, { status: 201 });
}
