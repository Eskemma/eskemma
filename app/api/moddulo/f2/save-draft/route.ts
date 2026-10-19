// app/api/moddulo/f2/save-draft/route.ts
// POST { projectId, draftDVS }
// Persiste el draftDVS actual sin finalizar (usado por re-edición de motores).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { decidirCompuertaM1, respuestaM1NoAprobado } from "@/lib/moddulo/compuertaM1";
import type { DVSF2 } from "@/types/moddulo.types";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; draftDVS?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, draftDVS } = body;
  if (!projectId || !draftDVS) {
    return NextResponse.json(
      { error: "projectId y draftDVS son requeridos" },
      { status: 400 }
    );
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // M1 gate (paso 4): the read and the write are one transaction, so an M1 reopened in the gap
  // cannot receive a motors draft.
  const ref = adminDb.collection("moddulo_projects").doc(projectId);
  const bloqueo = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.deletedAt) return "no_aprobado" as const;
    const compuerta = decidirCompuertaM1(snap.data()?.phases?.exploracion);
    if (compuerta.accion === "bloquea") return compuerta.motivo;
    tx.update(ref, { "phases.exploracion.draftDVS": draftDVS as DVSF2, updatedAt: FieldValue.serverTimestamp() });
    return null;
  });
  if (bloqueo) return respuestaM1NoAprobado("save-draft", bloqueo);

  return NextResponse.json({ success: true }, { status: 200 });
}
