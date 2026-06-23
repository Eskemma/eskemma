// app/api/moddulo/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { createProject, listUserProjects } from "@/lib/moddulo/project";
import type { CreateProjectInput } from "@/types/moddulo.types";

// GET: Listar proyectos del usuario
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");

    const projects = await listUserProjects(session.uid, {
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error al listar proyectos:", error);
    return NextResponse.json({ error: "Error al obtener proyectos" }, { status: 500 });
  }
}

// POST: Crear nuevo proyecto
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { type, name, description, color, centinelaProjectId } = body;

    if (!type || !name) {
      return NextResponse.json(
        { error: "type y name son requeridos" },
        { status: 400 }
      );
    }

    const validTypes = ["electoral", "gubernamental", "legislativo", "ciudadano"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Tipo de proyecto inválido" }, { status: 400 });
    }

    const input: CreateProjectInput = {
      type,
      name: name.trim(),
      description,
      color: typeof color === "string" && color.trim() ? color.trim() : "#026988",
      centinelaProjectId: typeof centinelaProjectId === "string" ? centinelaProjectId : undefined,
    };
    const project = await createProject(session.uid, input);

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error al crear proyecto:", error);
    return NextResponse.json({ error: "Error al crear proyecto" }, { status: 500 });
  }
}
