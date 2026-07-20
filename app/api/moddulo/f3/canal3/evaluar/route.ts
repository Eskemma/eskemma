// app/api/moddulo/f3/canal3/evaluar/route.ts
// POST { projectId, metadatosFuente }
// Evalúa compatibilidad de una fuente externa (Canal 3) contra el proyecto,
// SIN escribir nada — el usuario ve la evaluación antes de decidir vincular.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { evaluarCompatibilidad } from "@/lib/moddulo/canal3Evaluation";
import type { MetadatosFuenteExterna } from "@/types/f3.types";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; metadatosFuente?: MetadatosFuenteExterna };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, metadatosFuente } = body;
  if (!projectId || !metadatosFuente) {
    return NextResponse.json(
      { error: "projectId y metadatosFuente son requeridos" },
      { status: 400 }
    );
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const compatibilidad = evaluarCompatibilidad(project, metadatosFuente);
  return NextResponse.json({ compatibilidad }, { status: 200 });
}
