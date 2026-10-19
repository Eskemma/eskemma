// candadoM1Servidor: the decision of the H15 lock for «Nuevo análisis», «vincular» and «desvincular».
import { describe, expect, it } from "vitest";
import { decidirCandadoM1Servidor } from "./candadoM1Servidor";
import { exploracionGate } from "./__tests__/fixtures/m1Gate";
import type { ExploracionParaM1 } from "./m1Servidor";

const e = (...a: Parameters<typeof exploracionGate>) => exploracionGate(...a) as ExploracionParaM1;

describe("decidirCandadoM1Servidor", () => {
  it("estado limpio: continúa sin confirmación (nuevo análisis y vincular); desvincular con siempre pide", () => {
    expect(decidirCandadoM1Servidor({}, "nuevo_analisis", { confirmar: undefined, huella: undefined })).toEqual({ accion: "continuar" });
    expect(decidirCandadoM1Servidor(undefined, "vincular", { confirmar: undefined, huella: undefined })).toEqual({ accion: "continuar" });
    expect(decidirCandadoM1Servidor({}, "desvincular", { confirmar: undefined, huella: undefined, siempre: true }).accion).toBe("requiere_confirmacion");
  });
  it("con M1 aprobado: sin confirmar pide; con la huella devuelta continúa; con otra, huella_vencida", () => {
    const x = e("aprobado", { draftDVS: { a: 1 } });
    const pide = decidirCandadoM1Servidor(x, "nuevo_analisis", { confirmar: undefined, huella: undefined });
    expect(pide.accion).toBe("requiere_confirmacion");
    if (pide.accion === "continuar") throw new Error("inesperado");
    expect(decidirCandadoM1Servidor(x, "nuevo_analisis", { confirmar: true, huella: pide.huella })).toEqual({ accion: "continuar" });
    expect(decidirCandadoM1Servidor(x, "nuevo_analisis", { confirmar: true, huella: "otra" }).accion).toBe("huella_vencida");
    expect(decidirCandadoM1Servidor(x, "nuevo_analisis", { confirmar: "true", huella: pide.huella }).accion).toBe("requiere_confirmacion"); // solo `true` boolean
    expect(decidirCandadoM1Servidor(x, "nuevo_analisis", { confirmar: true, huella: 123 }).accion).toBe("requiere_confirmacion");
  });
  it("la huella depende de la acción: la de «nuevo análisis» no sirve para «vincular»", () => {
    const x = e("aprobado");
    const a = decidirCandadoM1Servidor(x, "nuevo_analisis", { confirmar: undefined, huella: undefined });
    const v = decidirCandadoM1Servidor(x, "vincular", { confirmar: undefined, huella: undefined });
    if (a.accion === "continuar" || v.accion === "continuar") throw new Error("inesperado");
    expect(a.huella).not.toBe(v.huella);
    expect(decidirCandadoM1Servidor(x, "vincular", { confirmar: true, huella: a.huella }).accion).toBe("huella_vencida");
  });
  it("la huella cambia cuando cambia lo que el usuario vería (motores, borrador)", () => {
    const a = decidirCandadoM1Servidor(e("aprobado"), "nuevo_analisis", { confirmar: undefined, huella: undefined });
    const b = decidirCandadoM1Servidor(e("aprobado", { draftDVS: { x: 1 } }), "nuevo_analisis", { confirmar: undefined, huella: undefined });
    if (a.accion === "continuar" || b.accion === "continuar") throw new Error("inesperado");
    expect(a.huella).not.toBe(b.huella);
  });
  it("un Reporte F2 finalizado solo (sin M1, sin borrador) no hace falta confirmarlo", () => {
    expect(decidirCandadoM1Servidor({ dvs: { x: 1 } }, "nuevo_analisis", { confirmar: undefined, huella: undefined })).toEqual({ accion: "continuar" });
  });
});
