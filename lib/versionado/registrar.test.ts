// C1a — registro de versiones en la misma transacción. Módulo nuevo: no hay comportamiento anterior que
// caracterizar. TODAS las pruebas corren con el mock que rechaza `undefined` como el SDK real
// (rechazarUndefined) y con transacciones atómicas (todo o nada).
// Límites: sin emulador de Firestore (Java 17; se requiere ≥ 21) no se prueban el aislamiento real ni los
// reintentos; el mock modela todo-o-nada. Los conteos de lecturas/escrituras son del mock, no de Firestore real.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

import {
  aplicarVersion,
  idRevision,
  idVersion,
  prepararVersion,
  traducirErrorHistorial,
  type CambioArtefacto,
  type CambioFase,
  type ResultadoVersion,
} from "./registrar";
import {
  AutorizacionIARequeridaError,
  CambioInvalidoError,
  ColisionHistorialError,
  HistorialInconsistenteError,
  type EntradaManifiesto,
  type RetenidaRef,
} from "./tipos";

const db = createMockAdminDb();
const RUTA = "moddulo_projects/p1";
const base = {
  ambito: "exploracion",
  fase: "exploracion",
  punteroCampo: "phases.exploracion.revision",
  tipoCambio: "ajuste_manual" as const,
  por: "u1",
};
const art = (artefacto: string, contenido: unknown, extra: Partial<CambioArtefacto> = {}): CambioArtefacto => ({ artefacto, contenido, ...extra });
const raizDe = (ruta: string) => {
  const [col, id] = ruta.split("/");
  return db.collection(col).doc(id);
};

/** El mock guarda las claves con puntos tal cual; Firestore real las expande: se expanden aquí para releer el puntero. */
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

/** Ejecuta UNA acción como la ejecutaría un llamador: lee el dueño, prepara, aplica y hace SU update con el puntero. */
async function ejecutar(
  cambio: Partial<CambioFase> & Pick<CambioFase, "artefactos">,
  { ruta = RUTA, base: b = base }: { ruta?: string; base?: Omit<typeof base, never> } = {}
) {
  const antes = db.contadores();
  let lecturasModulo = 0;
  const r = (await db.runTransaction(async (tx) => {
    const raiz = raizDe(ruta);
    const snap = await tx.get(raiz);
    const l0 = db.contadores().lecturas;
    const plan = await prepararVersion(tx as never, { ...b, raiz: raiz as never, datosRaiz: expandir(snap.data() as never), ...cambio });
    lecturasModulo = db.contadores().lecturas - l0;
    const res = aplicarVersion(tx as never, plan);
    if (res.cambio) await tx.update(raiz, res.updatesRaiz);
    return res;
  })) as ResultadoVersion;
  const despues = db.contadores();
  return {
    r,
    lecturasModulo,
    // escrituras de ESTE módulo = todas menos el `update` del dueño que el llamador ya hacía
    escriturasModulo: despues.escrituras - antes.escrituras - (r.cambio ? 1 : 0),
    borrados: despues.borrados - antes.borrados,
  };
}
/** Documento guardado, tipado solo en lo que las pruebas leen (sin `any`). */
type DocGuardado = Record<string, unknown> & {
  artefactos: Record<string, EntradaManifiesto>;
  aprobacion?: unknown;
  huellasItems: Record<string, string>;
  editadoPorPersona?: string[];
  cierre: { por: string };
  huella?: string;
  contenidoOmitido?: boolean;
  tamanoBytes: number;
  previaN: number | null;
  n: number;
  fase?: string;
  ambito?: string;
};
const doc = (ruta: string) => db.snapshot()[ruta] as DocGuardado | undefined;
const versionesDe = () => Object.keys(db.snapshot()).filter((k) => k.startsWith(`${RUTA}/versiones/`)).sort();

beforeEach(() => {
  db.reset({ [RUTA]: { nombre: "proyecto" } });
  db.rechazarUndefined(true);
  db.atomico(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("primera vez (sin historial)", () => {
  it("sin estado previo: versión n=1 + revisión 1 + evento; puntero para el dueño; 0 lecturas y 3 escrituras del módulo", async () => {
    const x = await ejecutar({ artefactos: [art("dvs", { a: 1 })] });
    expect(x.r).toMatchObject({ cambio: true, revisionN: 1, versionIds: { dvs: "dvs__000001" } });
    expect(x.lecturasModulo).toBe(0);
    expect(x.escriturasModulo).toBe(3);
    expect(doc(`${RUTA}/versiones/dvs__000001`)).toMatchObject({ artefacto: "dvs", n: 1, contenido: { a: 1 }, por: "u1", tipoCambio: "ajuste_manual", estado: "vigente" });
    expect(doc(`${RUTA}/revisiones/exploracion_000001`)).toMatchObject({ fase: "exploracion", n: 1, previaN: null, por: "u1" });
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/eventos/"))).toHaveLength(1);
    expect(expandir(doc(RUTA)).phases).toMatchObject({ exploracion: { revision: { n: 1, por: "u1" } } });
  });

  it("con estado previo COMPLETO y aprobado: el previo conserva aprobado/por/en/huella/mapa en SU versión (por y en null)", async () => {
    const aprobacion = { aprobado: true, por: "ana", en: "2026-10-01T10:00:00Z", huella: "hh", mapa: { P: { x: 1 } } };
    const x = await ejecutar({
      artefactos: [art("m1.aprobacion", { v: "nuevo" }, { estadoPrevio: { contenido: { v: "viejo" }, aprobacion, insumos: { dependeDe: [] } } })],
    });
    expect(x.escriturasModulo).toBe(4); // previo + versión + revisión + evento
    expect(x.lecturasModulo).toBe(0);
    const previo = doc(`${RUTA}/versiones/m1.aprobacion__000001`)!;
    expect(previo).toMatchObject({ n: 1, tipoCambio: "previo_sin_historial", por: null, en: null, estado: "reemplazada", contenido: { v: "viejo" } });
    expect(previo.aprobacion).toEqual(aprobacion); // aprobado, por, en, huella y mapa intactos
    expect(doc(`${RUTA}/versiones/m1.aprobacion__000002`)).toMatchObject({ n: 2, tipoCambio: "ajuste_manual", contenido: { v: "nuevo" }, por: "u1" });
    const m = doc(`${RUTA}/revisiones/exploracion_000001`)!;
    expect(m.artefactos["m1.aprobacion"].retenidas.map((r: RetenidaRef) => r.n)).toEqual([1, 2]);
    expect(m.artefactos["m1.aprobacion"].retenidas[0].aprobada).toBe(true);
  });

  it("si el estado previo ES lo que se quiere registrar: no hay nada que registrar (cero escrituras)", async () => {
    const x = await ejecutar({ artefactos: [art("dvs", { a: 1 }, { estadoPrevio: { contenido: { a: 1 } } })] });
    expect(x.r.cambio).toBe(false);
    expect(x.escriturasModulo).toBe(0);
    expect(versionesDe()).toEqual([]);
  });
});

describe("acciones siguientes y dedupe (SOLO contra la vigente, sobre la tupla completa)", () => {
  it("acción siguiente: +1 lectura (el manifiesto) y +3 escrituras; revisión 2 con previaN 1", async () => {
    await ejecutar({ artefactos: [art("dvs", { a: 1 })] });
    const x = await ejecutar({ artefactos: [art("dvs", { a: 2 })] });
    expect(x.lecturasModulo).toBe(1);
    expect(x.escriturasModulo).toBe(3);
    expect(doc(`${RUTA}/revisiones/exploracion_000002`)).toMatchObject({ n: 2, previaN: 1 });
    expect(doc(`${RUTA}/versiones/dvs__000002`)).toMatchObject({ n: 2, contenido: { a: 2 } });
  });

  it("misma tupla que la vigente → no-op: cero escrituras, sin puntero nuevo", async () => {
    await ejecutar({ artefactos: [art("dvs", { a: 1 })] });
    const x = await ejecutar({ artefactos: [art("dvs", { a: 1 })] });
    expect(x.r).toEqual({ cambio: false, revisionN: null, versionIds: {}, updatesRaiz: {} });
    expect(x.escriturasModulo).toBe(0);
    expect(versionesDe()).toEqual([`${RUTA}/versiones/dvs__000001`]);
  });

  it("A→B→A crea 3 versiones: NO reutiliza la primera", async () => {
    await ejecutar({ artefactos: [art("dvs", { v: "A" })] });
    await ejecutar({ artefactos: [art("dvs", { v: "B" })] });
    const x = await ejecutar({ artefactos: [art("dvs", { v: "A" })] });
    expect(x.r.versionIds.dvs).toBe("dvs__000003");
    expect(versionesDe()).toHaveLength(3);
    expect(doc(`${RUTA}/versiones/dvs__000003`)!.huella).toBe(doc(`${RUTA}/versiones/dvs__000001`)!.huella); // mismo contenido, versión propia
  });

  it("mismo contenido con la aprobación RETIRADA → versión nueva", async () => {
    const aprobacion = { aprobado: true, por: "ana", en: "2026-10-01", huella: "h", mapa: {} };
    await ejecutar({ artefactos: [art("m1.aprobacion", { v: 1 }, { aprobacion })] });
    const x = await ejecutar({ artefactos: [art("m1.aprobacion", { v: 1 })], tipoCambio: "reapertura" });
    expect(x.r.cambio).toBe(true);
    expect(doc(`${RUTA}/versiones/m1.aprobacion__000002`)).toMatchObject({ tipoCambio: "reapertura" });
    expect(doc(`${RUTA}/versiones/m1.aprobacion__000002`)!.aprobacion).toBeUndefined();
    expect(doc(`${RUTA}/versiones/m1.aprobacion__000001`)!.aprobacion).toEqual(aprobacion); // la aprobación anterior queda en SU versión
  });

  it("mismo contenido con insumos/dependeDe distintos → versión nueva", async () => {
    await ejecutar({ artefactos: [art("s", { v: 1 }, { insumos: { dependeDe: [{ artefacto: "o", versionId: "o__000001", huella: "h1" }] } })] });
    const x = await ejecutar({ artefactos: [art("s", { v: 1 }, { insumos: { dependeDe: [{ artefacto: "o", versionId: "o__000002", huella: "h2" }] } })] });
    expect(x.r.cambio).toBe(true);
  });

  it("un artefacto intacto reutiliza su versión en el manifiesto (no se copia contenido): solo se escribe lo que cambió", async () => {
    await ejecutar({ artefactos: [art("a", { v: 1 }), art("b", { v: 1 })] });
    const x = await ejecutar({ artefactos: [art("a", { v: 1 }), art("b", { v: 2 })] });
    expect(x.escriturasModulo).toBe(3); // versión de b + revisión + evento (a no cambió)
    const m = doc(`${RUTA}/revisiones/exploracion_000002`)!;
    expect(m.artefactos.a.versionId).toBe("a__000001");
    expect(m.artefactos.b.versionId).toBe("b__000002");
    expect(versionesDe()).toHaveLength(3);
  });
});

describe("costo por acción (medido con los contadores del mock)", () => {
  it("primera acción de un artefacto sin historial = 4 escrituras y 0 lecturas; siguiente = 3 y 1; N artefactos = N+2 y 1", async () => {
    const primera = await ejecutar({ artefactos: [art("x", { v: 2 }, { estadoPrevio: { contenido: { v: 1 } } })] });
    expect([primera.lecturasModulo, primera.escriturasModulo]).toEqual([0, 4]);
    const siguiente = await ejecutar({ artefactos: [art("x", { v: 3 })] });
    expect([siguiente.lecturasModulo, siguiente.escriturasModulo]).toEqual([1, 3]);
    const tres = await ejecutar({ artefactos: [art("x", { v: 4 }), art("y", { v: 1 }), art("z", { v: 1 })] });
    expect([tres.lecturasModulo, tres.escriturasModulo]).toEqual([1, 3 + 2]);
  });
  it("N artefactos nuevos con estado previo en la primera acción: 2N+2 escrituras", async () => {
    const x = await ejecutar({
      artefactos: [art("a", { v: 2 }, { estadoPrevio: { contenido: { v: 1 } } }), art("b", { v: 2 }, { estadoPrevio: { contenido: { v: 1 } } })],
    });
    expect([x.lecturasModulo, x.escriturasModulo]).toEqual([0, 2 * 2 + 2]);
  });
  it("la poda suma hasta 2 borrados por escritura (no lecturas)", async () => {
    for (let i = 1; i <= 6; i++) {
      const x = await ejecutar({ artefactos: [art("p", { v: i })], tope: 3 });
      if (i === 4) expect(x.borrados).toBe(1);
      expect(x.borrados).toBeLessThanOrEqual(2);
      if (i > 1) expect(x.lecturasModulo).toBe(1);
    }
  });
});

describe("N artefactos en la misma revisión", () => {
  it("una sola revisión y un solo evento para varios artefactos", async () => {
    const x = await ejecutar({ artefactos: [art("a", 1), art("b", 2), art("c", 3)] });
    expect(x.escriturasModulo).toBe(5);
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/revisiones/"))).toHaveLength(1);
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/eventos/"))).toHaveLength(1);
    expect(Object.keys(x.r.versionIds).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("autoría y autorización", () => {
  it("`por` es obligatorio", async () => {
    await expect(ejecutar({ artefactos: [art("a", 1)], por: "" })).rejects.toBeInstanceOf(CambioInvalidoError);
    expect(versionesDe()).toEqual([]);
  });
  it("una regeneración con IA EXIGE autorizadoPor y autorizadoEn; con ellos se guardan y la fuente es «ia»", async () => {
    await expect(ejecutar({ artefactos: [art("a", 1)], tipoCambio: "regeneracion_ia" })).rejects.toBeInstanceOf(AutorizacionIARequeridaError);
    await expect(
      ejecutar({ artefactos: [art("a", 1)], tipoCambio: "regeneracion_ia", autorizadoPor: "u1" })
    ).rejects.toBeInstanceOf(AutorizacionIARequeridaError);
    await ejecutar({ artefactos: [art("a", 1)], tipoCambio: "regeneracion_ia", autorizadoPor: "u1", autorizadoEn: "2026-11-15T10:00:00Z" });
    expect(doc(`${RUTA}/versiones/a__000001`)).toMatchObject({ tipoCambio: "regeneracion_ia", autorizadoPor: "u1", autorizadoEn: "2026-11-15T10:00:00Z" });
    const evento = Object.entries(db.snapshot()).find(([k]) => k.includes("/eventos/"))![1] as Record<string, unknown>;
    expect(evento.fuente).toBe("ia");
  });
  it("la aprobación se guarda con por/en/huella/mapa congelado; los ítems con su huella; lo editado por la persona se marca", async () => {
    const aprobacion = { aprobado: true, por: "ana", en: "2026-10-01", huella: "hh", mapa: { P: 1 } };
    await ejecutar({
      artefactos: [art("dvs", { pip: [{ id: "q1" }] }, { aprobacion, items: [{ id: "q1", valor: { t: 1 } }], editadoPorPersona: ["q1"] })],
    });
    const v = doc(`${RUTA}/versiones/dvs__000001`)!;
    expect(v.aprobacion).toEqual(aprobacion);
    expect(Object.keys(v.huellasItems)).toEqual(["q1"]);
    expect(v.editadoPorPersona).toEqual(["q1"]);
  });
  it("un nombre de artefacto reservado o repetido y una lista vacía se rechazan antes de escribir", async () => {
    await expect(ejecutar({ artefactos: [art("__x__", 1)] })).rejects.toBeInstanceOf(CambioInvalidoError);
    await expect(ejecutar({ artefactos: [art("a", 1), art("a", 2)] })).rejects.toBeInstanceOf(CambioInvalidoError);
    await expect(ejecutar({ artefactos: [] })).rejects.toBeInstanceOf(CambioInvalidoError);
  });
});

describe("dependencias, protección y cierre", () => {
  it("una versión citada por un dependeDe vigente queda PROTEGIDA en el manifiesto", async () => {
    await ejecutar({ artefactos: [art("origen", { v: 1 })] });
    await ejecutar({
      artefactos: [art("derivado", { v: 1 }, { insumos: { dependeDe: [{ artefacto: "origen", versionId: "origen__000001", huella: "h" }] } })],
    });
    const m = doc(`${RUTA}/revisiones/exploracion_000002`)!;
    expect(m.artefactos.origen.retenidas.find((r: RetenidaRef) => r.id === "origen__000001")?.protegida).toBe(true);
    expect(m.artefactos.derivado.dependeDe).toHaveLength(1);
  });
  it("con cierre: la revisión guarda quién cerró y las versiones vigentes quedan protegidas", async () => {
    await ejecutar({ artefactos: [art("dvs", { v: 1 }), art("m1", { v: 1 })], cierre: { por: "u9" } });
    const m = doc(`${RUTA}/revisiones/exploracion_000001`)!;
    expect(m.cierre.por).toBe("u9");
    expect(m.artefactos.dvs.retenidas.every((r: RetenidaRef) => r.protegida)).toBe(true);
  });
});

describe("retención (dentro de la misma transacción)", () => {
  it("con tope 3: tras 6 versiones quedan las 3 últimas; las aprobadas nunca se podan", async () => {
    const aprobacion = { aprobado: true, por: "ana", en: "e", huella: "h", mapa: {} };
    await ejecutar({ artefactos: [art("p", { v: 1 }, { aprobacion })], tope: 3 });
    for (let i = 2; i <= 6; i++) await ejecutar({ artefactos: [art("p", { v: i })], tope: 3 });
    const vivas = versionesDe().map((k) => k.split("/").at(-1));
    expect(vivas).toContain("p__000001"); // aprobada: conservada
    expect(vivas).toContain("p__000006");
    expect(vivas).not.toContain("p__000002");
    const m = doc(`${RUTA}/revisiones/exploracion_000006`)!;
    expect(m.artefactos.p.retenidas.length).toBe(vivas.length);
  });
  it("las revisiones y los eventos NO se podan", async () => {
    for (let i = 1; i <= 6; i++) await ejecutar({ artefactos: [art("p", { v: i })], tope: 3 });
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/revisiones/"))).toHaveLength(6);
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/eventos/"))).toHaveLength(6);
  });
});

describe("tamaño", () => {
  it("un contenido por encima del límite se guarda SIN contenido (contenidoOmitido) y con su huella", async () => {
    await ejecutar({ artefactos: [art("grande", { texto: "x".repeat(950_000) })] });
    const v = doc(`${RUTA}/versiones/grande__000001`)!;
    expect(v.contenidoOmitido).toBe(true);
    expect("contenido" in v).toBe(false);
    expect(v.huella).toMatch(/^[0-9a-f]{64}$/);
    expect(v.tamanoBytes).toBeGreaterThan(900_000);
  });
});

describe("no pisa nunca: create + errores explícitos ante un puntero desfasado", () => {
  it("colisión de id de versión: el commit falla y NO queda nada (ni revisión ni evento ni puntero)", async () => {
    db.reset({ [RUTA]: { nombre: "proyecto" }, [`${RUTA}/versiones/dvs__000001`]: { ocupado: true } });
    db.rechazarUndefined(true);
    db.atomico(true);
    const err = await ejecutar({ artefactos: [art("dvs", { a: 1 })] }).catch((e) => e);
    expect(String(err.message)).toContain("ALREADY_EXISTS");
    expect(traducirErrorHistorial(err)).toBeInstanceOf(ColisionHistorialError);
    expect(doc(`${RUTA}/versiones/dvs__000001`)).toEqual({ ocupado: true }); // no se pisó
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/revisiones/") || k.includes("/eventos/"))).toHaveLength(0);
    expect(expandir(doc(RUTA)).phases).toBeUndefined();
  });
  it("puntero a una revisión que NO existe: error explícito y cero escrituras (no crea desde cero)", async () => {
    db.reset({ [RUTA]: { nombre: "p", "phases.exploracion.revision": { n: 3, huella: "h", por: "u", en: "e" } } });
    db.rechazarUndefined(true);
    db.atomico(true);
    const antes = db.contadores().escrituras;
    await expect(ejecutar({ artefactos: [art("dvs", 1)] })).rejects.toBeInstanceOf(HistorialInconsistenteError);
    expect(db.contadores().escrituras).toBe(antes);
  });
  it("el manifiesto no coincide con el puntero (n distinto): error explícito", async () => {
    db.reset({
      [RUTA]: { nombre: "p", "phases.exploracion.revision": { n: 2, huella: "h", por: "u", en: "e" } },
      [`${RUTA}/revisiones/${idRevision("exploracion", 2)}`]: { fase: "exploracion", n: 5, artefactos: {} },
    });
    db.rechazarUndefined(true);
    db.atomico(true);
    await expect(ejecutar({ artefactos: [art("dvs", 1)] })).rejects.toBeInstanceOf(HistorialInconsistenteError);
  });
  it("la revisión n+1 ya existe pero el puntero sigue en n: el create falla y no queda nada", async () => {
    await ejecutar({ artefactos: [art("dvs", { v: 1 })] });
    db.reset({ ...db.snapshot(), [`${RUTA}/revisiones/${idRevision("exploracion", 2)}`]: { ocupada: true } });
    db.rechazarUndefined(true);
    db.atomico(true);
    const versionesAntes = versionesDe().length;
    const err = await ejecutar({ artefactos: [art("dvs", { v: 2 })] }).catch((e) => e);
    expect(traducirErrorHistorial(err)).toBeInstanceOf(ColisionHistorialError);
    expect(versionesDe()).toHaveLength(versionesAntes);
  });
  it("sin puntero pero con una revisión 1 ya existente: el create falla (no se crea desde cero)", async () => {
    db.reset({ [RUTA]: { nombre: "p" }, [`${RUTA}/revisiones/${idRevision("exploracion", 1)}`]: { ocupada: true } });
    db.rechazarUndefined(true);
    db.atomico(true);
    const err = await ejecutar({ artefactos: [art("dvs", 1)] }).catch((e) => e);
    expect(traducirErrorHistorial(err)).toBeInstanceOf(ColisionHistorialError);
    expect(versionesDe()).toEqual([]);
  });
  it("traducirErrorHistorial deja pasar cualquier otro error tal cual", () => {
    const otro = new Error("otra cosa");
    expect(traducirErrorHistorial(otro)).toBe(otro);
    expect(traducirErrorHistorial({ code: 6 })).toBeInstanceOf(ColisionHistorialError);
  });
});

describe("atomicidad y agnosticismo de app", () => {
  it("si falla UNA escritura, no queda ninguna (todo o nada)", async () => {
    db.failUpdateOn(`${RUTA}/revisiones/${idRevision("exploracion", 1)}`);
    await expect(ejecutar({ artefactos: [art("dvs", { a: 1 })] })).rejects.toThrow();
    expect(versionesDe()).toEqual([]);
    expect(Object.keys(db.snapshot()).filter((k) => k.includes("/eventos/"))).toHaveLength(0);
  });
  it("sirve a otra app: misma API con otra raíz y otro ámbito (fontana_sesiones/s1)", async () => {
    db.reset({ "fontana_sesiones/s1": { uid: "u1" } });
    db.rechazarUndefined(true);
    db.atomico(true);
    const x = await ejecutar(
      { artefactos: [art("reporte", { md: "# hola" })] },
      { ruta: "fontana_sesiones/s1", base: { ...base, ambito: "sesion", fase: "sesion", punteroCampo: "historial.revision" } }
    );
    expect(x.escriturasModulo).toBe(3);
    expect(doc("fontana_sesiones/s1/versiones/reporte__000001")).toMatchObject({ ambito: "sesion", fase: "sesion" });
    expect(expandir(doc("fontana_sesiones/s1")).historial).toMatchObject({ revision: { n: 1 } });
  });
  it("ids deterministas y sin el patrón reservado de Firestore (__*__)", () => {
    expect(idVersion("f3Resultado:abc", 7)).toBe("f3Resultado:abc__000007");
    expect(idVersion("a/b", 1)).toBe("a|b__000001");
    expect(idRevision("investigacion", 12)).toBe("investigacion_000012");
    expect(idVersion("dvs", 1)).not.toMatch(/^__.*__$/);
  });
});
