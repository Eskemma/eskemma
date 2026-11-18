// C1b-1 — COSTO de m1-approve, medido con los contadores del mock: TOTALES (lecturas / escrituras) de la transacción.
// `getProject` (acceso) suma +1 lectura y +1 escritura (`lastAccessedAt`) en TODOS los caminos (H-V23): aquí está
// mockeado, así que NO entra en estos números. Antes de C1b-1: aprobar = 1 lectura / 1 escritura (sin historial).
// Los conteos son del mock, no de Firestore real. Sin emulador (Java 17).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase-admin/firestore")>()),
  FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" },
}));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { aprobacionDe, docProyectoM1, huellaDe, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";
import { exploracionDe, registrarVigenteF2 } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", huellaVista: huellaDe(mapaM1()), ...o }) }) as never;

function sembrar(doc: unknown) {
  db.reset({ [P]: structuredClone(doc) });
  db.rechazarUndefined(true);
  db.atomico(true);
}
/** Mide SOLO la llamada a la ruta (la siembra de historial no cuenta). */
async function medir(o: Record<string, unknown> = {}) {
  const antes = db.contadores();
  const res = await POST(req(o));
  const d = db.contadores();
  return { status: res.status, lecturas: d.lecturas - antes.lecturas, escrituras: d.escrituras - antes.escrituras, borrados: d.borrados - antes.borrados };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
  sembrar(docProyectoM1());
});

describe("costo de aprobar (totales de la transacción)", () => {
  it("primera aprobación SIN historial previo: 1 lectura / 5 escrituras (proyecto + versión previa + versión + revisión + evento)", async () => {
    expect(await medir()).toEqual({ status: 200, lecturas: 1, escrituras: 5, borrados: 0 });
  });

  it("CON historial vigente (régimen): 2 lecturas (proyecto + manifiesto) / 4 escrituras (proyecto + versión + revisión + evento)", async () => {
    await registrarVigenteF2(db, P);
    expect(await medir()).toEqual({ status: 200, lecturas: 2, escrituras: 4, borrados: 0 });
  });

  it("con DERIVA (el vivo cambió sin registro): 2 lecturas / 5 escrituras (+1: la versión de deriva)", async () => {
    await registrarVigenteF2(db, P);
    const doc = structuredClone(db.snapshot()[P]) as { phases: { exploracion: { linkedSource: { payload: { P: { narrativa: string } } } } } };
    doc.phases.exploracion.linkedSource.payload.P.narrativa = "otra";
    db.seed(P, doc);
    const nueva = exploracionDe(db, P).linkedSource!.payload as never;
    expect(await medir({ huellaVista: huellaDe(nueva) })).toEqual({ status: 200, lecturas: 2, escrituras: 5, borrados: 0 });
  });

  it("los caminos que NO escriben cuestan 1 lectura / 0 escrituras (como antes): yaAprobado, m1_cambio, fase_cerrada", async () => {
    sembrar(docProyectoM1({ m1: { aprobacion: aprobacionDe(mapaM1()) } }));
    expect(await medir()).toEqual({ status: 200, lecturas: 1, escrituras: 0, borrados: 0 });
    sembrar(docProyectoM1());
    expect(await medir({ huellaVista: "otra" })).toEqual({ status: 409, lecturas: 1, escrituras: 0, borrados: 0 });
    sembrar(docProyectoM1({ status: "completed" }));
    expect(await medir()).toEqual({ status: 409, lecturas: 1, escrituras: 0, borrados: 0 });
  });
});
