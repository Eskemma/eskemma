import { afterEach, describe, expect, it, vi } from "vitest";
import { causaDeFalloModelo, causaMasGrave, esCausa, lineaFallo, registrarErrorEstructural } from "./registroModelo";

const SECRETO = "SECRETO-xyz request_id=req_FAKE123";
const err = (status: number | undefined, message = SECRETO, extra: object = {}) => Object.assign(new Error(message), { name: "APIError", status, ...extra });

describe("causaDeFalloModelo", () => {
  it.each([
    [429, SECRETO, "limite"],
    [529, SECRETO, "sobrecarga"],
    [503, SECRETO, "sobrecarga"],
    [402, SECRETO, "saldo"],
    [400, "Your credit balance is too low to access the Anthropic API", "saldo"],
    [400, "your credit balance is too HIGH", "otro"], // phrase changed → otro
    [400, "invalid_request_error", "otro"],
    [500, SECRETO, "otro"],
    [401, SECRETO, "otro"],
    [undefined, SECRETO, "otro"],
  ] as const)("status %s con mensaje %#", (status, message, esperado) => {
    expect(causaDeFalloModelo(err(status as number | undefined, message))).toBe(esperado);
  });

  it("sin status (error no HTTP) la frase de saldo sigue valiendo", () => {
    expect(causaDeFalloModelo(new Error("Your credit balance is too low"))).toBe("saldo");
  });

  it("un status distinto de 400 con la frase de saldo NO es saldo (la frase solo cuenta con 400)", () => {
    expect(causaDeFalloModelo(err(500, "credit balance is too low"))).toBe("otro");
  });

  it("billing_error del cuerpo del proveedor es saldo, sin leer el mensaje (con o sin status)", () => {
    expect(causaDeFalloModelo(err(undefined, "x", { error: { type: "error", error: { type: "billing_error", message: "m" } } }))).toBe("saldo");
    expect(causaDeFalloModelo(err(400, "x", { error: { type: "billing_error" } }))).toBe("saldo");
  });

  it("no lanza con valores raros", () => {
    for (const v of [null, undefined, "texto", 7, {}, { status: "429" }]) expect(causaDeFalloModelo(v)).toBe("otro");
  });
});

describe("causaMasGrave y esCausa", () => {
  it("orden saldo > limite > sobrecarga > otro", () => {
    expect(causaMasGrave(["otro", "sobrecarga", "limite", "saldo"])).toBe("saldo");
    expect(causaMasGrave(["otro", "sobrecarga", "limite"])).toBe("limite");
    expect(causaMasGrave(["otro", "sobrecarga"])).toBe("sobrecarga");
    expect(causaMasGrave(["otro"])).toBe("otro");
    expect(causaMasGrave([])).toBe("otro");
  });
  it("esCausa rechaza lo desconocido", () => {
    expect(esCausa("saldo")).toBe(true);
    for (const v of ["cuenta", "", null, undefined, 3, {}]) expect(esCausa(v)).toBe(false);
  });
});

describe("registro: causa y sin contenido", () => {
  afterEach(() => vi.restoreAllMocks());
  it("lineaFallo lleva causa y no el mensaje", () => {
    const l = lineaFallo("t", { motor: "M2", intento: 1, t0: 0 }, err(429), 5, 10);
    expect(l).toContain("causa=limite");
    expect(l).not.toContain("SECRETO");
    expect(l).not.toContain("req_FAKE123");
  });
  it("registrarErrorEstructural: saldo conserva el marcador; ninguno imprime el mensaje", () => {
    const e = vi.spyOn(console, "error").mockImplementation(() => {});
    registrarErrorEstructural("r", "ctx", err(400, "credit balance is too low " + SECRETO));
    registrarErrorEstructural("r", "ctx", err(529));
    const salida = e.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(salida).toContain("[ANTHROPIC_CREDIT_EXHAUSTED]");
    expect(salida).toContain("causa=saldo");
    expect(salida).toContain("causa=sobrecarga");
    expect(salida).not.toContain("SECRETO");
    expect(salida).not.toContain("req_FAKE123");
  });
});
