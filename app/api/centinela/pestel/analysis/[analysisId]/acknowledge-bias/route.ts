// app/api/centinela/pestel/analysis/[analysisId]/acknowledge-bias/route.ts
// POST /api/centinela/pestel/analysis/[analysisId]/acknowledge-bias
// Mark a specific bias alert as reviewed by the analyst.
// Body: { biasType: string }

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;

  const analysisSnap = await adminDb
    .collection("pestel_analyses")
    .doc(analysisId)
    .get();

  if (!analysisSnap.exists) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }

  const data = analysisSnap.data()!;

  // Verify ownership via project
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(data.projectId as string)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  let body: { biasType?: string };
  try {
    body = (await request.json()) as { biasType?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { biasType } = body;

  if (!biasType) {
    return NextResponse.json({ error: "biasType es requerido" }, { status: 400 });
  }

  // 7b-3 (H25): las alertas, `updatedAt` y —si procede— el status se escriben con UN solo `update` dentro
  // de UNA transacción que RELEE el análisis (antes: lectura fuera, dos `update` seguidos, y el 2.º
  // `status:"REVIEWED"` se escribía sin mirar el estado actual). Corrige tres cosas: (a) si fallaba el 2.º
  // quedaba la alerta reconocida con el análisis en PENDING_REVIEW; (b) reconocer de nuevo en un análisis
  // APPROVED lo BAJABA a REVIEWED (perdía la aprobación mientras el proyecto seguía en la etapa 7);
  // (c) dos reconocimientos simultáneos se pisaban (lectura-modificación-escritura del arreglo completo).
  // El callback puede reintentarse: lee antes de escribir, sin efectos externos, devuelve un resultado y
  // la respuesta se arma fuera. Re-reconocer una alerta ya reconocida sigue sobrescribiendo fecha y autor.
  const analysisRef = adminDb.collection("pestel_analyses").doc(analysisId);
  type Resultado = "ok" | "analisis_no_encontrado" | "alerta_no_encontrada";
  const resultado = await adminDb.runTransaction(async (tx): Promise<Resultado> => {
    const snap = await tx.get(analysisRef);
    if (!snap.exists) return "analisis_no_encontrado";
    const actual = snap.data()!;
    const biasAlerts = [...((actual.biasAlerts ?? []) as Array<{
      type: string;
      acknowledgedAt?: unknown;
      acknowledgedBy?: string;
    }>)];

    const alertIndex = biasAlerts.findIndex((b) => b.type === biasType);
    if (alertIndex === -1) return "alerta_no_encontrada";

    biasAlerts[alertIndex] = {
      ...biasAlerts[alertIndex],
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: session.uid,
    };

    const updates: Record<string, unknown> = {
      biasAlerts,
      updatedAt: FieldValue.serverTimestamp(),
    };
    // If all bias alerts are acknowledged, set status to REVIEWED — pero solo desde PENDING_REVIEW:
    // nunca baja un análisis APPROVED (ni reescribe uno que ya está REVIEWED).
    if (biasAlerts.every((b) => b.acknowledgedAt) && actual.status === "PENDING_REVIEW") {
      updates.status = "REVIEWED";
    }
    tx.update(analysisRef, updates);
    return "ok";
  });

  if (resultado === "analisis_no_encontrado") {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  if (resultado === "alerta_no_encontrada") {
    return NextResponse.json({ error: "Alerta de sesgo no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
