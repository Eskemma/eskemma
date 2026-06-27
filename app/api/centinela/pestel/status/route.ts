// app/api/centinela/pestel/status/route.ts
// GET /api/centinela/pestel/status?jobId=X
// Returns current job status. Used by the client for polling.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId es requerido" }, { status: 400 });
  }

  const jobSnap = await adminDb
    .collection("pestel_jobs")
    .doc(jobId)
    .get();

  if (!jobSnap.exists) {
    return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
  }

  const job = jobSnap.data()!;

  if (job.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  return NextResponse.json({
    status: job.status as string,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    // V2 field
    analysisId: job.analysisId ?? null,
    // Legacy field — kept for backward compat with existing feeds
    feedId: job.feedId ?? null,
    error: job.error ?? null,
  });
}
