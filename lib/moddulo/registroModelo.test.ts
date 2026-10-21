import { describe, expect, it, vi } from "vitest";
import { codigoDeParseo, lineaFallo, lineaLlamada, lineaTotal, medirLlamada } from "./registroModelo";

describe("registroModelo", () => {
  it("línea de llamada con el formato de generate-m1-express", () => {
    expect(lineaLlamada("t", { motor: "M2", intento: 1, t0: 1000 }, { stop_reason: "end_turn", usage: { input_tokens: 9, output_tokens: 3 } }, 50, 1400))
      .toBe("[t] motor=M2 intento=1 stop_reason=end_turn input_tokens=9 output_tokens=3 duracion_ms=50 desde_inicio_ms=400");
    expect(lineaLlamada("t", { motor: "M5", intento: 2, t0: 0 }, {}, 1, 1)).toContain("stop_reason=n/a input_tokens=n/a output_tokens=n/a");
  });
  it("línea de fallo y total", () => {
    expect(lineaFallo("t", { motor: "M4", intento: 1, t0: 0 }, Object.assign(new Error("secreto"), { status: 529 }), 7, 9)).toBe("[t] motor=M4 intento=1 codigo=fallo_modelo causa=sobrecarga name=Error status=529 duracion_ms=7 desde_inicio_ms=9");
    expect(lineaFallo("t", { motor: "M4", intento: 1, t0: 0 }, new Error("secreto"), 7, 9)).not.toContain("secreto");
    expect(lineaTotal("t", "ok", 100, 350)).toBe("[t] total resultado=ok duracion_ms=250");
  });
  it("códigos de parseo", () => {
    expect(codigoDeParseo("max_tokens")).toBe("respuesta_truncada");
    expect(codigoDeParseo("end_turn")).toBe("respuesta_invalida");
    expect(codigoDeParseo(undefined)).toBe("respuesta_invalida");
  });
  it("medirLlamada devuelve el resultado, registra y relanza el error original", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await medirLlamada("t", { motor: "M2", intento: 1, t0: Date.now() }, async () => ({ stop_reason: "end_turn" }))).toEqual({ stop_reason: "end_turn" });
    expect(log).toHaveBeenCalledTimes(1);
    const e = new Error("x");
    await expect(medirLlamada("t", { motor: "M2", intento: 1, t0: Date.now() }, async () => { throw e; })).rejects.toBe(e);
    expect(err).toHaveBeenCalledTimes(1);
    log.mockRestore(); err.mockRestore();
  });
});
