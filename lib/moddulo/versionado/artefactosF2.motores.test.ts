// C4c-0a — `origen` en el contenido de f2M1 (sin tocar el vivo) y la copia puntual `f2Motores`. Puras.

import { describe, expect, it } from "vitest";
import { huellaContenido } from "@/lib/versionado/huella";
import { estimarBytes } from "@/lib/versionado/tamano";
import { docProyectoM1 } from "@/lib/moddulo/__tests__/fixtures/m1Siembra";
import { docProyectoT22 } from "@/lib/moddulo/__tests__/fixtures/m1SiembraT22";
import {
  ESQUEMA_F2, NOMBRE_F2_MOTORES, copiaMotoresRestaurable, detalleDesvinculacion, detalleMotoresDescartados, estadoF2M1,
  estadoF2Motores, origenDe, vivoF2M1, type ExploracionCruda,
} from "./artefactosF2";
import { detalleEnTexto, etiquetaArtefacto } from "./textosHistorial";

const exp = (d: unknown) => (d as { phases: { exploracion: ExploracionCruda } }).phases.exploracion;

describe("la proyección viva NO cambió (cero deriva): hashes literales tomados del código ANTERIOR a C4c-0a", () => {
  it("ESQUEMA_F2 sigue en 1", () => expect(ESQUEMA_F2).toBe(1));
  it("vivoF2M1 de un T22 y de un express tiene exactamente la misma huella que antes", () => {
    expect(huellaContenido(vivoF2M1(exp(docProyectoT22({}))))).toBe("f77db64dfd1b903644e365c1f88ebd38c9de14aec4efc0080ead2cb0061774be");
    expect(huellaContenido(vivoF2M1(exp(docProyectoM1({}))))).toBe("706a5fb390bf97608c917d01993521b319ea8406292ed4483e1b2183dae6c7f2");
  });
  it("cambiar SOLO el origen del vínculo no mueve el vivo", () => {
    const a = exp(docProyectoT22({}));
    const b = structuredClone(a) as ExploracionCruda;
    (b.linkedSource as Record<string, unknown>).sourceId = "otro";
    (b.linkedSource as Record<string, unknown>).huellaFuente = { v: 2, h: "otra" };
    expect(huellaContenido(vivoF2M1(b))).toBe(huellaContenido(vivoF2M1(a)));
    expect(Object.keys(vivoF2M1(a) as object)).not.toContain("origen");
  });
});

describe("origenDe / contenido de f2M1", () => {
  it("T22: componente, sourceId, sourceAnalysisId, huellaFuente y aprobacionOrigen; NUNCA el payload", () => {
    const ls = { ...exp(docProyectoT22({})).linkedSource, aprobacionOrigen: { confianza: 30, justificacion: "x", aprobadoEn: undefined } };
    expect(origenDe(ls)).toEqual({
      componente: "centinela", sourceId: "pest1", sourceAnalysisId: "a1", huellaFuente: { v: 2, h: "huella-origen" },
      aprobacionOrigen: { confianza: 30, justificacion: "x" }, // `undefined` fuera: el Admin SDK lo rechaza
    });
    expect(JSON.stringify(origenDe(ls))).not.toContain("payload");
  });
  it("express: solo componente y sourceId", () => {
    expect(origenDe(exp(docProyectoM1({})).linkedSource)).toEqual({ componente: "moddulo", sourceId: "p1" });
  });
  it("sin vínculo, o con campos malformados: undefined (la clave se omite del contenido)", () => {
    expect(origenDe(undefined)).toBeUndefined();
    expect(origenDe({ kind: "T22" })).toBeUndefined();
    expect(origenDe({ sourceId: 7, huellaFuente: { v: "2", h: 1 }, aprobacionOrigen: [1] } as never)).toBeUndefined();
    expect(estadoF2M1({ m1: {} } as ExploracionCruda).contenido).toEqual({ kind: null, mapa: null, ediciones: {} });
  });
  it("estadoF2M1 incluye `origen` y nunca claves `undefined`", () => {
    const c = estadoF2M1(exp(docProyectoT22({}))).contenido as Record<string, unknown>;
    expect(c.origen).toMatchObject({ sourceId: "pest1" });
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });
});

describe("estadoF2Motores — la copia puntual", () => {
  const borrador = { hei: { x: 1 }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] };
  it("sin borrador (o borrador que no es un objeto) → null: nada que copiar", () => {
    expect(estadoF2Motores(undefined)).toBeNull();
    expect(estadoF2Motores({})).toBeNull();
    expect(estadoF2Motores({ draftDVS: null } as ExploracionCruda)).toBeNull();
    expect(estadoF2Motores({ draftDVS: "texto" } as ExploracionCruda)).toBeNull();
    expect(estadoF2Motores({ draftDVS: [] } as ExploracionCruda)).toBeNull();
  });
  it("contenido {draftDVS, motorAprobaciones, m1Huella}; sin aprobación, sin insumos, sin estado", () => {
    const e = estadoF2Motores({ draftDVS: borrador, motorAprobaciones: { M2: true }, m1: { generacion: { huella: "h", en: "t" } } } as ExploracionCruda)!;
    expect(e.contenido).toEqual({ draftDVS: borrador, motorAprobaciones: { M2: true }, m1Huella: "h" });
    expect(Object.keys(e)).toEqual(["contenido"]);
  });
  it("sin aprobaciones ni generación: {} y null (nunca undefined)", () => {
    const e = estadoF2Motores({ draftDVS: borrador } as ExploracionCruda)!;
    expect(e.contenido).toEqual({ draftDVS: borrador, motorAprobaciones: {}, m1Huella: null });
    expect(JSON.parse(JSON.stringify(e.contenido))).toEqual(e.contenido);
  });
  it("aprobaciones con `undefined` se limpian", () => {
    const e = estadoF2Motores({ draftDVS: borrador, motorAprobaciones: { M2: true, M3: undefined } } as ExploracionCruda)!;
    expect((e.contenido as { motorAprobaciones: object }).motorAprobaciones).toEqual({ M2: true });
  });
  it("tamaño: base ≈ 28 KB es restaurable; > 900 000 bytes NO (el núcleo guardaría solo la huella)", () => {
    const base = { ...borrador, relleno: "x".repeat(28_000) };
    const grande = { ...borrador, relleno: "x".repeat(900_100) };
    expect(copiaMotoresRestaurable(estadoF2Motores({ draftDVS: base })!)).toBe(true);
    expect(estimarBytes(estadoF2Motores({ draftDVS: grande })!.contenido)).toBeGreaterThan(900_000);
    expect(copiaMotoresRestaurable(estadoF2Motores({ draftDVS: grande })!)).toBe(false);
  });
  it("el nombre del artefacto es fijo", () => expect(NOMBRE_F2_MOTORES).toBe("f2Motores"));
});

describe("detalle del evento", () => {
  it("copiaMotores solo aparece cuando había borrador (true/false); sin borrador, la clave se omite", () => {
    expect(detalleMotoresDescartados({ motoresAprobados: ["M2"], hayBorrador: true, copiaMotores: true })).toEqual({
      motoresAprobadosDescartados: ["M2"], borradorDescartado: true, copiaMotores: true,
    });
    expect(detalleMotoresDescartados({ motoresAprobados: [], hayBorrador: true, copiaMotores: false })).toMatchObject({ copiaMotores: false });
    expect(detalleMotoresDescartados({ motoresAprobados: [], hayBorrador: false })).not.toHaveProperty("copiaMotores");
    expect(detalleDesvinculacion({ motoresAprobados: [], hayBorrador: true, hayReporteF2: false, copiaMotores: true })).toMatchObject({ copiaMotores: true });
    expect(detalleDesvinculacion({ motoresAprobados: [], hayBorrador: false, hayReporteF2: false })).not.toHaveProperty("copiaMotores");
  });
});

describe("panel: etiqueta y frase", () => {
  it("la etiqueta del artefacto no cae en «Elemento del proyecto»", () => {
    expect(etiquetaArtefacto("f2Motores")).toBe("Copia de los motores (M2 a M5)");
    expect(etiquetaArtefacto("f2M1")).toBe("Análisis de la Fase 2");
  });
  it("copiaMotores:true → «Se guardó una copia de los motores en el historial.»; false o ausente → nada de copia", () => {
    expect(detalleEnTexto({ borradorDescartado: true, copiaMotores: true })).toContain("Se guardó una copia de los motores en el historial.");
    expect(detalleEnTexto({ borradorDescartado: true, copiaMotores: false })).not.toMatch(/copia/);
    expect(detalleEnTexto({ borradorDescartado: true })).not.toMatch(/copia/);
  });
});
