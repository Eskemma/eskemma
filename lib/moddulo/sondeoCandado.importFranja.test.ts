// T5b — el import que no pudo hacerse: ramas explícitas de decidirConfirmacionImport y la franja de error.
import { describe, expect, it } from "vitest";
import { decidirConfirmacionImport, decidirFranjaImport } from "./sondeoCandado";
import { MENSAJE_F2_IMPORT_CON_PENDIENTE, MENSAJE_F2_IMPORT_YA_VINCULADO } from "./textosVinculo";
import type { RespuestaGuardado } from "./guardadoHonesto";

const r = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: status < 400, status, codigo });
// Los textos que hoy manda el servidor (no cambian): el del pestel ya vinculado se comparte con link-moddulo.
const SERVIDOR_YA_VINCULADO = "Este proyecto PESTEL ya está vinculado a otro proyecto de Moddulo.";

describe("decidirConfirmacionImport — rechazos de unicidad del vínculo (T5b)", () => {
  it("pestel_already_linked: texto de F2 + «No se importó nada.», sin reintento; NO el del servidor", () => {
    const d = decidirConfirmacionImport(r(409, "pestel_already_linked"), { error: "pestel_already_linked", message: SERVIDOR_YA_VINCULADO });
    expect(d).toEqual({ tipo: "error", mensaje: `${MENSAJE_F2_IMPORT_YA_VINCULADO} No se importó nada.`, reintentable: false });
    expect((d as { mensaje: string }).mensaje).not.toContain(SERVIDOR_YA_VINCULADO);
  });
  it("moddulo_con_pendiente: texto de F2 que nombra el control que existe, sin reintento", () => {
    const d = decidirConfirmacionImport(r(409, "moddulo_con_pendiente"), { error: "moddulo_con_pendiente", message: "texto del servidor" });
    expect(d).toEqual({ tipo: "error", mensaje: `${MENSAJE_F2_IMPORT_CON_PENDIENTE} No se importó nada.`, reintentable: false });
    expect((d as { mensaje: string }).mensaje).toContain("«Cancelar vínculo pendiente»");
  });
  it("los textos nombran un control que existe y no remiten a soporte", () => {
    expect(MENSAJE_F2_IMPORT_YA_VINCULADO).toContain("«Regresar a Moddulo F2 con resultados»"); // ModduloButton, rama vinculado
    for (const t of [MENSAJE_F2_IMPORT_YA_VINCULADO, MENSAJE_F2_IMPORT_CON_PENDIENTE]) expect(t).not.toMatch(/soporte/i);
  });
  it("no cambia lo demás: conflict sigue reconfirmando y fase_cerrada su texto", () => {
    expect(decidirConfirmacionImport(r(409, "conflict"), { lineas: ["a"], huella: "h" })).toMatchObject({ tipo: "reconfirmar" });
    expect(decidirConfirmacionImport(r(409, "fase_cerrada"))).toMatchObject({ tipo: "error", reintentable: false });
  });
});

describe("decidirFranjaImport — la franja de error del import automático y de «Vincular de nuevo»", () => {
  it("red caída, 5xx y 200 inválido: «No se pudo CONFIRMAR la importación…» con Reintentar", () => {
    for (const resp of [{ tipo: "error_red" } as RespuestaGuardado, r(500), r(502), r(503), r(504), r(500, "reemplazo_escritura_incierta"), r(200)]) {
      const f = decidirFranjaImport(resp);
      expect(f.mensaje).toContain("No se pudo CONFIRMAR la importación");
      expect(f.reintentable).toBe(true);
    }
  });
  it("4xx: texto propio sin Reintentar (no se escribió nada)", () => {
    for (const [resp, datos] of [[r(409, "pestel_already_linked"), {}], [r(409, "moddulo_con_pendiente"), {}], [r(409, "fase_cerrada"), {}], [r(403), {}], [r(404), {}], [r(401), {}]] as const) {
      const f = decidirFranjaImport(resp, datos);
      expect(f.reintentable).toBe(false);
      expect(f.mensaje.length).toBeGreaterThan(20);
    }
    expect(decidirFranjaImport(r(409, "pestel_already_linked")).mensaje).toBe(`${MENSAJE_F2_IMPORT_YA_VINCULADO} No se importó nada.`);
  });
  it("reconfirmar (no debería llegar aquí): muestra el aviso y no ofrece reintento", () => {
    const f = decidirFranjaImport(r(409, "reemplazo_huella_vencida"), { lineas: ["a"], huella: "h" });
    expect(f.reintentable).toBe(false);
    expect(f.mensaje).toContain("cambió");
  });
});
