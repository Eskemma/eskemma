// impactoM1: the lines of the notice, when the server demands a confirmation, the state
// fingerprint and the decision. Pure module (API nueva).

import { describe, expect, it } from "vitest";
import {
  decidirCandadoM1,
  firmaImpactoM1,
  lineasImpactoM1,
  requiereConfirmacionM1,
  type EstadoParaImpactoM1,
} from "./impactoM1";

const e = (o: Partial<EstadoParaImpactoM1> = {}): EstadoParaImpactoM1 => ({
  estado: "borrador", hayPayload: true, aprobada: false, huellaPayload: "H", huellaAprobacion: null, huellaGeneracion: null,
  dimensionesEditadas: [], totalDimensiones: 6, motoresAprobados: [], hayBorrador: false, hayDvs: false, ...o,
});

describe("requiereConfirmacionM1", () => {
  it("reabrir exige confirmación solo si hay aprobación válida (lo único que se pierde)", () => {
    expect(requiereConfirmacionM1(e({ aprobada: true, estado: "aprobado" }), "reabrir")).toBe(true);
    expect(requiereConfirmacionM1(e(), "reabrir")).toBe(false);
  });
  it("nuevo análisis, vincular y desvincular exigen confirmación si existe algo (M1, borrador o aprobaciones)", () => {
    for (const a of ["nuevo_analisis", "vincular", "desvincular"] as const) {
      expect(requiereConfirmacionM1(e(), a)).toBe(true);
      expect(requiereConfirmacionM1(e({ hayPayload: false, hayBorrador: true }), a)).toBe(true);
      expect(requiereConfirmacionM1(e({ hayPayload: false, motoresAprobados: ["M2"] }), a)).toBe(true);
    }
  });
  it("un proyecto limpio (sin M1, sin restos) no pide confirmar el primer análisis; un dvs solo no cuenta", () => {
    const limpio = e({ hayPayload: false, estado: "sin_m1", hayDvs: true });
    expect(requiereConfirmacionM1(limpio, "nuevo_analisis")).toBe(false);
  });
});

describe("lineasImpactoM1", () => {
  const completo = e({
    aprobada: true, estado: "aprobado", dimensionesEditadas: ["P", "S"], motoresAprobados: ["M2", "M3"], hayBorrador: true, hayDvs: true,
  });

  it("nuevo análisis con todo: ediciones con N de 6 y nombres, aprobación, borrador + aprobaciones, Reporte F2 intacto", () => {
    expect(lineasImpactoM1(completo, "nuevo_analisis")).toEqual([
      "Se perderán tus ediciones en 2 de 6 categorías (Político, Social).",
      "Se perderá la aprobación del análisis.",
      "Se descartarán el borrador de motores y las aprobaciones de M2, M3.",
      "El Reporte F2 finalizado no cambia hasta que lo vuelvas a finalizar.",
    ]);
  });
  it("solo aparecen las líneas que aplican al estado real (singular, sin aprobación, solo borrador)", () => {
    expect(lineasImpactoM1(e({ dimensionesEditadas: ["Ec"], hayBorrador: true }), "vincular")).toEqual([
      "Se perderán tus ediciones en 1 de 6 categorías (Ecológico).",
      "Se descartará el borrador de motores.",
    ]);
  });
  it("solo aprobaciones de motores, sin borrador", () => {
    expect(lineasImpactoM1(e({ motoresAprobados: ["M4"] }), "nuevo_analisis")).toEqual(["Se descartarán las aprobaciones de M4."]);
  });
  it("desvincular NO lista ediciones (el M1 de Centinela no las tiene) pero sí aprobación, borrador y aprobaciones", () => {
    const l = lineasImpactoM1({ ...completo, dimensionesEditadas: ["P"] }, "desvincular");
    expect(l.join(" ")).not.toContain("ediciones");
    expect(l).toContain("Se perderá la aprobación del análisis.");
    expect(l).toContain("Se descartarán el borrador de motores y las aprobaciones de M2, M3.");
  });
  it("reabrir: pierde solo la aprobación; los motores quedan en pausa y se descartan únicamente si el contenido cambia", () => {
    expect(lineasImpactoM1(completo, "reabrir")).toEqual([
      "Se perderá la aprobación del análisis; podrás aprobarlo de nuevo.",
      "M2–M5 quedarán en pausa mientras esté abierto.",
      "Si al aprobar de nuevo el contenido es distinto, se descartarán el borrador de motores y las aprobaciones de M2, M3 y se regenerarán; si es idéntico, se conservan.",
      "El Reporte F2 finalizado no cambia hasta que lo vuelvas a finalizar.",
    ]);
    expect(lineasImpactoM1(e({ aprobada: true, estado: "aprobado" }), "reabrir")).toEqual(["Se perderá la aprobación del análisis; podrás aprobarlo de nuevo."]);
  });
  it("ninguna línea usa palabras internas", () => {
    const todo = (["reabrir", "nuevo_analisis", "vincular", "desvincular"] as const).flatMap((a) => lineasImpactoM1(completo, a)).join(" ");
    expect(todo).not.toMatch(/huella|payload|linkedSource|draftDVS|DIE/i);
  });
});

describe("firma y decisión", () => {
  it("la firma cambia con cualquier dato del que depende el aviso y no con el orden de las listas", () => {
    const a = firmaImpactoM1(e({ motoresAprobados: ["M2", "M3"], dimensionesEditadas: ["P", "S"] }), "reabrir");
    expect(firmaImpactoM1(e({ motoresAprobados: ["M3", "M2"], dimensionesEditadas: ["S", "P"] }), "reabrir")).toBe(a);
    expect(firmaImpactoM1(e({ motoresAprobados: ["M2"], dimensionesEditadas: ["P", "S"] }), "reabrir")).not.toBe(a);
    expect(firmaImpactoM1(e({ huellaPayload: "OTRA" }), "reabrir")).not.toBe(firmaImpactoM1(e(), "reabrir"));
    expect(firmaImpactoM1(e(), "nuevo_analisis")).not.toBe(firmaImpactoM1(e(), "reabrir"));
  });
  it("decidirCandadoM1: continúa sin requerir; pide confirmar; huella vencida; confirmación válida", () => {
    expect(decidirCandadoM1({ requiere: false, huellaActual: "A", confirmar: false, huellaRecibida: null })).toBe("continuar");
    expect(decidirCandadoM1({ requiere: true, huellaActual: "A", confirmar: false, huellaRecibida: null })).toBe("requiere_confirmacion");
    expect(decidirCandadoM1({ requiere: true, huellaActual: "A", confirmar: true, huellaRecibida: null })).toBe("requiere_confirmacion");
    expect(decidirCandadoM1({ requiere: true, huellaActual: "A", confirmar: true, huellaRecibida: "B" })).toBe("huella_vencida");
    expect(decidirCandadoM1({ requiere: true, huellaActual: "A", confirmar: true, huellaRecibida: "A" })).toBe("continuar");
  });
});
