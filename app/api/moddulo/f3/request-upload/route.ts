// app/api/moddulo/f3/request-upload/route.ts
// POST { projectId, formato, filename }
// Reserva un resultadoId y devuelve el storagePath donde el cliente debe
// subir el archivo directamente (vía uploadMedia(), SDK cliente de Storage
// — mismo patrón que los adjuntos de F2, no URL firmada). No escribe nada
// en Firestore todavía: si el usuario cancela la subida, no hay nada que
// limpiar.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import type { MetadatosCargaManual } from "@/types/f3.types";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; formato?: MetadatosCargaManual["formato"]; filename?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, formato, filename } = body;
  if (!projectId || !formato || !filename) {
    return NextResponse.json(
      { error: "projectId, formato y filename son requeridos" },
      { status: 400 }
    );
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const resultadoId = adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .collection("f3Resultados")
    .doc().id;

  const storagePath = `moddulo/${session.uid}/${projectId}/f3/${resultadoId}/${filename}`;

  return NextResponse.json({ resultadoId, storagePath }, { status: 200 });
}
