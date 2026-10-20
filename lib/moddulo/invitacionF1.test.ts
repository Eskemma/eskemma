import { describe, expect, it } from "vitest";
import { BOTON_INVITACION_F1, debeInvitarCompletarF1, TEXTO_INVITACION_F1 } from "./invitacionF1";

describe("debeInvitarCompletarF1", () => {
  it("análisis importado + F1 sin completar + F2 abierta: invita (también con F1 desconocido)", () => {
    for (const estadoF1 of ["not-started", "in-progress", null, undefined]) {
      expect(debeInvitarCompletarF1({ hayMapaPestel: true, estadoF1, f2Cerrada: false })).toBe(true);
    }
  });
  it("F1 completada: no invita", () => {
    expect(debeInvitarCompletarF1({ hayMapaPestel: true, estadoF1: "completed", f2Cerrada: false })).toBe(false);
  });
  it("F2 cerrada (solo lectura): no invita a nada, aunque F1 esté sin completar", () => {
    expect(debeInvitarCompletarF1({ hayMapaPestel: true, estadoF1: "not-started", f2Cerrada: true })).toBe(false);
  });
  it("sin análisis importado: no invita", () => {
    expect(debeInvitarCompletarF1({ hayMapaPestel: false, estadoF1: "not-started", f2Cerrada: false })).toBe(false);
  });
  it("las 8 combinaciones: invita solo en una", () => {
    let n = 0;
    for (const hayMapaPestel of [true, false]) for (const estadoF1 of ["completed", "in-progress"]) for (const f2Cerrada of [true, false]) {
      if (debeInvitarCompletarF1({ hayMapaPestel, estadoF1, f2Cerrada })) n++;
    }
    expect(n).toBe(1);
  });
  it("el texto no promete desbloquear nada ni dice «incompleto»", () => {
    expect(TEXTO_INVITACION_F1).not.toMatch(/desbloque/i);
    expect(BOTON_INVITACION_F1).toBe("Ir a F1-Propósito →");
  });
});
