// app/api/centinela/pestel/trigger/route.ts
// POST /api/centinela/pestel/trigger
// Body: { projectId: string }
// Creates a job in Firestore and calls the CF without waiting (fire-and-forget).
// Returns { jobId } immediately.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  getResultadosByEstado,
  getPadronByEstado,
} from "@/lib/sefix/storage";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json()) as { projectId?: string };
  const { projectId } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  // Verify the project belongs to the user
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(projectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const functionsUrl = process.env.FIREBASE_FUNCTIONS_URL;
  if (!functionsUrl) {
    return NextResponse.json(
      { error: "FIREBASE_FUNCTIONS_URL no configurado" },
      { status: 500 }
    );
  }

  // 1. Fetch Sefix electoral data for the project territory (best-effort)
  const territorio = projectSnap.data()?.territorio as
    | { estado?: string; nivel?: string }
    | undefined;
  const estadoNombre = territorio?.estado ?? null;
  const isNacional = !estadoNombre || territorio?.nivel === "nacional";

  let sefixData: {
    resultados: unknown;
    padron: unknown;
  } | null = null;

  if (!isNacional && estadoNombre) {
    const [resultados, padron] = await Promise.allSettled([
      getResultadosByEstado(estadoNombre, "diputados"),
      getPadronByEstado(estadoNombre),
    ]);
    sefixData = {
      resultados: resultados.status === "fulfilled" ? resultados.value : null,
      padron: padron.status === "fulfilled" ? padron.value : null,
    };
    console.log(
      `[trigger] Sefix data fetched for ${estadoNombre}: ` +
        `resultados=${resultados.status} padron=${padron.status}`
    );
  }

  // 2. Pre-create job document
  const jobRef = adminDb.collection("pestel_jobs").doc();
  const jobId = jobRef.id;
  await jobRef.set({
    projectId,
    userId: session.uid,
    status: "pending",
    startedAt: FieldValue.serverTimestamp(),
  });

  // 3. Fire-and-forget: CF updates job asynchronously
  const cfUrl = `${functionsUrl}/scrapeAndAnalyze`;
  console.log(`[trigger] Calling CF: ${cfUrl} — jobId: ${jobId}`);

  fetch(cfUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      userId: session.uid,
      jobId,
      sefixData,
    }),
  })
    .then(async (cfRes) => {
      const text = await cfRes.text().catch(() => "(no body)");
      console.log(`[trigger] CF responded ${cfRes.status}: ${text.slice(0, 200)}`);
    })
    .catch((err) => {
      console.error("[trigger] CF call failed:", err);
    });

  // 4. Return immediately
  return NextResponse.json({ jobId });
}
