import { describe, expect, it } from "vitest";
import { armarNivelesComparados, type CeldaParaChat } from "./nivelesComparados";

const nat = () => "conteo_directo";

describe("armarNivelesComparados", () => {
  it("la celda distrital expone cobertura, tipo y aviso (caso m4qUAX…: F1-3 D.F. 3102)", () => {
    const celdas: CeldaParaChat[] = [
      { nivel: "estatal", valor: 65.7, unidad: "% de población indígena" },
      { nivel: "distrital", valor: 22.62, unidad: "% de población indígena", coberturaPct: 98.4, tipoDistritoPropio: "federal" },
    ];
    const [est, dis] = armarNivelesComparados(celdas, nat, "INEGI");
    expect(est.coberturaPct).toBeNull();
    expect(est.avisoCobertura).toBeNull();
    expect(dis.valor).toBe(22.62);
    expect(dis.coberturaPct).toBe(98.4);
    expect(dis.tipoDistritoPropio).toBe("federal");
    expect(dis.avisoCobertura?.nivel).toBe("nota");
    expect(dis.avisoCobertura?.texto).toContain("98.4%");
  });
  it("≥ 99 % sin aviso; sin valor no hay cobertura", () => {
    const [a, b] = armarNivelesComparados(
      [
        { nivel: "distrital", valor: 10, coberturaPct: 99.4, tipoDistritoPropio: "local" },
        { nivel: "distrital", motivo: "sin dato", coberturaPct: 50 },
      ],
      nat,
      null
    );
    expect(a.avisoCobertura).toBeNull();
    expect(b.coberturaPct).toBeNull();
    expect(b.motivo).toBe("sin dato");
  });
});
