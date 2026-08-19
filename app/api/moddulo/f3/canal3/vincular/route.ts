// app/api/moddulo/f3/canal3/vincular/route.ts
// POST { projectId, resultadoId, storagePath, nombre, tipo, metadatosFuente,
//        moduloPIP, cobertura, confirmarPeseATerritorio?, confirmarPeseAVigencia? }
// Vincula una fuente externa real (Canal 3) tras evaluar compatibilidad.
// resultadoId/storagePath vienen de /api/moddulo/f3/request-upload (mismo
// endpoint que Canal 2, sin cambios — es agnóstico de canal).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { evaluarCompatibilidad } from "@/lib/moddulo/canal3Evaluation";
import { extraerTerritorioEscalar } from "@/lib/territorio/staleness";
import type { MetadatosFuenteExterna, ResultadoFuenteExterna } from "@/types/f3.types";
import type { CoberturaDeclarada } from "@/types/shared.types";

interface VincularBody {
  projectId?: string;
  resultadoId?: string;
  storagePath?: string;
  nombre?: string;
  tipo?: string;
  metadatosFuente?: MetadatosFuenteExterna;
  moduloPIP?: string;
  cobertura?: CoberturaDeclarada;
  confirmarPeseATerritorio?: boolean;
  confirmarPeseAVigencia?: boolean;
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: VincularBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    projectId, resultadoId, storagePath, nombre, tipo, metadatosFuente,
    moduloPIP, cobertura, confirmarPeseATerritorio, confirmarPeseAVigencia,
  } = body;
  if (!projectId || !resultadoId || !storagePath || !nombre || !tipo || !metadatosFuente || !moduloPIP || !cobertura) {
    return NextResponse.json(
      { error: "projectId, resultadoId, storagePath, nombre, tipo, metadatosFuente, moduloPIP y cobertura son requeridos" },
      { status: 400 }
    );
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const compatibilidad = evaluarCompatibilidad(project, metadatosFuente);

  // Tipo: bloqueo duro, sin bypass posible.
  if (!compatibilidad.pertinencia.cumple) {
    return NextResponse.json(
      { error: "pertinencia_rechazada", message: compatibilidad.pertinencia.detalle },
      { status: 422 }
    );
  }

  // Territorio: bloqueo suave con su propio flag — no comparte confirmación con vigencia.
  if (compatibilidad.pertinencia.territorioRequiereConfirmacion && !confirmarPeseATerritorio) {
    return NextResponse.json(
      {
        error: "territorio_requiere_confirmacion",
        message: compatibilidad.pertinencia.territorioDetalle,
      },
      { status: 422 }
    );
  }

  // Vigencia (fecha): bloqueo suave con su propio flag.
  if (!compatibilidad.vigencia.cumple && !confirmarPeseAVigencia) {
    return NextResponse.json(
      { error: "vigencia_rechazada", message: compatibilidad.vigencia.detalle },
      { status: 422 }
    );
  }

  // Guard de existencia: mismo criterio que confirm/route.ts de Canal 2 —
  // extractTextPerFile no lanza si el archivo no existe.
  const [exists] = await adminStorage.bucket().file(storagePath).exists();
  if (!exists) {
    return NextResponse.json(
      { error: "file_not_found", message: "El archivo no existe en Storage. Sube el archivo antes de vincular." },
      { status: 404 }
    );
  }

  const extractoTexto = await extractTextPerFile({ nombre, tipo, url: "", storagePath });

  const resultado: ResultadoFuenteExterna = {
    moduloPIP,
    origen: {
      sourceKind: "external",
      componente: "external",
      analisisId: resultadoId,
      fechaEntrega: new Date().toISOString(),
    },
    cobertura,
    payload: { archivoUrl: storagePath, extractoTexto },
    metadatosFuente,
    compatibilidad,
    // Ronda 13 (26-08-18) — propagación de cambios de territorio.
    proyectoTerritorioSnapshotAtVinculacion: project.territorio
      ? JSON.stringify(extraerTerritorioEscalar(project.territorio))
      : undefined,
  };

  await adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .collection("f3Resultados")
    .doc(resultadoId)
    .set({ ...resultado, createdAt: FieldValue.serverTimestamp() });

  return NextResponse.json({ resultadoId, resultado }, { status: 200 });
}
