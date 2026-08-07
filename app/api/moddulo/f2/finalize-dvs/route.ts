// app/api/moddulo/f2/finalize-dvs/route.ts
// POST { projectId }
// Promueve el draftDVS al dvs final, limpia el borrador y motorAprobaciones.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { DVSF2 } from "@/types/moddulo.types";

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

  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.dvs": dvs,
    "phases.exploracion.estado": "lista",
    "phases.exploracion.draftDVS": FieldValue.delete(),
    "phases.exploracion.motorAprobaciones": FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ dvs }, { status: 200 });
}
