// app/api/moddulo/projects/papelera/route.ts
// Papelera de proyectos de Moddulo — fase (b). Ruta separada (no un query param
// sobre GET /projects) a propósito, mismo criterio que listProyectosPapelera
// es una función separada de listUserProjects — nunca se confunden.
// Solo devuelve los proyectos donde el usuario pedido es OWNER (pedido
// explícito de Raúl: un colaborador no-owner no ve la papelera del dueño).
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { listProyectosPapelera } from "@/lib/moddulo/project";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const proyectos = await listProyectosPapelera(session.uid);
    // listProyectosPapelera ya filtra por userId === session.uid (dueño), no
    // por colaborador — así que todo lo que devuelve ya es del dueño.
    return NextResponse.json({ projects: proyectos });
  } catch (error) {
    console.error("Error al listar papelera:", error);
    return NextResponse.json({ error: "Error al obtener la papelera" }, { status: 500 });
  }
}
