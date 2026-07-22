// app/api/moddulo/f3/confirm/route.ts
// POST { projectId, resultadoId, storagePath, nombre, tipo, metadatosCarga, moduloPIP, cobertura }
// Confirma una carga manual de F3 (Canal 2) ya subida a Storage vía
// uploadMedia() (request-upload solo reserva el resultadoId/storagePath).
// Extrae texto del archivo, resuelve familiaMetodologica cuando aplica, y
// escribe el ResultadoCargaManual en moddulo_projects/{projectId}/f3Resultados.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import type { MetadatosCargaManual, ResultadoCargaManual } from "@/types/f3.types";
import type { CoberturaDeclarada } from "@/types/shared.types";

interface ConfirmBody {
  projectId?: string;
  resultadoId?: string;
  storagePath?: string;
  nombre?: string;
  tipo?: string;
  metadatosCarga?: MetadatosCargaManual;
  moduloPIP?: string;
  cobertura?: CoberturaDeclarada;
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: ConfirmBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, resultadoId, storagePath, nombre, tipo, metadatosCarga, moduloPIP, cobertura } = body;
  if (!projectId || !resultadoId || !storagePath || !nombre || !tipo || !metadatosCarga || !moduloPIP || !cobertura) {
    return NextResponse.json(
      { error: "projectId, resultadoId, storagePath, nombre, tipo, metadatosCarga, moduloPIP y cobertura son requeridos" },
      { status: 400 }
    );
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Guard de existencia: extractTextPerFile() no lanza si el archivo no
  // existe (atrapa el error del .download() y devuelve un string de
  // placeholder) — sin este chequeo explícito, un storagePath de una subida
  // cancelada o nunca realizada terminaría guardado como si tuviera
  // contenido real extraído.
  const [exists] = await adminStorage.bucket().file(storagePath).exists();
  if (!exists) {
    return NextResponse.json(
      { error: "file_not_found", message: "El archivo no existe en Storage. Sube el archivo antes de confirmar." },
      { status: 404 }
    );
  }

  // Canal 2 es texto libre (tecnicaDescrita) — no hay catálogo que resolver
  // aquí, familiaMetodologica es declarativa: se persiste tal como la manda
  // el cliente (sugerida por sugerirFamiliaMetodologica(), editable por el usuario).
  const extractoTexto = await extractTextPerFile({ nombre, tipo, url: "", storagePath });

  const resultado: ResultadoCargaManual = {
    moduloPIP,
    origen: {
      sourceKind: "manual",
      componente: "manual",
      analisisId: resultadoId,
      fechaEntrega: new Date().toISOString(),
    },
    cobertura,
    payload: { archivoUrl: storagePath, extractoTexto },
    metadatosCarga,
  };

  await adminDb
    .collection("moddulo_projects")
    .doc(projectId)
    .collection("f3Resultados")
    .doc(resultadoId)
    .set({ ...resultado, createdAt: FieldValue.serverTimestamp() });

  return NextResponse.json({ resultadoId, resultado }, { status: 200 });
}
