// app/api/moddulo/f2/import-pestel/route.ts
// POST { projectId, pestAnalysisId }
// Importa un análisis de Centinela PESTEL al proyecto Moddulo F2.
// Transforma las señales tripartitas al formato MapaPESTEL de F2.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { DIMENSION_META } from "@/types/pestel.types";
import type {
  MapaPESTEL,
  F2DimensionPESTEL,
  F2Senal,
} from "@/types/moddulo.types";

type RawSenal = {
  descripcion?: string;
  fuente?: string;
  fechaCorte?: string;
  nivelConfianza?: "alto" | "medio" | "bajo";
  origenInternacional?: boolean;
};

function toF2Senal(s: RawSenal): F2Senal {
  return {
    descripcion: s.descripcion ?? "",
    fuente: s.fuente ?? "",
    fechaCorte: s.fechaCorte ?? "",
    nivelConfianza: s.nivelConfianza ?? "medio",
    origenInternacional: s.origenInternacional ?? false,
  };
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; pestAnalysisId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, pestAnalysisId } = body;
  if (!projectId || !pestAnalysisId) {
    return NextResponse.json(
      { error: "projectId y pestAnalysisId son requeridos" },
      { status: 400 }
    );
  }

  // Verify Moddulo project ownership
  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Load PESTEL analysis
  const analysisSnap = await adminDb
    .collection("pestel_analyses")
    .doc(pestAnalysisId)
    .get();

  if (!analysisSnap.exists) {
    return NextResponse.json({ error: "Análisis PESTEL no encontrado" }, { status: 404 });
  }

  const analysis = analysisSnap.data()!;

  // Verify PESTEL analysis ownership via its parent project
  const pestelProjectSnap = await adminDb
    .collection("pestel_projects")
    .doc(analysis.projectId as string)
    .get();

  if (!pestelProjectSnap.exists || pestelProjectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Sin permisos para este análisis PESTEL" }, { status: 403 });
  }

  // Transform DimensionAnalysis[] → MapaPESTEL
  const dimensions = (analysis.dimensions ?? []) as Array<{
    code: string;
    classification: "OPORTUNIDAD" | "NEUTRAL" | "AMENAZA";
    narrative?: string;
    confidence?: number;
    senalesFavorables?: RawSenal[];
    senalesAdversas?: RawSenal[];
    senalesInciertas?: RawSenal[];
  }>;

  const mapaPESTEL: MapaPESTEL = {};

  for (const dim of dimensions) {
    const code = dim.code;
    const label = DIMENSION_META[code as keyof typeof DIMENSION_META]?.label ?? code;

    const entry: F2DimensionPESTEL = {
      code,
      label,
      clasificacion: dim.classification ?? "NEUTRAL",
      senalesFavorables: (dim.senalesFavorables ?? []).map(toF2Senal),
      senalesAdversas: (dim.senalesAdversas ?? []).map(toF2Senal),
      senalesInciertas: (dim.senalesInciertas ?? []).map(toF2Senal),
      narrativa: dim.narrative,
      confidence: dim.confidence,
    };

    mapaPESTEL[code] = entry;
  }

  const pestProjectId = analysis.projectId as string;

  // Save to Moddulo project
  await adminDb.collection("moddulo_projects").doc(projectId).update({
    "phases.exploracion.pestAnalysisId": pestAnalysisId,
    "phases.exploracion.pestProjectId": pestProjectId,
    "phases.exploracion.mapaPESTEL": mapaPESTEL,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ mapaPESTEL, pestProjectId }, { status: 200 });
}
