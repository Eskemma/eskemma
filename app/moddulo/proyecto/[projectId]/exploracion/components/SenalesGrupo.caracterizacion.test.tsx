// T7 C4 — CARACTERIZACIÓN (verde contra HEAD): el pie de una señal en el panel lateral de F2 (PieSenal).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PieSenal } from "./SenalesGrupo";

const pie = (s: Record<string, unknown>) => renderToStaticMarkup(<PieSenal s={{ descripcion: "d", ...s } as never} />);

describe("PieSenal — comportamiento actual", () => {
  it("completa: fuente, fecha, nivel con su color", () => {
    const h = pie({ fuente: "INEGI", fechaCorte: "2020", nivelConfianza: "alto" });
    expect(h).toContain("INEGI");
    expect(h).toContain(">2020<");
    expect(h).toContain("bg-green-eske-10");
    expect(h).toContain(">alto<");
  });
  it("lo ausente no se pinta", () => {
    const h = pie({});
    expect(h).not.toContain("<p ");
    expect(h).not.toContain("whitespace-nowrap");
  });
  it("«bajo» va en rojo; «medio» en gris", () => {
    expect(pie({ nivelConfianza: "bajo" })).toContain("bg-red-eske-10");
    expect(pie({ nivelConfianza: "medio" })).toContain("bg-gray-eske-10");
  });
  it("C4 (defecto invertido a propósito): el literal «sin fecha» ya no se pinta como fecha", () => {
    expect(pie({ fechaCorte: "sin fecha" })).not.toContain("sin fecha");
  });
  it("C4 (efecto declarado): un nivel desconocido ya no se pinta (antes salía en gris con su texto); uno conocido sigue visible", () => {
    const h = pie({ nivelConfianza: "raro" });
    expect(h).not.toContain("raro");
    expect(h).not.toContain("whitespace-nowrap");
    expect(pie({ nivelConfianza: "Medio" })).toContain(">medio<");
  });
});
