// Paso 4 (H): los textos del 409 de complete-phase al cerrar la Fase 2.
import { describe, expect, it } from "vitest";
import { decidirCierreDeFase, decidirResultadoGuardado, TEXTO_CIERRE_F2, type RespuestaGuardado } from "./guardadoHonesto";

const r409 = (codigo: string): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status: 409, codigo });

describe("cerrar Fase 2 — 409 del servidor", () => {
  it("reporte_f2_no_finalizado: no navega, dice qué falta y que la fase sigue abierta", () => {
    const d = decidirCierreDeFase(r409("reporte_f2_no_finalizado"), null, { fase: "Fase 2" });
    expect(d.navegar).toBe(false);
    expect(d.mensajeBloqueante).toBe(TEXTO_CIERRE_F2.reporte_f2_no_finalizado);
    expect(d.mensajeBloqueante).toContain("todavía no hay un Reporte F2 finalizado");
    expect(d.mensajeBloqueante).toContain("La fase sigue abierta");
  });
  it("reporte_f2_de_otro_analisis: dice que el Reporte es de un análisis anterior y qué hacer; la fase sigue abierta", () => {
    const d = decidirCierreDeFase(r409("reporte_f2_de_otro_analisis"), null, { fase: "Fase 2", hayReporte: true });
    expect(d.navegar).toBe(false);
    expect(d.mensajeBloqueante).toBe(TEXTO_CIERRE_F2.reporte_f2_de_otro_analisis);
    expect(d.mensajeBloqueante).toContain("es de un análisis anterior; genera y finaliza los motores del análisis actual para cerrar");
    expect(d.mensajeBloqueante).toContain("La fase sigue abierta");
  });
  it("m1_no_aprobado: el texto depende de si hay un Reporte F2 en pantalla (no habla de un «análisis anterior» que no existe)", () => {
    const con = decidirCierreDeFase(r409("m1_no_aprobado"), null, { fase: "Fase 2", hayReporte: true }).mensajeBloqueante!;
    const sin = decidirCierreDeFase(r409("m1_no_aprobado"), null, { fase: "Fase 2", hayReporte: false }).mensajeBloqueante!;
    expect(con).toContain("el Reporte F2 es el del análisis anterior");
    expect(sin).not.toContain("análisis anterior");
    expect(sin).toContain("aún no está aprobado");
    expect(decidirCierreDeFase(r409("m1_no_aprobado"), null, { fase: "Fase 2" }).mensajeBloqueante).toBe(sin);
  });
  it("ninguno manda a pulsar «Cerrar Fase 2»: ese botón está apagado en estas situaciones; dicen qué hacer ANTES", () => {
    for (const t of Object.values(TEXTO_CIERRE_F2)) {
      expect(t).not.toMatch(/pulsa|presiona|haz clic|vuelve a cerrar/i);
      expect(t).toMatch(/Apruébalo|[Ff]inaliza/);
      expect(t).toContain("La fase sigue abierta");
    }
  });
  it("otros 409 y los 5xx/red NO usan estos textos; los 5xx siguen siendo «No se pudo CONFIRMAR»", () => {
    const o = decidirResultadoGuardado("cerrar_fase", r409("otra"), { fase: "Fase 2" }).mensajeError!;
    for (const t of Object.values(TEXTO_CIERRE_F2)) expect(o).not.toBe(t);
    expect(decidirResultadoGuardado("cerrar_fase", { tipo: "error_red" }, { fase: "Fase 2" }).mensajeError).toContain("CONFIRMAR");
    expect(decidirResultadoGuardado("cerrar_fase", { tipo: "respuesta", ok: false, status: 500 }, { fase: "Fase 2" }).mensajeError).not.toBe(TEXTO_CIERRE_F2.m1_no_aprobado);
  });
  it("la fase 1 y la 3 no usan estos textos aunque el código coincida", () => {
    // Only F2 sends hayReporte / receives these codes; a 409 with another code keeps the generic wording.
    expect(decidirCierreDeFase(r409("x"), null, { fase: "Fase 1" }).mensajeBloqueante).not.toContain("Reporte F2");
  });
});
