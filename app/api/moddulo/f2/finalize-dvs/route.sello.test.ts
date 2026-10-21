// Commit 2 (estados de trabajo): finalize-dvs escribe m1.finalizacion = {huella: generacion.huella} en la MISMA
// transacción que el dvs, leyendo la generación dentro de ella y compuesto con la guardia de la compuerta del M1.
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
import { exploracionGate, huellaGate, otroMapaGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const dvs = { hei: { tensionCentral: "A" }, contrasteXPCTO: [], incertidumbres: [], semaforo: [], pip: [] };
const SELLO = "phases.exploracion.m1.finalizacion";
const escrituraDvs = () => mockDb.updates().find((u) => "phases.exploracion.dvs" in u.data);
function sembrar(exploracion: Record<string, unknown>, docExploracion = exploracion) {
  vi.mocked(getProject).mockResolvedValue({ id: "p1", phases: { exploracion } } as never);
  mockDb.reset({ [P]: { phases: { exploracion: docExploracion } } });
}
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", draftDVS: dvs }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
});

describe("finalize-dvs — sello de finalización", () => {
  it("M1 aprobado con generación: escribe el sello con la huella de la generación, junto al dvs", async () => {
    const exp = exploracionGate("aprobado", { draftDVS: dvs });
    (exp.m1 as Record<string, unknown>).generacion = { huella: huellaGate(), en: "t" };
    sembrar(exp);
    expect((await POST(req())).status).toBe(200);
    const w = escrituraDvs()!;
    expect(w.data[SELLO]).toEqual({ huella: huellaGate(), en: "SERVER_TIMESTAMP" });
    expect(mockDb.updates().filter((u) => "phases.exploracion.dvs" in u.data)).toHaveLength(1); // una sola escritura
  });
  it("el sello lleva la huella de la GENERACIÓN, no la de la aprobación (borrador de otra versión → sello distinto)", async () => {
    const exp = exploracionGate("aprobado", { draftDVS: dvs });
    (exp.m1 as Record<string, unknown>).generacion = { huella: "huella-de-otra-generacion", en: "t" };
    sembrar(exp);
    await POST(req());
    expect((escrituraDvs()!.data[SELLO] as { huella: string }).huella).toBe("huella-de-otra-generacion");
  });
  it("lee la generación DENTRO de la transacción: si cambió desde la lectura previa, estampa la vigente", async () => {
    const previa = exploracionGate("aprobado", { draftDVS: dvs });
    (previa.m1 as Record<string, unknown>).generacion = { huella: "vieja", en: "t" };
    const enTx = exploracionGate("aprobado", { draftDVS: dvs });
    (enTx.m1 as Record<string, unknown>).generacion = { huella: huellaGate(), en: "t" };
    sembrar(previa, enTx);
    await POST(req());
    expect((escrituraDvs()!.data[SELLO] as { huella: string }).huella).toBe(huellaGate());
  });
  it("sin marca de generación: se BORRA el sello anterior (no se deja uno que diga que el dvs nuevo es de otra versión)", async () => {
    sembrar(exploracionGate("aprobado", { draftDVS: dvs }));
    await POST(req());
    expect(escrituraDvs()!.data[SELLO]).toBe("FIELD_DELETE");
  });
  it("sin registro m1 (proyecto anterior): no se escribe ningún sello", async () => {
    sembrar(exploracionGate("sin_m1", { draftDVS: dvs }));
    expect((await POST(req())).status).toBe(200);
    expect(escrituraDvs()!.data).not.toHaveProperty(SELLO);
  });
  it("compuesto con la guardia: el M1 se reabre entre la lectura previa y la transacción → 409 y NINGÚN sello ni dvs", async () => {
    sembrar(exploracionGate("aprobado", { draftDVS: dvs }), exploracionGate("reabierto", { draftDVS: dvs }));
    expect((await POST(req())).status).toBe(409);
    expect(mockDb.updates()).toEqual([]);
  });
  it("compuesto con la guardia: aprobado con otro contenido en la transacción → 409 y cero escrituras", async () => {
    sembrar(exploracionGate("aprobado", { draftDVS: dvs }), exploracionGate("aprobado", { draftDVS: dvs }, otroMapaGate));
    expect((await POST(req())).status).toBe(409);
    expect(mockDb.updates()).toEqual([]);
  });
});
