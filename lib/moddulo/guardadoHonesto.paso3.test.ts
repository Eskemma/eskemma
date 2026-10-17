// Paso 3 de 3b: B1 (la frase «Tu análisis actual se conserva» solo con análisis previo) y el 409 de
// «Cerrar Fase 2» cuando el análisis nuevo no está aprobado.

import { describe, expect, it } from "vitest";
import { decidirCierreDeFase, decidirReemplazoAnalisis, type RespuestaGuardado } from "./guardadoHonesto";

const r = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: status < 400, status, codigo });
const msg = (resp: RespuestaGuardado, ctx: { confirmado?: boolean; hayAnalisisPrevio?: boolean }) =>
  (decidirReemplazoAnalisis(resp, ctx, "generar_m1") as { mensajeError: string }).mensajeError;

describe("generar_m1 — hayAnalisisPrevio (B1)", () => {
  it("con análisis previo conserva la frase; sin él, no afirma que se conserve nada", () => {
    const con = msg(r(403), { confirmado: true, hayAnalisisPrevio: true });
    expect(con).toContain("Tu análisis actual se conserva");
    const sin = msg(r(403), { confirmado: true, hayAnalisisPrevio: false });
    expect(sin).not.toContain("se conserva");
    expect(sin).toContain("Inténtalo de nuevo");
  });
  it("sin dato (undefined) mantiene el texto de siempre", () => {
    expect(msg(r(403), { confirmado: true })).toContain("Tu análisis actual se conserva");
  });
  it("los textos por código del servidor no dicen «se conserva» en ningún caso (dicen «No se guardó nada»)", () => {
    for (const codigo of ["respuesta_truncada", "respuesta_invalida", "fallo_modelo"]) {
      for (const hayAnalisisPrevio of [true, false]) {
        const m = msg(r(500, codigo), { confirmado: true, hayAnalisisPrevio });
        expect(m).toContain("No se guardó nada");
        expect(m).not.toContain("se conserva");
      }
    }
  });
  it("el 404 genérico y el pestel_linked tampoco afirman que se conserve un análisis sin previo", () => {
    expect(msg(r(404), { hayAnalisisPrevio: false })).not.toContain("se conserva");
  });
});

describe("cerrar_fase — 409 m1_no_aprobado", () => {
  it("no navega, nombra el motivo y dice que la fase sigue abierta", () => {
    const d = decidirCierreDeFase(r(409, "m1_no_aprobado"), null, { fase: "Fase 2" });
    expect(d.navegar).toBe(false);
    expect(d.mensajeBloqueante).toContain("análisis nuevo");
    expect(d.mensajeBloqueante).toContain("Reporte F2 es el del análisis anterior");
    expect(d.mensajeBloqueante).toContain("La fase sigue abierta");
  });
  it("otro 409 no usa ese texto", () => {
    expect(decidirCierreDeFase(r(409, "otra"), null, { fase: "Fase 2" }).mensajeBloqueante).not.toContain("análisis nuevo");
  });
});
