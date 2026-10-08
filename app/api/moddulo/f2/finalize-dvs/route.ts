// app/api/moddulo/f2/finalize-dvs/route.ts
// POST { projectId }
// Promueve el draftDVS al dvs final, limpia el borrador y motorAprobaciones.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { DVSF2 } from "@/types/moddulo.types";
import { reemplazarDVSConVersion } from "@/lib/moddulo/dvsVersiones";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; draftDVS?: DVSF2 };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, draftDVS: clientDraft } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Use client-side draft (which may have edits) or fall back to Firestore-stored draft
  const storedDraft = project.phases?.exploracion?.draftDVS as DVSF2 | undefined;
  const dvs = clientDraft ?? storedDraft;
  if (!dvs) {
    return NextResponse.json({ error: "No hay draftDVS para finalizar" }, { status: 400 });
  }

  // Defensivo: un draft en memoria del cliente puede venir de una pestaña
  // abierta desde antes de que pipItemId existiera (o de una edición manual
  // vía M5Panel de un ítem ya persistido sin el campo) — nunca persistir un
  // PIPItem sin identidad estable. Mismo criterio que normalizePIPItem() en
  // lib/moddulo/project.ts (determinístico, no aleatorio, para que un
  // pipItemId legado siga correlacionando con TareaPIP legado por numero).
  if (Array.isArray(dvs.pip)) {
    dvs.pip = dvs.pip.map((p) => ({ ...p, pipItemId: p.pipItemId ?? `legacy-${p.numero}` }));
  }

  // If a finalized dvs already exists and the new one differs, it is copied to
  // dvsVersiones in the same transaction (a failed copy aborts the overwrite).
  // The first finalization has no previous dvs, so no copy is made.
  try {
    await reemplazarDVSConVersion(adminDb, projectId, {
      nuevoDvs: dvs,
      updates: {
        "phases.exploracion.estado": "lista",
        "phases.exploracion.draftDVS": FieldValue.delete(),
        "phases.exploracion.motorAprobaciones": FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      origen: "finalize-dvs",
      uid: session.uid,
    });
  } catch (err) {
    console.error("[finalize-dvs] no se pudo guardar el análisis (ni su versión anterior):", err);
    return NextResponse.json(
      { error: "No se pudo guardar el análisis; el anterior se conserva sin cambios. Intenta de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ dvs }, { status: 200 });
}
