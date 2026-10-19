// Paso 4 — link-moddulo: vincular REEMPLAZA el M1 del proyecto Moddulo. Con algo que se perdería (el M1, sus
// ediciones o aprobación, el borrador de motores o sus aprobaciones) el servidor pide UNA confirmación ligada a la
// huella; la advertencia de territorio (forceLink) es un paso aparte. Revalidado dentro de la transacción.

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
import { exploracionGate } from "@/lib/moddulo/__tests__/fixtures/m1Gate";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ projectId: "pest1" }) };
const NAC = { nivel: "nacional", nombre: "México" };
const post = async (cuerpo: Record<string, unknown> = {}) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ modduloProjectId: "m1", ...cuerpo }) }) as never, ctx);
  return { status: r.status, cuerpo: await r.json() };
};
const sembrar = (exploracion: Record<string, unknown>) => {
  db.reset({
    "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: NAC },
    "moddulo_projects/m1": { name: "M", type: "electoral", territorio: NAC, xpcto: { hito: "h" }, phases: { exploracion } },
    "pestel_analyses/a1": { projectId: "pest1", analyzedAt: "2026-10-01T00:00:00Z", dimensions: [] },
  });
  db.atomico(true);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
};
const escribioModdulo = () => db.updates().some((u) => u.path === "moddulo_projects/m1");
// Express M1 approved with motors (the upgrade express→Centinela case).
const cargado = () => {
  const x = exploracionGate("aprobado", { draftDVS: { x: 1 }, motorAprobaciones: { M2: true } });
  (x.linkedSource as { sourceId: string }).sourceId = "pest1";
  return x;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("link-moddulo — candado de vincular", () => {
  it("Moddulo limpio: vincula sin pedir nada (201)", async () => {
    sembrar({});
    expect((await post()).status).toBe(201);
    expect(escribioModdulo()).toBe(true);
  });

  it("express aprobado con motores: 409 reemplazo_requiere_confirmacion con las líneas y la huella; no escribe", async () => {
    sembrar(cargado());
    const r = await post();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(r.cuerpo.lineas.join(" ")).toContain("Se perderá la aprobación del análisis");
    expect(typeof r.cuerpo.huella).toBe("string");
    expect(db.updates()).toEqual([]);
  });

  it("confirmado con la huella devuelta: vincula (201), deja un M1 nuevo en borrador y descarta el borrador de motores", async () => {
    sembrar(cargado());
    const { cuerpo } = await post();
    const r = await post({ confirmar: true, huella: cuerpo.huella });
    expect(r.status).toBe(201);
    const d = db.updates().find((u) => u.path === "moddulo_projects/m1")!.data;
    expect(d["phases.exploracion.m1"]).toEqual({ creadoEn: "TS" });
    expect(d["phases.exploracion.draftDVS"]).toBe("__DELETE__");
    expect(db.updates().find((u) => u.path === "pestel_projects/pest1")!.data.modduloProjectId).toBe("m1");
  });

  it("huella de otro estado: reemplazo_huella_vencida; nada escrito", async () => {
    sembrar(cargado());
    const r = await post({ confirmar: true, huella: "vieja" });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_huella_vencida");
    expect(db.updates()).toEqual([]);
  });

  it("UNA sola confirmación: el territorio con `forceLink` y la confirmación de reemplazo viajan en la misma petición", async () => {
    sembrar(cargado());
    db.reset({ ...db.snapshot(), "pestel_projects/pest1": { userId: "u1", tipo: "electoral", territorio: { nivel: "estatal", nombre: "Jalisco", estado: "Jalisco" } } });
    db.atomico(true);
    const sinForce = await post();
    expect(sinForce.cuerpo.error).toBe("territorio_mismatch"); // el territorio se resuelve ANTES, con su propio paso
    const pide = await post({ forceLink: true });
    expect(pide.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect((await post({ forceLink: true, confirmar: true, huella: pide.cuerpo.huella })).status).toBe(201);
  });

  it("el mismo análisis ya importado (C7b) y el idempotente NO piden confirmación: no reemplazan nada", async () => {
    const x = exploracionGate("aprobado");
    x.linkedSource = { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", payload: (x.linkedSource as { payload: object }).payload };
    sembrar(x);
    expect((await post()).status).toBe(200);
    expect(escribioModdulo()).toBe(false);
  });

  it("[carrera] limpio en la lectura previa, pero al escribir ya hay un M1 aprobado: 409 y cero escrituras", async () => {
    sembrar({});
    const previa = structuredClone(db.snapshot()["moddulo_projects/m1"]);
    sembrar(cargado());
    vi.mocked(getProject).mockResolvedValue(previa as never);
    const r = await post();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(db.updates()).toEqual([]);
  });

  it("Fase 2 cerrada: sigue siendo fase_cerrada (va antes del candado)", async () => {
    sembrar({ ...cargado(), status: "completed" });
    expect((await post()).cuerpo).toEqual({ error: "fase_cerrada" });
  });
});
