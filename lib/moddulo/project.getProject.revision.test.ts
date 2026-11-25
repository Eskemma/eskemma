// H-V48 (C4b-0): sintesis/generar y veredicto/generar capturan `phases.investigacion.revision.n` del
// proyecto que entrega getProject. Todas las pruebas de ruta simulan getProject; ESTA usa el REAL sobre el
// mock de Firestore: si getProject / normalizarProyectoLeido descartaran `revision`, el n capturado sería
// siempre 0 y toda generación en un proyecto con entregas o aprobaciones daría 409 f3_estado_cambio.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { adminDb } from "@/lib/firebase-admin";
import { getProject } from "./project";
import { revisionDeInvestigacion } from "./impactoRegeneracionF3";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const doc = (inv: Record<string, unknown>) => ({
  userId: "u1",
  name: "P",
  collaborators: [{ uid: "u1", role: "owner" }],
  phases: { exploracion: { dvs: { pip: [], semaforo: [] } }, investigacion: inv },
});

describe("getProject REAL conserva phases.investigacion.revision", () => {
  beforeEach(() => mockDb.reset());

  it("revision.n = 3 en el documento → project.phases.investigacion.revision.n === 3", async () => {
    mockDb.reset({
      "moddulo_projects/p1": doc({ f3TareasPIP: [], revision: { n: 3, huella: "h", por: "u1", en: "2026-11-25T00:00:00.000Z" } }),
    });
    const p = await getProject("p1", "u1");
    const inv = p?.phases?.investigacion as unknown as { revision?: { n?: number } };
    expect(inv.revision?.n).toBe(3);
    expect(revisionDeInvestigacion(p?.phases?.investigacion)).toBe(3);
  });

  it("también con síntesis y tablero presentes (las ramas que normalizarProyectoLeido reescribe)", async () => {
    mockDb.reset({
      "moddulo_projects/p1": doc({
        f3TareasPIP: [{ pipItemId: "t1", asignaciones: [] }],
        f3Sintesis: { vaciosResiduales: [] },
        revision: { n: 5 },
      }),
    });
    const p = await getProject("p1", "u1");
    expect(revisionDeInvestigacion(p?.phases?.investigacion)).toBe(5);
  });

  it("sin revision en el documento → 0 (igual que la guardia de la transacción)", async () => {
    mockDb.reset({ "moddulo_projects/p1": doc({ f3TareasPIP: [] }) });
    const p = await getProject("p1", "u1");
    expect(revisionDeInvestigacion(p?.phases?.investigacion)).toBe(0);
  });
});
