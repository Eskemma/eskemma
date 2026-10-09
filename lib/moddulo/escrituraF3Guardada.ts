// lib/moddulo/escrituraF3Guardada.ts
// SERVER-ONLY. Conditional write for the F3 generators (H-M3): inside ONE
// transaction the project document is re-read and the guard decides whether the
// write may still happen (what is about to be generated must still not exist and
// the Reporte F3 must still not exist). If something appeared while Claude was
// generating, the guard throws and NOTHING is written, so two tabs generating at
// once cannot overwrite each other.

import type { Firestore } from "firebase-admin/firestore";

export async function escribirF3Condicional(
  db: Firestore,
  projectId: string,
  opciones: {
    updates: Record<string, unknown>;
    /** Throws (e.g. GeneracionF3RechazadaError) to abort BEFORE any write. */
    guardia: (proyecto: Record<string, unknown> | undefined) => void;
  }
): Promise<void> {
  const ref = db.collection("moddulo_projects").doc(projectId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Proyecto no encontrado");
    opciones.guardia(snap.data() as Record<string, unknown> | undefined);
    tx.update(ref, opciones.updates);
  });
}
