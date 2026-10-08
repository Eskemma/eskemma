// lib/moddulo/dvsVersiones.ts
// Replaces `phases.exploracion.dvs` while keeping a copy of the previous one in
// `moddulo_projects/{id}/dvsVersiones/{auto}`. The copy and the overwrite happen
// in ONE transaction: if the copy cannot be written, nothing is overwritten.
//
// Parallel mechanism to lib/moddulo/changelog.ts on purpose (H06/H08): the Grupo 2
// versioning round must unify them. No retention cap yet (Grupo 2); measured
// volume: ~24-30 KB per version (10 real finalized dvs).
//
// Authorship: `reemplazadoPor` is the uid of whoever replaced it (any
// collaborator can today: H-M7, untouched here).

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { DVSF2 } from "@/types/moddulo.types";
import { sonIgualesEstable } from "./serializacionEstable";

export type OrigenReemplazoDVS = "generate-dvs-final" | "finalize-dvs";

export interface ReemplazoDVS {
  nuevoDvs: DVSF2;
  /** Extra field updates applied together with the new dvs (estado, updatedAt...). */
  updates: Record<string, unknown>;
  origen: OrigenReemplazoDVS;
  uid: string;
}

/**
 * @returns the id of the saved version, or `null` when no copy was needed (first
 * finalization, or the new dvs is identical to the current one, key order aside).
 */
export async function reemplazarDVSConVersion(
  db: Firestore,
  projectId: string,
  { nuevoDvs, updates, origen, uid }: ReemplazoDVS
): Promise<{ versionId: string | null }> {
  const proyectoRef = db.collection("moddulo_projects").doc(projectId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(proyectoRef);
    if (!snap.exists) throw new Error("Proyecto no encontrado");
    const anterior = (snap.data() as { phases?: { exploracion?: { dvs?: DVSF2 } } } | undefined)
      ?.phases?.exploracion?.dvs;

    let versionId: string | null = null;
    if (anterior && !sonIgualesEstable(anterior, nuevoDvs)) {
      const versionRef = proyectoRef.collection("dvsVersiones").doc();
      // Copy first: a failure here aborts before the overwrite is applied.
      tx.set(versionRef, {
        dvs: anterior,
        reemplazadoEn: FieldValue.serverTimestamp(),
        reemplazadoPor: uid,
        origen,
      });
      versionId = versionRef.id;
    }
    tx.update(proyectoRef, { "phases.exploracion.dvs": nuevoDvs, ...updates });
    return { versionId };
  });
}
