// app/api/moddulo/f2/m1-approve/route.ts
// POST { projectId, huellaVista }
// Approves the M1 the user is looking at: records who/when/fingerprint and a FROZEN copy of the
// approved map. It does NOT call Claude (generating M2–M5 is a separate step, later commits).
//
// The fingerprint is recomputed on the server inside the transaction; `huellaVista` is only what
// the user's screen showed: if it differs the content changed meanwhile → 409 m1_cambio and nothing
// is written. Idempotent: the same fingerprint already approved → 200 { yaAprobado: true }. If the
// approved content differs from the one the current motors draft was generated from, the draft, the
// motor approvals and the generation mark are discarded in the SAME transaction; if it is identical
// they are kept (conservación diferida). 409 fase_cerrada when F2 is closed.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { contarDimensionesEditadas, totalDimensiones } from "@/lib/moddulo/m1Aprobacion";
import { analizarM1 } from "@/lib/moddulo/m1Servidor";

type Resultado =
  | { t: "no_encontrado" }
  | { t: "m1_no_encontrado" }
  | { t: "fase_cerrada" }
  | { t: "cambio"; huella: string }
  | { t: "ya_aprobado"; huella: string }
  | { t: "ok"; huella: string; categoriasEditadas: number; total: number; motoresDescartados: boolean };

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { projectId?: unknown; huellaVista?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { projectId, huellaVista } = body;
  if (typeof projectId !== "string" || !projectId) return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  if (typeof huellaVista !== "string" || !huellaVista) return NextResponse.json({ error: "huellaVista es requerida" }, { status: 400 });

  const project = await getProject(projectId, session.uid);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const ref = adminDb.collection("moddulo_projects").doc(projectId);
  const r = await adminDb.runTransaction(async (tx): Promise<Resultado> => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.deletedAt) return { t: "no_encontrado" };
    const exp = snap.data()?.phases?.exploracion;
    const a = analizarM1(exp);
    if (a.cerrada) return { t: "fase_cerrada" };
    if (!a.payload || !a.huellaPayload) return { t: "m1_no_encontrado" };

    if (huellaVista !== a.huellaPayload) return { t: "cambio", huella: a.huellaPayload };
    if (a.estado.aprobacionValida) return { t: "ya_aprobado", huella: a.huellaPayload };

    const categoriasEditadas = contarDimensionesEditadas(a.m1?.ediciones, a.payload);
    const total = totalDimensiones(a.payload);
    const updates: Record<string, unknown> = {
      "phases.exploracion.m1.aprobacion": {
        por: session.uid,
        en: FieldValue.serverTimestamp(),
        huella: a.huellaPayload,
        categoriasEditadas,
        total,
        mapa: structuredClone(a.payload), // frozen copy of what was approved
      },
      "phases.exploracion.m1.reabiertoEn": FieldValue.delete(),
      "phases.exploracion.m1.reabiertoPor": FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Conservación diferida: the motors survive only if they were generated from this exact content.
    const generadoDeEste = a.m1?.generacion?.huella === a.huellaPayload;
    const hayRestos = !!exp?.draftDVS || a.impacto.motoresAprobados.length > 0 || !!a.m1?.generacion;
    const descartar = !generadoDeEste && hayRestos;
    if (descartar) {
      updates["phases.exploracion.draftDVS"] = FieldValue.delete();
      updates["phases.exploracion.motorAprobaciones"] = {};
      updates["phases.exploracion.m1.generacion"] = FieldValue.delete();
    }
    tx.update(ref, updates);
    return { t: "ok", huella: a.huellaPayload, categoriasEditadas, total, motoresDescartados: descartar };
  });

  switch (r.t) {
    case "no_encontrado": return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    case "m1_no_encontrado": return NextResponse.json({ error: "m1_no_encontrado" }, { status: 404 });
    case "fase_cerrada": return NextResponse.json({ error: "fase_cerrada" }, { status: 409 });
    case "cambio": return NextResponse.json({ error: "m1_cambio", huella: r.huella }, { status: 409 });
    case "ya_aprobado": return NextResponse.json({ ok: true, yaAprobado: true, huella: r.huella });
    case "ok":
      return NextResponse.json({
        ok: true, huella: r.huella, categoriasEditadas: r.categoriasEditadas, total: r.total,
        motoresDescartados: r.motoresDescartados,
      });
  }
}
