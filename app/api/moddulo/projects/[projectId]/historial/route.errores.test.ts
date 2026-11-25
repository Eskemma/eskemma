// C4a-1 — errores de la ruta del historial: 503 `indice_en_construccion` (nunca «sin historial»), 500 `historial_ilegible`
// y genérico SIN filtrar el mensaje interno; y que endurecer la visibilidad de un rol es cambiar UNA función (aquí se
// simula con un mock de `visibilidadHistorial`: client sin permiso → 403; sin detalle → nombres y detalle ocultos).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
const lector = vi.hoisted(() => ({ falla: null as unknown }));
vi.mock("@/lib/moddulo/versionado/leerHistorial", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/moddulo/versionado/leerHistorial")>();
  return {
    ...orig,
    leerHistorialFase: vi.fn((...a: Parameters<typeof orig.leerHistorialFase>) => {
      if (lector.falla) return Promise.reject(lector.falla);
      return orig.leerHistorialFase(...a);
    }),
  };
});
const vis = vi.hoisted(() => ({
  panel: ((_r: string) => true) as (r: string) => boolean,
  detalle: ((_r: string) => true) as (r: string) => boolean,
}));
vi.mock("@/lib/moddulo/versionado/visibilidadHistorial", () => ({
  puedeVerPanelHistorial: (r: string) => vis.panel(r),
  puedeVerDetalleHistorial: (r: string) => vis.detalle(r),
  // C4b-1a: la regla real de quién puede volver (owner y co-consultant).
  puedeVolverAVersion: (r: string) => r === "owner" || r === "co-consultant",
}));

import { Timestamp } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { HistorialIlegibleError, IndiceNoListoError } from "@/lib/moddulo/versionado/leerHistorial";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { mockSessionPayload } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { GET } from "./route";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";

const pedir = () =>
  GET(new Request("http://local/x?fase=exploracion") as never, { params: Promise.resolve({ projectId: "p1" }) });

beforeEach(() => {
  lector.falla = null;
  vis.panel = () => true;
  vis.detalle = () => true;
  vi.mocked(getSessionFromRequest).mockResolvedValue(mockSessionPayload({ uid: "cli" }));
  db.reset({
    [P]: {
      name: "Proyecto",
      collaborators: [{ uid: "owner", role: "owner", displayName: "Raúl" }, { uid: "cli", role: "client", displayName: "Candidata" }],
      phases: { exploracion: { revision: { n: 1, huella: "h", por: "owner", en: Timestamp.fromDate(new Date("2026-11-10T10:00:00.000Z")) } } },
    },
    [`${P}/revisiones/exploracion_000001`]: {
      fase: "exploracion", ambito: "moddulo", n: 1,
      artefactos: { f2M1: { versionId: "f2M1__000001", n: 1, tupla: "t", dependeDe: [], retenidas: [{ id: "f2M1__000001", n: 1, aprobada: false, protegida: false }] } },
    },
    [`${P}/eventos/e1`]: {
      tipo: "ajuste_manual", fase: "exploracion", ambito: "moddulo", artefactos: ["f2M1"], revisionN: 1, versionIds: { f2M1: "f2M1__000001" },
      por: "owner", en: Timestamp.fromDate(new Date("2026-11-01T10:00:00.000Z")), motivo: "desvinculacion", detalle: { teniaAprobacion: true },
    },
  });
});
afterEach(() => vi.restoreAllMocks());

describe("errores", () => {
  it("índice no listo → 503 `indice_en_construccion` (no un historial vacío)", async () => {
    lector.falla = new IndiceNoListoError();
    const r = await pedir();
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "indice_en_construccion" });
  });
  it("historial ilegible → 500 `historial_ilegible`, sin el detalle interno en el cuerpo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    lector.falla = new HistorialIlegibleError("el puntero apunta a la revisión 9, que no existe.");
    const r = await pedir();
    expect(r.status).toBe(500);
    const c = await r.json();
    expect(c).toEqual({ error: "historial_ilegible" });
  });
  it("error inesperado → 500 genérico sin filtrar el mensaje", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    lector.falla = new Error("detalle interno secreto de Firestore");
    const r = await pedir();
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("secreto");
  });
});

describe("la visibilidad se endurece en UNA función", () => {
  it("hoy el cliente ve el historial con nombres y detalle", async () => {
    const c = await (await pedir()).json();
    expect(c.filas[0]).toMatchObject({ quien: "Raúl", detalleTexto: "El análisis estaba aprobado." });
  });
  it("si `puedeVerPanelHistorial(client)` pasa a false → 403 `sin_permiso`", async () => {
    vis.panel = (r) => r !== "client";
    const r = await pedir();
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "sin_permiso" });
  });
  it("si `puedeVerDetalleHistorial(client)` pasa a false → ve las filas pero sin nombres ni detalle", async () => {
    vis.detalle = (r) => r !== "client";
    const c = await (await pedir()).json();
    expect(c.filas[0].quien).toBe("Alguien del equipo");
    expect(c.filas[0].detalleTexto).toBeNull();
    expect(c.filas[0].titulo).toBe("Desvinculó el análisis de PESTEL, la app del Hub Centinela");
  });
});
