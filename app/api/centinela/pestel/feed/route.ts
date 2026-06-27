// app/api/centinela/pestel/feed/route.ts
// GET /api/centinela/pestel/feed
// Retorna el feed PEST-L más reciente para el territorio configurado.
// Consumido por Moddulo F2 para inyectar contexto en xpctoContext.

// app/api/centinela/pestel/feed/route.ts
// GET /api/centinela/pestel/feed?configId=X
// Retorna el feed PEST-L vigente para la config dada.
// Consumido por el dashboard de PESTEL y por Moddulo F2.

import {type NextRequest, NextResponse} from "next/server";
import {getSessionFromRequest} from "@/lib/server/auth-helpers";
import {adminDb} from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({error: "No autorizado"}, {status: 401});
  }

  const configId = request.nextUrl.searchParams.get("configId");
  if (!configId) {
    return NextResponse.json({error: "configId es requerido"}, {status: 400});
  }

  // Verificar que la config pertenece al usuario
  const configSnap = await adminDb
    .collection("pestel_configs")
    .doc(configId)
    .get();

  if (!configSnap.exists || configSnap.data()?.userId !== session.uid) {
    return NextResponse.json({error: "Config no encontrada"}, {status: 404});
  }

  const snap = await adminDb
    .collection("pestel_feeds")
    .where("configId", "==", configId)
    .where("vigente", "==", true)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({feed: null});
  }

  const doc = snap.docs[0];
  return NextResponse.json({feed: {id: doc.id, ...doc.data()}});
}
