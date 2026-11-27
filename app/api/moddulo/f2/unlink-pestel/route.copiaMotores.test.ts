// C4c-0a — unlink-pestel: desvincular SIEMPRE destruye el borrador de motores; si había uno, además de las versiones de
// f2M1 queda una COPIA PUNTUAL en `f2Motores` (misma revisión, leída del documento releído dentro de la transacción,
// sin `vivo` ni `estadoPrevio`). Mock con rechazo de `undefined` y transacciones atómicas; sin emulador (Java 17).
// Desvincular NO llama al modelo. Casos de tamaño: base ≈ 28 KB y límite > 900 000 bytes (`contenidoOmitido`).

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
import { docProyectoT22, type OpcionesT22 } from "@/lib/moddulo/__tests__/fixtures/m1SiembraT22";
import { clonar, eventosDe, registrarVigenteF2, revisionesDe, versionesDe } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";
import { estimarBytes } from "@/lib/versionado/tamano";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const PEST = "pestel_projects/pest1";
const req = (o: Record<string, unknown> = {}) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1", ...o }) }) as never;

function borrador(bytes: number) {
  const base = { hei: { tensionCentral: "TEXTO-DEL-BORRADOR-SECRETO" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] };
  const falta = Math.max(0, bytes - estimarBytes(base) - 20);
  return { ...base, relleno: "x".repeat(falta) };
}
function sembrar(doc: unknown) {
  db.reset({ [P]: clonar(doc), [PEST]: { userId: "u1", modduloProjectId: "p1" } });
  db.rechazarUndefined(true);
  db.atomico(true);
}
const t22 = (o: OpcionesT22 = {}) => docProyectoT22({ motorAprobaciones: { M2: true, M3: true }, dvs: { final: 1 }, ...o });
async function desvincular() {
  const r = await POST(req());
  expect(r.status).toBe(409);
  const { huella } = (await r.json()) as { huella: string };
  return POST(req({ confirmar: true, huella }));
}
const copias = () => versionesDe(db, P).filter((x) => x.artefacto === "f2Motores");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getProject).mockImplementation(async (id: string) => (db.snapshot()[`moddulo_projects/${id}`] ?? null) as never);
});

describe("desvincular con borrador — copia puntual de los motores (caso base ≈ 28 KB)", () => {
  it("guarda f2Motores {draftDVS, motorAprobaciones, m1Huella} en la MISMA revisión, sin aprobación ni previa ni vivo", async () => {
    const b = borrador(28_000);
    sembrar(t22({ draftDVS: b }));
    expect((await desvincular()).status).toBe(200);

    expect(versionesDe(db, P).map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002", "f2Motores__000001"]);
    const [copia] = copias();
    expect(copia.contenido).toMatchObject({ draftDVS: b, motorAprobaciones: { M2: true, M3: true } });
    expect(typeof (copia.contenido as unknown as { m1Huella: unknown }).m1Huella).toBe("string"); // la `generacion` del M1 sembrado
    expect(copia).not.toHaveProperty("aprobacion");
    expect(copia).toMatchObject({ motivo: "desvinculacion", tipoCambio: "ajuste_manual", por: "u1" });

    expect(revisionesDe(db, P).map((r) => r.id)).toEqual(["exploracion_000001"]);
    const manifiesto = revisionesDe(db, P)[0] as unknown as { artefactos: Record<string, { vivo?: string }> };
    expect(Object.keys(manifiesto.artefactos).sort()).toEqual(["f2M1", "f2Motores"]);
    expect(manifiesto.artefactos.f2Motores).not.toHaveProperty("vivo");
    const ev = eventosDe(db, P);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ artefactos: ["f2M1", "f2Motores"], motivo: "desvinculacion" });
    expect(ev[0].detalle).toMatchObject({ borradorDescartado: true, copiaMotores: true });
  });

  it("las versiones de f2M1 llevan `origen` (sin el payload) y NO llevan el borrador", async () => {
    sembrar(t22({ draftDVS: borrador(28_000) }));
    await desvincular();
    const f2m1 = versionesDe(db, P).filter((x) => x.artefacto === "f2M1");
    expect((f2m1[0].contenido as unknown as { origen: unknown }).origen).toEqual({
      componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", huellaFuente: { v: 2, h: "huella-origen" },
    });
    // la versión «sin M1» no tiene vínculo: no lleva la clave `origen` (ni `undefined`)
    expect(f2m1.at(-1)!.contenido).toEqual({ kind: null, mapa: null, ediciones: {} });
    expect(JSON.stringify(f2m1)).not.toContain("TEXTO-DEL-BORRADOR-SECRETO");
  });

  it("con historial vigente (régimen): solo se agrega la copia; ninguna previa ni deriva", async () => {
    sembrar(t22({ draftDVS: borrador(2_000) }));
    await registrarVigenteF2(db, P);
    expect((await desvincular()).status).toBe(200);
    expect(versionesDe(db, P).map((x) => x.id)).toEqual(["f2M1__000001", "f2M1__000002", "f2Motores__000001"]);
    expect(versionesDe(db, P).some((x) => x.deriva)).toBe(false);
  });
});

describe("desvincular con borrador — caso límite (> 900 000 bytes): copia `contenidoOmitido`, el acto NO falla", () => {
  it("200; la desvinculación se hace; la copia queda sin contenido; el evento dice copiaMotores:false", async () => {
    const grande = borrador(900_500);
    expect(estimarBytes({ draftDVS: grande })).toBeGreaterThan(900_000);
    sembrar(t22({ draftDVS: grande }));
    expect((await desvincular()).status).toBe(200);
    const [copia] = copias();
    expect(copia).toMatchObject({ contenidoOmitido: true });
    expect(copia).not.toHaveProperty("contenido");
    expect(eventosDe(db, P)[0].detalle).toMatchObject({ borradorDescartado: true, copiaMotores: false });
    // el vínculo se quitó como siempre
    const u = db.updates().find((x) => x.path === P)!.data;
    expect(u["phases.exploracion.linkedSource"]).toBe("__DELETE__");
    expect(u["phases.exploracion.draftDVS"]).toBe("__DELETE__");
  });
});

describe("desvincular sin borrador — no hay copia", () => {
  it("solo aprobaciones de motores (sin borrador): versiones de f2M1 y NADA de f2Motores; el detalle no trae copiaMotores", async () => {
    sembrar(t22({ draftDVS: null }));
    expect((await desvincular()).status).toBe(200);
    expect(copias()).toHaveLength(0);
    expect(eventosDe(db, P)[0].artefactos).toEqual(["f2M1"]);
    expect(eventosDe(db, P)[0].detalle).not.toHaveProperty("copiaMotores");
  });

  it("T22 totalmente vacío: sin versión de ningún tipo", async () => {
    sembrar(t22({ sinPayload: true, sinM1: true, draftDVS: null, motorAprobaciones: {}, dvs: null }));
    expect((await desvincular()).status).toBe(200);
    expect(versionesDe(db, P)).toHaveLength(0);
  });

  it("la pregunta (409) y el cancelar de un vínculo pendiente no dejan copia", async () => {
    sembrar(t22({ draftDVS: borrador(1_000) }));
    expect((await POST(req())).status).toBe(409);
    expect(versionesDe(db, P)).toHaveLength(0);
  });
});

describe("la copia sale del documento releído DENTRO de la transacción", () => {
  it("un `getProject` con un borrador distinto (lectura vieja) NO llega a la copia: manda el de la transacción", async () => {
    sembrar(t22({ draftDVS: borrador(2_000) }));
    vi.mocked(getProject).mockResolvedValue(t22({ draftDVS: { ...borrador(2_000), hei: { tensionCentral: "BORRADOR-VIEJO-FUERA-DE-LA-TX" } } }) as never);
    expect((await desvincular()).status).toBe(200);
    const texto = JSON.stringify(copias());
    expect(texto).toContain("TEXTO-DEL-BORRADOR-SECRETO");
    expect(texto).not.toContain("BORRADOR-VIEJO-FUERA-DE-LA-TX");
  });
});

describe("todo o nada y costo", () => {
  it("si la copia choca (versión ya existente sin manifiesto): historial_no_confirmado y NO se desvinculó nada", async () => {
    sembrar(t22({ draftDVS: borrador(1_000) }));
    db.seed(`${P}/versiones/f2Motores__000001`, { artefacto: "f2Motores", n: 1 });
    const res = await desvincular();
    expect((await res.json()).error).toBe("historial_no_confirmado");
    expect(db.updates().filter((u) => u.path === P || u.path === PEST)).toHaveLength(0);
  });

  it("costo: con borrador = el de siempre + 1 escritura (la copia) y 0 lecturas más", async () => {
    const medir = async (doc: unknown) => {
      sembrar(doc);
      const r = await POST(req());
      const { huella } = (await r.json()) as { huella: string };
      const a = db.contadores();
      expect((await POST(req({ confirmar: true, huella }))).status).toBe(200);
      const d = db.contadores();
      return { l: d.lecturas - a.lecturas, e: d.escrituras - a.escrituras };
    };
    const con = await medir(t22({ draftDVS: borrador(28_000) }));
    const sin = await medir(t22({ draftDVS: null }));
    expect(con.l).toBe(sin.l);
    expect(con.e).toBe(sin.e + 1);
  });

  it("no llama al modelo: la ruta no importa el SDK ni `lib/ai`", () => {
    expect(readFileSync(new URL("./route.ts", import.meta.url), "utf8")).not.toMatch(/anthropic|lib\/ai/i);
  });
});
