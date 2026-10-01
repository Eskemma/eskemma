// app/api/moddulo/projects/[projectId]/purge-now/route.ts
// "Eliminar definitivamente ahora" — Papelera de proyectos de Moddulo,
// fase (c), Punto 4. Solo el dueño, solo si el proyecto ya está en
// papelera, y solo tras confirmar escribiendo el nombre exacto del
// proyecto (validado aquí, server-side — nunca solo en el cliente).
// El borrado real vive en la Cloud Function purgeModduloProjectNow
// (functions/ no puede importar lib/); esta ruta es un wrapper delgado
// que autentica al usuario y reenvía la orden con el token de servicio.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProjectPapelera } from "@/lib/moddulo/project";

export const maxDuration = 60;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { projectId } = await params;

  let body: { confirmName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const confirmName = typeof body.confirmName === "string" ? body.confirmName.trim() : "";
  if (!confirmName) {
    return NextResponse.json({ error: "confirmName es requerido" }, { status: 400 });
  }

  // Mismo 404 para ajeno, inexistente o no-en-papelera que restore/route.ts
  // (anti-enumeración) — getProjectPapelera ya colapsa los 3 casos en null.
  const project = await getProjectPapelera(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado o no está en la papelera." }, { status: 404 });
  }

  const collaborator = project.collaborators.find((c) => c.uid === session.uid);
  if (collaborator?.role !== "owner") {
    return NextResponse.json({ error: "Solo el dueño puede eliminar definitivamente el proyecto." }, { status: 403 });
  }

  if (confirmName !== project.name) {
    return NextResponse.json({ error: "El nombre no coincide con el del proyecto." }, { status: 400 });
  }

  const functionsUrl = process.env.FIREBASE_FUNCTIONS_URL;
  const purgeToken = process.env.MODDULO_PURGE_TOKEN;
  if (!functionsUrl || !purgeToken) {
    console.error("[purge-now] FIREBASE_FUNCTIONS_URL o MODDULO_PURGE_TOKEN no configurados");
    return NextResponse.json({ error: "servicio_no_configurado" }, { status: 503 });
  }

  let cfRes: Response;
  try {
    cfRes = await fetch(`${functionsUrl}/purgeModduloProjectNow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-moddulo-purge-token": purgeToken,
      },
      body: JSON.stringify({ projectId, userId: session.uid }),
    });
  } catch (err) {
    console.error("[purge-now] Error de conexión con la Cloud Function:", err);
    return NextResponse.json({ error: "Error de conexión al purgar el proyecto." }, { status: 502 });
  }

  // Lee el cuerpo como texto PRIMERO — la respuesta de error de Cloud Run
  // para una invocación no autenticada (403, ver incidente real del
  // 26-09-30) es texto plano, no JSON; `.json()` directo la perdería por
  // completo detrás de un `.catch(() => ({}))` silencioso.
  const rawBody = await cfRes.text();
  let data: Record<string, unknown> = {};
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    data = {};
  }

  if (!cfRes.ok) {
    console.error(
      `[purge-now] Cloud Function respondió ${cfRes.status}: ${rawBody.slice(0, 500)}`
    );
    return NextResponse.json({ error: data.error ?? "No se pudo purgar el proyecto." }, { status: cfRes.status });
  }

  return NextResponse.json(data);
}
