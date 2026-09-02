// app/api/fontana/sesion/[sesionId]/mensajes/route.ts
// GET — historial de chat del agente "Fontana" (T10) para rehidratar el
// panel al abrir. Subcolección append-only
// fontana_sesiones/{sesionId}/mensajes, ordenada por `timestamp`. El
// append lo hace app/api/fontana/chat/route.ts server-side; aquí no hay POST.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { FontanaChatMessage } from "@/types/fontana.types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sesionId } = await context.params;

  const doc = await adminDb.collection("fontana_sesiones").doc(sesionId).get();
  if (!doc.exists || doc.data()?.uid !== session.uid) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const snap = await adminDb
    .collection("fontana_sesiones")
    .doc(sesionId)
    .collection("mensajes")
    .orderBy("timestamp")
    .get();

  const mensajes = snap.docs.map((d) => d.data() as FontanaChatMessage);
  return NextResponse.json({ mensajes }, { status: 200 });
}
