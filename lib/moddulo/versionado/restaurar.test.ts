// C4b-1a — piezas reutilizables de «volver»: leer la versión objetivo dentro de la transacción, huella sin uid ni
// contenido, y el cambio de la versión nueva (aprobación retirada). Mock de Firestore con `undefined` rechazado.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

import { aplicarVersion, prepararVersion } from "@/lib/versionado/registrar";
import { armarCambioRestauracion, huellaRestauracion, leerVersionObjetivo, versionIdValido } from "./restaurar";

const db = createMockAdminDb();
const P = "moddulo_projects/p1";
const ART = "f3Resultado:r1";
const V = (id: string, extra: Record<string, unknown> = {}) => ({
  artefacto: ART, n: 2, contenido: { moduloPIP: "x" }, huella: "h", ...extra,
});

async function leer(versionId: string, artefacto = ART) {
  let r: Awaited<ReturnType<typeof leerVersionObjetivo>> | undefined;
  await db.runTransaction(async (tx) => {
    r = await leerVersionObjetivo(tx as never, db.collection("moddulo_projects").doc("p1") as never, artefacto, versionId);
  });
  return r!;
}

beforeEach(() => {
  db.reset({ [P]: { n: 1 } });
  db.rechazarUndefined(true);
  db.atomico(true);
});

describe("leerVersionObjetivo", () => {
  it("versión del artefacto con contenido → {ok, n, contenido}", async () => {
    db.seed(`${P}/versiones/${ART}__000002`, V("x"));
    expect(await leer(`${ART}__000002`)).toEqual({ ok: true, n: 2, contenido: { moduloPIP: "x" } });
  });
  it("devuelve la aprobación que traía esa versión (para saber si estaba aprobada)", async () => {
    db.seed(`${P}/versiones/${ART}__000002`, V("x", { aprobacion: { aprobado: true, por: "u9", en: "2026-01-01T00:00:00.000Z", notas: "n" } }));
    const r = await leer(`${ART}__000002`);
    expect(r).toMatchObject({ ok: true, aprobacion: { aprobado: true, por: "u9" } });
  });
  it("una versión «previa al historial» también se puede restaurar", async () => {
    db.seed(`${P}/versiones/${ART}__000001`, V("x", { n: 1, tipoCambio: "previo_sin_historial", por: null }));
    expect(await leer(`${ART}__000001`)).toMatchObject({ ok: true, n: 1 });
  });
  it("no existe (o la poda la borró) → version_no_encontrada", async () => {
    expect(await leer(`${ART}__000009`)).toEqual({ ok: false, codigo: "version_no_encontrada" });
  });
  it("pertenece a OTRO artefacto (aunque el id exista) → version_no_encontrada, sin distinguirlo", async () => {
    db.seed(`${P}/versiones/f3Resultado:r2__000002`, V("x", { artefacto: "f3Resultado:r2" }));
    expect(await leer("f3Resultado:r2__000002")).toEqual({ ok: false, codigo: "version_no_encontrada" });
  });
  it("contenidoOmitido → version_no_restaurable (solo hay huella)", async () => {
    db.seed(`${P}/versiones/${ART}__000002`, { artefacto: ART, n: 2, contenidoOmitido: true, huella: "h" });
    expect(await leer(`${ART}__000002`)).toEqual({ ok: false, codigo: "version_no_restaurable" });
  });
  it("contenidoOmitido:true MANDA aunque el documento traiga algún contenido (no se restaura lo que no es el contenido completo)", async () => {
    db.seed(`${P}/versiones/${ART}__000002`, V("x", { contenidoOmitido: true }));
    expect(await leer(`${ART}__000002`)).toEqual({ ok: false, codigo: "version_no_restaurable" });
  });
  it("sin contenido (aunque no diga contenidoOmitido) → version_no_restaurable", async () => {
    db.seed(`${P}/versiones/${ART}__000002`, { artefacto: ART, n: 2, huella: "h" });
    expect(await leer(`${ART}__000002`)).toEqual({ ok: false, codigo: "version_no_restaurable" });
  });
  it("un id con «/» o vacío nunca sale de `versiones`: version_no_encontrada sin leer nada", async () => {
    db.reset({ [P]: { n: 1 } });
    const antes = db.contadores().lecturas;
    expect(await leer("a/b")).toEqual({ ok: false, codigo: "version_no_encontrada" });
    expect(await leer("")).toEqual({ ok: false, codigo: "version_no_encontrada" });
    expect(db.contadores().lecturas).toBe(antes);
    expect(versionIdValido("a/b")).toBe(false);
    expect(versionIdValido(`${ART}__000002`)).toBe(true);
  });
  it("costo: UNA lectura por versión", async () => {
    db.seed(`${P}/versiones/${ART}__000002`, V("x"));
    db.reset({ ...db.snapshot() });
    await leer(`${ART}__000002`);
    expect(db.contadores().lecturas).toBe(1);
  });
});

describe("huellaRestauracion", () => {
  const base = { puntero: { n: 3 }, objetivo: `${ART}__000002`, vigente: `${ART}__000003`, extras: { a: 1 } };
  it("determinista y cambia con cada ingrediente", () => {
    const h = huellaRestauracion(base);
    expect(huellaRestauracion({ ...base })).toBe(h);
    expect(huellaRestauracion({ ...base, puntero: { n: 4 } })).not.toBe(h);
    expect(huellaRestauracion({ ...base, objetivo: `${ART}__000001` })).not.toBe(h);
    expect(huellaRestauracion({ ...base, vigente: null })).not.toBe(h);
    expect(huellaRestauracion({ ...base, extras: { a: 2 } })).not.toBe(h);
  });
  it("sin puntero (fase sin historial todavía) cuenta como 0, igual que `revision.n` ausente", () => {
    expect(huellaRestauracion({ ...base, puntero: undefined })).toBe(huellaRestauracion({ ...base, puntero: { n: 0 } }));
    expect(huellaRestauracion({ ...base, puntero: null })).toBe(huellaRestauracion({ ...base, puntero: {} }));
  });
  it("no contiene uid ni contenido: el hash es de ids y números (no hay texto que filtrar) y no es el contenido", () => {
    const h = huellaRestauracion(base);
    expect(h).toMatch(/^[0-9a-f]+$/);
    expect(h).not.toContain("u1");
  });
});

describe("armarCambioRestauracion", () => {
  const e = { artefacto: ART, contenido: { moduloPIP: "x" }, vivo: { esquema: 1 }, aprobacion: { en: "2026-11-25T10:00:00.000Z" }, por: "u1" };
  it("la aprobación va SIEMPRE retirada, con quién y cuándo (ISO concreto)", () => {
    const c = armarCambioRestauracion(e);
    expect(c.aprobacion).toEqual({ aprobado: false, por: "u1", en: "2026-11-25T10:00:00.000Z" });
    expect(c.contenido).toEqual({ moduloPIP: "x" });
    expect(c.vivo).toEqual({ esquema: 1 });
  });
  it("sin estadoPrevio/vivoPrevio no emite esas claves (nada con undefined)", () => {
    const c = armarCambioRestauracion(e);
    expect(Object.keys(c).sort()).toEqual(["aprobacion", "artefacto", "contenido", "vivo"]);
    expect(JSON.stringify(c)).not.toContain("undefined");
  });
  it("con estadoPrevio y vivoPrevio los conserva", () => {
    const c = armarCambioRestauracion({ ...e, estadoPrevio: { contenido: { a: 1 } }, vivoPrevio: { esquema: 1, a: 1 } });
    expect(c.estadoPrevio).toEqual({ contenido: { a: 1 } });
    expect(c.vivoPrevio).toEqual({ esquema: 1, a: 1 });
  });
  it("registrado con el núcleo real como `restauracion`: crea la versión con aprobación retirada y tipo «restauracion»", async () => {
    await db.runTransaction(async (tx) => {
      const raiz = db.collection("moddulo_projects").doc("p1");
      const snap = await tx.get(raiz);
      const plan = await prepararVersion(tx as never, {
        raiz: raiz as never, datosRaiz: snap.data() as never, punteroCampo: "phases.investigacion.revision",
        ambito: "moddulo", fase: "investigacion", tipoCambio: "restauracion", motivo: "restauracion", por: "u1",
        artefactos: [armarCambioRestauracion(e)],
      });
      aplicarVersion(tx as never, plan);
    });
    const versiones = Object.entries(db.snapshot()).filter(([k]) => k.includes("/versiones/")).map(([, v]) => v as Record<string, unknown>);
    expect(versiones).toHaveLength(1);
    expect(versiones[0]).toMatchObject({ tipoCambio: "restauracion", motivo: "restauracion", aprobacion: { aprobado: false, por: "u1" } });
  });
});
