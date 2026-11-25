// H-V86 (C4b-1a) — `restauracion` tiene validación propia: exige `motivo` y NO admite `autorizadoPor`/`autorizadoEn`
// (esa marca es de `regeneracion_ia`). Los demás tipos no cambian. La exigencia de `aprobacion` NO está en el núcleo.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

import { aplicarVersion, prepararVersion, type CambioFase } from "./registrar";
import { CambioInvalidoError, type TipoCambio } from "./tipos";

const db = createMockAdminDb();
const RUTA = "moddulo_projects/p1";
const base = { ambito: "moddulo", fase: "investigacion", punteroCampo: "phases.investigacion.revision", por: "u1" };

async function ejecutar(tipoCambio: TipoCambio, extra: Partial<CambioFase> = {}) {
  await db.runTransaction(async (tx) => {
    const raiz = db.collection("moddulo_projects").doc("p1");
    const snap = await tx.get(raiz);
    const plan = await prepararVersion(tx as never, {
      ...base, tipoCambio, raiz: raiz as never, datosRaiz: snap.data() as never,
      artefactos: [{ artefacto: "f3Resultado:r1", contenido: { a: 1 } }], ...extra,
    });
    const res = aplicarVersion(tx as never, plan);
    if (res.cambio) await tx.update(raiz, res.updatesRaiz);
  });
}
const eventos = () => Object.entries(db.snapshot()).filter(([k]) => k.startsWith(`${RUTA}/eventos/`)).map(([, v]) => v as Record<string, unknown>);

beforeEach(() => {
  db.reset({ [RUTA]: { nombre: "p" } });
  db.rechazarUndefined(true);
  db.atomico(true);
});

describe("restauracion — validación del núcleo (H-V86)", () => {
  it("sin `motivo` → CambioInvalidoError y NADA escrito", async () => {
    await expect(ejecutar("restauracion")).rejects.toBeInstanceOf(CambioInvalidoError);
    expect(eventos()).toHaveLength(0);
  });
  it("`motivo` vacío o solo espacios → CambioInvalidoError", async () => {
    await expect(ejecutar("restauracion", { motivo: "" })).rejects.toBeInstanceOf(CambioInvalidoError);
    await expect(ejecutar("restauracion", { motivo: "   " })).rejects.toBeInstanceOf(CambioInvalidoError);
  });
  it("con `autorizadoPor` (o `autorizadoEn`) → CambioInvalidoError aunque traiga motivo", async () => {
    await expect(ejecutar("restauracion", { motivo: "restauracion", autorizadoPor: "u1", autorizadoEn: "2026-11-25T00:00:00.000Z" })).rejects.toBeInstanceOf(CambioInvalidoError);
    await expect(ejecutar("restauracion", { motivo: "restauracion", autorizadoEn: "2026-11-25T00:00:00.000Z" })).rejects.toBeInstanceOf(CambioInvalidoError);
    expect(eventos()).toHaveLength(0);
  });
  it("válida (con `motivo`, sin autorización) → se registra con tipo y motivo", async () => {
    await ejecutar("restauracion", { motivo: "restauracion" });
    expect(eventos()).toHaveLength(1);
    expect(eventos()[0]).toMatchObject({ tipo: "restauracion", motivo: "restauracion" });
  });
  it("los otros tipos NO cambian: sin motivo y con motivo siguen válidos; regeneracion_ia sigue exigiendo autorización", async () => {
    await ejecutar("ajuste_manual");
    expect(eventos()).toHaveLength(1);
    // el mock no expande el puntero con puntos: se reinicia entre llamadas
    db.reset({ [RUTA]: { nombre: "p" } }); db.rechazarUndefined(true); db.atomico(true);
    await ejecutar("entrega", { motivo: "entrega" });
    expect(eventos()).toHaveLength(1);
    db.reset({ [RUTA]: { nombre: "p" } }); db.rechazarUndefined(true); db.atomico(true);
    await expect(ejecutar("regeneracion_ia", { artefactos: [{ artefacto: "f3Resultado:r3", contenido: { c: 1 } }] })).rejects.toThrow();
  });
});
