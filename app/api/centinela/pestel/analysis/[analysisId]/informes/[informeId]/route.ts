// app/api/centinela/pestel/analysis/[analysisId]/informes/[informeId]/route.ts
// PATCH — guarda la edición del usuario sobre un informe E7 ya generado.
//
// NO es versionado: `contenidoTexto` (la generación) no se toca y
// `contenidoEditado` se SOBRESCRIBE en cada guardado. El historial completo
// de ediciones es del principio 7 (Persistencia), Grupo 2 de la auditoría.
//
// `informes` es un array dentro del documento y Firestore no permite
// actualizar un elemento: se lee y reescribe en transacción, para no pisar un
// informe que generate-report agregue con arrayUnion al mismo tiempo.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { getAnalisisPropio } from "@/lib/centinela/pestel/analisisPropio";
import { MAX_CONTENIDO_INFORME } from "@/lib/pestel/informesSync";
import {
  esErrorDocumentoLleno,
  evaluarTamanoDocumento,
  reportarTamano,
  type EvaluacionTamano,
} from "@/lib/pestel/informesTamano";
import type { InformeGenerado } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ analysisId: string; informeId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId, informeId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const contenido = (body as { contenido?: unknown } | null)?.contenido;
  if (typeof contenido !== "string") {
    return NextResponse.json({ error: "contenido inválido" }, { status: 400 });
  }
  if (contenido.length > MAX_CONTENIDO_INFORME) {
    return NextResponse.json({ error: "contenido demasiado largo" }, { status: 413 });
  }

  const propio = await getAnalisisPropio(analysisId, session.uid);
  if (!propio) {
    return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
  }

  const ref = adminDb.collection("pestel_analyses").doc(analysisId);
  const editadoEn = new Date().toISOString();

  let resultado: { encontrado: boolean; ev?: EvaluacionTamano };
  try {
    resultado = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const datos = (snap.data() ?? {}) as Record<string, unknown>;
      const informes = ((datos.informes ?? []) as InformeGenerado[]).slice();
      const idx = informes.findIndex((i) => i.id === informeId);
      if (idx === -1) return { encontrado: false };
      informes[idx] = {
        ...informes[idx],
        contenidoEditado: contenido,
        editadoEn,
        editadoPor: session.uid,
      };
      tx.update(ref, { informes });
      return { encontrado: true, ev: evaluarTamanoDocumento({ ...datos, informes }) };
    });
  } catch (err) {
    if (esErrorDocumentoLleno(err)) {
      console.error("[informes][limite-1MB] documento lleno, la edición NO se guardó:", analysisId);
      return NextResponse.json({ error: "limite_documento" }, { status: 413 });
    }
    throw err;
  }

  if (!resultado.encontrado) {
    return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
  }
  if (resultado.ev) reportarTamano(analysisId, resultado.ev, "editar un informe");
  return NextResponse.json({ ok: true, editadoEn });
}
