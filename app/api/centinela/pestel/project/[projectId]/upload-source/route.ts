// app/api/centinela/pestel/project/[projectId]/upload-source/route.ts
// POST multipart/form-data
// Extracts text from a PDF, DOCX, or TXT file and saves it as a manual
// data source in pestel_data_sources (same as data-source route).
// No binary file is stored — only the extracted text.
// For PDFs with image-based pages (charts, infographics), falls back to
// Claude Vision when pdf-parse returns insufficient text.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import { logAnthropicError } from "@/lib/ai/creditError";
import type { DimensionCode, ReliabilityLevel } from "@/types/pestel.types";
import { DIMENSION_ORDER } from "@/types/pestel.types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Minimum characters from pdf-parse to consider extraction successful.
// Shorter results likely mean image-only pages.
const PDF_TEXT_MIN_CHARS = 120;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 50_000;

const VALID_DIMENSION_CODES: DimensionCode[] = DIMENSION_ORDER;
const VALID_RELIABILITY: ReliabilityLevel[] = ["HIGH", "MEDIUM", "LOW"];

const SUPPORTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "docx",
  "text/plain": "txt",
  "text/markdown": "txt",
};

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

type ExtractionResult = { text: string; method: "text" | "vision" };

async function extractTextWithClaude(
  buffer: Buffer
): Promise<ExtractionResult> {
  const base64 = buffer.toString("base64");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: `Extrae toda la información relevante de este documento.
Si contiene gráficas, tablas o infografías, describe los datos que muestran con precisión (porcentajes, valores, categorías, tendencias).
Si contiene texto, transcríbelo fielmente.
Presenta la información de forma estructurada y completa, sin omitir datos.
Responde únicamente con el contenido extraído, sin comentarios adicionales.`,
          },
        ],
      },
    ],
  });

  const block = message.content[0];
  return { text: block.type === "text" ? block.text : "", method: "vision" };
}

async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  const type = SUPPORTED_TYPES[mimeType];

  if (type === "pdf") {
    // Try native text extraction first (fast, free).
    // If it fails or returns very little text (image-based PDF, charts,
    // infographics), fall back to Claude Vision.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (
        buf: Buffer
      ) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      const extracted = result.text.trim();
      if (extracted.length >= PDF_TEXT_MIN_CHARS) {
        return { text: extracted, method: "text" };
      }
    } catch {
      // pdf-parse failed — proceed to Claude Vision fallback below
    }
    return extractTextWithClaude(buffer);
  }

  if (type === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, method: "text" };
  }

  // Plain text / markdown
  return { text: buffer.toString("utf-8"), method: "text" };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;

  // Verify project ownership
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(projectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formato de solicitud inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  const dimensionCode = formData.get("dimensionCode") as string | null;
  const source = (formData.get("source") as string | null) ?? "";
  const reliabilityLevel =
    (formData.get("reliabilityLevel") as string | null) ?? "MEDIUM";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }

  if (!dimensionCode || !VALID_DIMENSION_CODES.includes(dimensionCode as DimensionCode)) {
    return NextResponse.json({ error: "dimensionCode inválido" }, { status: 400 });
  }

  if (!VALID_RELIABILITY.includes(reliabilityLevel as ReliabilityLevel)) {
    return NextResponse.json({ error: "reliabilityLevel inválido" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 10 MB." },
      { status: 413 }
    );
  }

  const mimeType = file.type;
  if (!SUPPORTED_TYPES[mimeType]) {
    return NextResponse.json(
      { error: "Tipo de archivo no soportado. Sube PDF, DOCX o TXT." },
      { status: 400 }
    );
  }

  // Extract text
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let extraction: ExtractionResult;
  try {
    extraction = await extractText(buffer, mimeType);
  } catch (err) {
    logAnthropicError("upload-source extraction", err);
    return NextResponse.json(
      { error: "No se pudo extraer texto del archivo." },
      { status: 422 }
    );
  }

  const trimmed = extraction.text.trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "No se pudo extraer texto del archivo." },
      { status: 422 }
    );
  }

  const content = trimmed.slice(0, MAX_TEXT_CHARS);

  // Save to pestel_data_sources
  const docRef = adminDb.collection("pestel_data_sources").doc();
  await docRef.set({
    projectId,
    userId: session.uid,
    content,
    dimensionCode: dimensionCode as DimensionCode,
    source: source.trim() || file.name,
    reliabilityLevel: reliabilityLevel as ReliabilityLevel,
    capturedAt: FieldValue.serverTimestamp(),
    isManual: true,
    fileOrigin: {
      name: file.name,
      mimeType,
      extractedLength: content.length,
      extractionMethod: extraction.method,
    },
  });

  return NextResponse.json(
    {
      dataSourceId: docRef.id,
      extractedLength: content.length,
      method: extraction.method,
    },
    { status: 201 }
  );
}
