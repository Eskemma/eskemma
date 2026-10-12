// app/api/moddulo/f2/unlink-pestel/route.ts
// POST { projectId }
// Desvincula explícitamente un proyecto Moddulo de su análisis de Centinela
// PESTEL. Limpia los punteros y el M1 asociado, dejando F2 listo para
// regenerar vía el flujo express. Contraparte deliberada del guard 409 en
// generate-m1-express/route.ts: sin esta acción, un proyecto vinculado a
// Centinela nunca podría volver a usar express.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // 7b-2 (H25): el Moddulo y el back-link de PESTEL se limpian en UNA transacción (antes, dos
  // escrituras sueltas: si fallaba la segunda quedaba un back-link colgante que luego bloqueaba, con
  // 409, volver a vincular ese análisis). El callback puede reintentarse: lee todo antes de escribir,
  // no tiene efectos externos y devuelve un resultado; la respuesta HTTP se arma fuera. Se RELEE el
  // vínculo dentro (la lectura previa de `getProject` es solo de acceso): dos desvinculaciones
  // simultáneas dejan a la segunda en `not_linked`.
  const proyectoRef = adminDb.collection("moddulo_projects").doc(projectId);
  type ResultadoDesvinculo = "ok" | "no_encontrado" | "no_vinculado";
  const resultado = await adminDb.runTransaction(async (tx): Promise<ResultadoDesvinculo> => {
    const snap = await tx.get(proyectoRef);
    if (!snap.exists) return "no_encontrado";
    const linkedSource = snap.data()?.phases?.exploracion?.linkedSource;
    // kind !== "T22" cubre tanto "sin vínculo" como "vínculo express" — el
    // express no tiene fuente de Centinela que desvincular (su sourceId es
    // el propio ID del proyecto Moddulo, no un pestel_projects real).
    if (!linkedSource || linkedSource.kind !== "T22") return "no_vinculado";

    // Write-back: clear the reverse reference on the PESTEL project if it
    // still points to this Moddulo project (symmetry with link-moddulo).
    const pestProjectId = linkedSource.sourceId as string | undefined;
    const pestelRef = pestProjectId ? adminDb.collection("pestel_projects").doc(pestProjectId) : null;
    const pestelSnap = pestelRef ? await tx.get(pestelRef) : null;
    const pestelApuntaAqui = !!pestelSnap?.exists && pestelSnap.data()?.modduloProjectId === projectId;

    tx.update(proyectoRef, {
      "phases.exploracion.linkedSource": FieldValue.delete(),
      "phases.exploracion.fuentesConsultadas": FieldValue.delete(),
      "phases.exploracion.xpctoSnapshotAtGeneration": FieldValue.delete(),
      // Conserva el vínculo anterior completo para permitir deshacer
      // ("Vincular de nuevo") sin pasar por el picker.
      "phases.exploracion.lastUnlinkedLinkedSource": linkedSource,
      // M1 desaparece — M2-M5 aprobados contra él quedan obsoletos, se fuerza
      // re-aprobación. draftDVS NO se borra: si el usuario restaura el vínculo
      // o regenera vía express y la regeneración falla, sigue teniendo su
      // último estado válido visible en vez de pantalla en blanco.
      "phases.exploracion.motorAprobaciones": {},
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (pestelRef && pestelApuntaAqui) {
      tx.update(pestelRef, {
        modduloProjectId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return "ok";
  });

  if (resultado === "no_encontrado") {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (resultado === "no_vinculado") {
    return NextResponse.json(
      { error: "not_linked", message: "Este proyecto no está vinculado a ningún análisis de Centinela PESTEL." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
