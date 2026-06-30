// app/api/centinela/pestel/project/[projectId]/variables/route.ts
// PUT /api/centinela/pestel/project/[projectId]/variables
// Save or replace the PEST-L variable configuration for a project (E3).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PestlDimensionConfig } from "@/types/pestel.types";
import { DIMENSION_ORDER } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
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

  const body = (await request.json()) as { dimensions: PestlDimensionConfig[] };
  const { dimensions } = body;

  if (!dimensions || !Array.isArray(dimensions) || dimensions.length === 0) {
    return NextResponse.json(
      { error: "dimensions es requerido y debe ser un array" },
      { status: 400 }
    );
  }

  // Validate each dimension has at least 1 variable
  const validCodes = DIMENSION_ORDER;
  for (const dim of dimensions) {
    if (!validCodes.includes(dim.code)) {
      return NextResponse.json(
        { error: `Código de dimensión inválido: ${dim.code}` },
        { status: 400 }
      );
    }
    if (!dim.variables || dim.variables.length === 0) {
      return NextResponse.json(
        { error: `La dimensión ${dim.code} debe tener al menos 1 variable` },
        { status: 400 }
      );
    }
  }

  // Total variable cap: 30
  const totalVars = dimensions.reduce((sum, d) => sum + d.variables.length, 0);
  if (totalVars > 30) {
    return NextResponse.json(
      { error: "El total de variables no puede superar 30" },
      { status: 400 }
    );
  }

  // Upsert variable config document
  const configRef = adminDb
    .collection("pestel_variable_configs")
    .doc(projectId);

  await configRef.set({
    projectId,
    dimensions,
    savedAt: FieldValue.serverTimestamp(),
  });

  // Only advance to E4 if project hasn't started analysis yet
  const currentStage = (projectSnap.data()?.currentStage as number) ?? 0;
  if (currentStage <= 3) {
    await adminDb
      .collection("pestel_projects")
      .doc(projectId)
      .update({ currentStage: 4, updatedAt: FieldValue.serverTimestamp() });
  }

  return NextResponse.json({ ok: true });
}
