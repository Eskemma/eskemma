// C3a — CONTRATO de la respuesta de error del historial (lo consumirá C3b): los códigos `error` y los textos se
// fijan aquí. El 409 de colisión comparte status con `reemplazo_requiere_confirmacion`: el botón decide por `error`.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CODIGO_HISTORIAL_NO_CONFIRMADO, MENSAJE_HISTORIAL_COLISION, MENSAJE_HISTORIAL_INCONSISTENTE, respuestaDeErrorHistorial,
} from "./respuestaHistorial";
import { ColisionHistorialError, HistorialInconsistenteError } from "@/lib/versionado/tipos";

const ctx = { projectId: "projA", fase: "investigacion", ruta: "canal1/entregar" };
afterEach(() => vi.restoreAllMocks());

describe("contrato de errores del historial", () => {
  it("códigos y textos EXACTOS (contrato)", () => {
    expect(CODIGO_HISTORIAL_NO_CONFIRMADO).toBe("historial_no_confirmado");
    expect(MENSAJE_HISTORIAL_COLISION).toBe("No se pudo CONFIRMAR el registro del historial. No se guardó nada; vuelve a intentarlo.");
    expect(MENSAJE_HISTORIAL_INCONSISTENTE).toBe(
      "No se pudo CONFIRMAR el registro del historial. No se guardó nada. Si vuelve a pasar, no insistas: hay que revisarlo."
    );
  });

  it("colisión → 409 {error:'historial_no_confirmado', causa:'colision'} con su texto", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = respuestaDeErrorHistorial(new ColisionHistorialError("x"), ctx);
    expect(r?.status).toBe(409);
    expect(await r?.json()).toEqual({ error: "historial_no_confirmado", causa: "colision", message: MENSAJE_HISTORIAL_COLISION });
  });

  it("inconsistencia → 500 {error:'historial_no_confirmado', causa:'inconsistencia'} con su texto", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = respuestaDeErrorHistorial(new HistorialInconsistenteError("x"), ctx);
    expect(r?.status).toBe(500);
    expect(await r?.json()).toEqual({ error: "historial_no_confirmado", causa: "inconsistencia", message: MENSAJE_HISTORIAL_INCONSISTENTE });
  });

  it("un ALREADY_EXISTS crudo del commit (código gRPC 6) se traduce a colisión", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = respuestaDeErrorHistorial(Object.assign(new Error("6 ALREADY_EXISTS: x"), { code: 6 }), ctx);
    expect(r?.status).toBe(409);
    expect((await r?.json()).causa).toBe("colision");
  });

  it("log de servidor nivel error: nombre del error, proyecto, fase y ruta; SIN contenido ni uid", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    respuestaDeErrorHistorial(new HistorialInconsistenteError("detalle con contenido secreto uidA"), ctx);
    expect(log).toHaveBeenCalledTimes(1);
    const linea = String(log.mock.calls[0][0]);
    expect(linea).toContain("HistorialInconsistenteError");
    expect(linea).toContain("projA");
    expect(linea).toContain("investigacion");
    expect(linea).toContain("canal1/entregar");
    expect(linea).not.toContain("secreto");
    expect(linea).not.toContain("uidA");
  });

  it("un error que NO es del historial devuelve null (la ruta lo relanza) y no registra nada", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(respuestaDeErrorHistorial(new Error("otra cosa"), ctx)).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });
});
