// Paso 4 (H): la decisión pura de «puedo cerrar la Fase 2», la MISMA que usa complete-phase y el botón.
import { describe, expect, it } from "vitest";
import { motivoNoCerrarF2, puedeCerrarFase, textoBotonCierreApagado } from "./pantallaM1";
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
    for (const motivo of ["m1_no_aprobado", "reporte_f2_no_finalizado", "reporte_f2_de_otro_analisis"] as const) {
      for (const puedeAprobar of [true, false]) {
        const t = textoBotonCierreApagado(motivo, puedeAprobar);
        expect(t).not.toMatch(/pulsa|presiona|haz clic|vuelve a cerrar/i);
        expect(t).toMatch(/Aprueba|Finaliza|finaliza|genera|análisis anterior/);
      }
    }
    expect(textoBotonCierreApagado("reporte_f2_de_otro_analisis", true)).toContain("genera y finaliza los motores del análisis actual");
  });
});
