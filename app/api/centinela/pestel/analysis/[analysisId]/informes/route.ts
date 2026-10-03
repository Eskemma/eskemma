// app/api/centinela/pestel/analysis/[analysisId]/informes/route.ts
// POST — crea un informe a partir de un texto que el navegador ya tenía en su
// caché local (antes de 26-10-03 las ediciones solo vivían ahí). Es el único
// camino para no perder lo que un usuario ya tenga en localStorage.
// Queda marcado `origen: "migrado_localstorage"`: no es una generación del
// modelo, así que `contenidoTexto` es ese texto local.

import { type NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { getAnalisisPropio } from "@/lib/centinela/pestel/analisisPropio";
import {
  MAX_CONTENIDO_INFORME,
  REPORT_FORMATS,
  construirInforme,
} from "@/lib/pestel/informesSync";
import {
  esErrorDocumentoLleno,
  evaluarTamanoDocumento,
  reportarTamano,
} from "@/lib/pestel/informesTamano";
import type { ReportFormat } from "@/lib/pestel/reportPrompts";
import type { PestlDimensionConfig } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ analysisId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { analysisId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { formato, contenido } = (body ?? {}) as {
    formato?: unknown;
    contenido?: unknown;
  };
  if (typeof formato !== "string" || !REPORT_FORMATS.includes(formato as ReportFormat)) {
    return NextResponse.json({ error: "formato inválido" }, { status: 400 });
  }
  if (typeof contenido !== "string" || contenido.trim() === "") {
    return NextResponse.json({ error: "contenido inválido" }, { status: 400 });
  }
  if (contenido.length > MAX_CONTENIDO_INFORME) {
    return NextResponse.json({ error: "contenido demasiado largo" }, { status: 413 });
  }

  const propio = await getAnalisisPropio(analysisId, session.uid);
  if (!propio) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }

  const configSnap = await adminDb
    .collection("pestel_variable_configs")
    .doc(propio.analysis.projectId)
    .get();
  const variableConfigs = configSnap.exists
    ? ((configSnap.data()?.dimensions ?? []) as PestlDimensionConfig[])
    : [];

  const informe = construirInforme({
    id: crypto.randomUUID(),
    format: formato as ReportFormat,
    texto: contenido,
    analysis: propio.analysis,
    variableConfigs,
    origen: "migrado_localstorage",
  });

  reportarTamano(
    analysisId,
    evaluarTamanoDocumento(propio.analysis, informe),
    "migrar un informe desde el navegador"
  );
  try {
    await adminDb
      .collection("pestel_analyses")
      .doc(analysisId)
      .update({ informes: FieldValue.arrayUnion(informe) });
  } catch (err) {
    if (esErrorDocumentoLleno(err)) {
      console.error("[informes][limite-1MB] documento lleno, la migración NO se guardó:", analysisId);
      return NextResponse.json({ error: "limite_documento" }, { status: 413 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, informeId: informe.id }, { status: 201 });
}
