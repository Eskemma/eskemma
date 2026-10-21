// Paso 5: texto de «mapa_demasiado_grande» por origen: sin cifras y con la acción que de verdad existe.
import { describe, expect, it } from "vitest";
import { decidirResultadoGuardado, textoMapaDemasiadoGrande, type RespuestaGuardado } from "./guardadoHonesto";
import { leerRespuestaGuardado } from "./leerRespuestaGuardado";

const r422 = (origen?: "express" | "centinela" | "desconocido"): RespuestaGuardado => ({
  tipo: "respuesta", ok: false, status: 422, codigo: "mapa_demasiado_grande", ...(origen ? { origen } : {}),
});
const msg = (a: Parameters<typeof decidirResultadoGuardado>[0], r: RespuestaGuardado) => decidirResultadoGuardado(a, r).mensajeError ?? "";
const BASE = "El análisis es demasiado extenso para generar los motores. No se generó nada.";

describe("mapa_demasiado_grande — texto por origen", () => {
  it.each(["generar_motores", "generar_analisis", "reemplazar_analisis"] as const)("%s: express ofrece «Editar narrativas» y «Nuevo análisis»", (a) => {
    const m = msg(a, r422("express"));
    expect(m).toBe(`${BASE} Puedes acortar las narrativas con «Editar narrativas» o generar un análisis nuevo con «Nuevo análisis».`);
  });
  it("centinela: no ofrece editar, manda a generar uno nuevo en Centinela e importarlo", () => {
    const m = msg("generar_motores", r422("centinela"));
    expect(m).toContain("no se puede editar aquí");
    expect(m).toContain("Centinela");
    expect(m).not.toMatch(/Editar narrativas/);
  });
  it("origen desconocido o ausente: texto genérico sin ninguna acción", () => {
    expect(msg("generar_motores", r422("desconocido"))).toBe(BASE);
    expect(msg("generar_motores", r422())).toBe(BASE);
    expect(textoMapaDemasiadoGrande("raro")).toBe(BASE);
  });
  it("sin cifras ni códigos internos ni «Claude» en ningún origen", () => {
    for (const o of ["express", "centinela", "desconocido", undefined] as const) {
      expect(msg("generar_motores", r422(o))).not.toMatch(/\d|Claude|mapa_demasiado|150/);
    }
  });
  it("otro 422 o sin el código no usa este texto", () => {
    expect(msg("generar_motores", { tipo: "respuesta", ok: false, status: 422, codigo: "otra_cosa" })).not.toContain("demasiado extenso");
  });
  it("leerRespuestaGuardado conserva un origen válido y descarta uno desconocido", async () => {
    const mk = (origen: unknown) => () => Promise.resolve(new Response(JSON.stringify({ codigo: "mapa_demasiado_grande", origen }), { status: 422 }));
    expect((await leerRespuestaGuardado(mk("express"))).resp).toMatchObject({ origen: "express" });
    expect((await leerRespuestaGuardado(mk("<b>"))).resp).not.toHaveProperty("origen");
  });
});
