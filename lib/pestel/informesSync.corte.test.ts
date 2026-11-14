// H75 — corte por longitud: clasificación del stop_reason, campos del informe guardado y marcas de estado del stream
// (cortado / no guardado / fin), incluidas las combinadas y las partidas entre chunks.

import { describe, expect, it } from "vitest";
import {
  MARCA_INFORME_CORTADO,
  MARCA_INFORME_FIN,
  MARCA_INFORME_NO_GUARDADO,
  clasificarCortePorLongitud,
  construirInforme,
  extraerEstadoInforme,
} from "./informesSync";

const base = { id: "i", format: "technical" as const, texto: "T", analysis: { dimensions: [] }, variableConfigs: [], generadoEn: "2026-11-13T10:00:00.000Z" };

describe("clasificarCortePorLongitud", () => {
  it.each([
    ["max_tokens", "cortado"],
    ["model_context_window_exceeded", "cortado"],
    ["end_turn", "completo"],
    ["stop_sequence", "completo"],
    ["refusal", "desconocido"],
    ["tool_use", "desconocido"],
    ["pause_turn", "desconocido"],
    ["algo_nuevo", "desconocido"],
    [null, "desconocido"],
    [undefined, "desconocido"],
    ["", "desconocido"],
  ])("%s → %s", (stop, esperado) => {
    expect(clasificarCortePorLongitud(stop as string | null | undefined)).toBe(esperado);
  });
});

describe("construirInforme — campos de corte", () => {
  it("max_tokens: stopReason y truncado: true", () => {
    const inf = construirInforme({ ...base, stopReason: "max_tokens" });
    expect(inf.stopReason).toBe("max_tokens");
    expect(inf.truncado).toBe(true);
  });
  it("model_context_window_exceeded: también truncado", () => {
    expect(construirInforme({ ...base, stopReason: "model_context_window_exceeded" }).truncado).toBe(true);
  });
  it("end_turn: guarda stopReason pero NO escribe truncado", () => {
    const inf = construirInforme({ ...base, stopReason: "end_turn" });
    expect(inf.stopReason).toBe("end_turn");
    expect("truncado" in inf).toBe(false);
  });
  it("refusal: guarda stopReason y no afirma corte", () => {
    const inf = construirInforme({ ...base, stopReason: "refusal" });
    expect(inf.stopReason).toBe("refusal");
    expect("truncado" in inf).toBe(false);
  });
  it("sin motivo (null/ausente): no escribe ningún campo nuevo (Firestore rechaza undefined)", () => {
    for (const stopReason of [null, undefined]) {
      const inf = construirInforme({ ...base, stopReason });
      expect("stopReason" in inf).toBe(false);
      expect("truncado" in inf).toBe(false);
    }
  });
});

describe("extraerEstadoInforme", () => {
  it("sin marcas: texto intacto, guardado, no cortado y NO finalizado (interrumpido)", () => {
    expect(extraerEstadoInforme("Hola")).toEqual({ texto: "Hola", guardado: true, cortado: false, finalizado: false });
  });
  it("solo fin: finalizado", () => {
    expect(extraerEstadoInforme("Hola" + MARCA_INFORME_FIN)).toEqual({ texto: "Hola", guardado: true, cortado: false, finalizado: true });
  });
  it("cortado + fin", () => {
    expect(extraerEstadoInforme("Hola" + MARCA_INFORME_CORTADO + MARCA_INFORME_FIN)).toEqual({
      texto: "Hola",
      guardado: true,
      cortado: true,
      finalizado: true,
    });
  });
  it("no guardado + fin", () => {
    expect(extraerEstadoInforme("Hola" + MARCA_INFORME_NO_GUARDADO + MARCA_INFORME_FIN)).toEqual({
      texto: "Hola",
      guardado: false,
      cortado: false,
      finalizado: true,
    });
  });
  it("combinadas: cortado + no guardado + fin, en el orden que manda el servidor", () => {
    expect(extraerEstadoInforme("Hola" + MARCA_INFORME_CORTADO + MARCA_INFORME_NO_GUARDADO + MARCA_INFORME_FIN)).toEqual({
      texto: "Hola",
      guardado: false,
      cortado: true,
      finalizado: true,
    });
  });
  it("cortado SIN fin: sigue siendo interrumpido (el servidor no terminó su protocolo)", () => {
    const e = extraerEstadoInforme("Hola" + MARCA_INFORME_CORTADO);
    expect(e.cortado).toBe(true);
    expect(e.finalizado).toBe(false);
  });
  it("texto vacío", () => {
    expect(extraerEstadoInforme("")).toEqual({ texto: "", guardado: true, cortado: false, finalizado: false });
  });
  it("partidas entre chunks: en NINGÚN punto de corte se cuela una marca parcial en el texto ni se afirma un estado a medias", () => {
    const completo = "Informe largo\ncon salto" + MARCA_INFORME_CORTADO + MARCA_INFORME_NO_GUARDADO + MARCA_INFORME_FIN;
    const textoFinal = "Informe largo\ncon salto";
    for (let i = 0; i <= completo.length; i++) {
      const e = extraerEstadoInforme(completo.slice(0, i));
      // Límite declarado: si el chunk termina justo tras el "\n" con el que empieza toda marca, ese salto de
      // línea se ve un instante (indistinguible de uno del texto); al llegar el resto de la marca se recorta.
      expect(textoFinal.startsWith(e.texto.replace(/\n$/, ""))).toBe(true);
      expect(e.texto).not.toContain("\u001E");
      // las banderas solo aparecen con la marca COMPLETA
      expect(e.cortado).toBe(completo.slice(0, i).includes(MARCA_INFORME_CORTADO));
      expect(e.finalizado).toBe(completo.slice(0, i).includes(MARCA_INFORME_FIN));
    }
    expect(extraerEstadoInforme(completo)).toEqual({ texto: textoFinal, guardado: false, cortado: true, finalizado: true });
  });
  it("un salto de línea normal del texto no se confunde con el inicio de una marca", () => {
    expect(extraerEstadoInforme("a\n\nb" + MARCA_INFORME_FIN).texto).toBe("a\n\nb");
  });
});
