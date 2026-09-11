// lib/fontana/reporte/reporteJob.ts
// Estado de la generación asíncrona del reporte de sesión. Doc de id fijo
// `fontana_sesiones/{sesionId}/reporte/job` (1:1 con la sesión, cascada de
// borrado, sin índice compuesto). Espejo ligero de pestel_jobs.
//
// Ciclo: crearReporteJob (pending, sobrescribe el doc entero → sin `error`
// stale) → marcarReporteJob("running") → marcarReporteJob("completed") o
// ("failed" + error). El cuerpo del reporte y el puntero `reporteSesion`
// SOLO se escriben al completar con éxito (en generarReporteSesion).

import { adminDb } from "@/lib/firebase-admin";
import type { ReporteSesionJob } from "@/types/fontana.types";

// Un job en `running` más viejo que esto se considera colgado (la función
// serverless murió sin marcar failed) — la ruta puede lanzar uno nuevo.
export const REPORTE_JOB_STALE_MS = 10 * 60 * 1000;

function jobRef(sesionId: string) {
  return adminDb.collection("fontana_sesiones").doc(sesionId).collection("reporte").doc("job");
}

export async function crearReporteJob(sesionId: string): Promise<ReporteSesionJob> {
  const job: ReporteSesionJob = {
    jobId: crypto.randomUUID(),
    status: "pending",
    startedAt: new Date().toISOString(),
  };
  await jobRef(sesionId).set(job); // overwrite completo — sin campos stale
  return job;
}

export async function getReporteJob(sesionId: string): Promise<ReporteSesionJob | null> {
  const snap = await jobRef(sesionId).get();
  return snap.exists ? (snap.data() as ReporteSesionJob) : null;
}

export async function marcarReporteJob(
  sesionId: string,
  patch: Partial<Pick<ReporteSesionJob, "status" | "completedAt" | "error">>
): Promise<void> {
  await jobRef(sesionId).set(patch, { merge: true });
}

/** true si el job cuenta como "en curso" (y no colgado). */
export function jobEnCurso(job: ReporteSesionJob | null): boolean {
  if (!job) return false;
  if (job.status === "pending") return true;
  if (job.status === "running") {
    return Date.now() - Date.parse(job.startedAt) < REPORTE_JOB_STALE_MS;
  }
  return false;
}
