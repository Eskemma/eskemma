// lib/centinela/pestel/analisisPropio.ts
// Lectura de pestel_analyses/{id} con guard de propiedad (Reglas de Oro §3,
// CLAUDE.md): el id llega del cliente y se usa con el Admin SDK, que ignora
// firestore.rules. El análisis es del usuario si el PROYECTO al que pertenece
// es suyo. Devuelve null tanto si no existe como si es ajeno — nunca distingue
// los dos casos (no revela qué ids existen), misma convención que
// getPestelProjectPropio.

import { adminDb } from "@/lib/firebase-admin";
import { getPestelProjectPropio } from "@/lib/centinela/pestel/projectPropio";
import type { PESTELProject, PestlAnalysisV2 } from "@/types/pestel.types";

export interface AnalisisPropio {
  analysis: PestlAnalysisV2 & { id: string };
  project: PESTELProject & { id: string };
}

export async function getAnalisisPropio(
  analysisId: string,
  uid: string
): Promise<AnalisisPropio | null> {
  const snap = await adminDb.collection("pestel_analyses").doc(analysisId).get();
  if (!snap.exists) return null;
  const analysis = { id: snap.id, ...snap.data() } as PestlAnalysisV2 & { id: string };
  if (typeof analysis.projectId !== "string") return null;
  const project = await getPestelProjectPropio(analysis.projectId, uid);
  if (!project) return null;
  return { analysis, project };
}
