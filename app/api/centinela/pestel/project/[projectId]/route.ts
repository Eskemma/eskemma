// app/api/centinela/pestel/project/[projectId]/route.ts
// GET  — fetch a single project
// PATCH — update E1-E2 fields (nombre, tipo, territorio, horizonte, color)

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PESTELProject, TipoProyecto, Territorio } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const snap = await adminDb.collection("pestel_projects").doc(projectId).get();

  if (!snap.exists || snap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ project: { id: snap.id, ...snap.data() } as PESTELProject & { id: string } });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const snap = await adminDb.collection("pestel_projects").doc(projectId).get();

  if (!snap.exists || snap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<Pick<PESTELProject, "nombre" | "tipo" | "horizonte" | "color"> & { territorio: Territorio }>;

  const VALID_TIPOS: TipoProyecto[] = ["electoral", "gubernamental", "legislativo", "ciudadano"];
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (body.nombre !== undefined) updates.nombre = body.nombre;
  if (body.tipo !== undefined) {
    if (!VALID_TIPOS.includes(body.tipo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }
    updates.tipo = body.tipo;
  }
  if (body.territorio !== undefined) updates.territorio = body.territorio;
  if (body.horizonte !== undefined) updates.horizonte = body.horizonte;
  if (body.color !== undefined) updates.color = body.color;

  await adminDb.collection("pestel_projects").doc(projectId).update(updates);

  return NextResponse.json({ ok: true });
}
