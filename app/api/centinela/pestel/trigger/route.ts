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
  buildSefixContext,
  type SefixResultadoNorm,
} from "@/lib/sefix/sefixContext";

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

  // 1. Fetch 4-priority Sefix electoral datasets for the P dimension (best-effort)
  const projectData = projectSnap.data();
  const territorio = projectData?.territorio as
    | { estado?: string; nivel?: string }
    | undefined;
  const tipoProyecto = (projectData?.tipo as string) ?? "ciudadano";
  const estadoNombre = territorio?.estado ?? null;
  const nivelTerritorial = territorio?.nivel ?? "estatal";

  let sefixData: {
    resultadosList: SefixResultadoNorm[];
    padron: unknown;
  } | null = null;

  const sefixContext = await buildSefixContext({
    tipoProyecto,
    estadoNombre,
    nivelTerritorial,
  }).catch((e) => {
    console.warn("[trigger] buildSefixContext failed:", e);
    return null;
  });

  if (sefixContext) {
    sefixData = sefixContext;
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
