// app/api/fontana/sesion/[sesionId]/adjunto/route.ts
// POST multipart/form-data — el usuario adjunta un archivo al chat de
// Fontana. Se extrae SOLO el texto (extractor compartido
// lib/moddulo/attachments.ts) y se persiste en la subcolección append-only
// fontana_sesiones/{sesionId}/adjuntos. El binario NUNCA se guarda — ni en
// Storage ni en Firestore, ni temporalmente: el buffer vive solo en memoria
// de esta request. Patrón calcado de
// app/api/centinela/pestel/project/[projectId]/upload-source/route.ts.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import {
  extractTextFromBuffer,
  isExtractionError,
  resolveEffectiveMime,
} from "@/lib/moddulo/attachments";

export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB, igual que Moddulo y PESTEL
const MAX_TEXT_CHARS = 50_000; // igual que PESTEL upload-source

// Tipos aceptados (decisión de la ronda). CSV y TXT se validan por
// decodificación UTF-8, no por magic bytes (no tienen firma fiable).
const TIPOS_ACEPTADOS = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

const REPLACEMENT_CHAR = "�";

/**
 * Validación de tipo REAL en servidor: no confía solo en la extensión ni en
 * el MIME que manda el navegador (hueco documentado en el chat de Moddulo,
 * que no valida nada server-side). PDF -> %PDF; DOCX/XLSX -> firma ZIP
 * (PK\x03\x04), se desambiguan por extensión; TXT/CSV -> debe ser UTF-8
 * decodable sin bytes NUL.
 */
function validarTipoArchivo(
  buffer: Buffer,
  nombre: string,
  mimeCliente: string
): { ok: true; mime: string } | { ok: false; error: string } {
  const mime = resolveEffectiveMime(mimeCliente, nombre);
  if (!TIPOS_ACEPTADOS.has(mime)) {
    return {
      ok: false,
      error: "Tipo de archivo no soportado. Adjunta PDF, Word, Excel, TXT o CSV.",
    };
  }

  const firma4 = buffer.subarray(0, 4);
  const esPdf = firma4.toString("latin1") === "%PDF";
  const esZip =
    firma4[0] === 0x50 && firma4[1] === 0x4b && firma4[2] === 0x03 && firma4[3] === 0x04;

  if (mime === "application/pdf") {
    if (!esPdf) return { ok: false, error: "El archivo no es un PDF válido." };
    return { ok: true, mime };
  }

  if (mime.includes("wordprocessingml") || mime.includes("spreadsheetml")) {
    if (!esZip) {
      return { ok: false, error: "El archivo de Office parece dañado o no es válido." };
    }
    return { ok: true, mime };
  }

  if (mime === "application/msword" || mime === "application/vnd.ms-excel") {
    // Formatos binarios legacy (.doc/.xls): el extractor los intenta vía
    // mammoth/exceljs; no bloqueamos aquí.
    return { ok: true, mime };
  }

  // text/plain, text/markdown, text/csv — debe ser texto legible.
  // Byte NUL => binario; U+FFFD abundante => no era UTF-8.
  const muestra = buffer.subarray(0, 8192).toString("utf-8");
  const tieneNul = buffer.subarray(0, 8192).includes(0);
  const reemplazos = muestra.split(REPLACEMENT_CHAR).length - 1;
  if (tieneNul || reemplazos > 8) {
    return { ok: false, error: "El archivo no parece ser texto plano." };
  }
  return { ok: true, mime };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sesionId } = await context.params;

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formato de solicitud inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 10 MB." },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const validacion = validarTipoArchivo(buffer, file.name, file.type);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }

  let texto: string;
  try {
    texto = await extractTextFromBuffer(buffer, validacion.mime, file.name);
  } catch (err) {
    console.error("[fontana/adjunto] extracción falló:", err);
    return NextResponse.json(
      { error: "No se pudo extraer el texto del archivo.", code: "extraccion_fallida" },
      { status: 422 }
    );
  }

  if (isExtractionError(texto) || !texto.trim()) {
    return NextResponse.json(
      { error: "No se pudo leer el contenido del archivo.", code: "sin_contenido" },
      { status: 422 }
    );
  }

  const textoExtraido = texto.slice(0, MAX_TEXT_CHARS);
  const adjuntoId = crypto.randomUUID();

  await adminDb
    .collection("fontana_sesiones")
    .doc(sesionId)
    .collection("adjuntos")
    .doc(adjuntoId)
    .set({
      id: adjuntoId,
      nombreArchivo: file.name,
      textoExtraido,
      tipoMime: validacion.mime,
      cargadoEn: FieldValue.serverTimestamp(),
    });

  return NextResponse.json(
    { adjuntoId, nombreArchivo: file.name, caracteres: textoExtraido.length },
    { status: 201 }
  );
}
