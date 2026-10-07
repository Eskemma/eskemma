// app/api/moddulo/projects/[projectId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import {
  getProject,
  updateProject,
  updatePhaseData,
  marcarFaseIniciada,
  savePhaseReportDraft,
  deleteProject,
} from "@/lib/moddulo/project";
import { ProyectoNoEncontradoError, SinPermisosError } from "@/lib/moddulo/projectErrors";
import {
  PatchInvalidoError,
  esObjetoPlano,
  filtrarRecuperacionXpcto,
  validarPhaseData,
  validarReportDraft,
} from "@/lib/moddulo/projectPatch";
import type { UpdateProjectInput, ModduloProject } from "@/types/moddulo.types";

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
      // H-M5 (26-10-07): las claves salen del extractedData que produjo el MODELO; solo pasan las 8
      // rutas válidas de XPCTO (antes cualquier `xpcto.<lo-que-sea>` se escribía con su ruta).
      const bruto = recoverXpctoFromChatHistory(project);
      let recovered: Record<string, unknown> | null = null;
      if (bruto) {
        const { validas, descartadas } = filtrarRecuperacionXpcto(bruto);
        if (descartadas.length > 0) {
          console.warn(`[projects/GET] claves xpcto descartadas por no ser rutas válidas (${projectId}):`, descartadas);
        }
        recovered = Object.keys(validas).length > 0 ? validas : null;
      }
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
//
// H-M5 (26-10-07): el cuerpo se valida contra una lista blanca (lib/moddulo/projectPatch.ts); lo
// que no está en ella se rechaza con 400 (nunca se ignora en silencio) y la respuesta de error
// NO incluye el contenido enviado, solo el nombre del campo y un motivo fijo.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { projectId } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new PatchInvalidoError("(cuerpo)", "cuerpo_invalido");
    }
    if (!esObjetoPlano(body)) throw new PatchInvalidoError("(cuerpo)", "cuerpo_invalido");

    if (body.phaseData) {
      const fase = validarPhaseData(body.phaseData);
      if (fase.soloIniciar) {
        await marcarFaseIniciada(projectId, session.uid, fase.phaseId);
      } else {
        await updatePhaseData(projectId, session.uid, fase.phaseId, fase.data ?? {});
      }
    } else if (body.reportDraft) {
      // Guardar borrador del reporte sin completar la fase
      const { phaseId, reportText } = validarReportDraft(body.reportDraft);
      await savePhaseReportDraft(projectId, session.uid, phaseId, reportText);
    } else {
      // Actualización de campos del proyecto: la lista blanca vive en updateProject
      await updateProject(projectId, session.uid, body as UpdateProjectInput);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PatchInvalidoError) {
      return NextResponse.json(
        { error: "Solicitud inválida", campo: error.campo, motivo: error.motivo },
        { status: 400 }
      );
    }
    if (error instanceof SinPermisosError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ProyectoNoEncontradoError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error al actualizar proyecto:", error);
    return NextResponse.json({ error: "Error al actualizar proyecto" }, { status: 500 });
  }
}

// DELETE: Mover proyecto a la papelera (soft-delete, 26-09-28 — ver deleteProject).
// La eliminación definitiva es otra ruta, fase (c) del plan de papelera.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { projectId } = await params;
    await deleteProject(projectId, session.uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar proyecto:", error);
    const message = error instanceof Error ? error.message : "Error al eliminar proyecto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
