// app/api/moddulo/projects/[projectId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getProject, updateProject, updatePhaseData, savePhaseReportDraft } from "@/lib/moddulo/project";
import type { UpdateProjectInput, ModduloProject, PhaseId } from "@/types/moddulo.types";

// GET: Obtener proyecto individual
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { projectId } = await params;
    const project = await getProject(projectId, session.uid);

    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Si xpcto está vacío, intentar reconstruirlo desde el chatHistory de cada fase
    // (los mensajes guardados incluyen extractedData con los campos xpcto.*)
    const xpcto = project.xpcto;
    const xpctoIsEmpty = !xpcto?.hito && !xpcto?.sujeto && !xpcto?.justificacion;

    if (xpctoIsEmpty) {
      const recovered = recoverXpctoFromChatHistory(project);
      if (recovered) {
        // Guardar los datos recuperados en Firestore para no tener que reconstruir siempre
        const { adminDb } = await import("@/lib/firebase-admin");
        const { FieldValue } = await import("firebase-admin/firestore");
        await adminDb.collection("moddulo_projects").doc(projectId).update({
          ...recovered,
          updatedAt: FieldValue.serverTimestamp(),
        });
        // Aplicar al proyecto devuelto
        for (const [key, value] of Object.entries(recovered)) {
          const parts = key.split(".");
          if (parts[0] === "xpcto" && parts.length === 2) {
            (project.xpcto as unknown as Record<string, unknown>)[parts[1]] = value;
          } else if (parts[0] === "xpcto" && parts.length === 3) {
            const sub = (project.xpcto as unknown as Record<string, Record<string, unknown>>)[parts[1]];
            if (sub) sub[parts[2]] = value;
          }
        }
        console.log(`[projects/GET] xpcto recuperado desde chatHistory para ${projectId}`);
      }
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error al obtener proyecto:", error);
    return NextResponse.json({ error: "Error al obtener proyecto" }, { status: 500 });
  }
}

// ==========================================
// RECUPERACIÓN DE XPCTO DESDE CHATHISTORY
// Reconstruye los campos xpcto.* acumulando el extractedData de todos los
// mensajes de asistente guardados en phases.proposito.chatHistory
// ==========================================

function recoverXpctoFromChatHistory(project: ModduloProject): Record<string, unknown> | null {
  const chatHistory = project.phases?.proposito?.chatHistory ?? [];
  if (chatHistory.length === 0) return null;

  const merged: Record<string, unknown> = {};
  for (const msg of chatHistory) {
    const ed = (msg as { extractedData?: Record<string, unknown> }).extractedData;
    if (!ed) continue;
    for (const [key, value] of Object.entries(ed)) {
      if (key.startsWith("xpcto.") && value !== "" && value !== null && value !== undefined) {
        merged[key] = value;
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

// PATCH: Actualizar proyecto o datos de una fase
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { projectId } = await params;
    const body = await request.json();

    // Si se envía phaseData, guardar datos de la fase específica
    if (body.phaseData) {
      const { phaseId, data, started } = body.phaseData as {
        phaseId: PhaseId;
        data?: Record<string, unknown>;
        started?: boolean;
      };
      // started: true → marcar la fase como iniciada sin sobreescribir datos
      if (started === true && !data) {
        const proj = await getProject(projectId, session.uid);
        if (!proj) return NextResponse.json({ error: "Proyecto no encontrado o sin acceso." }, { status: 404 });
        await adminDb.collection("moddulo_projects").doc(projectId).update({
          [`phases.${phaseId}.started`]: true,
          [`phases.${phaseId}.status`]: "in-progress",
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        await updatePhaseData(projectId, session.uid, phaseId, data ?? {});
      }
    } else if (body.reportDraft) {
      // Guardar borrador del reporte sin completar la fase
      const { phaseId, reportText } = body.reportDraft as { phaseId: PhaseId; reportText: string };
      await savePhaseReportDraft(projectId, session.uid, phaseId, reportText);
    } else {
      // Actualización de campos del proyecto (xpcto, name, status, etc.)
      const input = body as UpdateProjectInput;
      await updateProject(projectId, session.uid, input);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al actualizar proyecto:", error);
    const message = error instanceof Error ? error.message : "Error al actualizar proyecto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
