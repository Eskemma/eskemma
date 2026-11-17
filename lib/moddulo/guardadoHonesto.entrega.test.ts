import { describe, expect, it } from "vitest";
import { decidirResultadoGuardado, GRUPO_ACCION } from "./guardadoHonesto";

describe("guardadoHonesto — entregar_canal1 (C3b)", () => {
  it("está en el catálogo como acción simple", () => {
    expect(GRUPO_ACCION.entregar_canal1).toBe("simple");
  });
  it("éxito", () => {
    expect(decidirResultadoGuardado("entregar_canal1", { tipo: "respuesta", ok: true, status: 200 }).exito).toBe(true);
  });
  it("red caída: ambiguo («No se pudo CONFIRMAR»), nunca afirma que no se entregó", () => {
    const d = decidirResultadoGuardado("entregar_canal1", { tipo: "error_red" });
    expect(d.mensajeError).toContain("No se pudo CONFIRMAR la entrega a Moddulo F3");
    expect(d.mensajeError).toContain("Puede que sí se haya entregado");
  });
  it("500 sin código: ambiguo", () => {
    const d = decidirResultadoGuardado("entregar_canal1", { tipo: "respuesta", ok: false, status: 500 });
    expect(d.mensajeError).toContain("No se pudo CONFIRMAR");
  });
  it("403/404/400 conservan el motivo del servidor", () => {
    for (const status of [400, 403, 404]) {
      const d = decidirResultadoGuardado("entregar_canal1", { tipo: "respuesta", ok: false, status, codigo: "motivo X" });
      expect(d.mensajeError).toBe("El resultado se subió pero no se pudo registrar la entrega: motivo X.");
    }
  });
  it("404 sin motivo: texto de «no encontrado»", () => {
    const d = decidirResultadoGuardado("entregar_canal1", { tipo: "respuesta", ok: false, status: 404 });
    expect(d.mensajeError).toContain("no se encontró la sesión o el proyecto");
  });
  it("401 afirma solo el permiso", () => {
    const d = decidirResultadoGuardado("entregar_canal1", { tipo: "respuesta", ok: false, status: 401 });
    expect(d.mensajeError).toContain("No se pudo registrar la entrega a Moddulo F3.");
  });
});
