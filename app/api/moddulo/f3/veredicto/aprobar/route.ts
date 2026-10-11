// app/api/moddulo/f3/veredicto/aprobar/route.ts
// POST { projectId }
// M4 — el usuario aprueba el veredicto draft ya generado. Ensambla el DIE
// final (snapshot análogo a `dvs` en F2 — ver finalize-dvs/route.ts) y
// marca la fase como "lista".

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { SintesisF3, TareaPIP, VeredictoHEI, DIE } from "@/types/moddulo.types";
import {
  AprobacionVeredictoRechazadaError,
  decidirAprobacionEnTransaccion,
  decidirAprobacionVeredicto,
  estadoF3Desde,
} from "@/lib/moddulo/impactoRegeneracionF3";
import { escribirF3Condicional } from "@/lib/moddulo/escrituraF3Guardada";
import { respuestaAprobacionRechazada } from "@/lib/moddulo/respuestaCandado";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // H25 #6, step 1. The decision and the in-transaction comparison use the RAW
  // document (getProject normalizes the synthesis, so comparing raw against its
  // output would never match); the DIE itself is still assembled from getProject's
  // data, exactly as before (it keeps `numero` in the board and the residual gaps).
  const rawSnap = await adminDb.collection("moddulo_projects").doc(projectId).get();
  const rawInv = ((rawSnap.data() as { phases?: { investigacion?: unknown } } | undefined)?.phases?.investigacion) ?? {};
  const estadoPrevio = estadoF3Desde(rawInv);
  const previa = decidirAprobacionVeredicto(estadoPrevio);
  if (previa.accion === "ya_aprobado") return respuestaAprobacionRechazada("ya_aprobado");

  const veredictoDraft = project.phases?.investigacion?.f3Veredicto as VeredictoHEI | undefined;
  const sintesis = project.phases?.investigacion?.f3Sintesis as SintesisF3 | undefined;
  const tareas = (project.phases?.investigacion?.f3TareasPIP ?? []) as TareaPIP[];

  if (!veredictoDraft || previa.accion === "sin_veredicto") {
    return NextResponse.json({ error: "No hay veredicto generado para aprobar" }, { status: 400 });
  }
  if (!sintesis || previa.accion === "sin_sintesis") {
    return NextResponse.json({ error: "No hay síntesis (M3) generada" }, { status: 400 });
  }

  const veredicto: VeredictoHEI = { ...veredictoDraft, aprobadoPorUsuario: true };
  const die: DIE = {
    sintesisPorDimension: sintesis,
    tableroTareasPIP: tareas,
    veredictoHEI: veredicto,
  };

  // Step 2: ONE conditional write. Authorship / date of the approval (H03, Grupo 2)
  // are two more fields in this same `updates`.
  try {
    await escribirF3Condicional(adminDb, projectId, {
      updates: {
        "phases.investigacion.f3Veredicto": veredicto,
        "phases.investigacion.f3DIE": die,
        "phases.investigacion.estado": "lista",
        updatedAt: FieldValue.serverTimestamp(),
      },
      guardia: (proyecto) => {
        const inv = (proyecto?.phases as { investigacion?: unknown } | undefined)?.investigacion;
        const d = decidirAprobacionEnTransaccion(estadoF3Desde(inv), {
          veredicto: estadoPrevio.veredicto,
          sintesis: estadoPrevio.sintesis,
        });
        if (d.accion === "ya_aprobado" || d.accion === "estado_cambio") throw new AprobacionVeredictoRechazadaError(d);
      },
    });
  } catch (err) {
    if (err instanceof AprobacionVeredictoRechazadaError) return respuestaAprobacionRechazada(err.decision.accion);
    // The commit may or may not have reached the server: do not claim it did not.
    console.error("[veredicto/aprobar] no se pudo confirmar la aprobación:", err);
    return NextResponse.json(
      { error: "reemplazo_escritura_incierta", mensaje: "No se pudo confirmar la aprobación del veredicto. Recarga la página para verificar el estado." },
      { status: 500 }
    );
  }

  return NextResponse.json({ die }, { status: 200 });
}
