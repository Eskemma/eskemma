// app/api/moddulo/f2/unlink-pestel/route.ts
// POST { projectId, confirmar?, huella? }
// H15 (paso 4): the confirmation is ALWAYS required (409 reemplazo_requiere_confirmacion with the real lines
// and the fingerprint to confirm against); 409 fase_cerrada when F2 is closed. On success it discards the
// motors draft, the motor approvals and the M1 record together with the link.
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
import { exploracionCerrada, respuestaFaseCerrada } from "@/lib/moddulo/faseCerrada";
import { decidirCandadoM1Servidor, respuestaCandadoM1, type DecisionCandadoM1Servidor } from "@/lib/moddulo/candadoM1Servidor";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; confirmar?: unknown; huella?: unknown };
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
  type ResultadoDesvinculo =
    | "ok"
    | "no_encontrado"
    | "no_vinculado"
    | "fase_cerrada"
    | { candado: Exclude<DecisionCandadoM1Servidor, { accion: "continuar" }> };
  const resultado = await adminDb.runTransaction(async (tx): Promise<ResultadoDesvinculo> => {
    const snap = await tx.get(proyectoRef);
    if (!snap.exists || snap.data()?.deletedAt) return "no_encontrado";
    const exploracion = snap.data()?.phases?.exploracion;
    // F2 closed = read-only (same 409 as the other M1 writers).
    if (exploracionCerrada(exploracion)) return "fase_cerrada";
    const linkedSource = exploracion?.linkedSource;
    // kind !== "T22" cubre tanto "sin vínculo" como "vínculo express" — el
    // express no tiene fuente de Centinela que desvincular (su sourceId es
    // el propio ID del proyecto Moddulo, no un pestel_projects real).
    if (!linkedSource || linkedSource.kind !== "T22") return "no_vinculado";

    // H15 lock (paso 4), ALWAYS asked: unlinking removes the M1 and breaks the link on both sides. The
    // lines list what exists; the confirmation is tied to the fingerprint of what the user saw.
    const candado = decidirCandadoM1Servidor(exploracion, "desvincular", {
      confirmar: body.confirmar,
      huella: body.huella,
      siempre: true,
    });
    if (candado.accion !== "continuar") return { candado };

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
      // The M1 goes away and so does everything made against it: the motors draft, the motor approvals and
      // the M1 record itself (approval, edits, generation mark). The finalized Reporte F2 (`dvs`) stays.
      // NOTE for the reopening round: the record of the approval is lost with the M1.
      "phases.exploracion.motorAprobaciones": {},
      "phases.exploracion.draftDVS": FieldValue.delete(),
      "phases.exploracion.m1": FieldValue.delete(),
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

  if (typeof resultado === "object") return respuestaCandadoM1(resultado.candado);
  if (resultado === "fase_cerrada") return respuestaFaseCerrada();
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
