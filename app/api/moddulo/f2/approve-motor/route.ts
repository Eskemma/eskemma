// app/api/moddulo/f2/approve-motor/route.ts
// POST { projectId, motor }
// Persiste la aprobación de un motor individual en motorAprobaciones.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { decidirCompuertaM1, respuestaM1NoAprobado } from "@/lib/moddulo/compuertaM1";

type MotorId = "M2" | "M3" | "M4" | "M5";
const VALID_MOTORS: MotorId[] = ["M2", "M3", "M4", "M5"];

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; motor?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, motor } = body;
  if (!projectId || !motor) {
    return NextResponse.json({ error: "projectId y motor son requeridos" }, { status: 400 });
  }

  if (!VALID_MOTORS.includes(motor as MotorId)) {
    return NextResponse.json({ error: "Motor inválido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // M1 gate (paso 4): the read and the write are one transaction, so an M1 reopened in the gap
  // cannot receive a motor approval.
  const ref = adminDb.collection("moddulo_projects").doc(projectId);
  const bloqueo = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.deletedAt) return "no_aprobado" as const;
    const compuerta = decidirCompuertaM1(snap.data()?.phases?.exploracion);
    if (compuerta.accion === "bloquea") return compuerta.motivo;
    tx.update(ref, {
      [`phases.exploracion.motorAprobaciones.${motor}`]: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return null;
  });
  if (bloqueo) return respuestaM1NoAprobado("approve-motor", bloqueo);

  return NextResponse.json({ success: true }, { status: 200 });
}
