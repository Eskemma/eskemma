import { describe, expect, it } from "vitest";
import { avisoCoberturaChat, esUnidadProporcion, nivelAvisoCobertura } from "./coberturaDistrital";

// Cobertura real de los 6 distritos federales de Yucatán (datos de Fontana, 26-09-26).
const YUCATAN = [98.7, 98.4, 72.8, 72.8, 92.9, 64.1];

describe("nivelAvisoCobertura", () => {
  it("gradúa los 6 distritos reales de Yucatán", () => {
    expect(YUCATAN.map(nivelAvisoCobertura)).toEqual(["nota", "nota", "fuerte", "fuerte", "nota", "fuerte"]);
  });
  it("bordes: 99 sin aviso, 98.99 nota, 90 nota, 89.9 fuerte", () => {
    expect(nivelAvisoCobertura(99)).toBe("ninguno");
    expect(nivelAvisoCobertura(98.99)).toBe("nota");
    expect(nivelAvisoCobertura(90)).toBe("nota");
    expect(nivelAvisoCobertura(89.9)).toBe("fuerte");
  });
  it("sin cobertura conocida no hay aviso", () => {
    expect(nivelAvisoCobertura(undefined)).toBe("ninguno");
    expect(nivelAvisoCobertura(null)).toBe("ninguno");
    expect(nivelAvisoCobertura(NaN)).toBe("ninguno");
  });
});

describe("avisoCoberturaChat", () => {
  it("D.F. 3102 (98.4 %): nota con el porcentaje real", () => {
    const a = avisoCoberturaChat(98.4, { esProporcion: true })!;
    expect(a.nivel).toBe("nota");
    expect(a.texto).toContain("98.4%");
    expect(a.texto).toContain("Censo 2020 y la cartografía electoral vigente");
    expect(a.texto).toContain("1.6%");
    expect(a.texto).toContain("porcentaje");
  });
  it("64.1 %: advertencia fuerte que ofrece el dato municipal; un conteo dice que subestima", () => {
    const a = avisoCoberturaChat(64.1, { esProporcion: false })!;
    expect(a.nivel).toBe("fuerte");
    expect(a.texto).toContain("reserva");
    expect(a.texto).toContain("municipal");
    expect(a.texto).toContain("subestimar");
  });
  it("≥ 99 % → null", () => {
    expect(avisoCoberturaChat(99.5, { esProporcion: true })).toBeNull();
  });
});

describe("esUnidadProporcion", () => {
  it("distingue porcentaje de conteo", () => {
    expect(esUnidadProporcion("% de población indígena")).toBe(true);
    expect(esUnidadProporcion("habitantes")).toBe(false);
    expect(esUnidadProporcion(undefined)).toBe(false);
  });
});
