// C4a-1 — CARACTERIZACIÓN: lo que el LECTOR del historial da por hecho del registrador (`registrar.ts`). Se escribe y pasa
// contra el código ANTERIOR a C4a-1 (no cambia nada del registrador): si alguien altera una de estas propiedades, el
// lector deja de ser fiable y esta prueba lo dice antes que el panel.
//   1. Cada acción registrada deja EXACTAMENTE un evento con `fase` (texto) y `revisionN` (entero) = la revisión creada.
//   2. Las revisiones de una fase son 1..n sin saltos; dos fases del mismo proyecto numeran por separado (por eso el
//      lector filtra por fase).
//   3. Los eventos NO se podan; la poda solo quita ids de las `retenidas` del manifiesto vigente (que es la lista
//      autoritativa de las versiones que existen).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase-admin/firestore")>()),
  FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" },
}));

import { adminDb } from "@/lib/firebase-admin";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { consolidarSemilla, registrarEnSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
type Doc = Record<string, unknown>;

const accion = async (fase: string, n: number, extra: Doc = {}) => {
  await registrarEnSemilla(
    db, P,
    [{ artefacto: `a:${fase}`, contenido: { v: n } }],
    { punteroCampo: `phases.${fase}.revision`, ambito: "moddulo", fase, ...extra }
  );
  consolidarSemilla(db, P);
};
const hijos = (sub: string): Array<Doc & { id: string }> =>
  Object.entries(db.snapshot()).filter(([k]) => k.startsWith(`${P}/${sub}/`)).map(([k, v]) => ({ ...(v as Doc), id: k.split("/").pop() as string }));

beforeEach(() => {
  db.reset({ [P]: { name: "Proyecto", phases: {} } });
  db.rechazarUndefined(true);
  db.atomico(true);
});

describe("contrato del registrador que el lector da por hecho", () => {
  it("un evento por acción, con `fase` y `revisionN` enteros que coinciden con la revisión creada", async () => {
    for (let i = 1; i <= 4; i++) await accion("exploracion", i);
    const eventos = hijos("eventos");
    const revisiones = hijos("revisiones");
    expect(eventos).toHaveLength(4);
    expect(revisiones).toHaveLength(4);
    expect(eventos.map((e) => e.revisionN).sort()).toEqual([1, 2, 3, 4]);
    for (const e of eventos) {
      expect(typeof e.fase).toBe("string");
      expect(e.fase).toBe("exploracion");
      expect(Number.isInteger(e.revisionN)).toBe(true);
      expect(revisiones.some((r) => r.id === `exploracion_${String(e.revisionN).padStart(6, "0")}`)).toBe(true);
    }
  });

  it("dos fases numeran por separado: ambas empiezan en 1 y comparten la colección `eventos`", async () => {
    await accion("exploracion", 1);
    await accion("investigacion", 1);
    await accion("exploracion", 2);
    const eventos = hijos("eventos");
    const por = (f: string) => eventos.filter((e) => e.fase === f).map((e) => e.revisionN).sort();
    expect(por("exploracion")).toEqual([1, 2]);
    expect(por("investigacion")).toEqual([1]);
  });

  it("el puntero cuenta las acciones (puntero.n = nº de eventos de la fase)", async () => {
    for (let i = 1; i <= 3; i++) await accion("proposito", i);
    const doc = db.snapshot()[P] as { phases: { proposito: { revision: { n: number } } } };
    expect(doc.phases.proposito.revision.n).toBe(3);
    expect(hijos("eventos").filter((e) => e.fase === "proposito")).toHaveLength(doc.phases.proposito.revision.n);
  });

  it("la poda quita ids de `retenidas` del manifiesto vigente pero NUNCA borra eventos ni revisiones", async () => {
    // tope 2 y 6 versiones distintas del mismo artefacto: la poda borra de a 2 por acción como máximo.
    for (let i = 1; i <= 6; i++) await accion("exploracion", i, { tope: 2 });
    expect(hijos("eventos")).toHaveLength(6);
    expect(hijos("revisiones")).toHaveLength(6);
    const vigente = hijos("revisiones").find((r) => r.id === "exploracion_000006") as unknown as { artefactos: Record<string, { versionId: string; retenidas: { id: string }[] }> };
    const entrada = vigente.artefactos["a:exploracion"];
    const existentes = new Set(hijos("versiones").map((v) => v.id));
    // La lista autoritativa: todo lo que dice `retenidas` existe y todo lo que existe está en `retenidas`.
    expect(new Set(entrada.retenidas.map((r) => r.id))).toEqual(existentes);
    expect(entrada.retenidas.length).toBeLessThan(6); // sí se podó
    expect(existentes.has(entrada.versionId)).toBe(true); // la vigente nunca se poda
  });
});
