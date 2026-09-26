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
import { getPhaseSystemPrompt } from "@/lib/ai/phases/prompts";
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

function streamConTexto(text: string) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: "content_block_delta", delta: { type: "text_delta", text } };
    },
  };
}

/** Respuesta del modelo con su bloque JSON de extracción (como en producción). */
const respuestaConJson = (prosa: string, datos: Record<string, unknown>) =>
  `${prosa}\n\n\`\`\`json\n${JSON.stringify({ ...datos, __reasoning: "test" })}\n\`\`\``;

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

// Guard de grounding (forense 26-09-18): lo que el modelo extrae y el
// servidor persiste debe tener respaldo en lo que el usuario dijo. Casos
// recreados de YgKs7M (cifra inventada + día inventado).
describe("POST /api/moddulo/chat/[phaseId] — guard de grounding de extractedData", () => {
  const usuarioPrevio = {
    id: "u1", role: "user", timestamp: "2026-08-05T10:00:00Z",
    content:
      "Defensa del Voto: Cobertura del 100% de las casillas en el país con Representantes de Casilla (RC). Estructura en las 32 entidades. Día D: Junio de 2030.",
  };
  const proyecto = () =>
    ({ type: "electoral", phases: { proposito: { chatHistory: [usuarioPrevio] } } }) as unknown as ModduloProject;

  async function turno(datos: Record<string, unknown>, mensaje = "Continúa.") {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue(proyecto());
    mockStream.mockReturnValue(
      streamConTexto(respuestaConJson("Registro lo que compartiste.", datos)) as unknown as ReturnType<typeof anthropic.messages.stream>
    );
    const res = await POST(buildRequest({ message: mensaje, projectId: PROJECT_ID }), ctx("proposito"));
    const cuerpo = await res.text();
    const eventos = [...cuerpo.matchAll(/^data: (.*)$/gm)].map((m) => JSON.parse(m[1]));
    return { cuerpo, eventos, escrito: (mockAdminDb.snapshot()[`moddulo_projects/${PROJECT_ID}`] ?? {}) as Record<string, unknown> };
  }

  it("descarta la cifra inventada: no se emite al cliente ni se escribe a Firestore, y avisa al usuario", async () => {
    const { cuerpo, eventos, escrito } = await turno({
      "xpcto.capacidades.humano": "Defensa del Voto con cobertura del 100% de casillas (~170,000 representantes de casilla).",
    });
    expect(eventos.some((e) => e.type === "extracted-data")).toBe(false);
    expect(escrito["xpcto.capacidades.humano"]).toBeUndefined();
    expect(cuerpo).toContain("Nota del sistema");
    expect(cuerpo).toContain("170,000");
  });

  it("descarta el día inventado (usuario: 'Junio de 2030' → modelo: 2030-06-01) junto con la duración derivada", async () => {
    const { eventos, escrito } = await turno({
      "xpcto.tiempo.fechaLimite": "2030-06-01",
      "xpcto.tiempo.duracionMeses": 47,
    });
    expect(eventos.some((e) => e.type === "extracted-data")).toBe(false);
    expect(escrito["xpcto.tiempo.fechaLimite"]).toBeUndefined();
    expect(escrito["xpcto.tiempo.duracionMeses"]).toBeUndefined();
  });

  it("los valores con respaldo (formato equivalente) sí se emiten y se escriben; solo se corta el inventado", async () => {
    const { eventos, escrito } = await turno({
      "xpcto.capacidades.humano": "Estructura en las 32 entidades. Cobertura del 100% de casillas.",
      "xpcto.capacidades.logistico": "Bodega y ~170,000 vehículos.",
      "xpcto.tiempo.fechaLimite": "Junio de 2030",
    });
    const extraido = eventos.find((e) => e.type === "extracted-data");
    expect(Object.keys(extraido.extractedData).sort()).toEqual(["xpcto.capacidades.humano", "xpcto.tiempo.fechaLimite"]);
    expect(escrito["xpcto.capacidades.humano"]).toContain("32 entidades");
    expect(escrito["xpcto.tiempo.fechaLimite"]).toBe("Junio de 2030");
    expect(escrito["xpcto.capacidades.logistico"]).toBeUndefined();
  });

  it("una confirmación corta ('sí') respalda la fecha que el asistente propuso en el turno anterior", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({
      type: "electoral",
      phases: { proposito: { chatHistory: [
        usuarioPrevio,
        { id: "a1", role: "assistant", content: "¿La jornada es el 2 de junio de 2030?", timestamp: "2026-08-05T10:01:00Z" },
      ] } },
    } as unknown as ModduloProject);
    mockStream.mockReturnValue(
      streamConTexto(respuestaConJson("Registrada.", { "xpcto.tiempo.fechaLimite": "2030-06-02" })) as unknown as ReturnType<typeof anthropic.messages.stream>
    );
    const res = await POST(buildRequest({ message: "Sí, esa es.", projectId: PROJECT_ID }), ctx("proposito"));
    await res.text();
    const escrito = mockAdminDb.snapshot()[`moddulo_projects/${PROJECT_ID}`] as Record<string, unknown>;
    expect(escrito["xpcto.tiempo.fechaLimite"]).toBe("2030-06-02");
  });

  it("respalda con el borrador XPCTO extraído de un documento compartido en un turno anterior (F1)", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({
      type: "electoral",
      phases: { proposito: {
        chatHistory: [usuarioPrevio],
        xpctoBorrador: { c: { financiero: "Presupuesto total estimado: 3,000,000 de pesos" } },
      } },
    } as unknown as ModduloProject);
    mockStream.mockReturnValue(
      streamConTexto(respuestaConJson("Listo.", { "xpcto.capacidades.financiero": "Presupuesto total estimado: 3,000,000 de pesos." })) as unknown as ReturnType<typeof anthropic.messages.stream>
    );
    const res = await POST(buildRequest({ message: "Toma el contenido del documento.", projectId: PROJECT_ID }), ctx("proposito"));
    await res.text();
    const escrito = mockAdminDb.snapshot()[`moddulo_projects/${PROJECT_ID}`] as Record<string, string>;
    expect(escrito["xpcto.capacidades.financiero"]).toContain("3,000,000");
  });

  it("la clave `__action` y las claves fuera de los prefijos persistidos no se ven afectadas", async () => {
    const { eventos } = await turno({ __action: "start_express", "investigacion.insightsClave": "Hallazgo con 87.3%" });
    const extraido = eventos.find((e) => e.type === "extracted-data");
    expect(extraido.extractedData.__action).toBe("start_express");
    expect(extraido.extractedData["investigacion.insightsClave"]).toBe("Hallazgo con 87.3%");
  });
});

describe("POST /api/moddulo/chat/[phaseId] — territorio estructurado (Paso 4a)", () => {
  const TERR = {
    nivel: "distrito_federal",
    nombre: "PROGRESO",
    estado: "Yucatán",
    pais: "México",
    distritosSeleccionados: [{ cve: "002", nombre: "PROGRESO", estado: "Yucatán" }],
  };
  const proyectoConTerritorio = () =>
    ({ type: "electoral", phases: {}, collaborators: [{ uid: UID, role: "owner" }], territorio: TERR }) as unknown as ModduloProject;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminDb.reset();
  });

  async function turnoConTerritorio(datos: Record<string, unknown>) {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue(proyectoConTerritorio());
    mockStream.mockReturnValue(
      streamConTexto(respuestaConJson("Listo.", datos)) as unknown as ReturnType<typeof anthropic.messages.stream>
    );
    const res = await POST(buildRequest({ message: "Continúa.", projectId: PROJECT_ID }), ctx("exploracion"));
    const cuerpo = await res.text();
    return { cuerpo, eventos: [...cuerpo.matchAll(/^data: (.*)$/gm)].map((m) => JSON.parse(m[1])) };
  }

  it("pasa project.territorio como 4.º argumento de getPhaseSystemPrompt", async () => {
    await turnoConTerritorio({});
    const args = vi.mocked(getPhaseSystemPrompt).mock.calls[0];
    expect(args[0]).toBe("exploracion");
    expect(args[3]).toEqual(TERR);
  });

  it("el territorio NO viaja dentro del contexto XPCTO (que alimenta el grounding)", async () => {
    await turnoConTerritorio({});
    const xpctoCtx = vi.mocked(getPhaseSystemPrompt).mock.calls[0][2];
    expect(JSON.stringify(xpctoCtx ?? {})).not.toContain("PROGRESO");
    expect(JSON.stringify(xpctoCtx ?? {})).not.toContain("distritosSeleccionados");
  });

  it("grounding: el código de distrito del bloque de territorio NO respalda una cifra extraída", async () => {
    // El código 3102 sale del bloque del prompt, no de lo que dijo el usuario: si el modelo lo extrae
    // como dato del usuario, el guard sigue exigiendo respaldo y lo descarta.
    const { eventos } = await turnoConTerritorio({ "xpcto.capacidades.humano": "Equipo de 3102 promotores." });
    expect(eventos.some((e) => e.type === "extracted-data")).toBe(false);
  });

  it("proyecto sin territorio (legado): 4.º argumento undefined, sin error", async () => {
    mockGetSessionFromRequest.mockResolvedValue(mockSessionPayload({ uid: UID }));
    mockGetProject.mockResolvedValue({ type: "electoral", phases: {} } as unknown as ModduloProject);
    mockStream.mockReturnValue(streamDeUnChunk() as unknown as ReturnType<typeof anthropic.messages.stream>);
    const res = await POST(buildRequest({ message: "hola", projectId: PROJECT_ID }), ctx("exploracion"));
    expect(res.status).toBe(200);
    expect(vi.mocked(getPhaseSystemPrompt).mock.calls[0][3]).toBeUndefined();
  });
});
