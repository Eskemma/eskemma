// Paso 4 — save-draft bajo la compuerta del M1: lectura y escritura en UNA transacción; con un M1 sin aprobar
// responde 409 m1_no_aprobado y no escribe; sin m1 (o sin payload) hace lo de siempre.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return { ...real, getProject: vi.fn() };
});
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { exploracionGate, type EstadoGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
function sembrar(estado: EstadoGate) {
  const exploracion = exploracionGate(estado);
  vi.mocked(getProject).mockResolvedValue({ id: "p1", phases: { exploracion } } as never);
  mockDb.reset({ [P]: { phases: { exploracion } } });
}
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", draftDVS: { hei: {}, pip: [] } }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
});

describe("save-draft — compuerta del M1", () => {
  it.each(["borrador", "reabierto", "copia_alterada"] as const)("M1 %s → 409 m1_no_aprobado y cero escrituras", async (estado) => {
    sembrar(estado);
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "m1_no_aprobado" });
    expect(mockDb.updates()).toEqual([]);
  });
  it("aprobado → 200 y escribe", async () => {
    sembrar("aprobado");
    expect((await POST(req())).status).toBe(200);
    expect(mockDb.updates()).toHaveLength(1);
    expect(mockDb.updates()[0].data).toHaveProperty("phases.exploracion.draftDVS");
  });
  it("[carrera] getProject (lectura previa) lo ve aprobado pero al escribir ya se reabrió → 409, cero escrituras", async () => {
    sembrar("aprobado");
    mockDb.reset({ [P]: { phases: { exploracion: exploracionGate("reabierto") } } });
    expect((await POST(req())).status).toBe(409);
    expect(mockDb.updates()).toEqual([]);
  });
  it("proyecto en la papelera entre la lectura y la escritura → 409 sin escribir", async () => {
    sembrar("aprobado");
    mockDb.reset({ [P]: { deletedAt: "t", phases: { exploracion: exploracionGate("aprobado") } } });
    expect((await POST(req())).status).toBe(409);
    expect(mockDb.updates()).toEqual([]);
  });
});

describe("save-draft — sin m1 / sin payload: comportamiento de siempre (no regresión)", () => {
  it.each(["sin_m1", "sin_payload"] as const)("%s → 200 y escribe exactamente lo de siempre", async (estado) => {
    sembrar(estado);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const u = mockDb.updates();
    expect(u).toHaveLength(1);
    expect(Object.keys(u[0].data).sort()).toEqual(["phases.exploracion.draftDVS", "updatedAt"].sort());
  });
});
