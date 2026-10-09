import { describe, expect, it } from "vitest";
import {
  GeneracionF3RechazadaError,
  decidirGeneracionF3,
  estadoF3Desde,
  type EstadoF3,
} from "./impactoRegeneracionF3";
import { motivoBloqueoF3 } from "./impactoReemplazoDVS";
import { SIEMBRA_DIE, SIEMBRA_SINTESIS, SIEMBRA_VEREDICTO } from "./__tests__/fixtures/siembraF3";

const nada: EstadoF3 = {};
const conSintesis: EstadoF3 = { sintesis: SIEMBRA_SINTESIS };
const sintesisYBorrador: EstadoF3 = { sintesis: SIEMBRA_SINTESIS, veredicto: SIEMBRA_VEREDICTO };
const aprobadoSinDie: EstadoF3 = { sintesis: SIEMBRA_SINTESIS, veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true } };
const cerrado: EstadoF3 = { sintesis: SIEMBRA_SINTESIS, veredicto: { ...SIEMBRA_VEREDICTO, aprobadoPorUsuario: true }, die: SIEMBRA_DIE };
const dieSinVeredicto: EstadoF3 = { sintesis: SIEMBRA_SINTESIS, die: SIEMBRA_DIE };

const acc = (e: EstadoF3, d: Parameters<typeof decidirGeneracionF3>[1]) => decidirGeneracionF3(e, d).accion;

describe("decidirGeneracionF3 — matriz de estados", () => {
  it("nada existe: continúa en las tres (primera generación, como hoy)", () => {
    expect(acc(nada, "sintesis")).toBe("continuar");
    expect(acc(nada, "veredicto")).toBe("continuar");
    expect(acc(nada, "tablero")).toBe("continuar");
    expect(acc(nada, "sincronizar_tablero")).toBe("continuar");
  });
  it("síntesis sin veredicto: M3 → ya existe; M4 continúa (la ruta ya pide síntesis); tablero continúa", () => {
    expect(acc(conSintesis, "sintesis")).toBe("ya_existe");
    expect(acc(conSintesis, "veredicto")).toBe("continuar");
    expect(acc(conSintesis, "tablero")).toBe("continuar");
  });
  it("síntesis + borrador de veredicto sin aprobar: ambos → ya existe (no hay regenerar); tablero continúa", () => {
    expect(acc(sintesisYBorrador, "sintesis")).toBe("ya_existe");
    expect(acc(sintesisYBorrador, "veredicto")).toBe("ya_existe");
    expect(acc(sintesisYBorrador, "tablero")).toBe("continuar");
    expect(acc(sintesisYBorrador, "sincronizar_tablero")).toBe("continuar");
  });
  it("veredicto sin síntesis (dato anómalo): M3 continúa, M4 → ya existe", () => {
    expect(acc({ veredicto: SIEMBRA_VEREDICTO }, "sintesis")).toBe("continuar");
    expect(acc({ veredicto: SIEMBRA_VEREDICTO }, "veredicto")).toBe("ya_existe");
  });
  it("veredicto aprobado SIN Reporte F3 (dato anómalo): bloqueado en las cuatro, y el texto no afirma un Reporte F3", () => {
    for (const d of ["sintesis", "veredicto", "tablero", "sincronizar_tablero"] as const) {
      const r = decidirGeneracionF3(aprobadoSinDie, d);
      expect(r.accion).toBe("bloqueado");
      if (r.accion === "bloqueado") {
        expect(r.mensaje).toContain("«M4 · Veredicto HEI»");
        expect(r.mensaje).not.toContain("Reporte F3");
      }
    }
  });
  it("Reporte F3 existente: bloqueado en las cuatro, con «Reporte F3»", () => {
    for (const d of ["sintesis", "veredicto", "tablero", "sincronizar_tablero"] as const) {
      const r = decidirGeneracionF3(cerrado, d);
      expect(r).toMatchObject({ accion: "bloqueado" });
      if (r.accion === "bloqueado") expect(r.mensaje).toContain("«Reporte F3»");
    }
  });
  it("Reporte F3 sin veredicto (dato anómalo): bloqueado", () => {
    expect(acc(dieSinVeredicto, "sintesis")).toBe("bloqueado");
    expect(acc(dieSinVeredicto, "veredicto")).toBe("bloqueado");
  });
  it("el bloqueo gana sobre «ya existe»", () => {
    expect(acc(cerrado, "sintesis")).toBe("bloqueado");
  });
  it("estadoF3Desde lee los campos de phases.investigacion y tolera su ausencia", () => {
    expect(estadoF3Desde(undefined)).toEqual({ sintesis: undefined, veredicto: undefined, die: undefined });
    const e = estadoF3Desde({ f3Sintesis: SIEMBRA_SINTESIS, f3Veredicto: SIEMBRA_VEREDICTO, f3DIE: SIEMBRA_DIE });
    expect(acc(e, "sintesis")).toBe("bloqueado");
  });
  it("las muestras de siembra de la guía producen exactamente los estados que la guía promete", () => {
    expect(acc(estadoF3Desde({ f3Sintesis: SIEMBRA_SINTESIS }), "sintesis")).toBe("ya_existe");
    expect(acc(estadoF3Desde({ f3Veredicto: SIEMBRA_VEREDICTO }), "veredicto")).toBe("ya_existe");
    expect(acc(estadoF3Desde({ f3DIE: SIEMBRA_DIE }), "sintesis")).toBe("bloqueado");
    expect(acc(estadoF3Desde({ f3DIE: SIEMBRA_DIE }), "tablero")).toBe("bloqueado");
  });
});

describe("motivoBloqueoF3 — verbo por acción, nunca «DIE»", () => {
  const casos: [Parameters<typeof motivoBloqueoF3>[0], string][] = [
    ["generar_sintesis", "Generar la síntesis de nuevo las dejaría inconsistentes"],
    ["generar_veredicto", "Generar el veredicto de nuevo las dejaría inconsistentes"],
    ["generar_tablero", "Generar el tablero de nuevo las dejaría inconsistentes"],
    ["sincronizar_tablero", "Sincronizar el tablero las dejaría inconsistentes"],
  ];
  it.each(casos)("%s", (verbo, frase) => {
    const m = motivoBloqueoF3(verbo);
    expect(m).toContain("La Fase 3 ya aprobó su «M4 · Veredicto HEI» y cuenta con su «Reporte F3».");
    expect(m).toContain(frase);
    expect(m).toContain("reabrir la Fase 3 aún no está disponible");
    expect(m).not.toMatch(/\bDIE\b/);
  });
  it("sin Reporte F3 (anómalo): singular y sin afirmar el reporte", () => {
    const m = motivoBloqueoF3("generar_sintesis", false);
    expect(m).toContain("Generar la síntesis de nuevo la dejaría inconsistente");
    expect(m).not.toContain("Reporte F3");
  });
});

describe("GeneracionF3RechazadaError", () => {
  it("lleva la decisión", () => {
    const e = new GeneracionF3RechazadaError({ accion: "ya_existe" });
    expect(e.decision.accion).toBe("ya_existe");
    expect(e).toBeInstanceOf(Error);
  });
});

describe("negativo — el comportamiento anterior de las rutas nunca rechazaba", () => {
  it("antes: siempre «continuar»; ahora el Reporte F3 y lo ya generado se rechazan", () => {
    const antes = () => ({ accion: "continuar" });
    expect(acc(cerrado, "sintesis")).not.toBe(antes().accion);
    expect(acc(sintesisYBorrador, "veredicto")).not.toBe(antes().accion);
  });
});
