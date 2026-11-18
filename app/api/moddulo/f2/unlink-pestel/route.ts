// app/api/moddulo/f2/unlink-pestel/route.ts
// POST { projectId, confirmar?, huella? }
// H15 (paso 4): the confirmation is ALWAYS required (409 reemplazo_requiere_confirmacion with the real lines
// and the fingerprint to confirm against); 409 fase_cerrada when F2 is closed. On success it discards the
// motors draft, the motor approvals and the M1 record together with the link.
//
// C1b-2 — HISTORIAL: unlinking an M1 (or the remains of one: payload, `m1`, motors draft or motor approvals) leaves
// versions of `f2M1` in `lib/versionado/` in the SAME transaction: the PREVIOUS state (first time only) and a NEW one
// «without M1» (`contenido {kind: null, mapa: null, ediciones: {}}`, `aprobacion {aprobado: false, por, en}`), kind
// `ajuste_manual`, motivo `desvinculacion`. ONE instant per operation: `lastUnlinkedLinkedSource.desvinculadoEn` is
// `Timestamp.fromDate(instante)` and the version carries its ISO. The event names what is discarded (`detalle`, only
// booleans, numbers and motor names); the CONTENT of the motors draft and the generation/finalization marks is NOT
// versioned (H-V28). The pointer `phases.exploracion.revision` is KEPT (the history of `f2M1` continues after a
// relink). The pending-link branch discards nothing and writes no history. All reads (project, PESTEL back-link,
// history manifest) happen before the first write; a history failure aborts everything (the link, the M1 and the
// back-link stay as they were) and answers `{error: "historial_no_confirmado", causa}`.
// Desvincula explícitamente un proyecto Moddulo de su análisis de Centinela
// PESTEL. Limpia los punteros y el M1 asociado, dejando F2 listo para
// regenerar vía el flujo express. Contraparte deliberada del guard 409 en
// generate-m1-express/route.ts: sin esta acción, un proyecto vinculado a
// Centinela nunca podría volver a usar express.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { analizarM1 } from "@/lib/moddulo/m1Servidor";
import { aplicarVersion, prepararVersion } from "@/lib/versionado/registrar";
import {
  AMBITO_F2, FASE_F2, NOMBRE_F2_M1, PUNTERO_F2, detalleDesvinculacion, estadoF2M1, hayAlgoQueVersionarAlDesvincular, vivoF2M1,
} from "@/lib/moddulo/versionado/artefactosF2";
import { respuestaDeErrorHistorial } from "@/lib/moddulo/versionado/respuestaHistorial";
import { exploracionCerrada, respuestaFaseCerrada } from "@/lib/moddulo/faseCerrada";
import { decidirCandadoM1Servidor, respuestaCandadoM1, type DecisionCandadoM1Servidor } from "@/lib/moddulo/candadoM1Servidor";
import { MENSAJE_PENDIENTE_CAMBIO, MENSAJE_PENDIENTE_NO_ENCONTRADO } from "@/lib/moddulo/textosVinculo";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; confirmar?: unknown; huella?: unknown; pestelProjectId?: unknown };
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
    | "pendiente_ok"
    | "pendiente_no_encontrado"
    | "estado_cambio"
    | { candado: Exclude<DecisionCandadoM1Servidor, { accion: "continuar" }> };
  const transaccion = async (tx: Transaction): Promise<ResultadoDesvinculo> => {
    const snap = await tx.get(proyectoRef);
    if (!snap.exists || snap.data()?.deletedAt) return "no_encontrado";
    const exploracion = snap.data()?.phases?.exploracion;
    // F2 closed = read-only (same 409 as the other M1 writers).
    if (exploracionCerrada(exploracion)) return "fase_cerrada";
    const linkedSource = exploracion?.linkedSource;

    // T5 — CANCELAR UN VÍNCULO PENDIENTE (sin H15: no se pierde ningún análisis de F2). Aplica cuando el cuerpo trae
    // `pestelProjectId` y el Moddulo NO tiene un análisis de Centinela importado:
    //  · (b) forma nueva: solo el back-link `pestel_projects.modduloProjectId`;
    //  · (a) forma antigua: un `linkedSource` T22 con `sourceId` pero sin `sourceAnalysisId` (la ventana N6, o
    //    `createProject` sin análisis).
    // El id del cuerpo NUNCA se confía por sí solo: el back-link solo se borra si el PESTEL es del usuario y apunta
    // a ESTE Moddulo; el `linkedSource` solo se limpia si es la forma (a) y su `sourceId` es ese mismo id. Dentro de
    // la transacción también se verifica que el usuario sea colaborador del Moddulo (mismo criterio de `getProject`,
    // el de las demás rutas de F2).
    const pestelIdCuerpo = typeof body.pestelProjectId === "string" && body.pestelProjectId.trim() ? body.pestelProjectId.trim() : null;
    const importado = linkedSource?.kind === "T22" && !!linkedSource.sourceAnalysisId;
    if (pestelIdCuerpo) {
      if (!snap.data()?.collaborators?.some((c: { uid?: string }) => c.uid === session.uid)) return "no_encontrado";
      if (importado) return "estado_cambio";
      const pestelRef = adminDb.collection("pestel_projects").doc(pestelIdCuerpo);
      const pestelSnap = await tx.get(pestelRef);
      const backlinkValido = pestelSnap.exists && pestelSnap.data()?.userId === session.uid && pestelSnap.data()?.modduloProjectId === projectId;
      const formaAntigua = linkedSource?.kind === "T22" && linkedSource.sourceId === pestelIdCuerpo;
      if (!backlinkValido && !formaAntigua) return "pendiente_no_encontrado";
      if (backlinkValido) {
        tx.update(pestelRef, { modduloProjectId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
      }
      if (formaAntigua) {
        const conMapa = !!linkedSource.payload && typeof linkedSource.payload === "object" && Object.keys(linkedSource.payload).length > 0;
        if (conMapa) {
          // Mezcla de la ventana N6 sobre un express: se devuelve su forma original (el mapa no se toca).
          tx.update(proyectoRef, {
            "phases.exploracion.linkedSource.kind": "express",
            "phases.exploracion.linkedSource.componente": "moddulo",
            "phases.exploracion.linkedSource.sourceId": projectId,
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(proyectoRef, { "phases.exploracion.linkedSource": FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
        }
      }
      return "pendiente_ok";
    }

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

    // ONE instant for the live document and for the version (H-V25). Every read (project, PESTEL back-link above,
    // history manifest in `prepararVersion`) happens BEFORE the first write below.
    const instante = new Date();
    let updatesRaiz: Record<string, unknown> = {};
    if (hayAlgoQueVersionarAlDesvincular(exploracion)) {
      const a = analizarM1(exploracion);
      const expDespues = { ...exploracion, linkedSource: undefined, m1: undefined };
      const plan = await prepararVersion(tx, {
        raiz: proyectoRef,
        datosRaiz: snap.data() as Record<string, unknown> | undefined,
        punteroCampo: PUNTERO_F2,
        ambito: AMBITO_F2,
        fase: FASE_F2,
        tipoCambio: "ajuste_manual",
        por: session.uid,
        fuente: "usuario",
        // Internal code (not screen text); C4 tells this version apart by it and by `kind: null`.
        motivo: "desvinculacion",
        detalle: detalleDesvinculacion({
          aprobacion: exploracion?.m1?.aprobacion ?? null,
          motoresAprobados: a.impacto.motoresAprobados,
          hayBorrador: !!exploracion?.draftDVS,
          hayReporteF2: !!exploracion?.dvs,
        }),
        artefactos: [{
          artefacto: NOMBRE_F2_M1,
          ...estadoF2M1(expDespues, { aprobado: false, por: session.uid, en: instante.toISOString() }),
          vivo: vivoF2M1(expDespues),
          estadoPrevio: estadoF2M1(exploracion),
          vivoPrevio: vivoF2M1(exploracion),
        }],
      });
      updatesRaiz = aplicarVersion(tx, plan).updatesRaiz;
    }

    tx.update(proyectoRef, {
      "phases.exploracion.linkedSource": FieldValue.delete(),
      "phases.exploracion.fuentesConsultadas": FieldValue.delete(),
      "phases.exploracion.xpctoSnapshotAtGeneration": FieldValue.delete(),
      // Conserva el vínculo anterior completo para permitir deshacer ("Vincular de nuevo") sin pasar por el picker,
      // más el instante de la desvinculación (campo aditivo; el único lector usa `.sourceAnalysisId`).
      "phases.exploracion.lastUnlinkedLinkedSource": { ...linkedSource, desvinculadoEn: Timestamp.fromDate(instante) },
      // The M1 goes away and so does everything made against it: the motors draft, the motor approvals and
      // the M1 record itself (approval, edits, generation mark). The finalized Reporte F2 (`dvs`) stays.
      "phases.exploracion.motorAprobaciones": {},
      "phases.exploracion.draftDVS": FieldValue.delete(),
      "phases.exploracion.m1": FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
      ...updatesRaiz,
    });
    if (pestelRef && pestelApuntaAqui) {
      tx.update(pestelRef, {
        modduloProjectId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return "ok";
  };
  let resultado: ResultadoDesvinculo;
  try {
    resultado = await adminDb.runTransaction(transaccion);
  } catch (err) {
    const respuesta = respuestaDeErrorHistorial(err, { projectId, fase: FASE_F2, ruta: "unlink-pestel" });
    if (respuesta) return respuesta;
    throw err;
  }

  if (typeof resultado === "object") return respuestaCandadoM1(resultado.candado);
  if (resultado === "fase_cerrada") return respuestaFaseCerrada();
  if (resultado === "pendiente_ok") return NextResponse.json({ ok: true, pendienteCancelado: true }, { status: 200 });
  if (resultado === "pendiente_no_encontrado") {
    return NextResponse.json({ error: "pendiente_no_encontrado", message: MENSAJE_PENDIENTE_NO_ENCONTRADO }, { status: 400 });
  }
  if (resultado === "estado_cambio") {
    return NextResponse.json({ error: "estado_cambio", message: MENSAJE_PENDIENTE_CAMBIO }, { status: 409 });
  }
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
