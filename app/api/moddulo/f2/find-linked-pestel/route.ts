// app/api/moddulo/f2/find-linked-pestel/route.ts
// GET ?moddulo_project_id=X  — find pestel_projects by modduloProjectId (fallback path)
// GET ?pestel_project_id=Y   — fetch fresh currentStage by direct ID (happy path)

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { getProject } from "@/lib/moddulo/project";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const modduloProjectId = searchParams.get("moddulo_project_id");
  const pestelProjectId = searchParams.get("pestel_project_id");

  // Mode 2: direct lookup by pestel_project_id to get fresh currentStage
  if (pestelProjectId) {
    const doc = await adminDb
      .collection("pestel_projects")
      .doc(pestelProjectId)
      .get();
    if (!doc.exists || doc.data()?.userId !== session.uid) {
      return NextResponse.json({ found: false });
    }
    return NextResponse.json({
      found: true,
      sourceId: doc.id,
      currentStage: doc.data()?.currentStage ?? 3,
    });
  }

  // Mode 1: query by modduloProjectId — fallback + repair
  if (modduloProjectId) {
    const snap = await adminDb
      .collection("pestel_projects")
      .where("modduloProjectId", "==", modduloProjectId)
      .where("userId", "==", session.uid)
      .get();

    if (snap.empty) {
      return NextResponse.json({ found: false });
    }

    // Sort in memory: most recent first (handles duplicate edge case without
    // requiring a composite index)
    const doc = snap.docs.sort((a, b) => {
      const aTime = (a.data().createdAt as Timestamp)?.seconds ?? 0;
      const bTime = (b.data().createdAt as Timestamp)?.seconds ?? 0;
      return bTime - aTime;
    })[0];

    // Repair (7b-6b, H25). Sigue siendo un GET con efecto de escritura y el fallo sigue siendo no
    // fatal (un solo write: no hay medio estado), pero ahora REVALIDA en una transacción antes de
    // escribir. Antes, un `update` suelto con la lectura de la consulta: (a) resucitaba un vínculo que
    // `unlink-pestel` acababa de quitar (la consulta veía el back-link, el unlink borraba ambos lados
    // y el repair escribía después); (b) pisaba un sourceId distinto o convertía un vínculo `express`
    // en T22; (c) escribía y bumpeaba updatedAt aunque ya estuviera bien.
    // Regla (la más conservadora): se escribe SOLO si el Moddulo existe, no está en papelera y el
    // usuario colabora; el PESTEL sigue siendo suyo y sigue apuntando a ESTE Moddulo; y el
    // linkedSource está ausente, o es de kind vacío/T22 SIN sourceId. Cualquier sourceId presente
    // (igual o distinto, de cualquier kind) o un kind distinto de T22 → cero escrituras.
    // getProject queda solo como acceso (404 del proyecto = sin repair, como antes).
    const modduloProject = await getProject(modduloProjectId, session.uid);
    if (modduloProject) {
      const modduloRef = adminDb.collection("moddulo_projects").doc(modduloProjectId);
      const pestelRef = adminDb.collection("pestel_projects").doc(doc.id);
      try {
        await adminDb.runTransaction(async (tx): Promise<void> => {
          const modSnap = await tx.get(modduloRef);
          const pesSnap = await tx.get(pestelRef);
          if (!modSnap.exists || !pesSnap.exists) return;
          const mod = modSnap.data() as {
            deletedAt?: unknown;
            collaborators?: Array<{ uid?: string }>;
            phases?: { exploracion?: { linkedSource?: { sourceId?: string; kind?: string } } };
          };
          const pes = pesSnap.data() as { userId?: string; modduloProjectId?: string };
          if (mod.deletedAt || !mod.collaborators?.some((c) => c.uid === session.uid)) return;
          if (pes.userId !== session.uid || pes.modduloProjectId !== modduloProjectId) return;
          const ls = mod.phases?.exploracion?.linkedSource;
          if (ls?.sourceId) return;
          if (ls?.kind && ls.kind !== "T22") return;
          tx.update(modduloRef, {
            "phases.exploracion.linkedSource.sourceId": doc.id,
            "phases.exploracion.linkedSource.kind": "T22",
            "phases.exploracion.linkedSource.componente": "centinela",
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      } catch (err) {
        // Non-fatal: still return the found project to the client. Etiqueta fija para medir en los
        // logs cuándo se puede retirar el repair (como el respaldo por índice de 7a).
        console.warn("[find-linked-pestel][repair] no se pudo completar el vínculo:", err);
      }
    }
    return NextResponse.json({
      found: true,
      sourceId: doc.id,
      currentStage: doc.data().currentStage ?? 3,
    });
  }

  return NextResponse.json(
    { error: "Se requiere moddulo_project_id o pestel_project_id" },
    { status: 400 }
  );
}
