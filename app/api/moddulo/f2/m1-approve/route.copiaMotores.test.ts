// C4c-0a — m1-approve: cuando aprobar con contenido distinto DESCARTA un borrador de motores, además de la versión de
// f2M1 queda una COPIA PUNTUAL del borrador en el artefacto `f2Motores`, en la MISMA revisión, leída del documento
// releído dentro de la transacción. Sin `vivo` y sin `estadoPrevio` (es una foto, no un estado vivo). Mock con rechazo
// de `undefined` y transacciones atómicas; sin emulador (Java 17). La aprobación NO llama al modelo.
// Casos de tamaño: base ≈ 28 KB (el borrador real medido: 27 855 – 28 045 bytes) y límite > 900 000 bytes
// (`contenidoOmitido`: el acto NO falla).

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase-admin/firestore")>()),
  FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" },
}));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { docProyectoM1, huellaDe, mapaM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";
import { consolidarF2, eventosDe, exploracionDe, revisionesDe, versionesDe } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";
import { huellaContenido } from "@/lib/versionado/huella";
import { vivoF2M1 } from "@/lib/moddulo/versionado/artefactosF2";
import { estimarBytes } from "@/lib/versionado/tamano";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const H = huellaDe(mapaM1());
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", huellaVista: H, ...o }) }) as never;

/** Borrador con la forma de `DVSF2` rellenado hasta pesar ≈ `bytes` (JSON UTF-8). */
function borrador(bytes: number) {
  const base = { hei: { tensionCentral: "TEXTO-DEL-BORRADOR-SECRETO" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] };
  const falta = Math.max(0, bytes - estimarBytes(base) - 20);
  return { ...base, relleno: "x".repeat(falta) };
}
const conBorrador = (b: unknown, generacion: string | null = "huella-de-otro-contenido", extra: Record<string, unknown> = {}) =>
  docProyectoM1({
    draftDVS: b,
    motorAprobaciones: { M2: true, M3: true },
    m1: { ...(generacion ? { generacion: { huella: generacion, en: "t" } } : {}), reabiertoEn: "t", reabiertoPor: "u1" },
    ...extra,
  });

function sembrar(doc: unknown) {
  db.reset({ [P]: structuredClone(doc) });
  db.rechazarUndefined(true);
  db.atomico(true);
}
const copias = () => versionesDe(db, P).filter((x) => x.artefacto === "f2Motores");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
});

describe("aprobar con contenido distinto — copia puntual de los motores (caso base ≈ 28 KB)", () => {
  it("guarda f2Motores {draftDVS, motorAprobaciones, m1Huella} en la MISMA revisión, sin aprobación, sin previa y sin vivo", async () => {
    const b = borrador(28_000);
    expect(estimarBytes(b)).toBeGreaterThan(27_500);
    sembrar(conBorrador(b));
    expect((await POST(req())).status).toBe(200);

    const todas = versionesDe(db, P);
    // f2M1: previa + nueva; f2Motores: UNA sola (no hay estado previo que registrar de una foto).
    expect(todas.map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002", "f2Motores__000001"]);
    const [copia] = copias();
    expect(copia.contenido).toEqual({ draftDVS: b, motorAprobaciones: { M2: true, M3: true }, m1Huella: "huella-de-otro-contenido" });
    expect(copia).not.toHaveProperty("aprobacion");
    expect(copia).toMatchObject({ tipoCambio: "ajuste_manual", motivo: "aprobacion", por: "u1", estado: "vigente" });
    expect(copia).not.toHaveProperty("contenidoOmitido");

    // MISMA revisión y UN solo evento; el manifiesto lista las dos y la copia no lleva `vivo`.
    expect(revisionesDe(db, P).map((r) => r.id)).toEqual(["exploracion_000001"]);
    const manifiesto = revisionesDe(db, P)[0] as unknown as { artefactos: Record<string, { vivo?: string; versionId: string }> };
    expect(Object.keys(manifiesto.artefactos).sort()).toEqual(["f2M1", "f2Motores"]);
    expect(manifiesto.artefactos.f2Motores).not.toHaveProperty("vivo");
    expect(manifiesto.artefactos.f2Motores.versionId).toBe("f2Motores__000001");
    const ev = eventosDe(db, P);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ artefactos: ["f2M1", "f2Motores"], motivo: "aprobacion" });
    expect(ev[0].detalle).toEqual({ motoresAprobadosDescartados: ["M2", "M3"], borradorDescartado: true, copiaMotores: true });
  });

  it("se borra el borrador vivo (como siempre) y la copia no lo reemplaza: la pantalla ve lo mismo que antes", async () => {
    sembrar(conBorrador(borrador(28_000)));
    await POST(req());
    const u = db.updates().find((x) => x.path === P)!.data;
    expect(u["phases.exploracion.draftDVS"]).toBe("__DELETE__");
    expect(u["phases.exploracion.motorAprobaciones"]).toEqual({});
    expect(u["phases.exploracion.m1.generacion"]).toBe("__DELETE__");
  });

  it("[sin deriva nueva] la proyección viva NO cambió de forma: el `vivo` de f2M1 sigue siendo el de siempre (sin `origen`)", async () => {
    sembrar(conBorrador(borrador(28_000)));
    await POST(req());
    const manifiesto = revisionesDe(db, P)[0] as unknown as { artefactos: { f2M1: { vivo: string } } };
    consolidarF2(db, P);
    expect(huellaContenido(vivoF2M1(exploracionDe(db, P)))).toBe(manifiesto.artefactos.f2M1.vivo);
    expect(Object.keys(vivoF2M1(exploracionDe(db, P)) as object)).not.toContain("origen");
    expect(vivoF2M1(exploracionDe(db, P))).toMatchObject({ esquema: 1 });
  });

  it("la versión de f2M1 lleva `origen` (sin el payload) y NO lleva el borrador", async () => {
    sembrar(conBorrador(borrador(28_000)));
    await POST(req());
    const f2m1 = versionesDe(db, P).filter((x) => x.artefacto === "f2M1");
    for (const v of f2m1) expect(v.contenido).toMatchObject({ origen: { componente: "moddulo", sourceId: "p1" } });
    expect(JSON.stringify(f2m1)).not.toContain("TEXTO-DEL-BORRADOR-SECRETO");
    expect(JSON.stringify(f2m1.map((v) => (v.contenido as unknown as { origen: unknown }).origen))).not.toContain("payload");
  });
});

describe("aprobar con contenido distinto — caso límite (> 900 000 bytes): la copia sale `contenidoOmitido` y el acto NO falla", () => {
  it("200, la aprobación se hace, la copia queda sin contenido y el evento dice copiaMotores:false", async () => {
    const grande = borrador(900_500);
    expect(estimarBytes({ draftDVS: grande })).toBeGreaterThan(900_000);
    sembrar(conBorrador(grande));
    const res = await POST(req());
    expect(res.status).toBe(200);

    const [copia] = copias();
    expect(copia).toMatchObject({ contenidoOmitido: true });
    expect(copia).not.toHaveProperty("contenido");
    expect(copia.huella).toEqual(expect.any(String));
    // el análisis SÍ se aprobó y la versión de f2M1 es normal
    const nueva = versionesDe(db, P).filter((x) => x.artefacto === "f2M1").at(-1)!;
    expect(nueva.aprobacion).toMatchObject({ aprobado: true, huella: H });
    expect(eventosDe(db, P)[0].detalle).toEqual({ motoresAprobadosDescartados: ["M2", "M3"], borradorDescartado: true, copiaMotores: false });
  });
});

describe("aprobar — cuándo NO hay copia", () => {
  it("contenido IDÉNTICO al que generó el borrador: no se descarta nada y no hay copia ni detalle", async () => {
    sembrar(conBorrador(borrador(28_000), H));
    expect((await (await POST(req())).json()).motoresDescartados).toBe(false);
    expect(copias()).toHaveLength(0);
    expect(eventosDe(db, P)[0].artefactos).toEqual(["f2M1"]);
    expect(Object.keys(eventosDe(db, P)[0])).not.toContain("detalle");
  });

  it("se descarta algo pero NO había borrador (solo marca de generación): sin copia y el detalle no trae copiaMotores", async () => {
    sembrar(docProyectoM1({ m1: { generacion: { huella: "otro", en: "t" }, reabiertoEn: "t", reabiertoPor: "u1" } }));
    expect((await (await POST(req())).json()).motoresDescartados).toBe(true);
    expect(copias()).toHaveLength(0);
    expect(eventosDe(db, P)[0].detalle).toEqual({ motoresAprobadosDescartados: [], borradorDescartado: false });
  });

  it("solo aprobaciones de motores, sin borrador: sin copia", async () => {
    sembrar(docProyectoM1({ motorAprobaciones: { M2: true }, m1: { generacion: { huella: "otro", en: "t" }, reabiertoEn: "t", reabiertoPor: "u1" } }));
    await POST(req());
    expect(copias()).toHaveLength(0);
    expect(eventosDe(db, P)[0].detalle).not.toHaveProperty("copiaMotores");
  });

  it("los caminos que no escriben (ya aprobado, huella vencida) tampoco dejan copia", async () => {
    sembrar(conBorrador(borrador(1_000)));
    expect((await POST(req({ huellaVista: "otra" }))).status).toBe(409);
    expect(copias()).toHaveLength(0);
    expect(versionesDe(db, P)).toHaveLength(0);
  });
});

describe("la copia sale del documento releído DENTRO de la transacción", () => {
  it("un `getProject` con un borrador distinto (lectura vieja) NO llega a la copia: manda el de la transacción", async () => {
    const vigente = borrador(2_000);
    const viejo = { ...borrador(2_000), hei: { tensionCentral: "BORRADOR-VIEJO-FUERA-DE-LA-TX" } };
    sembrar(conBorrador(vigente));
    vi.mocked(getProject).mockResolvedValue(conBorrador(viejo) as never);
    expect((await POST(req())).status).toBe(200);
    const texto = JSON.stringify(copias());
    expect(texto).toContain("TEXTO-DEL-BORRADOR-SECRETO");
    expect(texto).not.toContain("BORRADOR-VIEJO-FUERA-DE-LA-TX");
  });
});

describe("dos copias seguidas idénticas no se duplican (dedupe del núcleo)", () => {
  it("segunda aprobación que descarta EXACTAMENTE la misma foto: sigue habiendo una sola versión de f2Motores", async () => {
    const b = borrador(2_000);
    sembrar(conBorrador(b));
    await POST(req());
    expect(copias()).toHaveLength(1);
    // vuelve a quedar un M1 reabierto con el MISMO borrador, mismas aprobaciones y la misma huella de generación
    consolidarF2(db, P);
    const doc = structuredClone(db.snapshot()[P]) as { phases: { exploracion: Record<string, unknown> & { m1: Record<string, unknown> } } };
    const e = doc.phases.exploracion;
    e.draftDVS = b;
    e.motorAprobaciones = { M2: true, M3: true };
    delete e.m1.aprobacion;
    e.m1.generacion = { huella: "huella-de-otro-contenido", en: "t" };
    e.m1.reabiertoEn = "t";
    e.m1.reabiertoPor = "u1";
    db.seed(P, doc);
    expect((await POST(req())).status).toBe(200);
    expect(copias()).toHaveLength(1);
    expect(eventosDe(db, P).at(-1)!.artefactos).toEqual(["f2M1"]);
  });
});

describe("todo o nada y costo", () => {
  it("si la copia choca (versión ya existente sin manifiesto): 409 historial_no_confirmado y NO se aprobó ni se descartó nada", async () => {
    sembrar(conBorrador(borrador(1_000)));
    db.seed(`${P}/versiones/f2Motores__000001`, { artefacto: "f2Motores", n: 1 });
    const res = await POST(req());
    expect([409, 500]).toContain(res.status);
    expect((await res.json()).error).toBe("historial_no_confirmado");
    expect(db.updates().filter((u) => u.path === P)).toHaveLength(0);
  });

  it("costo: con borrador que se descarta = el de siempre + 1 escritura (la copia) y 0 lecturas más", async () => {
    sembrar(conBorrador(borrador(28_000)));
    const antes = db.contadores();
    await POST(req());
    const conCopia = db.contadores();
    const e1 = conCopia.escrituras - antes.escrituras;
    const l1 = conCopia.lecturas - antes.lecturas;

    sembrar(docProyectoM1({ m1: { generacion: { huella: "otro", en: "t" }, reabiertoEn: "t", reabiertoPor: "u1" } })); // se descarta, SIN borrador
    const a2 = db.contadores();
    await POST(req());
    const sinCopia = db.contadores();
    expect(l1).toBe(sinCopia.lecturas - a2.lecturas);
    expect(e1).toBe(sinCopia.escrituras - a2.escrituras + 1);
  });

  it("no llama al modelo: la ruta no importa el SDK ni `lib/ai`", () => {
    const fuente = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
    expect(fuente).not.toMatch(/anthropic|lib\/ai/i);
  });
});
