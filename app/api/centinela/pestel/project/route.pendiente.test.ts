// T5 (N6) — POST /pestel/project: el vínculo pendiente vive SOLO en el back-link. El POST no escribe en el Moddulo,
// ya no responde 409 `conflict`, ignora `confirmReplace`, deduplica en una transacción y respeta la Fase 2 cerrada.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModduloProject } from "@/types/moddulo.types";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "TS", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const UID = "uidA";
const M = "modA";
const body = { nombre: "PESTEL de prueba", tipo: "electoral", territorio: { nivel: "nacional", nombre: "México" }, horizonte: 12 };
const llamar = async (extra: Record<string, unknown> = {}) => {
  const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify({ ...body, modduloProjectId: M, ...extra }) }) as never);
  return { status: r.status, cuerpo: await r.json() };
};
const sembrar = (exploracion: Record<string, unknown> = {}, extra: Record<string, unknown> = {}, moddulo: Record<string, unknown> = {}) => {
  db.reset({ [`moddulo_projects/${M}`]: { ...moddulo, phases: { exploracion } }, ...extra });
  db.atomico(true);
};
const pestel = () => Object.keys(db.snapshot()).filter((k) => k.startsWith("pestel_projects/"));
const escriteEnModdulo = () => db.updates().some((u) => u.path.startsWith("moddulo_projects/"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
  vi.mocked(getProject).mockResolvedValue({} as unknown as ModduloProject);
});

describe("POST /pestel/project — pendiente solo en el back-link (T5)", () => {
  it("[real] crea el PESTEL con el back-link y NO escribe nada en el Moddulo (antes: linkedSource T22 sin mapa)", async () => {
    sembrar();
    const antes = structuredClone(db.snapshot()[`moddulo_projects/${M}`]);
    const r = await llamar();
    expect(r.status).toBe(201);
    expect(db.snapshot()[`pestel_projects/${r.cuerpo.projectId}`]).toMatchObject({ userId: UID, modduloProjectId: M });
    expect(escriteEnModdulo()).toBe(false);
    expect(db.snapshot()[`moddulo_projects/${M}`]).toEqual(antes);
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
  });

  it("[real] un Moddulo con mapa EXPRESS ya no da 409: crea el pendiente y deja el express intacto", async () => {
    const express = { kind: "express", componente: "moddulo", sourceId: M, payload: { P: {} } };
    sembrar({ linkedSource: express });
    const r = await llamar();
    expect(r.status).toBe(201);
    expect((db.snapshot()[`moddulo_projects/${M}`] as { phases: { exploracion: { linkedSource: unknown } } }).phases.exploracion.linkedSource).toEqual(express);
  });

  it("[real] ya no existe el 409 `conflict` ni la reescritura por confirmReplace: el parámetro se ignora", async () => {
    sembrar({ linkedSource: { kind: "express", sourceId: M, payload: { P: {} } } });
    const r = await llamar({ confirmReplace: true });
    expect(r.status).toBe(201);
    expect(r.cuerpo.error).toBeUndefined();
    expect(escriteEnModdulo()).toBe(false);
  });

  it("[real] un T22 con análisis importado y SIN back-link (asimetría) → 409 moddulo_already_linked, nada creado", async () => {
    sembrar({ linkedSource: { kind: "T22", sourceId: "otro", sourceAnalysisId: "an1", payload: { P: {} } } });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo.error).toBe("moddulo_already_linked");
    expect(r.cuerpo.message).toContain("«Desvincular»");
    expect(pestel()).toEqual([]);
  });

  it("[real] Fase 2 cerrada → 409 fase_cerrada y no crea nada", async () => {
    sembrar({ status: "completed" });
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(r.cuerpo).toEqual({ error: "fase_cerrada" });
    expect(pestel()).toEqual([]);
  });

  it("[real] Moddulo en papelera (visto dentro de la transacción) → 404 y no crea nada", async () => {
    sembrar({}, {}, { deletedAt: "2026-11-01" });
    const r = await llamar();
    expect(r.status).toBe(404);
    expect(pestel()).toEqual([]);
  });

  it("SE CONSERVA — dedup: con un pendiente ya existente (o un T22 sin análisis con su back-link) responde 200 con el más reciente, sin escribir", async () => {
    sembrar({ linkedSource: { kind: "T22", sourceId: "p1" } }, {
      "pestel_projects/p1": { userId: UID, modduloProjectId: M, createdAt: { _seconds: 5 } },
      "pestel_projects/p2": { userId: UID, modduloProjectId: M, createdAt: { _seconds: 9 } },
    });
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.projectId).toBe("p2");
    expect(db.updates()).toEqual([]);
    expect(pestel().length).toBe(2);
  });

  it("SE CONSERVA — un PESTEL de OTRO usuario con ese back-link no cuenta: se crea el nuevo", async () => {
    sembrar({}, { "pestel_projects/ajeno": { userId: "otro", modduloProjectId: M } });
    const r = await llamar();
    expect(r.status).toBe(201);
  });

  it("[local] si la transacción falla: 500 genérico y nada queda creado", async () => {
    sembrar();
    db.runTransaction.mockRejectedValueOnce(new Error("boom"));
    const r = await llamar();
    expect(r.status).toBe(500);
    expect(r.cuerpo).toEqual({ error: "No se pudo crear el proyecto" });
    expect(pestel()).toEqual([]);
  });

  it("SE CONSERVA — sin Moddulo de origen: 201 sin transacción y sin leer proyectos", async () => {
    db.reset({});
    const r = await POST(new Request("http://local/x", { method: "POST", body: JSON.stringify(body) }) as never);
    expect(r.status).toBe(201);
    expect(vi.mocked(getProject)).not.toHaveBeenCalled();
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});
