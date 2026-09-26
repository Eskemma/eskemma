// lib/centinela/pestel/projectPropio.ts
// Punto único de lectura de pestel_projects/{id} con guard de propiedad (Reglas de Oro §3, CLAUDE.md):
// el id llega del cliente y se usa con el Admin SDK, que ignora firestore.rules. Devuelve null tanto si
// el proyecto no existe como si es ajeno — nunca distingue los dos casos (no revela qué ids existen),
// misma convención que `createProject` (PestelProjectNoPropioError → 404).

import { adminDb } from "@/lib/firebase-admin";
import type { PESTELProject } from "@/types/pestel.types";

export async function getPestelProjectPropio(
  projectId: string,
  uid: string
): Promise<(PESTELProject & { id: string }) | null> {
  const snap = await adminDb.collection("pestel_projects").doc(projectId).get();
  if (!snap.exists || snap.data()?.userId !== uid) return null;
  return { id: snap.id, ...snap.data() } as PESTELProject & { id: string };
}
