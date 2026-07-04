// app/api/centinela/pestel/project/[projectId]/route.ts
// GET    — fetch a single project
// PATCH  — update E1-E2 fields + isActive for archive/restore
// DELETE — permanent deletion with cascade across related collections

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

  const body = (await request.json()) as Partial<
    Pick<PESTELProject, "nombre" | "tipo" | "horizonte" | "color"> & {
      territorio: Territorio;
      isActive: boolean;
    }
  >;

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
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  await adminDb.collection("pestel_projects").doc(projectId).update(updates);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const snap = await adminDb.collection("pestel_projects").doc(projectId).get();

  if (!snap.exists || snap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Cascade delete — query each related collection by projectId
  const RELATED_COLLECTIONS = [
    "pestel_variable_configs",
    "pestel_data_sources",
    "pestel_analyses",
    "pestel_jobs",
    "pestel_alerts",
    "pestel_raw_articles",
  ];

  const MAX_OPS = 499;

  for (const col of RELATED_COLLECTIONS) {
    const query = await adminDb.collection(col).where("projectId", "==", projectId).get();
    if (query.empty) continue;

    // Process in batches of MAX_OPS
    for (let i = 0; i < query.docs.length; i += MAX_OPS) {
      const batch = adminDb.batch();
      query.docs.slice(i, i + MAX_OPS).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  // Delete the project document itself
  await adminDb.collection("pestel_projects").doc(projectId).delete();

  return NextResponse.json({ success: true });
}
