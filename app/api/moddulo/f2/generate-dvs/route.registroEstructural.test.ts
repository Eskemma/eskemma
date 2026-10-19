// G (paso 4): generate-dvs no registra texto del modelo ni del proyecto, y sus 500 ya no devuelven `raw`.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return { ...real, getProject: vi.fn() };
});
vi.mock("@/lib/ai/claude", () => ({ anthropic: { messages: { create: vi.fn() } }, CLAUDE_MODEL: "modelo-de-prueba" }));
vi.mock("@/lib/moddulo/knowledge-injector", () => ({ buildPhaseContext: vi.fn(async () => "") }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { anthropic } from "@/lib/ai/claude";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { exploracionGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const MARCA = "MARCADOR-DEL-PROYECTO-123";
const modelo = (text: string, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "text", text }] }) as never;
/** Every console.* argument of the run, flattened. */
const espias: Array<ReturnType<typeof vi.spyOn>> = [];
const registros = () =>
  espias.flatMap((e) => e.mock.calls as unknown[][]).map((c) => c.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")).join("\n");

beforeEach(() => {
  vi.clearAllMocks();
  espias.length = 0;
  for (const m of ["error", "log", "warn"] as const) espias.push(vi.spyOn(console, m).mockImplementation(() => {}));
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  const exploracion = exploracionGate("sin_m1");
  vi.mocked(getProject).mockResolvedValue({ id: "p1", type: "electoral", xpcto: { hito: "H" }, phases: { exploracion } } as never);
  mockDb.reset({ "moddulo_projects/p1": { phases: { exploracion } } });
  crear.mockReset();
});
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", saveas: "draft" }) }) as never;

describe("generate-dvs — registros estructurales", () => {
  it("M2 que no parsea: ni el log ni el cuerpo de la respuesta llevan el texto", async () => {
    crear.mockResolvedValueOnce(modelo(`{"narra ${MARCA}`)).mockResolvedValueOnce(modelo("[]"));
    const res = await POST(req());
    expect(res.status).toBe(500);
    const cuerpo = await res.json();
    expect(cuerpo).not.toHaveProperty("raw");
    expect(JSON.stringify(cuerpo)).not.toContain(MARCA);
    expect(registros()).toContain("M2 parse failure longitud=");
    expect(registros()).not.toContain(MARCA);
  });
  it("M5 inválido en los dos intentos: el log describe la forma, nunca el texto", async () => {
    crear.mockResolvedValueOnce(modelo("[]")).mockResolvedValueOnce(modelo("[]")).mockResolvedValueOnce(modelo("[]"))
      .mockResolvedValue(modelo(`no es json ${MARCA}`));
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(registros()).toContain("M5 attempt 1 respuesta longitud=");
    expect(registros()).toContain("M5 attempt 2 parse failure longitud=");
    expect(registros()).not.toContain(MARCA);
  });
  it("M5 vacío tras sanitizar: se registran claves y conteo, no el contenido", async () => {
    crear.mockResolvedValueOnce(modelo("[]")).mockResolvedValueOnce(modelo("[]")).mockResolvedValueOnce(modelo("[]"))
      .mockResolvedValue(modelo(JSON.stringify({ hei: { otraCosa: MARCA }, pip: [] })));
    await POST(req());
    expect(registros()).not.toContain(MARCA);
  });
  it("fallo del modelo con un mensaje que trae datos: el log lleva clase y status, no el mensaje", async () => {
    crear.mockRejectedValue(Object.assign(new Error(`falló ${MARCA}`), { status: 529, name: "APIError" }));
    await POST(req());
    expect(registros()).toContain("clase=APIError status=529");
    expect(registros()).not.toContain(MARCA);
  });
});
