import { beforeEach, describe, expect, it } from "vitest";
import { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { aplicarVinculoUnico, prepararVinculoUnico } from "./vinculoUnico";

const db = createMockAdminDb();
const FV = { serverTimestamp: () => "TS", delete: () => "__DELETE__" } as never;
const correr = (p: Parameters<typeof prepararVinculoUnico>[2]) =>
  db.runTransaction(async (tx) => prepararVinculoUnico(tx as never, db as never, p));

beforeEach(() => db.reset({}));

describe("prepararVinculoUnico", () => {
  it("PESTEL inexistente o de otro usuario: pestel_no_encontrado (mismo código, no revela cuál)", async () => {
    db.reset({ "pestel_projects/ajeno": { userId: "otro" } });
    expect(await correr({ uid: "u1", pestelProjectId: "no-existe", modduloProjectId: "m1" })).toEqual({ ok: false, codigo: "pestel_no_encontrado" });
    expect(await correr({ uid: "u1", pestelProjectId: "ajeno", modduloProjectId: "m1" })).toEqual({ ok: false, codigo: "pestel_no_encontrado" });
  });
  it("sin back-link: hay que escribirlo", async () => {
    db.reset({ "pestel_projects/p": { userId: "u1" } });
    expect(await correr({ uid: "u1", pestelProjectId: "p", modduloProjectId: "m1" })).toEqual({ ok: true, escribirBacklink: true, limpiarAnteriorId: null });
  });
  it("back-link ya a este Moddulo: no se reescribe", async () => {
    db.reset({ "pestel_projects/p": { userId: "u1", modduloProjectId: "m1" } });
    expect(await correr({ uid: "u1", pestelProjectId: "p", modduloProjectId: "m1" })).toMatchObject({ ok: true, escribirBacklink: false });
  });
  it("back-link a otro Moddulo que existe (vivo o en papelera): pestel_already_linked", async () => {
    db.reset({ "pestel_projects/p": { userId: "u1", modduloProjectId: "m2" }, "moddulo_projects/m2": { deletedAt: "x" } });
    expect(await correr({ uid: "u1", pestelProjectId: "p", modduloProjectId: "m1" })).toEqual({ ok: false, codigo: "pestel_already_linked" });
  });
  it("back-link a un Moddulo que ya no existe: no bloquea", async () => {
    db.reset({ "pestel_projects/p": { userId: "u1", modduloProjectId: "fantasma" } });
    expect(await correr({ uid: "u1", pestelProjectId: "p", modduloProjectId: "m1" })).toMatchObject({ ok: true, escribirBacklink: true });
  });
  it("PESTEL anterior: se limpia solo si es del usuario y todavía apunta a este Moddulo", async () => {
    db.reset({
      "pestel_projects/nuevo": { userId: "u1" },
      "pestel_projects/viejo": { userId: "u1", modduloProjectId: "m1" },
      "pestel_projects/otroDueno": { userId: "x", modduloProjectId: "m1" },
      "pestel_projects/apuntaOtro": { userId: "u1", modduloProjectId: "m9" },
    });
    const c = (anterior: string) => correr({ uid: "u1", pestelProjectId: "nuevo", modduloProjectId: "m1", pestelAnteriorId: anterior });
    expect(await c("viejo")).toMatchObject({ limpiarAnteriorId: "viejo" });
    expect(await c("otroDueno")).toMatchObject({ limpiarAnteriorId: null });
    expect(await c("apuntaOtro")).toMatchObject({ limpiarAnteriorId: null });
    expect(await c("nuevo")).toMatchObject({ limpiarAnteriorId: null });
  });
});

describe("aplicarVinculoUnico", () => {
  it("escribe el back-link y limpia el anterior, y no escribe lo que el plan no pide", async () => {
    db.reset({ "pestel_projects/n": { userId: "u1" }, "pestel_projects/v": { userId: "u1", modduloProjectId: "m1" } });
    await db.runTransaction(async (tx) => {
      aplicarVinculoUnico(tx as never, db as never, FV, { pestelProjectId: "n", modduloProjectId: "m1" }, { ok: true, escribirBacklink: true, limpiarAnteriorId: "v" });
    });
    expect(db.updates()).toEqual([
      { path: "pestel_projects/n", data: { modduloProjectId: "m1", updatedAt: "TS" } },
      { path: "pestel_projects/v", data: { modduloProjectId: "__DELETE__", updatedAt: "TS" } },
    ]);
    db.reset({});
    await db.runTransaction(async (tx) => {
      aplicarVinculoUnico(tx as never, db as never, FV, { pestelProjectId: "n", modduloProjectId: "m1" }, { ok: true, escribirBacklink: false, limpiarAnteriorId: null });
    });
    expect(db.updates()).toEqual([]);
  });
});
