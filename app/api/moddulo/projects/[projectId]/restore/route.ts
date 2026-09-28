// app/api/moddulo/projects/[projectId]/restore/route.ts
// Papelera de proyectos de Moddulo — fase (b). Restaurar es owner-only,
// simétrico a "eliminar" (mover a papelera): no toca ningún vínculo (PESTEL,
// Fontana, linkedSource), porque deleteProject tampoco los tocó.
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { restoreProjectFromPapelera } from "@/lib/moddulo/project";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { projectId } = await params;
    await restoreProjectFromPapelera(projectId, session.uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al restaurar proyecto";
    // Mismo 404 para ajeno, inexistente o no-en-papelera — getProjectPapelera
    // ya colapsa esos 3 casos en null (anti-enumeración, mismo criterio que
    // getPestelProjectPropio/createProject).
    if (message.includes("no está en la papelera")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("Solo el dueño")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Error al restaurar proyecto:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
