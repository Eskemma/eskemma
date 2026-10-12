// H25 (7b-3) — equivalencia del criterio de propiedad de approve sobre una SIEMBRA que representa el caso real
// medido el 26-10-12 (analysis.userId == dueño del proyecto en 142 de 142; PESTEL no tiene colaboradores).
// ES SOBRE SIEMBRA, NO SOBRE DATOS REALES: la medición real fue de solo lectura y está declarada en CLAUDE.md.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});

import { adminDb } from "@/lib/firebase-admin";
import { getAnalisisPropio } from "@/lib/centinela/pestel/analisisPropio";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
// Criterio ANTERIOR de approve: la copia `userId` del propio análisis.
const criterioAnterior = (analysis: { userId?: string } | undefined, uid: string) => !!analysis && analysis.userId === uid;

describe("propiedad de approve: por proyecto (nuevo) == por userId del análisis (anterior) en el caso real", () => {
  beforeEach(() => {
    mockDb.reset({
      "pestel_analyses/a1": { projectId: "p1", userId: "dueno" },
      "pestel_projects/p1": { userId: "dueno" },
      "pestel_analyses/a2": { projectId: "p2", userId: "otro-dueno" },
      "pestel_projects/p2": { userId: "otro-dueno" },
    });
  });

  it.each([
    ["a1", "dueno", true],
    ["a1", "intruso", false],
    ["a1", "otro-dueno", false],
    ["a2", "otro-dueno", true],
    ["a2", "dueno", false],
  ])("análisis %s, usuario %s → %s con ambos criterios", async (id, uid, esperado) => {
    const data = mockDb.snapshot()[`pestel_analyses/${id}`] as { userId?: string };
    expect(criterioAnterior(data, uid)).toBe(esperado);
    expect((await getAnalisisPropio(id, uid)) !== null).toBe(esperado);
  });

  it("análisis inexistente: ambos criterios lo tratan como ajeno/inexistente", async () => {
    expect(criterioAnterior(undefined, "dueno")).toBe(false);
    expect(await getAnalisisPropio("no-existe", "dueno")).toBeNull();
  });

  it("DIFERENCIA declarada: análisis cuyo proyecto no existe — antes pasaba la propiedad, ahora no", async () => {
    mockDb.reset({ "pestel_analyses/a9": { projectId: "p-borrado", userId: "dueno" } });
    expect(criterioAnterior(mockDb.snapshot()["pestel_analyses/a9"] as { userId?: string }, "dueno")).toBe(true);
    expect(await getAnalisisPropio("a9", "dueno")).toBeNull();
  });
});
