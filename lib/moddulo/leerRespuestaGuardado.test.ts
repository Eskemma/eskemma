import { describe, expect, it } from "vitest";
import { leerRespuestaGuardado } from "./leerRespuestaGuardado";

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

describe("leerRespuestaGuardado", () => {
  it("un fetch que lanza es error_red (no una excepción)", async () => {
    const { resp } = await leerRespuestaGuardado(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(resp).toEqual({ tipo: "error_red" });
  });

  it("lee status, código y mensaje del cuerpo JSON", async () => {
    const { resp, datos } = await leerRespuestaGuardado(async () =>
      json(409, { error: "sesion_vinculada", mensaje: "m" })
    );
    expect(resp).toMatchObject({ tipo: "respuesta", ok: false, status: 409, codigo: "sesion_vinculada", mensaje: "m" });
    expect(datos).toMatchObject({ error: "sesion_vinculada" });
  });

  it("un 500 de Next sin JSON (cuerpo de texto) no lanza: queda sin código", async () => {
    const { resp } = await leerRespuestaGuardado(async () => new Response("Internal Server Error", { status: 500 }));
    expect(resp).toMatchObject({ tipo: "respuesta", ok: false, status: 500, codigo: undefined });
  });

  it("cuerpoEsValido solo se evalúa si la respuesta es OK", async () => {
    const valido = (d: Record<string, unknown>) => !!d.compatibilidad;
    const ok = await leerRespuestaGuardado(async () => json(200, {}), valido);
    expect(ok.resp).toMatchObject({ ok: true, cuerpoValido: false });
    const bien = await leerRespuestaGuardado(async () => json(200, { compatibilidad: {} }), valido);
    expect(bien.resp).toMatchObject({ ok: true, cuerpoValido: true });
    const mal = await leerRespuestaGuardado(async () => json(404, {}), valido);
    expect(mal.resp).toMatchObject({ ok: false, cuerpoValido: undefined });
  });
});

// Las muestras de la guía de navegador del commit 5b deben ser las que las pantallas leen.
import { SIEMBRA_RDA_ITEM, SIEMBRA_CANVAS_ITEM } from "./__tests__/fixtures/siembra5b";
import { getDisplayTextForRDAItem } from "./rda";
import { canvasItemToMarkdown } from "../fontana/canvasExport";

describe("muestras de siembra del commit 5b", () => {
  it("el ítem RDA sembrado está «activo» y la pantalla lo lee con su nombre", () => {
    expect(SIEMBRA_RDA_ITEM.estado).toBe("activo");
    const t = getDisplayTextForRDAItem({ ...SIEMBRA_RDA_ITEM, fechaCreacion: null as never });
    expect(t.nombre).toBe("Prueba 5b — deficiencia desechable");
  });
  it("la tarjeta de Canvas sembrada la sabe pintar el exportador (forma válida)", () => {
    expect(canvasItemToMarkdown(SIEMBRA_CANVAS_ITEM)).toContain("Población total");
    expect(SIEMBRA_CANVAS_ITEM.eliminado).toBeUndefined();
  });
});
