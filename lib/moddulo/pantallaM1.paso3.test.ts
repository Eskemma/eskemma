// Paso 3 de 3b: reporte del análisis anterior, sello de fecha y aviso de éxito de «Nuevo análisis».
import { describe, expect, it } from "vitest";
import {
  fechaHora, pieM1, reporteDelAnalisisAnterior, selloM1, textoExitoNuevoAnalisis, TEXTO_REPORTE_ANTERIOR,
  type EntradaPie,
} from "./pantallaM1";

describe("reporteDelAnalisisAnterior", () => {
  it("solo con Reporte F2 y un M1 sin aprobar (borrador o reabierto)", () => {
    expect(reporteDelAnalisisAnterior("borrador", true)).toBe(true);
    expect(reporteDelAnalisisAnterior("reabierto", true)).toBe(true);
    expect(reporteDelAnalisisAnterior("borrador", false)).toBe(false);
    expect(reporteDelAnalisisAnterior("aprobado", true)).toBe(false);
    expect(reporteDelAnalisisAnterior("anterior", true)).toBe(false);
    expect(reporteDelAnalisisAnterior("sin_m1", true)).toBe(false);
    expect(reporteDelAnalisisAnterior(null, true)).toBe(false);
  });
  it("el rótulo dice «corresponde al análisis anterior»", () => {
    expect(TEXTO_REPORTE_ANTERIOR).toContain("corresponde al análisis anterior");
  });
});

describe("fechaHora y selloM1", () => {
  const instante = new Date("2026-10-16T18:41:00Z"); // 12:41 p. m. en CDMX (UTC−6)
  it("fecha y hora de la Ciudad de México", () => {
    expect(fechaHora(instante)).toMatch(/^16 oct 2026, 12:41 p\. ?m\.$/);
  });
  it("acepta la forma Timestamp del GET y ISO; null si no es fecha", () => {
    expect(fechaHora({ _seconds: instante.getTime() / 1000 })).toBe(fechaHora(instante));
    expect(fechaHora(instante.toISOString())).toBe(fechaHora(instante));
    expect(fechaHora(null)).toBeNull();
    expect(fechaHora("no es fecha")).toBeNull();
  });
  it("Express: «Generado el …»; Centinela: «Importado de Centinela el …»", () => {
    expect(selloM1({ estado: "borrador", kind: "express", creadoEn: instante })).toMatch(/^Generado el 16 oct 2026, 12:41/);
    expect(selloM1({ estado: "aprobado", kind: "T22", creadoEn: instante })).toMatch(/^Importado de Centinela el 16 oct 2026/);
  });
  it("sin sello para «anterior», sin M1 o sin fecha registrada", () => {
    expect(selloM1({ estado: "anterior", kind: "express", creadoEn: instante })).toBeNull();
    expect(selloM1({ estado: "sin_m1", kind: null, creadoEn: instante })).toBeNull();
    expect(selloM1({ estado: "borrador", kind: "express", creadoEn: undefined })).toBeNull();
  });
});

describe("pieM1 — sello", () => {
  const base: EntradaPie = {
    estado: "borrador", f2Cerrada: false, kind: "express", aprobadoEn: null, motoresSinGenerarServidor: false,
    motoresGenerados: false, dimensionesConCambios: [], aprobando: false, generando: false, creadoEn: new Date("2026-10-16T18:41:00Z"),
  };
  it("borrador, reabierto y aprobado llevan el sello; «anterior» y oculto no", () => {
    expect(pieM1(base).sello).toMatch(/^Generado el/);
    expect(pieM1({ ...base, estado: "reabierto" }).sello).toMatch(/^Generado el/);
    expect(pieM1({ ...base, estado: "aprobado", aprobadoEn: new Date() }).sello).toMatch(/^Generado el/);
    expect(pieM1({ ...base, estado: "anterior" }).sello).toBeNull();
    expect(pieM1({ ...base, estado: "sin_m1" }).sello).toBeNull();
  });
  it("sin creadoEn no hay sello (los M1 anteriores a este cambio)", () => {
    expect(pieM1({ ...base, creadoEn: undefined }).sello).toBeNull();
  });
});

describe("textoExitoNuevoAnalisis", () => {
  const ahora = new Date("2026-10-16T18:41:00Z");
  it("nombra la fecha y el paso siguiente", () => {
    const t = textoExitoNuevoAnalisis(ahora, false);
    expect(t).toMatch(/^Análisis nuevo generado el 16 oct 2026, 12:41/);
    expect(t).toContain("apruébalo para generar M2–M5");
    expect(t).not.toContain("Reporte F2");
  });
  it("con Reporte F2 anterior lo aclara", () => {
    expect(textoExitoNuevoAnalisis(ahora, true)).toContain("El Reporte F2 finalizado sigue siendo el del análisis anterior");
  });
});
