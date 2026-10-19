// Paso 4: textos del 409 `m1_no_aprobado` de la compuerta del M1 (servidor) en las acciones de motores.
import { describe, expect, it } from "vitest";
import { decidirResultadoGuardado, type RespuestaGuardado } from "./guardadoHonesto";

const r409 = (codigo = "m1_no_aprobado"): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status: 409, codigo });
const acciones = ["aprobar_motor", "guardar_borrador", "finalizar_analisis", "guardar_analisis", "reemplazar_analisis", "generar_analisis"] as const;

describe("m1_no_aprobado — los textos", () => {
  it.each(acciones)("%s: nombra la causa, no promete de más y no contradice el 409", (accion) => {
    const d = decidirResultadoGuardado(accion, r409(), { motor: "M3" });
    expect(d.exito).toBe(false);
    expect(d.mensajeError).toContain("no está aprobado");
    expect(d.mensajeError).not.toMatch(/Recarga|recarga/); // el análisis no cambió de lugar: hay que aprobarlo
    expect(d.mensajeError).not.toMatch(/claude/i);
    expect(d.mensajeError).toMatch(/Apruébalo|apruébalo/);
  });
  it("aprobar_motor revierte la aprobación optimista y nombra el motor; finalizar_analisis también revierte", () => {
    const a = decidirResultadoGuardado("aprobar_motor", r409(), { motor: "M3", aprobadoPrevio: false });
    expect(a.revertirAprobacion).toBe(true);
    expect(a.mensajeError).toContain("M3");
    expect(decidirResultadoGuardado("finalizar_analisis", r409()).revertirAprobacion).toBe(true);
  });
  it("lo que el servidor garantiza (nada escrito) se afirma solo donde es cierto: guardar_borrador/guardar_analisis dicen que los cambios siguen en pantalla", () => {
    for (const a of ["guardar_borrador", "guardar_analisis"] as const) {
      expect(decidirResultadoGuardado(a, r409()).mensajeError).toContain("siguen en pantalla");
    }
    expect(decidirResultadoGuardado("generar_analisis", r409()).mensajeError).toContain("formulario sí se guardaron");
  });
  it("un 409 con OTRO código NO usa este texto; y un 5xx o una caída de red siguen siendo «No se pudo CONFIRMAR»", () => {
    for (const a of acciones) {
      expect(decidirResultadoGuardado(a, r409("otro"), { motor: "M2" }).mensajeError).not.toContain("no está aprobado");
      expect(decidirResultadoGuardado(a, { tipo: "respuesta", ok: false, status: 500 }, { motor: "M2" }).mensajeError).not.toContain("no está aprobado");
      expect(decidirResultadoGuardado(a, { tipo: "error_red" }, { motor: "M2" }).mensajeError).toContain("CONFIRMAR");
    }
  });
});
