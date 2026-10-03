// lib/pestel/informesTamano.test.ts
// Alerta de tamaño de pestel_analyses (límite de 1 MiB por documento): umbrales de
// aviso temprano (60 %) y prioridad alta (80 %), estimación y reconocimiento del error.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LIMITE_DOCUMENTO_BYTES as LIM,
  UMBRAL_AVISO,
  UMBRAL_PRIORIDAD,
  esErrorDocumentoLleno,
  estimarBytes,
  evaluarTamano,
  evaluarTamanoDocumento,
  reportarTamano,
} from "./informesTamano";

describe("umbrales", () => {
  it("están en 60 % y 80 % de 1 MiB", () => {
    expect(LIM).toBe(1_048_576);
    expect(UMBRAL_AVISO).toBe(0.6);
    expect(UMBRAL_PRIORIDAD).toBe(0.8);
  });

  it("clasifica los bordes", () => {
    expect(evaluarTamano(0).nivel).toBe("ok");
    expect(evaluarTamano(Math.floor(LIM * 0.6) - 1).nivel).toBe("ok");
    expect(evaluarTamano(Math.ceil(LIM * 0.6)).nivel).toBe("aviso");
    expect(evaluarTamano(Math.ceil(LIM * 0.8) - 1).nivel).toBe("aviso");
    expect(evaluarTamano(Math.ceil(LIM * 0.8)).nivel).toBe("prioridad");
    expect(evaluarTamano(LIM * 2).nivel).toBe("prioridad");
  });

  it("calcula el porcentaje", () => {
    expect(evaluarTamano(LIM / 2).porcentaje).toBeCloseTo(0.5);
  });
});

describe("estimarBytes / evaluarTamanoDocumento", () => {
  it("cuenta bytes UTF-8, no caracteres", () => {
    expect(estimarBytes("á")).toBe(Buffer.byteLength('"á"', "utf8"));
    expect(estimarBytes("á")).toBeGreaterThan(estimarBytes("a"));
  });

  it("suma el elemento que se va a agregar", () => {
    const base = { informes: [{ t: "x".repeat(1000) }] };
    const nuevo = { t: "y".repeat(2000) };
    expect(evaluarTamanoDocumento(base, nuevo).bytes).toBe(estimarBytes(base) + estimarBytes(nuevo));
    expect(evaluarTamanoDocumento(base).bytes).toBe(estimarBytes(base));
  });

  it("un documento al 60 % de texto cae en aviso", () => {
    const doc = { informes: [{ t: "x".repeat(Math.ceil(LIM * 0.61)) }] };
    expect(evaluarTamanoDocumento(doc).nivel).toBe("aviso");
  });
});

describe("reportarTamano", () => {
  afterEach(() => vi.restoreAllMocks());

  it("nivel ok: silencio", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    reportarTamano("a1", evaluarTamano(1000), "x");
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("aviso: console.warn con etiqueta fija, porcentaje e id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    reportarTamano("an1", evaluarTamano(LIM * 0.65), "generar un informe");
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain("[informes][limite-1MB]");
    expect(msg).toContain("aviso temprano");
    expect(msg).toContain("pestel_analyses/an1");
    expect(msg).toContain("65%");
  });

  it("prioridad: console.error y menciona la solución de fondo", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    reportarTamano("an1", evaluarTamano(LIM * 0.85), "editar un informe");
    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    const msg = String(error.mock.calls[0][0]);
    expect(msg).toContain("PRIORIDAD ALTA");
    expect(msg).toContain("subcolección");
    expect(msg).toContain("85%");
  });
});

describe("esErrorDocumentoLleno", () => {
  it("reconoce el mensaje de Firestore", () => {
    expect(esErrorDocumentoLleno(new Error("3 INVALID_ARGUMENT: The value of property \"informes\" is longer than 1048487 bytes. Document exceeds the maximum size"))).toBe(true);
    expect(esErrorDocumentoLleno(new Error("Document too large"))).toBe(true);
  });
  it("no confunde otros errores ni entradas raras", () => {
    expect(esErrorDocumentoLleno(new Error("permission denied"))).toBe(false);
    expect(esErrorDocumentoLleno(null)).toBe(false);
    expect(esErrorDocumentoLleno("exceeds the maximum")).toBe(false);
    expect(esErrorDocumentoLleno({})).toBe(false);
  });
});
