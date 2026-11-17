import { describe, expect, it } from "vitest";
import { decidirRespuestaEntregaCanal1 } from "./respuestaEntregaCanal1";

const PREGUNTA = { error: "reemplazo_requiere_confirmacion", lineas: ["a", "b"], huella: "H1" };
const COLISION = { error: "historial_no_confirmado", causa: "colision", message: "No se pudo CONFIRMAR el registro del historial. No se guardó nada; vuelve a intentarlo." };

describe("decidirRespuestaEntregaCanal1 — decide por el código `error`, no por el status", () => {
  it("MISMO status 409, distinto error: la pregunta de reemplazo y la colisión del historial son acciones distintas", () => {
    const a = decidirRespuestaEntregaCanal1({ status: 409, cuerpo: PREGUNTA });
    const b = decidirRespuestaEntregaCanal1({ status: 409, cuerpo: COLISION });
    expect(a).toEqual({ tipo: "pedir_confirmacion", lineas: ["a", "b"], huella: "H1", huellaVencida: false });
    expect(b).toEqual({ tipo: "error_historial", mensaje: COLISION.message, causa: "colision" });
  });
  it("inconsistencia del historial (500): su mensaje, no el error crudo", () => {
    const r = decidirRespuestaEntregaCanal1({
      status: 500,
      cuerpo: { error: "historial_no_confirmado", causa: "inconsistencia", message: "msg del servidor" },
    });
    expect(r).toEqual({ tipo: "error_historial", mensaje: "msg del servidor", causa: "inconsistencia" });
  });
  it("sin `message` usa un respaldo (nunca el código crudo)", () => {
    const r = decidirRespuestaEntregaCanal1({ status: 409, cuerpo: { error: "historial_no_confirmado", causa: "colision" } });
    expect(r.tipo).toBe("error_historial");
    expect((r as { mensaje: string }).mensaje).toContain("No se pudo CONFIRMAR el registro del historial");
    expect((r as { mensaje: string }).mensaje).not.toContain("historial_no_confirmado");
  });
  it("huella vencida se propaga al modal", () => {
    const r = decidirRespuestaEntregaCanal1({ status: 409, cuerpo: { ...PREGUNTA, huellaVencida: true } });
    expect(r).toMatchObject({ tipo: "pedir_confirmacion", huellaVencida: true });
  });
  it("una pregunta sin huella o sin líneas NO abre el modal (no hay nada seguro que confirmar)", () => {
    for (const cuerpo of [{ error: PREGUNTA.error, lineas: ["a"] }, { error: PREGUNTA.error, huella: "H" }, { error: PREGUNTA.error, lineas: [], huella: "H" }]) {
      expect(decidirRespuestaEntregaCanal1({ status: 409, cuerpo }).tipo).toBe("error");
    }
  });
  it("200 con {resultadoId, fecha} es éxito; 200 sin esos campos no lo es", () => {
    expect(decidirRespuestaEntregaCanal1({ status: 200, cuerpo: { resultadoId: "r", fecha: "2026-11-17" } })).toEqual({ tipo: "exito" });
    expect(decidirRespuestaEntregaCanal1({ status: 200, cuerpo: {} }).tipo).toBe("error");
  });
  it("un 404 conserva el motivo del servidor (antes: `message ?? error`)", () => {
    const r = decidirRespuestaEntregaCanal1({ status: 404, cuerpo: { error: "Asignación de Canal 1 (T10) no encontrada en el tablero" } });
    expect(r).toEqual({
      tipo: "error",
      mensaje: "El resultado se subió pero no se pudo registrar la entrega: Asignación de Canal 1 (T10) no encontrada en el tablero.",
    });
  });
  it("un 500 sin código y un cuerpo no JSON son errores ambiguos («No se pudo CONFIRMAR»)", () => {
    for (const cuerpo of [{}, null, "texto", undefined]) {
      const r = decidirRespuestaEntregaCanal1({ status: 500, cuerpo });
      expect(r.tipo).toBe("error");
      expect((r as { mensaje: string }).mensaje).toContain("No se pudo CONFIRMAR");
    }
  });
  it("un 409 de OTRO código no se confunde con la pregunta", () => {
    expect(decidirRespuestaEntregaCanal1({ status: 409, cuerpo: { error: "otra_cosa" } }).tipo).toBe("error");
  });
});
