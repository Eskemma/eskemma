// C1b-3b — `completePhase()` (lib/moddulo/project.ts) se eliminó: escribía `status: "completed"`, `completedAt`, `report` y
// `currentPhase` SIN transacción, SIN compuertas y SIN historial, y no tenía ningún llamador (grep de 26-11-18 sobre
// app, lib, functions, scripts, pruebas, docs e imports dinámicos). Un cierre de fase pasa SOLO por la ruta
// `complete-phase`; esta prueba evita que reaparezca un segundo escritor de cierre sin historial.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({ adminDb: {} }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

describe("lib/moddulo/project — no hay un segundo escritor de cierre de fase", () => {
  it("no exporta `completePhase`", async () => {
    const m = await import("./project");
    expect("completePhase" in m).toBe(false);
  });
});
