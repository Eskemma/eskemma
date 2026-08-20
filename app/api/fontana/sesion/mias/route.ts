// app/api/fontana/sesion/mias/route.ts
// GET — lista las sesiones SUELTAS (sin modduloProjectId) del usuario
// autenticado, para el hub de Fontana (Punto 1, verificación en
// navegador 2026-08-19). Mismo criterio que los hubs de PESTEL/Moddulo:
// fetch-todo-por-uid y filtrar en código, sin índice compuesto nuevo en
// Firestore (uid=X AND modduloProjectId=null requeriría uno).
//
// Punto C — autorización explícita: el uid SIEMPRE viene de
// getSessionFromRequest (servidor), nunca de un query param del
// cliente — este endpoint no acepta ni lee ningún uid de la URL.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { FontanaSesion } from "@/types/fontana.types";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const snap = await adminDb.collection("fontana_sesiones").where("uid", "==", session.uid).get();
  const sesiones = snap.docs
    .map((doc) => ({ sesionId: doc.id, ...doc.data() }) as FontanaSesion)
    .filter((s) => !s.modduloProjectId)
    .sort((a, b) => (a.fechaUltimoGuardado < b.fechaUltimoGuardado ? 1 : -1));

  return NextResponse.json({ sesiones }, { status: 200 });
}
