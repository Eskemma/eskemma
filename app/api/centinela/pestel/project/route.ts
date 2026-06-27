// app/api/centinela/pestel/project/route.ts
// GET  /api/centinela/pestel/project  — list user's projects
// POST /api/centinela/pestel/project  — create new project (E1-E2)

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PESTELProject } from "@/types/pestel.types";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const snap = await adminDb
    .collection("pestel_projects")
    .where("userId", "==", session.uid)
    .where("isActive", "==", true)
    .get();

  type ProjectDoc = PESTELProject & { id: string };
  const projects: ProjectDoc[] = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as ProjectDoc))
    .sort((a, b) => {
      const aTime = (a.createdAt as { _seconds?: number })?._seconds ?? 0;
      const bTime = (b.createdAt as { _seconds?: number })?._seconds ?? 0;
      return bTime - aTime;
    });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<PESTELProject>;
  const { nombre, tipo, territorio, horizonte, alertas } = body;

  if (!nombre || !tipo || !territorio || !horizonte) {
    return NextResponse.json(
      { error: "nombre, tipo, territorio y horizonte son requeridos" },
      { status: 400 }
    );
  }

  const validTypes = ["electoral", "gubernamental", "legislativo", "ciudadano"];
  if (!validTypes.includes(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  const projectRef = adminDb.collection("pestel_projects").doc();
  const now = FieldValue.serverTimestamp();

  await projectRef.set({
    userId: session.uid,
    nombre,
    tipo,
    territorio,
    horizonte,
    isActive: true,
    autoMonitorEnabled: false,
    alertas: alertas ?? {
      vectorRiesgoUmbral: 70,
      notificarEmail: false,
      notificarInApp: true,
    },
    currentStage: 3, // ready to configure variables
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ projectId: projectRef.id }, { status: 201 });
}
