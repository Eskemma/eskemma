// app/api/centinela/pestel/project/[projectId]/stage/route.ts
// PATCH — advances the project's currentStage (never decrements).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { stage } = body as { stage?: unknown };
  if (
    typeof stage !== "number" ||
    !Number.isInteger(stage) ||
    stage < 1 ||
    stage > 8
  ) {
    return NextResponse.json(
      { error: "stage debe ser un entero entre 1 y 8" },
      { status: 400 }
    );
  }

  const projectRef = adminDb.collection("pestel_projects").doc(projectId);
  const snap = await projectRef.get();

  if (!snap.exists || snap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const currentStage = snap.data()?.currentStage ?? 1;

  // Only advance, never go back
  if (stage <= currentStage) {
    return NextResponse.json({ ok: true, currentStage }, { status: 200 });
  }

  await projectRef.update({
    currentStage: stage,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, currentStage: stage }, { status: 200 });
}
