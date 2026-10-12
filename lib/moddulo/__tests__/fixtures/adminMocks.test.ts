// H25 (7b-2) — el fixture modela «todo o nada» SOLO en batch() y en el modo atómico opt-in; el update
// suelto y la transacción por defecto conservan su semántica de siempre (los usan informes,
// impact-chain, dvsVersiones y escribirF3Condicional).

import { describe, expect, it } from "vitest";
import { createMockAdminDb } from "./adminMocks";

describe("adminMocks — semántica por modo", () => {
  it("update() suelto sobre un documento inexistente NO falla (merge, como antes)", async () => {
    const db = createMockAdminDb();
    await db.collection("c").doc("nuevo").update({ a: 1 });
    expect(db.snapshot()["c/nuevo"]).toEqual({ a: 1 });
  });

  it("transacción por defecto: escribe al instante y no revierte si el callback lanza después", async () => {
    const db = createMockAdminDb({ "c/x": { v: 1 } });
    await expect(
      db.runTransaction(async (tx) => {
        await tx.update(db.collection("c").doc("x"), { v: 2 });
        throw new Error("boom");
      })
    ).rejects.toThrow();
    expect(db.snapshot()["c/x"]).toEqual({ v: 2 });
  });

  it("batch(): update de un documento inexistente falla el lote COMPLETO (no se aplica nada)", async () => {
    const db = createMockAdminDb({ "c/x": { v: 1 } });
    const b = db.batch();
    b.update(db.collection("c").doc("x") as never, { v: 2 });
    b.update(db.collection("c").doc("no-existe") as never, { v: 3 });
    await expect(b.commit()).rejects.toThrow();
    expect(db.snapshot()).toEqual({ "c/x": { v: 1 } });
  });

  it("transacción atómica opt-in: update inexistente o callback que lanza no aplican nada", async () => {
    const db = createMockAdminDb({ "c/x": { v: 1 } });
    db.atomico(true);
    await expect(
      db.runTransaction(async (tx) => {
        await tx.update(db.collection("c").doc("x"), { v: 2 });
        await tx.update(db.collection("c").doc("no-existe"), { v: 3 });
      })
    ).rejects.toThrow();
    await expect(
      db.runTransaction(async (tx) => {
        await tx.update(db.collection("c").doc("x"), { v: 2 });
        throw new Error("boom");
      })
    ).rejects.toThrow();
    expect(db.snapshot()).toEqual({ "c/x": { v: 1 } });
  });
});
