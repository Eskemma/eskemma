// Paso 4 — finalize-dvs bajo la compuerta del M1: 409 m1_no_aprobado antes de escribir; la huella aprobada se
// captura al inicio y la transacción (guardia) la compara con la que lee; sin m1/sin payload, como siempre.

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
import { exploracionGate, otroMapaGate, type EstadoGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const dvs = { hei: { tensionCentral: "A" }, contrasteXPCTO: [], incertidumbres: [], semaforo: [], pip: [] };
function sembrar(estado: EstadoGate, extra: Record<string, unknown> = {}, mapa?: object) {
  const exploracion = exploracionGate(estado, extra, mapa);
  vi.mocked(getProject).mockResolvedValue({ id: "p1", phases: { exploracion } } as never);
  mockDb.reset({ [P]: { phases: { exploracion } } });
}
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", draftDVS: dvs }) }) as never;
const escribioDvs = () => mockDb.updates().some((u) => "phases.exploracion.dvs" in u.data);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
});

describe("finalize-dvs — compuerta del M1", () => {
  it.each(["borrador", "reabierto", "copia_alterada"] as const)("M1 %s → 409 m1_no_aprobado y cero escrituras", async (estado) => {
    sembrar(estado);
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "m1_no_aprobado" });
    expect(mockDb.updates()).toEqual([]);
  });
  it("aprobado → 200 y escribe el dvs", async () => {
    sembrar("aprobado");
    expect((await POST(req())).status).toBe(200);
    expect(escribioDvs()).toBe(true);
  });
  it("[carrera] se reabre entre la lectura previa y la transacción → 409 y cero escrituras", async () => {
    sembrar("aprobado");
    mockDb.reset({ [P]: { phases: { exploracion: exploracionGate("reabierto") } } });
    expect((await POST(req())).status).toBe(409);
    expect(escribioDvs()).toBe(false);
  });
  it("[carrera] se vuelve a aprobar con OTRO contenido entre la lectura previa y la transacción → 409 y cero escrituras", async () => {
    sembrar("aprobado");
    mockDb.reset({ [P]: { phases: { exploracion: exploracionGate("aprobado", {}, otroMapaGate) } } });
    expect((await POST(req())).status).toBe(409);
    expect(mockDb.updates()).toEqual([]);
  });
});

describe("finalize-dvs — sin m1 / sin payload: comportamiento de siempre (no regresión)", () => {
  it.each(["sin_m1", "sin_payload"] as const)("%s → 200 y escribe lo de siempre (estado lista, borrador y aprobaciones borrados)", async (estado) => {
    sembrar(estado);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const u = mockDb.updates()[0].data;
    expect(u["phases.exploracion.estado"]).toBe("lista");
    expect(u["phases.exploracion.draftDVS"]).toBe("FIELD_DELETE");
    expect(u["phases.exploracion.motorAprobaciones"]).toBe("FIELD_DELETE");
  });
});
