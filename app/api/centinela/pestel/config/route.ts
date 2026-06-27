// app/api/centinela/pestel/config/route.ts
// GET  /api/centinela/pestel/config        → todos los configs activos del usuario
// POST /api/centinela/pestel/config        → crear nueva config

import {type NextRequest, NextResponse} from "next/server";
import {getSessionFromRequest} from "@/lib/server/auth-helpers";
import {adminDb} from "@/lib/firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({error: "No autorizado"}, {status: 401});
  }

  const snap = await adminDb
    .collection("pestel_configs")
    .where("userId", "==", session.uid)
    .where("isActive", "==", true)
    .get();

  // Ordenar en memoria para evitar requerir índice compuesto en Firestore
  const configs = snap.docs
    .map((doc) => ({id: doc.id, ...doc.data()}))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aTime =
        (a.createdAt as {_seconds?: number})?._seconds ?? 0;
      const bTime =
        (b.createdAt as {_seconds?: number})?._seconds ?? 0;
      return bTime - aTime;
    });

  return NextResponse.json({configs});
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({error: "No autorizado"}, {status: 401});
  }

  const body = (await request.json()) as {
    territorioNombre?: string;
    modo?: string;
  };

  const {territorioNombre, modo} = body;

  if (!territorioNombre || !modo) {
    return NextResponse.json(
      {error: "territorioNombre y modo son requeridos"},
      {status: 400}
    );
  }

  if (modo !== "ciudadano" && modo !== "gubernamental") {
    return NextResponse.json({error: "modo inválido"}, {status: 400});
  }

  const ref = adminDb.collection("pestel_configs").doc();
  await ref.set({
    userId: session.uid,
    territorio: {nombre: territorioNombre, nivel: "nacional"},
    modo,
    isActive: true,
    alertas: {
      vectorRiesgoUmbral: 70,
      notificarEmail: false,
      notificarInApp: true,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({configId: ref.id});
}
