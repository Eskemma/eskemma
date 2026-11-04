// link-moddulo (T5): un Moddulo que ya tiene un análisis de Centinela EN PREPARACIÓN rechaza vincular otro.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" } }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { MENSAJE_MODDULO_CON_PENDIENTE } from "@/lib/moddulo/textosVinculo";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const NAC = { nivel: "nacional", nombre: "México" };
const vincular = async (extra: Record<string, unknown>, moddulo: Record<string, unknown> = {}) => {
  db.reset({
    "pestel_projects/pestB": { userId: "u1", tipo: "electoral", territorio: NAC },
    "moddulo_projects/m1": { name: "M", type: "electoral", territorio: NAC, xpcto: { hito: "h" }, phases: { exploracion: moddulo }, collaborators: [{ uid: "u1" }] },
    ...extra,
  });
  db.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: "m1" }) }) as never, { params: Promise.resolve({ projectId: "pestB" }) });
  return { status: r.status, cuerpo: await r.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("link-moddulo — pendiente duplicado (T5)", () => {
  it("[real] otro PESTEL del usuario apunta al Moddulo (pendiente por back-link): 409 moddulo_con_pendiente con el texto de «Cancelar vínculo pendiente», sin escribir", async () => {
    const r = await vincular({ "pestel_projects/pestA": { userId: "u1", modduloProjectId: "m1" } });
    expect(r.status).toBe(409);
    expect(r.cuerpo).toEqual({ error: "moddulo_con_pendiente", message: MENSAJE_MODDULO_CON_PENDIENTE });
    expect(r.cuerpo.message).toContain("«Cancelar vínculo pendiente»");
    expect(db.updates()).toEqual([]);
  });

  it("[real] la forma antigua (T22 sin análisis de otro PESTEL) también es un pendiente", async () => {
    const r = await vincular({}, { linkedSource: { kind: "T22", sourceId: "pestA" } });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("moddulo_con_pendiente");
    expect(db.updates()).toEqual([]);
  });

  it("SE CONSERVA — un T22 de otro PESTEL CON análisis importado sigue siendo «ya usa otro análisis» (moddulo_already_linked)", async () => {
    const r = await vincular({ "pestel_projects/pestA": { userId: "u1", modduloProjectId: "m1" } }, { linkedSource: { kind: "T22", sourceId: "pestA", sourceAnalysisId: "anA", payload: { P: {} } } });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("moddulo_already_linked");
  });

  it("SE CONSERVA — el back-link de un PESTEL de OTRO usuario no cuenta: se vincula", async () => {
    const r = await vincular({ "pestel_projects/pestA": { userId: "otro", modduloProjectId: "m1" } });
    expect(r.status).toBe(201);
  });
});
