// app/api/moddulo/f2/m1-reopen/route.ts
// POST { projectId, confirmar?, huella? }
// Reopens an approved M1 for editing (Express and Centinela alike). H15 enforced on the server:
//   · without confirmation → 409 reemplazo_requiere_confirmacion with the lines computed from the
//     REAL state and the fingerprint to confirm against (nothing written);
//   · a stale fingerprint → 409 reemplazo_huella_vencida (nothing written);
//   · confirmed → deletes ONLY the approval (conservación diferida: the motors draft, its approvals
//     and the generation mark stay, paused until M1 is approved again).
// Idempotent: already reopened → 200 { yaReabierto: true }. 409 m1_no_aprobado when there is
// nothing approved to reopen; 409 fase_cerrada when F2 is closed. Decided inside ONE transaction.
//
// C1b-1 — HISTORIAL: reopening leaves a version of `f2M1` in `lib/versionado/` in the SAME transaction
// (kind `reapertura`, with `aprobacion {aprobado: false, por, en}` as the record). ONE instant per operation:
// `reabiertoEn` of the live document is `Timestamp.fromDate(instante)` and the version carries its ISO. Reopening
// discards nothing (the motors draft stays, paused), so the event carries no `detalle`. A failure of the history
// aborts the whole transaction and answers `{error: "historial_no_confirmado", causa}`; the H15 409
// (`reemplazo_requiere_confirmacion`) shares that status but a different `error` code. Idempotent and 409 paths
// write nothing.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { analizarM1 } from "@/lib/moddulo/m1Servidor";
import { aplicarVersion, prepararVersion } from "@/lib/versionado/registrar";
import {
  AMBITO_F2, FASE_F2, NOMBRE_F2_M1, PUNTERO_F2, estadoF2M1, vivoF2M1,
} from "@/lib/moddulo/versionado/artefactosF2";
import { respuestaDeErrorHistorial } from "@/lib/moddulo/versionado/respuestaHistorial";
import { huellaTexto } from "@/lib/moddulo/m1Huella";
import {
  decidirCandadoM1,
  firmaImpactoM1,
  lineasImpactoM1,
  requiereConfirmacionM1,
} from "@/lib/moddulo/impactoM1";

type Resultado =
  | { t: "no_encontrado" }
  | { t: "m1_no_encontrado" }
  | { t: "fase_cerrada" }
  | { t: "no_aprobado" }
  | { t: "ya_reabierto"; huella: string }
  | { t: "requiere"; lineas: string[]; huellaImpacto: string }
  | { t: "vencida"; lineas: string[]; huellaImpacto: string }
  | { t: "ok"; huella: string };

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { projectId?: unknown; confirmar?: unknown; huella?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { projectId, confirmar, huella } = body;
  if (typeof projectId !== "string" || !projectId) return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });

  const project = await getProject(projectId, session.uid);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const ref = adminDb.collection("moddulo_projects").doc(projectId);
  const transaccion = async (tx: Transaction): Promise<Resultado> => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.deletedAt) return { t: "no_encontrado" };
    const exp = snap.data()?.phases?.exploracion;
    const a = analizarM1(exp);
    if (a.cerrada) return { t: "fase_cerrada" };
    if (!a.payload || !a.huellaPayload) return { t: "m1_no_encontrado" };
    if (a.estado.estado === "reabierto") return { t: "ya_reabierto", huella: a.huellaPayload };
    if (!a.estado.aprobacionValida) return { t: "no_aprobado" };

    const huellaImpacto = huellaTexto(firmaImpactoM1(a.impacto, "reabrir"));
    const decision = decidirCandadoM1({
      requiere: requiereConfirmacionM1(a.impacto, "reabrir"),
      huellaActual: huellaImpacto,
      confirmar: confirmar === true,
      huellaRecibida: typeof huella === "string" ? huella : null,
    });
    const lineas = lineasImpactoM1(a.impacto, "reabrir");
    if (decision === "requiere_confirmacion") return { t: "requiere", lineas, huellaImpacto };
    if (decision === "huella_vencida") return { t: "vencida", lineas, huellaImpacto };

    // ONE instant for the live document and for the version (H-V25).
    const instante = new Date();
    const expDespues = { ...exp, m1: { ...(a.m1 ?? {}), aprobacion: undefined, reabiertoEn: instante, reabiertoPor: session.uid } };
    const plan = await prepararVersion(tx, {
      raiz: ref,
      datosRaiz: snap.data() as Record<string, unknown> | undefined,
      punteroCampo: PUNTERO_F2,
      ambito: AMBITO_F2,
      fase: FASE_F2,
      tipoCambio: "reapertura",
      por: session.uid,
      fuente: "usuario",
      // Internal code (not screen text). Reopening discards nothing: no `detalle`.
      motivo: "reapertura",
      artefactos: [{
        artefacto: NOMBRE_F2_M1,
        ...estadoF2M1(exp, { aprobado: false, por: session.uid, en: instante.toISOString() }),
        vivo: vivoF2M1(expDespues),
        estadoPrevio: estadoF2M1(exp),
        vivoPrevio: vivoF2M1(exp),
      }],
    });
    const versionado = aplicarVersion(tx, plan);
    tx.update(ref, {
      "phases.exploracion.m1.aprobacion": FieldValue.delete(),
      "phases.exploracion.m1.reabiertoEn": Timestamp.fromDate(instante),
      "phases.exploracion.m1.reabiertoPor": session.uid,
      updatedAt: FieldValue.serverTimestamp(),
      ...versionado.updatesRaiz,
    });
    return { t: "ok", huella: a.huellaPayload };
  };
  let r: Resultado;
  try {
    r = await adminDb.runTransaction(transaccion);
  } catch (err) {
    const respuesta = respuestaDeErrorHistorial(err, { projectId, fase: FASE_F2, ruta: "m1-reopen" });
    if (respuesta) return respuesta;
    throw err;
  }

  switch (r.t) {
    case "no_encontrado": return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    case "m1_no_encontrado": return NextResponse.json({ error: "m1_no_encontrado" }, { status: 404 });
    case "fase_cerrada": return NextResponse.json({ error: "fase_cerrada" }, { status: 409 });
    case "no_aprobado": return NextResponse.json({ error: "m1_no_aprobado" }, { status: 409 });
    case "ya_reabierto": return NextResponse.json({ ok: true, yaReabierto: true, huella: r.huella });
    case "requiere":
      return NextResponse.json({ error: "reemplazo_requiere_confirmacion", lineas: r.lineas, huella: r.huellaImpacto }, { status: 409 });
    case "vencida":
      return NextResponse.json({ error: "reemplazo_huella_vencida", lineas: r.lineas, huella: r.huellaImpacto }, { status: 409 });
    case "ok": return NextResponse.json({ ok: true, huella: r.huella });
  }
}
