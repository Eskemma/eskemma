// C1b-1 — `detalle` del evento (campo ADITIVO de CambioFase). El evento es un registro de auditoría: solo nombres y
// banderas. Sin `detalle`, el evento es EXACTAMENTE el de siempre (los 3 usuarios de C3a no lo pasan).
// Mock con rechazo de `undefined` como el SDK real y transacciones atómicas. Sin emulador (Java 17).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

import { aplicarVersion, prepararVersion, type CambioFase } from "./registrar";
import { CambioInvalidoError, type DetalleEvento } from "./tipos";

const db = createMockAdminDb();
const RUTA = "moddulo_projects/p1";
const base = { ambito: "moddulo", fase: "exploracion", punteroCampo: "phases.exploracion.revision", tipoCambio: "ajuste_manual" as const, por: "u1" };

async function ejecutar(extra: Partial<CambioFase> = {}) {
  await db.runTransaction(async (tx) => {
    const raiz = db.collection("moddulo_projects").doc("p1");
    const snap = await tx.get(raiz);
    const plan = await prepararVersion(tx as never, {
      ...base, raiz: raiz as never, datosRaiz: snap.data() as never, artefactos: [{ artefacto: "f2M1", contenido: { a: 1 } }], ...extra,
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

describe("detalle del evento", () => {
  it("se copia al evento tal cual (nombres y banderas)", async () => {
    const detalle: DetalleEvento = { motoresAprobadosDescartados: ["M2", "M3"], borradorDescartado: true };
    await ejecutar({ detalle });
    expect(eventos()[0].detalle).toEqual(detalle);
  });

  it("[omisión] sin detalle (o vacío) el evento NO trae la clave `detalle`, y el mock que rechaza undefined lo prueba", async () => {
    await ejecutar();
    expect(Object.keys(eventos()[0])).not.toContain("detalle");
    db.reset({ [RUTA]: { nombre: "p" } }); db.rechazarUndefined(true); db.atomico(true);
    await ejecutar({ detalle: {} });
    expect(Object.keys(eventos()[0])).not.toContain("detalle");
  });

  it("[el evento de quien no lo usa es EXACTAMENTE el de siempre] mismas claves, sin detalle", async () => {
    await ejecutar({ motivo: "aprobacion" });
    expect(Object.keys(eventos()[0]).sort()).toEqual(["ambito", "artefactos", "en", "fase", "fuente", "motivo", "por", "revisionN", "tipo", "versionIds"]);
  });

  it("[rechazarUndefined] un `detalle` con valor undefined NO llega a Firestore: el registro lo rechaza antes", async () => {
    await expect(ejecutar({ detalle: { a: undefined } as never })).rejects.toBeInstanceOf(CambioInvalidoError);
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/eventos/"))).toHaveLength(0);
  });

  it.each([
    ["objeto anidado", { a: { b: 1 } }],
    ["null", { a: null }],
    ["lista con un número", { a: ["M2", 3] }],
    ["número no finito", { a: Number.NaN }],
    ["función", { a: () => 1 }],
  ])("tipo estrecho: %s se rechaza", async (_n, detalle) => {
    await expect(ejecutar({ detalle: detalle as never })).rejects.toBeInstanceOf(CambioInvalidoError);
  });

  it("el detalle del evento es una COPIA: mutar el original después no lo cambia", async () => {
    const detalle = { motores: ["M2"] };
    await ejecutar({ detalle });
    detalle.motores.push("M9");
    expect(eventos()[0].detalle).toEqual({ motores: ["M2"] });
  });
});
