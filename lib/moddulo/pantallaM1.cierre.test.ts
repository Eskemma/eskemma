// Paso 4 (H): la decisión pura de «puedo cerrar la Fase 2», la MISMA que usa complete-phase y el botón.
import { describe, expect, it } from "vitest";
import { insigniaF2, motivoNoCerrarF2, puedeCerrarFase, textoBotonCierreApagado } from "./pantallaM1";
import type { EstadoM1 } from "./m1Aprobacion";

const ESTADOS: EstadoM1[] = ["sin_m1", "sin_m1_con_restos", "anterior", "borrador", "reabierto", "aprobado"];

describe("motivoNoCerrarF2", () => {
  it("heredados y sin M1: solo necesitan su Reporte F2 (los proyectos ya cerrados no cambian)", () => {
    for (const estado of ["sin_m1", "sin_m1_con_restos", "anterior"] as const) {
      expect(motivoNoCerrarF2({ estado, hayDvs: true, motoresSinGenerar: false })).toBeNull();
      expect(motivoNoCerrarF2({ estado, hayDvs: false, motoresSinGenerar: false })).toBe("reporte_f2_no_finalizado");
    }
  });
  it("borrador y reabierto: M1 sin aprobar, con o sin Reporte F2", () => {
    for (const estado of ["borrador", "reabierto"] as const) {
      for (const hayDvs of [true, false]) expect(motivoNoCerrarF2({ estado, hayDvs, motoresSinGenerar: false })).toBe("m1_no_aprobado");
    }
  });
  it("aprobado: cierra si el Reporte F2 es de este M1; si no, «de otro análisis»; sin Reporte, «no finalizado»", () => {
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: true, motoresSinGenerar: false })).toBeNull();
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: true, motoresSinGenerar: true })).toBe("reporte_f2_de_otro_analisis");
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: false, motoresSinGenerar: true })).toBe("reporte_f2_no_finalizado");
  });
  it("puedeCerrarFase es exactamente «sin motivo» en las 24 combinaciones", () => {
    for (const estado of ESTADOS) for (const hayDvs of [true, false]) for (const motoresSinGenerar of [true, false]) {
      const i = { estado, hayDvs, motoresSinGenerar };
      expect(puedeCerrarFase(i)).toBe(motivoNoCerrarF2(i) === null);
    }
  });
  it("el texto del botón apagado nunca invita a cerrar: dice qué hacer antes", () => {
    for (const motivo of ["ya_cerrada", "m1_no_aprobado", "reporte_f2_no_finalizado", "reporte_f2_de_otro_analisis"] as const) {
      for (const puedeAprobar of [true, false]) {
        const t = textoBotonCierreApagado(motivo, puedeAprobar);
        expect(t).not.toMatch(/pulsa|presiona|haz clic|vuelve a cerrar/i);
        expect(t).toMatch(/Aprueba|Finaliza|finaliza|genera|análisis anterior|ya está cerrada/);
      }
    }
    expect(textoBotonCierreApagado("reporte_f2_de_otro_analisis", true)).toContain("genera y finaliza los motores del análisis actual");
  });
  it("Commit 5: una Fase 2 ya cerrada gana sobre cualquier otro motivo, en las 6 × 2 × 2 combinaciones", () => {
    for (const estado of ESTADOS) for (const hayDvs of [true, false]) for (const motoresSinGenerar of [true, false]) {
      expect(motivoNoCerrarF2({ estado, hayDvs, motoresSinGenerar, f2Cerrada: true })).toBe("ya_cerrada");
      expect(puedeCerrarFase({ estado, hayDvs, motoresSinGenerar, f2Cerrada: true })).toBe(false);
    }
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: true, motoresSinGenerar: false, f2Cerrada: false })).toBeNull();
    expect(motivoNoCerrarF2({ estado: "aprobado", hayDvs: true, motoresSinGenerar: false })).toBeNull(); // sin el campo: como antes
  });
  it("el tooltip del botón apagado por «ya cerrada» solo describe el estado: no invita a nada", () => {
    expect(textoBotonCierreApagado("ya_cerrada", true)).toBe("La Fase 2 ya está cerrada.");
  });
  it("insignia: «Cerrada» gana sobre «Lista»; «Editando» sobre ambas; sin Reporte ni cierre, ninguna", () => {
    expect(insigniaF2({ f2Cerrada: true, hayDvs: true, editando: false })).toBe("Cerrada");
    expect(insigniaF2({ f2Cerrada: false, hayDvs: true, editando: false })).toBe("Lista");
    expect(insigniaF2({ f2Cerrada: true, hayDvs: true, editando: true })).toBe("Editando");
    expect(insigniaF2({ f2Cerrada: false, hayDvs: false, editando: false })).toBeNull();
    expect(insigniaF2({ f2Cerrada: true, hayDvs: false, editando: false })).toBe("Cerrada");
  });
});
