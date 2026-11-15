// 7b-7 (N2) — la reentrega de un resultado YA APROBADO armaba la asignación con `resultadoId: undefined`
// y el Admin SDK real rechaza `undefined` (lib/firebase-admin.ts no activa ignoreUndefinedProperties):
// la entrega daba 500 DESPUÉS de pisar el resultado. El mock permisivo de siempre lo aceptaba, por eso
// ninguna prueba lo vio. Aquí el mock rechaza `undefined` con el mensaje literal del SDK real
// (rechazarUndefined, contrastado con el SDK en adminMocks.test.ts).
// Contra el código anterior: la prueba de la reentrega falla con
//   Update() requires either a single JavaScript object … Cannot use "undefined" as a Firestore value
//   (found in field "`phases.investigacion.f3TareasPIP`.`0`.asignaciones.`0`.resultadoId") …

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb(), adminStorage: createMockAdminStorage() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/moddulo/project")>()),
  getProject: vi.fn(),
}));
vi.mock("@/lib/moddulo/attachments", () => ({ extractTextPerFile: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { POST } from "./route";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import {
  UID, PROJECT_ID, SESION_ID, OWN_PATH, RESULTADO_PREVIO,
  rutaProyecto, rutaSesion, rutaResultado, proyectoDoc, sesionDoc, comoProject,
} from "./siembraEntregar";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;

const peticion = () =>
  new Request("http://localhost/api/moddulo/f3/canal1/entregar", {
    method: "POST",
    body: JSON.stringify({ projectId: PROJECT_ID, sesionId: SESION_ID, storagePath: OWN_PATH }),
  }) as unknown as Parameters<typeof POST>[0];

function sembrar(asig: Record<string, unknown>, sesionExtra: Record<string, unknown>) {
  const proyecto = proyectoDoc(asig);
  db.reset({ [rutaProyecto]: proyecto, [rutaSesion]: sesionDoc(sesionExtra) });
  db.rechazarUndefined(true);
  vi.mocked(getProject).mockResolvedValue(comoProject(proyecto));
}

describe("canal1/entregar — N2: nada llega a Firestore con undefined", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: UID }));
    vi.mocked(extractTextPerFile).mockResolvedValue("texto extraído");
  });

  it("reentrega con la asignación ya aprobada: termina en 200 y la asignación se escribe SIN la clave resultadoId", async () => {
    sembrar(
      { estado: "recibido", resultadoId: RESULTADO_PREVIO },
      { entregaCanal1: { fecha: "2026-01-01", resultadoId: RESULTADO_PREVIO } }
    );
    const res = await POST(peticion());
    expect(res.status).toBe(200);

    const tablero = (db.snapshot()[rutaProyecto] as {
      "phases.investigacion.f3TareasPIP": Array<{ asignaciones: Array<Record<string, unknown>> }>;
    })["phases.investigacion.f3TareasPIP"];
    const a1 = tablero[0].asignaciones[0];
    expect(a1.estado).toBe("en_curso");
    expect("resultadoId" in a1).toBe(false); // omitida, no undefined
    expect(db.snapshot()[rutaResultado(RESULTADO_PREVIO)]).toBeDefined();
    expect((db.snapshot()[rutaSesion] as { entregaCanal1: { resultadoId: string } }).entregaCanal1.resultadoId).toBe(RESULTADO_PREVIO);
  });

  it("primera entrega y reentrega sin aprobar siguen funcionando con el mock que rechaza undefined", async () => {
    sembrar({}, {});
    expect((await POST(peticion())).status).toBe(200);
    sembrar({}, { entregaCanal1: { fecha: "2026-01-01", resultadoId: RESULTADO_PREVIO } });
    expect((await POST(peticion())).status).toBe(200);
  });
});
