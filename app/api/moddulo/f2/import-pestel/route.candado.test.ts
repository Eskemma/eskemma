// Paso 4 — import-pestel: UNA sola confirmación. Una fuente distinta (409 `conflict`) y el candado H15 se piden
// juntos: el 409 conserva su código y su mensaje pero ahora trae las líneas reales y la huella; `confirmar` +
// `huella` es la confirmación explícita (equivale a `confirmReplace`). Revalidado dentro de la transacción.

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
const P = "moddulo_projects/p1";
const llamar = async (cuerpo: Record<string, unknown> = {}) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", pestAnalysisId: "a1", ...cuerpo }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const sembrar = (exploracion: Record<string, unknown>) => {
  vi.mocked(getProject).mockResolvedValue({ id: "p1", xpcto: { hito: "h" }, phases: { exploracion } } as never);
  db.reset({
    "pestel_analyses/a1": { projectId: "pest1", dimensions: [] },
    "pestel_projects/pest1": { userId: "u1" },
    [P]: { phases: { exploracion } },
  });
  db.atomico(true);
};
const escribio = () => db.updates().some((u) => u.path === P);
// An express M1, approved, with motors: replacing it by Centinela's loses all of that.
const expressCargado = () => {
  const x = exploracionGate("aprobado", { draftDVS: { x: 1 }, motorAprobaciones: { M3: true }, dvs: { f: 1 } });
  (x.linkedSource as { kind: string; sourceId: string }).sourceId = "p1";
  return x;
};
const mismoProyecto = () => {
  const x = exploracionGate("aprobado");
  x.linkedSource = { kind: "T22", componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a-vieja", payload: (x.linkedSource as { payload: object }).payload };
  return x;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("import-pestel — una sola confirmación", () => {
  it("proyecto limpio: importa sin pedir nada (primer import)", async () => {
    sembrar({});
    expect((await llamar()).status).toBe(200);
    expect(escribio()).toBe(true);
  });

  it("fuente DISTINTA con M1 aprobado y motores: un solo 409 `conflict` que ADEMÁS trae las líneas y la huella; no escribe", async () => {
    sembrar(expressCargado());
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("conflict");
    expect(r.cuerpo.message).toContain("ya tiene un análisis PESTEL importado");
    expect(r.cuerpo.lineas.join(" ")).toContain("Se perderá la aprobación del análisis");
    expect(typeof r.cuerpo.huella).toBe("string");
    expect(escribio()).toBe(false);
  });

  it("esa MISMA confirmación (confirmar + huella) basta para reemplazar la otra fuente, sin segundo modal", async () => {
    sembrar(expressCargado());
    const { cuerpo } = await llamar();
    const r = await llamar({ confirmar: true, huella: cuerpo.huella });
    expect(r.status).toBe(200);
    const d = db.updates().find((u) => u.path === P)!.data;
    expect(d["phases.exploracion.m1"]).toEqual({ creadoEn: "TS" });
    expect(d["phases.exploracion.draftDVS"]).toBe("__DELETE__");
    expect(d).not.toHaveProperty("phases.exploracion.dvs");
  });

  it("`confirmReplace` SIN huella ya no basta (cliente viejo): pide la confirmación con huella", async () => {
    sembrar(expressCargado());
    const r = await llamar({ confirmReplace: true });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(escribio()).toBe(false);
  });

  it("MISMO proyecto Centinela con análisis renovado y un M1 aprobado/editado: re-sincronizar también pide confirmación (antes sobrescribía en silencio)", async () => {
    sembrar(mismoProyecto());
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(r.cuerpo.lineas.join(" ")).toContain("aprobación");
    expect(escribio()).toBe(false);
    expect((await llamar({ confirmar: true, huella: r.cuerpo.huella })).status).toBe(200);
  });

  it("el MISMO análisis ya importado: 200 idempotente sin pedir nada ni escribir", async () => {
    const x = mismoProyecto();
    (x.linkedSource as { sourceAnalysisId: string }).sourceAnalysisId = "a1";
    sembrar(x);
    expect((await llamar()).status).toBe(200);
    expect(escribio()).toBe(false);
  });

  it("huella de otro estado: reemplazo_huella_vencida; nada escrito", async () => {
    sembrar(expressCargado());
    const r = await llamar({ confirmar: true, huella: "vieja" });
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_huella_vencida");
    expect(escribio()).toBe(false);
  });

  it("[carrera] la lectura previa ve un proyecto limpio pero al escribir ya hay un M1 aprobado: 409 y cero escrituras", async () => {
    sembrar({});
    db.reset({ "pestel_analyses/a1": { projectId: "pest1", dimensions: [] }, "pestel_projects/pest1": { userId: "u1" }, [P]: { phases: { exploracion: expressCargado() } } });
    db.atomico(true);
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
    expect(escribio()).toBe(false);
  });

  it("[carrera] la Fase 2 se cierra entre la lectura previa y la transacción: 409 fase_cerrada y cero escrituras", async () => {
    sembrar({});
    db.reset({ "pestel_analyses/a1": { projectId: "pest1", dimensions: [] }, "pestel_projects/pest1": { userId: "u1" }, [P]: { phases: { exploracion: { status: "completed" } } } });
    db.atomico(true);
    expect((await llamar()).cuerpo).toEqual({ error: "fase_cerrada" });
    expect(escribio()).toBe(false);
  });
});
