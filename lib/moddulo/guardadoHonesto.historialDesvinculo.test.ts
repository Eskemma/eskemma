// C1b-2 — la pantalla de F2 distingue `historial_no_confirmado` de `unlink-pestel` (el registro del historial falló: NADA
// cambió, el proyecto sigue vinculado) de los 409 de CONFIRMACIÓN H15 (`reemplazo_requiere_confirmacion` /
// `reemplazo_huella_vencida`) que reabren el modal: comparten el status 409, así que se decide por el CÓDIGO `error` del
// cuerpo, nunca por el status. Funciones puras (sin DOM): se ejerce `leerRespuestaGuardado` con un `Response` real y
// `decidirResultadoGuardado`, que son exactamente lo que usa `handleUnlinkPestel`.

import { describe, expect, it } from "vitest";
import { CODIGO_HISTORIAL_NO_CONFIRMADO, decidirResultadoGuardado } from "./guardadoHonesto";
import { leerRespuestaGuardado } from "./leerRespuestaGuardado";

const cuerpo = (status: number, c: Record<string, unknown>) => leerRespuestaGuardado(async () => new Response(JSON.stringify(c), { status }));
/** La condición EXACTA con la que `handleUnlinkPestel` reabre el modal de confirmación (por código, no por status). */
const reabreModal = (resp: Awaited<ReturnType<typeof cuerpo>>["resp"]) =>
  resp.tipo === "respuesta" && resp.status === 409 && (resp.codigo === "reemplazo_requiere_confirmacion" || resp.codigo === "reemplazo_huella_vencida");

describe("desvincular_pestel — historial_no_confirmado", () => {
  it("409 (colisión): NO reabre el modal de confirmación; error con el texto del historial; el modal queda abierto con ese texto", async () => {
    const { resp } = await cuerpo(409, { error: CODIGO_HISTORIAL_NO_CONFIRMADO, causa: "colision" });
    expect(reabreModal(resp)).toBe(false);
    const d = decidirResultadoGuardado("desvincular_pestel", resp);
    expect(d).toMatchObject({
      exito: false, bloqueante: true, marcarGuardado: false,
      mensajeError: "No se pudo CONFIRMAR el registro del historial. El proyecto sigue vinculado; vuelve a intentarlo.",
    });
  });

  it("500 (inconsistencia): pide no insistir", async () => {
    const { resp } = await cuerpo(500, { error: CODIGO_HISTORIAL_NO_CONFIRMADO, causa: "inconsistencia" });
    expect(decidirResultadoGuardado("desvincular_pestel", resp).mensajeError)
      .toBe("No se pudo CONFIRMAR el registro del historial. El proyecto sigue vinculado. Si vuelve a pasar, no insistas: hay que revisarlo.");
  });

  it("el MISMO status 409 con código de confirmación SÍ reabre el modal (se distingue por el código, no por el status)", async () => {
    for (const error of ["reemplazo_requiere_confirmacion", "reemplazo_huella_vencida"]) {
      expect(reabreModal((await cuerpo(409, { error })).resp)).toBe(true);
    }
  });

  it("el texto sale del código aunque el status sea cualquier otro de error (no por el status)", async () => {
    for (const status of [409, 500, 503]) {
      const { resp } = await cuerpo(status, { error: CODIGO_HISTORIAL_NO_CONFIRMADO });
      expect(decidirResultadoGuardado("desvincular_pestel", resp).mensajeError).toContain("registro del historial");
    }
  });

  it("sin el código, un 409 / 500 conserva su texto de siempre (no menciona el historial)", async () => {
    for (const [status, error] of [[409, "estado_cambio"], [500, undefined]] as const) {
      const { resp } = await cuerpo(status, error ? { error } : {});
      expect(decidirResultadoGuardado("desvincular_pestel", resp).mensajeError).not.toContain("registro del historial");
    }
  });

  it("200 válido sigue siendo éxito y una red caída sigue siendo ambigua («No se pudo CONFIRMAR…») sin hablar de historial", async () => {
    expect(decidirResultadoGuardado("desvincular_pestel", { tipo: "respuesta", ok: true, status: 200 }).exito).toBe(true);
    const red = decidirResultadoGuardado("desvincular_pestel", { tipo: "error_red" });
    expect(red.mensajeError).toContain("No se pudo CONFIRMAR");
    expect(red.mensajeError).not.toContain("historial");
  });
});
