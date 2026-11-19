// C1b-3b — módulo puro del registro de cierre + lo que deja listo para la futura reapertura de fases (H-V27) y para C4.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase-admin/firestore")>()),
  FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => "TS" },
}));

import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { registrarEnSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";
import { clonar, consolidarF2, eventosDe, revisionesDe, versionesDe } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF2";
import {
  AMBITO_CIERRE, MOTIVO_CIERRE, detalleCierre, estadoAbierto, estadoCierre, nombreCierre, punteroFase, vivoCierre,
} from "./artefactosCierre";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const P = "moddulo_projects/p1";
const sinUndefined = (v: unknown) => expect(JSON.stringify(v, (_k, x) => (x === undefined ? "__UNDEFINED__" : x))).not.toContain("__UNDEFINED__");

describe("estadoCierre / estadoAbierto / vivoCierre", () => {
  const fase = { status: "completed", completedAt: "2026-11-10T15:00:00.123Z", reportText: "R", data: { aprobadoEn: "2026-11-10T15:00:00.123Z" }, m1: { aprobacion: { huella: "H" } } };

  it("nombre y puntero por fase", () => {
    expect(nombreCierre("exploracion")).toBe("cierre:exploracion");
    expect(punteroFase("proposito")).toBe("phases.proposito.revision");
  });
  it("con sello: la aprobación lleva quien cerró y el MISMO instante; F2 añade aprobadoEn y la huella del M1", () => {
    const e = estadoCierre("exploracion", fase, { por: "u1", en: "2026-11-10T15:00:00.123Z" });
    expect(e.aprobacion).toEqual({ aprobado: true, por: "u1", en: "2026-11-10T15:00:00.123Z" });
    expect(e.contenido).toEqual({
      fase: "exploracion", estado: "cerrada", completedAt: "2026-11-10T15:00:00.123Z", reportText: "R",
      aprobadoEn: "2026-11-10T15:00:00.123Z", m1HuellaAprobada: "H",
    });
  });
  it("las demás fases NO llevan campos de F2", () => {
    expect(Object.keys(estadoCierre("proposito", fase, { por: "u1", en: "x" }).contenido as object).sort()).toEqual(["completedAt", "estado", "fase", "reportText"]);
  });
  it("legado (sin sello): `por: null` («sin autoría registrada») y `en` = completedAt", () => {
    expect(estadoCierre("proposito", fase).aprobacion).toEqual({ aprobado: true, por: null, en: "2026-11-10T15:00:00.123Z" });
  });
  it("nunca lleva `undefined` (el Admin SDK lo rechaza), aunque falte todo", () => {
    for (const f of [undefined, {}, { status: "completed" }, { reportText: { reportText: "legado" } }]) {
      sinUndefined(estadoCierre("exploracion", f));
      sinUndefined(estadoAbierto("exploracion", f));
      sinUndefined(vivoCierre("exploracion", f));
    }
  });
  it("completedAt/aprobadoEn como Timestamp real o fecha ilegible no lanzan (se convierten o quedan null)", () => {
    const t = Timestamp.fromDate(new Date("2026-11-10T15:00:00.123Z"));
    expect((estadoCierre("proposito", { status: "completed", completedAt: t }).contenido as { completedAt: unknown }).completedAt).toBe("2026-11-10T15:00:00.123Z");
    expect((estadoCierre("proposito", { completedAt: "no es fecha" }).contenido as { completedAt: unknown }).completedAt).toBe("no es fecha");
    expect((estadoCierre("proposito", { completedAt: 7 }).contenido as { completedAt: unknown }).completedAt).toBeNull();
  });
  it("la previa «abierta» solo conserva el borrador del reporte", () => {
    expect(estadoAbierto("proposito", { status: "in-progress", reportText: "borrador" })).toEqual({ contenido: { fase: "proposito", estado: "abierta", reportText: "borrador" } });
    expect(estadoAbierto("proposito", {}).contenido).toEqual({ fase: "proposito", estado: "abierta", reportText: null });
  });
  it("la proyección viva NO lleva autor ni sello y distingue «abierta» de «cerrada»", () => {
    const v = vivoCierre("proposito", fase) as Record<string, unknown>;
    expect(JSON.stringify(v)).not.toContain("u1");
    expect(v).toMatchObject({ esquema: 1, estado: "cerrada" });
    expect(vivoCierre("proposito", { status: "in-progress" })).toMatchObject({ estado: "abierta" });
  });
  it("un campo volátil del documento (updatedAt, chatHistory, dvs) no mueve la proyección", () => {
    const a = vivoCierre("exploracion", fase);
    const b = vivoCierre("exploracion", { ...fase, updatedAt: "x", chatHistory: [1], dvs: { x: 1 }, draftDVS: { y: 1 } } as never);
    expect(b).toEqual(a);
  });
  it("detalle: solo banderas y números", () => {
    const d = detalleCierre({ reporteNuevo: true, reporteSustituido: false, rdaNuevos: 2, rdaResueltos: 0, proyectoCompletado: false });
    expect(Object.values(d).every((x) => typeof x === "boolean" || typeof x === "number")).toBe(true);
    expect(Object.keys(d).sort()).toEqual(["proyectoCompletado", "rdaNuevos", "rdaResueltos", "reporteNuevo", "reporteSustituido"]);
  });
});

describe("lo que deja listo para H-V27 (reabrir una fase cerrada; SIN ruta ni código sin uso)", () => {
  beforeEach(() => {
    db.reset({ [P]: clonar({ phases: { proposito: { status: "completed", completedAt: "2026-10-01T10:00:00.000Z", reportText: "R-legado" } } }) });
    db.rechazarUndefined(true);
    db.atomico(true);
  });
  it("una fase cerrada SIN historial se reconstruye con `estadoCierre` (por:null) y se registra como previa de una «reapertura»", async () => {
    const f = { status: "completed", completedAt: "2026-10-01T10:00:00.000Z", reportText: "R-legado" };
    const abierta = { status: "in-progress", reportText: "R-legado" };
    await registrarEnSemilla(
      db, P,
      [{ artefacto: nombreCierre("proposito"), ...estadoAbierto("proposito", abierta), vivo: vivoCierre("proposito", abierta), estadoPrevio: estadoCierre("proposito", f), vivoPrevio: vivoCierre("proposito", f) }],
      { punteroCampo: punteroFase("proposito"), ambito: AMBITO_CIERRE, fase: "proposito", tipoCambio: "reapertura", motivo: "reapertura_fase" }
    );
    consolidarF2(db, P);
    const [previa, nueva] = versionesDe(db, P);
    expect(previa).toMatchObject({ tipoCambio: "previo_sin_historial", por: null });
    expect(previa.contenido).toMatchObject({ estado: "cerrada", completedAt: "2026-10-01T10:00:00.000Z", reportText: "R-legado" });
    expect(previa.aprobacion).toEqual({ aprobado: true, por: null, en: "2026-10-01T10:00:00.000Z" });
    expect(nueva).toMatchObject({ tipoCambio: "reapertura", motivo: "reapertura_fase" });
    expect(nueva.contenido).toMatchObject({ estado: "abierta" });
    expect(eventosDe(db, P)[0]).toMatchObject({ tipo: "reapertura", motivo: "reapertura_fase", fase: "proposito" });
    expect(revisionesDe(db, P)).toHaveLength(1);
  });
  it("el motivo de cierre es el que el lector (C4) usará para rotular", () => {
    expect(MOTIVO_CIERRE).toBe("cierre_fase");
  });
});
