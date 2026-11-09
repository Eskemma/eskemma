// T7 C4 — CARACTERIZACIÓN (los dos casos de defecto se invirtieron a propósito en C4): el pie de señal del panel de Centinela. Se escribió sobre el componente recién extraído
// de PESTLPanelV2 SIN cambio de lógica (el original vivía inline y no se puede renderizar suelto): fija lo que NO cambia.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PieSenalCentinela } from "./PieSenalCentinela";

const pie = (s: Record<string, unknown>) => renderToStaticMarkup(<PieSenalCentinela s={{ descripcion: "d", origenInternacional: false, ...s } as never} />);

describe("PieSenalCentinela — comportamiento actual", () => {
  it("alto → verde y «alta»; medio → marrón y «media»", () => {
    const a = pie({ fuente: "INEGI", fechaCorte: "2020", nivelConfianza: "alto" });
    expect(a).toContain("text-green-eske");
    expect(a).toContain("confianza alta");
    expect(a).toContain("INEGI");
    expect(a).toContain("2020");
    expect(pie({ nivelConfianza: "medio" })).toContain("confianza media");
  });
  it("bajo → rojo y «baja»; internacional se anota", () => {
    const b = pie({ nivelConfianza: "bajo", origenInternacional: true });
    expect(b).toContain("text-red-eske");
    expect(b).toContain("confianza baja");
    expect(b).toContain("· internacional");
  });
  it("C4 (defecto 1c invertido a propósito): un nivel ausente ya NO se pinta como «baja» en rojo", () => {
    const h = pie({ nivelConfianza: undefined });
    expect(h).not.toContain("confianza");
    expect(h).not.toContain("text-red-eske");
  });
  it("C4 (defecto invertido a propósito): el literal «sin fecha» se dice «fecha no registrada»", () => {
    const h = pie({ fechaCorte: "sin fecha" });
    expect(h).toContain("fecha no registrada");
    expect(h).not.toContain("sin fecha");
  });
  it("C4: un nivel desconocido tampoco se declara (ni «baja» ni texto crudo)", () => {
    const h = pie({ nivelConfianza: "raro" });
    expect(h).not.toContain("confianza");
    expect(h).not.toContain("raro");
  });
});
