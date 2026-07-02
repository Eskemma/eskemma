// lib/moddulo/attachments.ts
// Shared text extraction for Moddulo chat attachments.
// Used by the chat API route and the PESTEL import endpoint.

import { anthropic } from "@/lib/ai/claude";
import type { ChatAttachment } from "@/types/moddulo.types";

const CLAUDE_MODEL = "claude-sonnet-4-6";

export async function extractTextPerFile(attachment: ChatAttachment): Promise<string> {
  const res = await fetch(attachment.url);
  if (!res.ok) return `[No se pudo acceder a ${attachment.nombre}]`;
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = attachment.tipo;

  if (mimeType === "application/pdf") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      const text = result.text.trim();
      if (text.length >= 120) return `[Archivo: ${attachment.nombre}]\n${text}`;
    } catch { /* fall through to Claude Vision */ }
    const base64 = buffer.toString("base64");
    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: "Extrae toda la información relevante de este documento de forma estructurada." },
      ]}],
    });
    const block = msg.content[0];
    return `[Archivo: ${attachment.nombre}]\n${block.type === "text" ? block.text : ""}`;
  }

  if (mimeType.includes("wordprocessingml") || mimeType === "application/msword") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return `[Archivo: ${attachment.nombre}]\n${result.value}`;
  }

  if (mimeType.startsWith("text/") || mimeType === "text/csv") {
    return `[Archivo: ${attachment.nombre}]\n${buffer.toString("utf-8")}`;
  }

  if (mimeType.startsWith("image/")) {
    const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    type ImageMediaType = typeof validImageTypes[number];
    const mediaType: ImageMediaType = validImageTypes.includes(mimeType as ImageMediaType)
      ? (mimeType as ImageMediaType)
      : "image/jpeg";
    const base64 = buffer.toString("base64");
    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: "Describe el contenido de esta imagen. Si hay texto, transcríbelo. Si hay datos o tablas, descríbelos con precisión." },
      ]}],
    });
    const block = msg.content[0];
    return `[Imagen: ${attachment.nombre}]\n${block.type === "text" ? block.text : ""}`;
  }

  return `[Archivo no soportado: ${attachment.nombre}]`;
}
