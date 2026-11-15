// H25 (7b-2) — el fixture modela «todo o nada» SOLO en batch() y en el modo atómico opt-in; el update
// suelto y la transacción por defecto conservan su semántica de siempre (los usan informes,
// impact-chain, dvsVersiones y escribirF3Condicional).

import { afterAll, describe, expect, it } from "vitest";
// C1a: la clase `Firestore` se importa de `firebase-admin/firestore` (ya declarado en package.json), que reexporta la
// misma de @google-cloud/firestore (una sola copia instalada, 7.11.6): sin depender de un paquete transitivo no declarado.
import { Firestore } from "firebase-admin/firestore";
import { createMockAdminDb, validarSinUndefined } from "./adminMocks";

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

  it("estricto() opt-in: el update() suelto de un inexistente falla (NOT_FOUND) y no escribe", async () => {
    const db = createMockAdminDb();
    db.estricto(true);
    await expect(db.collection("c").doc("nuevo").update({ a: 1 })).rejects.toThrow();
    expect(db.snapshot()).toEqual({});
  });
});

// 7b-7 — `rechazarUndefined`: el mock rechaza `undefined` como el SDK REAL (N2/N3). Opt-in: las pruebas
// existentes no lo activan (medición del impacto de activarlo por defecto: ver el resumen de 7b-7).
describe("adminMocks — rechazarUndefined (7b-7)", () => {
  const MENSAJE_SET =
    'Value for argument "data" is not a valid Firestore document. Cannot use "undefined" as a Firestore value (found in field "{campo}"). If you want to ignore undefined values, enable `ignoreUndefinedProperties`.';

  it("por defecto está APAGADO: set y update aceptan undefined (comportamiento de siempre)", async () => {
    const db = createMockAdminDb();
    await db.collection("c").doc("x").set({ a: undefined });
    await db.collection("c").doc("x").update({ b: undefined });
    expect(db.snapshot()["c/x"]).toEqual({ a: undefined, b: undefined });
  });

  it("encendido: set() lanza el mensaje del SDK con la ruta de campo", async () => {
    const db = createMockAdminDb();
    db.rechazarUndefined(true);
    await expect(db.collection("c").doc("x").set({ ok: 1, proyectoTerritorioSnapshotAtVinculacion: undefined })).rejects.toThrow(
      MENSAJE_SET.replace("{campo}", "proyectoTerritorioSnapshotAtVinculacion")
    );
    expect(db.snapshot()).toEqual({});
  });

  it("encendido: update() con clave con puntos y arreglo anidado da la ruta con comillas invertidas (N2)", async () => {
    const db = createMockAdminDb({ "c/x": { v: 1 } });
    db.rechazarUndefined(true);
    const data = {
      "phases.investigacion.f3TareasPIP": [{ pipItemId: "p", asignaciones: [{ asignacionId: "a", resultadoId: undefined }] }],
    };
    await expect(db.collection("c").doc("x").update(data)).rejects.toThrow(
      'Update() requires either a single JavaScript object or an alternating list of field/value pairs that can be followed by an optional precondition. Value for argument "dataOrField" is not a valid Firestore value. Cannot use "undefined" as a Firestore value (found in field "`phases.investigacion.f3TareasPIP`.`0`.asignaciones.`0`.resultadoId"). If you want to ignore undefined values, enable `ignoreUndefinedProperties`.'
    );
    expect(db.snapshot()["c/x"]).toEqual({ v: 1 });
  });

  it("encendido: también en add(), batch() y transacciones (por defecto y atómicas)", async () => {
    const db = createMockAdminDb({ "c/x": { v: 1 } });
    db.rechazarUndefined(true);
    await expect(db.collection("c").add({ a: undefined })).rejects.toThrow("undefined");
    expect(() => db.batch().set(db.collection("c").doc("y") as never, { a: undefined })).toThrow("undefined");
    expect(() => db.batch().update(db.collection("c").doc("x") as never, { a: undefined })).toThrow("undefined");
    await expect(db.runTransaction(async (tx) => tx.set(db.collection("c").doc("y"), { a: undefined }))).rejects.toThrow("undefined");
    db.atomico(true);
    await expect(db.runTransaction(async (tx) => tx.update(db.collection("c").doc("x"), { a: undefined }))).rejects.toThrow("undefined");
    expect(db.snapshot()).toEqual({ "c/x": { v: 1 } });
  });

  it("encendido: los documentos válidos pasan (valores falsy, null, sentinelas como texto, claves ausentes)", async () => {
    const db = createMockAdminDb();
    db.rechazarUndefined(true);
    await db.collection("c").doc("x").set({ a: 0, b: "", c: false, d: null, e: [{ f: 1 }], g: "SERVER_TIMESTAMP" });
    await db.collection("c").doc("x").update({ "h.i": [1, { j: null }] });
    expect(Object.keys(db.snapshot())).toEqual(["c/x"]);
  });

  it("reset() lo apaga", async () => {
    const db = createMockAdminDb();
    db.rechazarUndefined(true);
    db.reset();
    await db.collection("c").doc("x").set({ a: undefined });
    expect(db.snapshot()["c/x"]).toEqual({ a: undefined });
  });
});

// CONTRATO con el SDK real: el mensaje del mock es EXACTAMENTE el de @google-cloud/firestore (la misma
// versión que usa firebase-admin). La validación del SDK ocurre en el cliente y LANZA DE FORMA SÍNCRONA antes
// de cualquier red, así que basta un cliente sin servidor: solo se invocan formas que lanzan (nunca una
// válida), por lo que no se abre ninguna conexión ni queda ningún proceso colgado.
describe("adminMocks — contrato de rechazarUndefined contra el SDK real", () => {
  const real = new Firestore({
    projectId: "sonda-contrato",
    host: "localhost:1",
    ssl: false,
    credentials: { client_email: "sonda@example.com", private_key: "no-se-usa" },
  });
  afterAll(async () => {
    await real.terminate().catch(() => {});
  });

  const mensajeReal = (fn: () => unknown): string => {
    try {
      fn();
    } catch (e) {
      return (e as Error).message;
    }
    return "NO LANZÓ";
  };

  it("update(): clave con puntos + arreglo + mapa (la forma exacta de N2)", () => {
    const data = { "phases.investigacion.f3TareasPIP": [{ pipItemId: "p", asignaciones: [{ asignacionId: "a", resultadoId: undefined }] }], updatedAt: 1 };
    let mock = "";
    try { validarSinUndefined(data, "update"); } catch (e) { mock = (e as Error).message; }
    expect(mock).toBe(mensajeReal(() => real.doc("c/x").update(data)));
  });

  it("set(): clave de primer nivel (la forma exacta de N3)", () => {
    const data = { moduloPIP: "x", proyectoTerritorioSnapshotAtVinculacion: undefined };
    let mock = "";
    try { validarSinUndefined(data, "set"); } catch (e) { mock = (e as Error).message; }
    expect(mock).toBe(mensajeReal(() => real.doc("c/x").set(data)));
  });

  it("set(): mapa anidado con una clave que no es identificador", () => {
    const data = { "a-b": { c: undefined }, ok: 1 };
    let mock = "";
    try { validarSinUndefined(data, "set"); } catch (e) { mock = (e as Error).message; }
    expect(mock).toBe(mensajeReal(() => real.doc("c/x").set(data)));
  });
});

// C1a — `create` (falla si el documento existe) y contadores de lecturas/escrituras/borrados (opt-in, aditivos).
describe("adminMocks — create y contadores (C1a)", () => {
  it("create() escribe si no existe y FALLA (ALREADY_EXISTS) si ya existe, sin pisar", async () => {
    const db = createMockAdminDb({ "c/x": { v: 1 } });
    await db.collection("c").doc("nuevo").create({ a: 1 });
    expect(db.snapshot()["c/nuevo"]).toEqual({ a: 1 });
    await expect(db.collection("c").doc("x").create({ v: 2 })).rejects.toThrow("ALREADY_EXISTS");
    expect(db.snapshot()["c/x"]).toEqual({ v: 1 });
  });

  it("tx.create atómico: una colisión no aplica NINGUNA escritura del lote (ni las anteriores)", async () => {
    const db = createMockAdminDb({ "c/x": { v: 1 } });
    db.atomico(true);
    await expect(
      db.runTransaction(async (tx) => {
        await tx.create(db.collection("c").doc("a"), { a: 1 });
        await tx.create(db.collection("c").doc("x"), { v: 2 });
      })
    ).rejects.toThrow("ALREADY_EXISTS");
    expect(db.snapshot()).toEqual({ "c/x": { v: 1 } });
  });

  it("create dos veces sobre el mismo id DENTRO del mismo lote también colisiona; batch().create existe", async () => {
    const db = createMockAdminDb();
    db.atomico(true);
    await expect(
      db.runTransaction(async (tx) => {
        await tx.create(db.collection("c").doc("a"), { a: 1 });
        await tx.create(db.collection("c").doc("a"), { a: 2 });
      })
    ).rejects.toThrow("ALREADY_EXISTS");
    const lote = db.batch();
    lote.create(db.collection("c").doc("b") as never, { b: 1 });
    await lote.commit();
    expect(db.snapshot()["c/b"]).toEqual({ b: 1 });
  });

  it("create también rechaza undefined cuando rechazarUndefined está encendido", async () => {
    const db = createMockAdminDb();
    db.rechazarUndefined(true);
    await expect(db.collection("c").doc("x").create({ a: undefined })).rejects.toThrow("undefined");
  });

  it("contadores: cuentan lecturas de documentos, escrituras (set/update/create) y borrados; reset() los pone en cero", async () => {
    const db = createMockAdminDb({ "c/x": { v: 1 }, "c/y": { v: 2 } });
    await db.collection("c").doc("x").get();
    await db.collection("c").doc("z").create({ z: 1 });
    await db.collection("c").doc("x").update({ v: 3 });
    await db.collection("c").doc("y").delete();
    await db.collection("c").get(); // consulta: cuenta los documentos devueltos (x y z)
    expect(db.contadores()).toEqual({ lecturas: 3, escrituras: 2, borrados: 1 });
    db.reset();
    expect(db.contadores()).toEqual({ lecturas: 0, escrituras: 0, borrados: 0 });
  });

  it("contadores en transacción atómica: solo cuentan lo APLICADO (un lote fallido no suma)", async () => {
    const db = createMockAdminDb({ "c/x": { v: 1 } });
    db.atomico(true);
    await db.runTransaction(async (tx) => {
      await tx.get(db.collection("c").doc("x"));
      await tx.update(db.collection("c").doc("x"), { v: 2 });
      await tx.create(db.collection("c").doc("n"), { n: 1 });
      await tx.delete(db.collection("c").doc("x"));
    });
    expect(db.contadores()).toEqual({ lecturas: 1, escrituras: 2, borrados: 1 });
    await expect(db.runTransaction(async (tx) => tx.create(db.collection("c").doc("n"), { n: 2 }))).rejects.toThrow();
    expect(db.contadores()).toEqual({ lecturas: 1, escrituras: 2, borrados: 1 });
  });
});
