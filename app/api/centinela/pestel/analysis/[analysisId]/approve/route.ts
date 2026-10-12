// app/api/centinela/pestel/analysis/[analysisId]/approve/route.ts
// POST — marks an analysis as APPROVED and advances the project to stage 7 (informes).
// Prerequisites: all bias alerts must be acknowledged.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getAnalisisPropio } from "@/lib/centinela/pestel/analisisPropio";
import type { BiasAlert } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;

  // 7b-3 (H25): propiedad POR PROYECTO (`getAnalisisPropio`, el mismo criterio que `impact-chain`,
  // `acknowledge-bias` e `informes`) en vez de la copia `data.userId` del análisis; 404 igual para
  // inexistente, ajeno o análisis cuyo proyecto ya no existe (antes este último escribía APPROVED y luego
  // lanzaba al actualizar el proyecto). Esta lectura previa solo decide el 404 y obtiene el `projectId`;
  // todo lo demás se decide con la lectura TRANSACCIONAL de abajo.
  const propio = await getAnalisisPropio(analysisId, session.uid);
  if (!propio) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }

  // El análisis APPROVED y el avance del proyecto a la etapa 7 salen en UNA transacción (antes, dos
  // `update` sueltos: si fallaba el 2.º quedaba APPROVED con el proyecto en su etapa anterior). El 422 se
  // evalúa con la lectura transaccional del análisis y antes de cualquier escritura, de modo que una
  // carrera entre reconocer y aprobar se resuelve con el estado vigente. El callback puede reintentarse:
  // lee todo antes de escribir, sin efectos externos, devuelve un resultado y la respuesta se arma fuera.
  // La re-aprobación se deja como estaba: vuelve a escribir y sobrescribe approvedAt/approvedBy.
  const analysisRef = adminDb.collection("pestel_analyses").doc(analysisId);
  const projectId = propio.analysis.projectId;
  const projectRef = adminDb.collection("pestel_projects").doc(projectId);
  type Resultado =
    | { tipo: "ok" }
    | { tipo: "no_encontrado" }
    | { tipo: "sesgos_sin_revisar"; cuantos: number };

  const resultado = await adminDb.runTransaction(async (tx): Promise<Resultado> => {
    const analysisSnap = await tx.get(analysisRef);
    const projectSnap = await tx.get(projectRef);
    if (!analysisSnap.exists || !projectSnap.exists) return { tipo: "no_encontrado" };
    const data = analysisSnap.data()!;
    if (data.projectId !== projectId || projectSnap.data()?.userId !== session.uid) {
      return { tipo: "no_encontrado" };
    }

    // Verify all bias alerts have been acknowledged before approving
    const biasAlerts = (data.biasAlerts ?? []) as BiasAlert[];
    const unacknowledged = biasAlerts.filter((a) => !a.acknowledgedAt);
    if (unacknowledged.length > 0) return { tipo: "sesgos_sin_revisar", cuantos: unacknowledged.length };

    // Mark analysis as APPROVED
    tx.update(analysisRef, {
      status: "APPROVED",
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: session.uid,
    });
    // Advance project stage to 7 (interpretation complete → informes)
    tx.update(projectRef, {
      currentStage: 7,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { tipo: "ok" };
  });

  if (resultado.tipo === "no_encontrado") {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  if (resultado.tipo === "sesgos_sin_revisar") {
    return NextResponse.json(
      {
        error: `Hay ${resultado.cuantos} alerta(s) de sesgo sin revisar. Márcalas como revisadas antes de aprobar.`,
      },
      { status: 422 }
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
