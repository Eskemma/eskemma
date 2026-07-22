// app/api/moddulo/f3/resultados/route.ts
// GET ?projectId=X — lista todos los resultados de F3 (Canal 1/2/3) para
// un proyecto. Usado por M2 (Receptor y validador) para organizar los
// resultados por módulo del PIP.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const snap = await adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .collection("f3Resultados")
    .get();

  const resultados = snap.docs.map((doc) => ({ resultadoId: doc.id, ...doc.data() }));

  return NextResponse.json({ resultados }, { status: 200 });
}
