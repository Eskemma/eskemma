// C1a — vigilancia de tamaño (módulo puro; umbrales de informesTamano.ts duplicados a propósito).
import { afterEach, describe, expect, it, vi } from "vitest";
import { decidirContenido, estimarBytes, evaluarTamanoVersion, reportarTamano } from "./tamano";
import { LIMITE_CONTENIDO_BYTES, LIMITE_DOCUMENTO_BYTES } from "./tipos";

afterEach(() => vi.restoreAllMocks());

describe("evaluarTamanoVersion — bordes", () => {
  const al = (pct: number) => Math.floor((LIMITE_DOCUMENTO_BYTES * pct) / 100);
  it("59,9 % es ok; 60 % es aviso; 79,9 % es aviso; 80 % es prioridad", () => {
    expect(evaluarTamanoVersion(al(59.9)).nivel).toBe("ok");
    expect(evaluarTamanoVersion(Math.ceil((LIMITE_DOCUMENTO_BYTES * 60) / 100)).nivel).toBe("aviso");
    expect(evaluarTamanoVersion(al(79.9)).nivel).toBe("aviso");
    expect(evaluarTamanoVersion(Math.ceil((LIMITE_DOCUMENTO_BYTES * 80) / 100)).nivel).toBe("prioridad");
  });
});
describe("estimarBytes", () => {
  it("cuenta bytes UTF-8, no caracteres", () => {
    expect(estimarBytes("ñ")).toBe(Buffer.byteLength('"ñ"', "utf8"));
    expect(estimarBytes("ñ")).toBeGreaterThan(estimarBytes("n"));
    expect(estimarBytes(undefined)).toBe(4); // "null"
  });
});
describe("decidirContenido", () => {
  it("guarda el contenido hasta el límite; por encima solo la huella", () => {
    expect(decidirContenido(LIMITE_CONTENIDO_BYTES).guardarContenido).toBe(true);
    expect(decidirContenido(LIMITE_CONTENIDO_BYTES + 1).guardarContenido).toBe(false);
  });
});
describe("reportarTamano", () => {
  it("ok no deja rastro; aviso usa warn; prioridad usa error; etiqueta fija", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    reportarTamano("x", evaluarTamanoVersion(10));
    expect(warn).not.toHaveBeenCalled();
    reportarTamano("x", evaluarTamanoVersion(Math.ceil(LIMITE_DOCUMENTO_BYTES * 0.65)));
    expect(warn.mock.calls[0][0]).toContain("[versionado][limite-1MB]");
    reportarTamano("x", evaluarTamanoVersion(Math.ceil(LIMITE_DOCUMENTO_BYTES * 0.9)));
    expect(error.mock.calls[0][0]).toContain("PRIORIDAD ALTA");
  });
});
