// app/api/moddulo/chat/[phaseId]/route.test.ts
// Regresión del IDOR de storagePath en los adjuntos del chat de Moddulo
// (attachments[].storagePath → extractTextPerFile → adminStorage, que
// bypasea storage.rules). Estructura distinta a canal1/canal3/confirm:
// el cliente manda un ARREGLO y storagePath es opcional en el tipo, así
// que además de "path ajeno" se prueba "path ausente" (sin él,
// extractTextPerFile haría fetch(attachment.url)). Los 2 sitios que
// consumen los adjuntos (fase "proposito" → extracción XPCTO; resto de
// fases → texto inyectado al prompt) quedan cubiertos por UN guard central
// antes de cualquier I/O — se prueba que ambos rechazan.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModduloProject } from "@/types/moddulo.types";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import(
    "@/lib/moddulo/__tests__/fixtures/adminMocks"
  );
  return {
    adminDb: createMockAdminDb(),
    adminStorage: createMockAdminStorage(),
  };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    delete: () => "FIELD_DELETE",
    arrayUnion: () => "ARRAY_UNION",
  },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({
  getProject: vi.fn(),
  appendChatMessage: vi.fn(async () => undefined),
}));
vi.mock("@/lib/moddulo/attachments", () => ({
  extractTextPerFile: vi.fn(),
  isExtractionError: vi.fn(() => false),
}));
vi.mock("@/lib/moddulo/knowledge-injector", () => ({ buildPhaseContext: vi.fn(async () => "") }));
vi.mock("@/lib/ai/phases/prompts", () => ({ getPhaseSystemPrompt: vi.fn(() => "system prompt") }));
vi.mock("@/lib/ai/claude", () => ({
  CLAUDE_MODEL: "test-model",
  anthropic: { messages: { stream: vi.fn(), create: vi.fn() } },
}));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { anthropic } from "@/lib/ai/claude";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockAdminDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const mockGetSessionFromRequest = vi.mocked(getSessionFromRequest);
const mockGetProject = vi.mocked(getProject);
const mockExtractTextPerFile = vi.mocked(extractTextPerFile);
const mockStream = vi.mocked(anthropic.messages.stream);
const mockCreate = vi.mocked(anthropic.messages.create);

const UID = "uidA";
const OTHER_UID = "uidB";
const PROJECT_ID = "projA";
const own = (phase: string) => `moddulo/${UID}/${PROJECT_ID}/fases/${phase}/attachments/uuid-doc.pdf`;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/moddulo/chat/exploracion", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const ctx = (phaseId: string) => ({ params: Promise.resolve({ phaseId }) });

const adjunto = (storagePath?: string) => ({
  nombre: "doc.pdf",
  url: "https://firebasestorage.example/doc.pdf",
  tipo: "application/pdf",
  ...(storagePath === undefined ? {} : { storagePath }),
});

function streamDeUnChunk() {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "hola" } };
    },
  };
}

describe("POST /api/moddulo/chat/[phaseId] — adjuntos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminDb.reset();
  });

  it("responde 401 sin sesión", async () => {
    mockGetSessionFromRequest.mockResolvedValue(null);
    const res = await POST(buildRequest({}), ctx("exploracion"));
    expect(res.status).toBe(401);
  });

  it("responde 400 si faltan message/projectId", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const res = await POST(buildRequest({ message: "hola" }), ctx("exploracion"));
    expect(res.status).toBe(400);
  });

  it("responde 403 si un adjunto trae el storagePath de otro uid (fase exploracion), sin tocar nada", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const ajeno = `moddulo/${OTHER_UID}/${PROJECT_ID}/fases/exploracion/attachments/uuid-doc.pdf`;
    const res = await POST(
      buildRequest({ message: "hola", projectId: PROJECT_ID, attachments: [adjunto(ajeno)] }),
      ctx("exploracion")
    );
    expect(res.status).toBe(403);
    expect(mockGetProject).not.toHaveBeenCalled();
    expect(mockExtractTextPerFile).not.toHaveBeenCalled();
    expect(mockStream).not.toHaveBeenCalled();
    expect(mockAdminDb.collection).not.toHaveBeenCalled();
  });

  it("responde 403 también en la fase proposito (2º sitio de consumo: extracción XPCTO)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const ajeno = `moddulo/${OTHER_UID}/${PROJECT_ID}/fases/proposito/attachments/uuid-doc.pdf`;
    const res = await POST(
      buildRequest({ message: "", projectId: PROJECT_ID, attachments: [adjunto(ajeno)] }),
      ctx("proposito")
    );
    expect(res.status).toBe(403);
    expect(mockExtractTextPerFile).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("responde 403 si UN solo adjunto del lote es ajeno, aunque los demás sean propios", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const ajeno = `moddulo/${OTHER_UID}/${PROJECT_ID}/fases/exploracion/attachments/uuid-doc.pdf`;
    const res = await POST(
      buildRequest({
        message: "hola",
        projectId: PROJECT_ID,
        attachments: [adjunto(own("exploracion")), adjunto(ajeno)],
      }),
      ctx("exploracion")
    );
    expect(res.status).toBe(403);
    expect(mockExtractTextPerFile).not.toHaveBeenCalled();
  });

  it("responde 403 si un adjunto NO trae storagePath (evita el fallback a fetch(url) del extractor)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const res = await POST(
      buildRequest({ message: "hola", projectId: PROJECT_ID, attachments: [adjunto()] }),
      ctx("exploracion")
    );
    expect(res.status).toBe(403);
    expect(mockExtractTextPerFile).not.toHaveBeenCalled();
  });

  it("responde 403 si attachments no es un arreglo", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    const res = await POST(
      buildRequest({ message: "hola", projectId: PROJECT_ID, attachments: "no soy arreglo" }),
      ctx("exploracion")
    );
    expect(res.status).toBe(403);
  });

  it("responde 404 si el proyecto no existe (adjuntos propios pasan el guard, falla después)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue(null);
    const res = await POST(
      buildRequest({ message: "hola", projectId: PROJECT_ID, attachments: [adjunto(own("exploracion"))] }),
      ctx("exploracion")
    );
    expect(res.status).toBe(404);
  });

  it("responde 200 (SSE) con adjuntos propios y los pasa al extractor (camino feliz, fase exploracion)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({ type: "electoral", phases: {} } as unknown as ModduloProject);
    mockExtractTextPerFile.mockResolvedValue("texto extraído");
    mockStream.mockReturnValue(streamDeUnChunk() as unknown as ReturnType<typeof anthropic.messages.stream>);

    const res = await POST(
      buildRequest({ message: "hola", projectId: PROJECT_ID, attachments: [adjunto(own("exploracion"))] }),
      ctx("exploracion")
    );
    const cuerpo = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(cuerpo).toContain('"type":"done"');
    expect(mockGetProject).toHaveBeenCalledWith(PROJECT_ID, UID);
    expect(mockExtractTextPerFile.mock.calls[0][0]).toMatchObject({ storagePath: own("exploracion") });
    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  it("con adjuntos propios en la fase proposito, el guard no bloquea y llega a la extracción XPCTO", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({ type: "electoral", phases: {} } as unknown as ModduloProject);
    mockExtractTextPerFile.mockResolvedValue("texto extraído");
    const xpctoExtraido = {
      x: { resultado: "Ganar", ambito: "Local", fecha: "2027", criterioVerificacion: "Actas", confianza: "alta" },
      p: { identidad: "Candidata", trayectoria: "-", imagenActual: "-", arquetipoEstilo: "-", fronterasEticas: "-", confianza: "media" },
      c: { financiero: "Bajo", humano: "-", organizacional: "-", material: "-", confianza: "baja" },
      t: { fechaInicio: "2026", fechaHito: "2027", hitosIntermedios: "-", restricciones: "-", confianza: "alta" },
      o: { problemaPublico: "Seguridad", beneficiarios: "-", conexionPO: "-", criterioIntegridad: "-", confianza: "alta" },
    };
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(xpctoExtraido) }],
    } as unknown as Awaited<ReturnType<typeof anthropic.messages.create>>);

    const res = await POST(
      buildRequest({ message: "", projectId: PROJECT_ID, attachments: [adjunto(own("proposito"))] }),
      ctx("proposito")
    );
    const cuerpo = await res.text();

    expect(res.status).toBe(200);
    expect(cuerpo).toContain("He analizado el documento");
    expect(mockExtractTextPerFile.mock.calls[0][0]).toMatchObject({ storagePath: own("proposito") });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("sin adjuntos el guard no interviene (flujo de chat normal sigue igual)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({ type: "electoral", phases: {} } as unknown as ModduloProject);
    mockStream.mockReturnValue(streamDeUnChunk() as unknown as ReturnType<typeof anthropic.messages.stream>);

    const res = await POST(buildRequest({ message: "hola", projectId: PROJECT_ID }), ctx("exploracion"));
    await res.text();

    expect(res.status).toBe(200);
    expect(mockExtractTextPerFile).not.toHaveBeenCalled();
  });
});
