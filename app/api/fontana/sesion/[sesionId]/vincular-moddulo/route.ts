// app/api/fontana/sesion/[sesionId]/vincular-moddulo/route.ts
// POST { modduloProjectId }
// Vincula una FontanaSesion suelta (Escenarios b/c) a un proyecto Moddulo —
// único lugar que escribe fontanaPendiente en el proyecto, usado por Flujo 1
// (justo tras crear el proyecto) y Flujo 2 (al confirmar el picker), mismo
// endpoint para los 2. Mismo patrón de autorización/idempotencia/conflicto
// que /api/centinela/pestel/project/[projectId]/link-moddulo, sin el chequeo
// de tipo/territorio de PESTEL (Fontana no lo exige — el picker de Flujo 2
// ya muestra la advertencia de territorio client-side antes de confirmar).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getProject } from "@/lib/moddulo/project";
import type { FontanaSesion } from "@/types/fontana.types";

interface RouteContext {
  params: Promise<{ sesionId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sesionId } = await context.params;

  let body: { modduloProjectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { modduloProjectId } = body;
  if (!modduloProjectId) {
    return NextResponse.json({ error: "modduloProjectId es requerido" }, { status: 400 });
  }

  // (1) Dueño de la FontanaSesion — primera guarda, sin excepción.
  const sesionRef = adminDb.collection("fontana_sesiones").doc(sesionId);
  const sesionSnap = await sesionRef.get();
  if (!sesionSnap.exists || sesionSnap.data()?.uid !== session.uid) {
    return NextResponse.json({ error: "Sesión de Fontana no encontrada" }, { status: 404 });
  }
  const sesion = sesionSnap.data() as FontanaSesion;

  // (2) Dueño del proyecto Moddulo — segunda guarda, ANTES de cualquier
  // branching de idempotencia/conflicto/éxito (Punto E, verificación en
  // navegador 2026-08-19) — getProject() ya filtra por session.uid
  // internamente. Se carga aquí (no después, como antes) para que
  // currentPhase esté disponible tanto en la respuesta idempotente como
  // en la de éxito, sin una 2ª lectura a Firestore (Punto B).
  const modduloProject = await getProject(modduloProjectId, session.uid);
  if (!modduloProject) {
    return NextResponse.json({ error: "Proyecto Moddulo no encontrado" }, { status: 404 });
  }
  // Punto D — respaldo explícito si currentPhase no viniera poblado
  // (esquema viejo/dato inconsistente): "proposito" es la fase con la
  // que todo proyecto nuevo nace, nunca puede estar "más atrás" que eso.
  const currentPhase = modduloProject.currentPhase ?? "proposito";

  // Solo ahora, con (1) y (2) ya superadas, se decide qué responder.

  // Idempotencia: misma sesión, mismo proyecto — no-op. El cliente SÍ
  // navega en este camino (Punto B) — currentPhase es requerido.
  if (sesion.modduloProjectId === modduloProjectId) {
    return NextResponse.json({ modduloProjectId, currentPhase }, { status: 200 });
  }

  // Conflicto: sesión ya vinculada a OTRO proyecto. El cliente nunca
  // navega en este camino (solo muestra el error) — currentPhase no
  // aplica (Punto B).
  if (sesion.modduloProjectId) {
    return NextResponse.json(
      { error: "sesion_already_linked", message: "Esta sesión de Fontana ya está vinculada a otro proyecto de Moddulo." },
      { status: 409 }
    );
  }

  await adminDb.collection("moddulo_projects").doc(modduloProjectId).update({
    "phases.investigacion.fontanaPendiente": {
      sesionId,
      territorio: sesion.territorio,
      fechaCreacion: new Date().toISOString(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  await sesionRef.update({ modduloProjectId });

  return NextResponse.json({ modduloProjectId, currentPhase }, { status: 200 });
}
