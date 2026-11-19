// C4a-1 — ampliación ADITIVA del mock compartido para lecturas paginadas: `startAfter`, `getAll` (con máscara de
// campos), `select` y orden por `Timestamp` reales. Lo que ya existía (where/orderBy/limit/get) no cambia: las pruebas
// de `adminMocks.test.ts` y las de las rutas pasan sin editarse. Cada documento leído cuenta 1 lectura (la máscara de
// campos NO baja la facturación, igual que Firestore real).
import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { createMockAdminDb } from "./adminMocks";

const t = (min: number) => Timestamp.fromDate(new Date(Date.UTC(2026, 10, 1, 10, min)));
const docs = () => ({
  "p/1/ev/a": { fase: "x", revisionN: 1, en: t(30), texto: "a" },
  "p/1/ev/b": { fase: "x", revisionN: 2, en: t(10), texto: "b" },
  "p/1/ev/c": { fase: "x", revisionN: 3, en: t(20), texto: "c" },
  "p/1/ev/d": { fase: "y", revisionN: 4, en: t(5), texto: "d" },
});
const ids = (r: { docs: { id: string }[] }) => r.docs.map((d) => d.id);

describe("startAfter", () => {
  it("descendente: devuelve lo MENOR que el cursor y excluye el propio valor", async () => {
    const db = createMockAdminDb(docs());
    const q = db.collection("p").doc("1").collection("ev").where("fase", "==", "x").orderBy("revisionN", "desc");
    expect(ids(await q.get())).toEqual(["c", "b", "a"]);
    expect(ids(await q.startAfter(3).get())).toEqual(["b", "a"]);
    expect(ids(await q.startAfter(2).limit(1).get())).toEqual(["a"]);
    expect(ids(await q.startAfter(1).get())).toEqual([]);
  });
  it("ascendente: devuelve lo MAYOR que el cursor", async () => {
    const db = createMockAdminDb(docs());
    const q = db.collection("p").doc("1").collection("ev").where("fase", "==", "x").orderBy("revisionN", "asc");
    expect(ids(await q.startAfter(1).get())).toEqual(["b", "c"]);
  });
  it("el orden de los operadores encadenados no importa", async () => {
    const db = createMockAdminDb(docs());
    const base = db.collection("p").doc("1").collection("ev");
    const a = await base.where("fase", "==", "x").orderBy("revisionN", "desc").startAfter(3).limit(1).get();
    const b = await base.where("fase", "==", "x").orderBy("revisionN", "desc").limit(1).startAfter(3).get();
    expect(ids(a)).toEqual(ids(b));
  });
});

describe("orden por Timestamp reales", () => {
  it("ordena por milisegundos (no por el objeto) y respeta el cursor", async () => {
    const db = createMockAdminDb(docs());
    const q = db.collection("p").doc("1").collection("ev").where("fase", "==", "x").orderBy("en", "desc");
    expect(ids(await q.get())).toEqual(["a", "c", "b"]);
    expect(ids(await q.startAfter(t(20)).get())).toEqual(["b"]);
  });
});

describe("select (máscara de campos)", () => {
  it("el documento solo trae los campos pedidos, pero la lectura cuenta completa", async () => {
    const db = createMockAdminDb(docs());
    const r = await db.collection("p").doc("1").collection("ev").where("fase", "==", "x").select("revisionN").get();
    expect(r.docs.map((d) => d.data())).toEqual(expect.arrayContaining([{ revisionN: 1 }, { revisionN: 2 }, { revisionN: 3 }]));
    expect(db.contadores().lecturas).toBe(3);
  });
});

describe("getAll", () => {
  it("devuelve un snapshot por ref, en orden, exista o no, y cuenta una lectura por documento", async () => {
    const db = createMockAdminDb(docs());
    const col = db.collection("p").doc("1").collection("ev");
    const snaps = await db.getAll(col.doc("b"), col.doc("nope"), col.doc("a"));
    expect(snaps.map((s) => [s.id, s.exists])).toEqual([["b", true], ["nope", false], ["a", true]]);
    expect(db.contadores().lecturas).toBe(3);
  });
  it("con máscara de campos al final", async () => {
    const db = createMockAdminDb(docs());
    const col = db.collection("p").doc("1").collection("ev");
    const snaps = await db.getAll(col.doc("b"), { fieldMask: ["texto"] });
    expect(snaps[0].data()).toEqual({ texto: "b" });
    expect(db.contadores().lecturas).toBe(1);
  });
});

describe("lo que ya existía no cambia", () => {
  it("where + orderBy + limit + get siguen igual (strings y números)", async () => {
    const db = createMockAdminDb({ "c/a": { k: "x", n: 2 }, "c/b": { k: "x", n: 1 }, "c/z": { k: "y", n: 9 } });
    const r = await db.collection("c").where("k", "==", "x").orderBy("n", "asc").limit(1).get();
    expect(ids(r)).toEqual(["b"]);
    expect(db.contadores().lecturas).toBe(1);
  });
});
