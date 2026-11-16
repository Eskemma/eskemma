// C3a — DERIVA en el registro de versiones: el estado vivo cambió por un escritor que no registra historial.
// Pruebas del módulo (sin rutas): orden respecto del dedupe, sello de la aprobación, marca y poda.
// Mock con rechazo de `undefined` y transacciones atómicas. Límites: sin emulador de Firestore (Java 17).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

import { aplicarVersion, prepararVersion, type CambioArtefacto, type CambioFase, type ResultadoVersion } from "./registrar";
import { CambioInvalidoError, type EntradaManifiesto } from "./tipos";
import { huellaContenido } from "./huella";

const db = createMockAdminDb();
const RUTA = "moddulo_projects/p1";
const base = { ambito: "moddulo", fase: "investigacion", punteroCampo: "phases.investigacion.revision", tipoCambio: "reentrega" as const, por: "u1" };

function expandir(doc: Record<string, unknown> | undefined): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc ?? {})) {
    const partes = k.split(".");
    let cur = salida;
    partes.slice(0, -1).forEach((p) => {
      cur = (cur[p] = (cur[p] as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    });
    cur[partes.at(-1) as string] = v;
  }
  return salida;
}

async function ejecutar(artefactos: CambioArtefacto[], extra: Partial<CambioFase> = {}) {
  return (await db.runTransaction(async (tx) => {
    const raiz = db.collection("moddulo_projects").doc("p1");
    const snap = await tx.get(raiz);
    const plan = await prepararVersion(tx as never, { ...base, raiz: raiz as never, datosRaiz: expandir(snap.data() as never), artefactos, ...extra });
    const res = aplicarVersion(tx as never, plan);
    if (res.cambio) await tx.update(raiz, res.updatesRaiz);
    return res;
  })) as ResultadoVersion;
}

type Doc = Record<string, unknown> & { artefactos?: Record<string, EntradaManifiesto>; n?: number; deriva?: boolean; por?: unknown; tipoCambio?: string; contenido?: unknown; artefactosConDeriva?: string[]; aprobacion?: unknown };
const doc = (ruta: string) => db.snapshot()[ruta] as Doc | undefined;
const versiones = () => Object.keys(db.snapshot()).filter((k) => k.startsWith(`${RUTA}/versiones/`)).sort();
const ultimaRevision = () => {
  const claves = Object.keys(db.snapshot()).filter((k) => k.startsWith(`${RUTA}/revisiones/`)).sort();
  return doc(claves.at(-1) as string) as Doc;
};
const eventos = () => Object.entries(db.snapshot()).filter(([k]) => k.includes("/eventos/")).map(([, v]) => v as Doc);

const A = { x: "A" };
const B = { x: "B" };
const art = (contenido: unknown, extra: Partial<CambioArtefacto> = {}): CambioArtefacto => ({ artefacto: "f3Resultado:r1", contenido, ...extra });

beforeEach(() => {
  db.reset({ [RUTA]: { nombre: "proyecto" } });
  db.rechazarUndefined(true);
  db.atomico(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deriva — el vivo cambió sin registro", () => {
  it("vivo igual a la huella guardada → CERO deriva (solo la versión nueva)", async () => {
    await ejecutar([art(A, { vivo: { v: 1 } })]);
    await ejecutar([art(B, { vivo: { v: 2 }, estadoPrevio: { contenido: A }, vivoPrevio: { v: 1 } })]);
    expect(versiones()).toHaveLength(2);
    expect(eventos().every((e) => e.artefactosConDeriva === undefined)).toBe(true);
  });

  it("vivo distinto de la huella guardada → UNA versión de deriva (previo_sin_historial, deriva:true, por null) antes de la nueva", async () => {
    await ejecutar([art(A, { vivo: { v: 1 } })]);
    await ejecutar([art(B, { vivo: { v: 3 }, estadoPrevio: { contenido: { x: "DERIVADO" } }, vivoPrevio: { v: 2 } })]);
    expect(versiones()).toHaveLength(3);
    expect(doc(`${RUTA}/versiones/f3Resultado:r1__000002`)).toMatchObject({
      tipoCambio: "previo_sin_historial", deriva: true, por: null, estado: "reemplazada", contenido: { x: "DERIVADO" },
    });
    expect(doc(`${RUTA}/versiones/f3Resultado:r1__000003`)).toMatchObject({ tipoCambio: "reentrega", por: "u1", contenido: B });
    expect(doc(`${RUTA}/versiones/f3Resultado:r1__000003`)?.deriva).toBeUndefined();
    // el evento lista los artefactos con deriva
    expect(eventos().at(-1)?.artefactosConDeriva).toEqual(["f3Resultado:r1"]);
    expect(ultimaRevision().artefactos?.["f3Resultado:r1"]).toMatchObject({ n: 3, versionId: "f3Resultado:r1__000003" });
  });

  it("ORDEN: la deriva se evalúa ANTES del dedupe — A, B (deriva) y A de nuevo (antes el dedupe lo veía como no-op y B se perdía)", async () => {
    await ejecutar([art(A, { vivo: { v: 1 } })]);
    // el vivo derivó a B (sin registro) y la acción lo deja igual a la vigente A
    await ejecutar([art(A, { vivo: { v: 1 }, estadoPrevio: { contenido: B }, vivoPrevio: { v: 2 } })]);
    expect(versiones()).toHaveLength(3);
    expect(doc(`${RUTA}/versiones/f3Resultado:r1__000001`)?.contenido).toEqual(A);
    expect(doc(`${RUTA}/versiones/f3Resultado:r1__000002`)).toMatchObject({ deriva: true, contenido: B });
    expect(doc(`${RUTA}/versiones/f3Resultado:r1__000003`)?.contenido).toEqual(A);
  });

  it("si la acción deja el vivo igual a lo derivado: la deriva queda registrada y no se crea versión nueva (el manifiesto apunta a ella)", async () => {
    await ejecutar([art(A, { vivo: { v: 1 } })]);
    await ejecutar([art(B, { vivo: { v: 2 }, estadoPrevio: { contenido: B }, vivoPrevio: { v: 2 } })]);
    expect(versiones()).toHaveLength(2);
    expect(doc(`${RUTA}/versiones/f3Resultado:r1__000002`)).toMatchObject({ deriva: true, contenido: B });
    expect(ultimaRevision().artefactos?.["f3Resultado:r1"]).toMatchObject({ n: 2, versionId: "f3Resultado:r1__000002" });
    expect(eventos().at(-1)?.artefactosConDeriva).toEqual(["f3Resultado:r1"]);
  });

  it("SELLO: la aprobación registrada trae por/en que el vivo NO tiene; la deriva compara el vivo, así que NO hay falsa deriva", async () => {
    const aprobada = { aprobado: true, por: "ana", en: "2026-10-01", huella: "h" };
    await ejecutar([art(A, { aprobacion: aprobada, vivo: { v: 1, aprobado: true } })]);
    // el estado leído del vivo no tiene sello (por null): su TUPLA nunca coincidiría con la guardada
    const sinSello = { aprobado: true, por: null, en: null };
    await ejecutar([art(B, { vivo: { v: 2 }, estadoPrevio: { contenido: A, aprobacion: sinSello }, vivoPrevio: { v: 1, aprobado: true } })]);
    expect(versiones()).toHaveLength(2);
    expect(eventos().every((e) => e.artefactosConDeriva === undefined)).toBe(true);
  });

  it("si el vivo tenía aprobación, la versión de deriva la conserva (por null) y cuenta como aprobada para la poda", async () => {
    await ejecutar([art(A, { vivo: { v: 1 } })]);
    await ejecutar([
      art(B, { vivo: { v: 3 }, estadoPrevio: { contenido: { x: "D" }, aprobacion: { aprobado: true, por: null, en: null } }, vivoPrevio: { v: 2 } }),
    ]);
    expect(doc(`${RUTA}/versiones/f3Resultado:r1__000002`)?.aprobacion).toEqual({ aprobado: true, por: null, en: null });
    const retenidas = ultimaRevision().artefactos?.["f3Resultado:r1"].retenidas ?? [];
    expect(retenidas.find((r) => r.n === 2)?.aprobada).toBe(true);
  });

  it("estadoPrevio con vigente que trae `vivo` pero SIN vivoPrevio → CambioInvalidoError (la comparación por tupla daría falsa deriva)", async () => {
    await ejecutar([art(A, { vivo: { v: 1 } })]);
    await expect(ejecutar([art(B, { estadoPrevio: { contenido: A } })])).rejects.toBeInstanceOf(CambioInvalidoError);
    expect(versiones()).toHaveLength(1);
  });

  it("entradas SIN `vivo` (registradas sin proyección): la deriva se evalúa contra la tupla, como antes", async () => {
    await ejecutar([art(A)]);
    await ejecutar([art(B, { estadoPrevio: { contenido: A } })]); // tupla previa == tupla vigente → sin deriva
    expect(versiones()).toHaveLength(2);
    await ejecutar([art({ x: "C" }, { estadoPrevio: { contenido: { x: "otro" } } })]); // distinta → deriva
    expect(versiones()).toHaveLength(4);
    expect(eventos().at(-1)?.artefactosConDeriva).toEqual(["f3Resultado:r1"]);
  });

  it("la entrada del manifiesto guarda la huella de la proyección viva (`vivo`) y NO cambia la tupla", async () => {
    await ejecutar([art(A, { vivo: { v: 1 } })]);
    const e = ultimaRevision().artefactos?.["f3Resultado:r1"];
    expect(e?.vivo).toBe(huellaContenido({ v: 1 }));
    await ejecutar([art(A, { vivo: { v: 99 } })]); // misma tupla: sigue siendo no-op aunque `vivo` cambie
    expect(versiones()).toHaveLength(1);
  });

  it("deriva en un artefacto no afecta a otro del mismo cambio (cada artefacto se evalúa por separado)", async () => {
    await ejecutar([art(A, { vivo: { v: 1 } }), { artefacto: "f3Asignacion:a1", contenido: { e: 1 }, vivo: { w: 1 } }]);
    await ejecutar([
      art(B, { vivo: { v: 2 }, estadoPrevio: { contenido: A }, vivoPrevio: { v: 1 } }),
      { artefacto: "f3Asignacion:a1", contenido: { e: 2 }, vivo: { w: 2 }, estadoPrevio: { contenido: { e: "otro" } }, vivoPrevio: { w: 9 } },
    ]);
    expect(eventos().at(-1)?.artefactosConDeriva).toEqual(["f3Asignacion:a1"]);
  });
});

describe("tamaño — se vigila SIEMPRE sobre el documento completo de la versión (arreglo declarado de C1a)", () => {
  it("un contenido de ~700 KB (< 900 KB, se guarda) avisa al 60 % del límite; antes solo avisaba si el contenido se omitía", async () => {
    const grande = { texto: "x".repeat(700_000) };
    await ejecutar([art(grande)]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[versionado][limite-1MB]"));
    expect(doc(`${RUTA}/versiones/f3Resultado:r1__000001`)?.contenido).toEqual(grande); // sigue guardado
  });
});
