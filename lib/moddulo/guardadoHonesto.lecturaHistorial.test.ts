// C4a-1 — texto de un fallo al LEER el historial: «No se pudo cargar el historial…» (leer no es guardar: nunca
// «CONFIRMAR», que es lenguaje de escritura), sin códigos internos y con texto propio para el índice en construcción.
import { describe, expect, it } from "vitest";
import { TEXTO_HISTORIAL_INDICE_NO_LISTO, decidirLecturaHistorial, type RespuestaGuardado } from "./guardadoHonesto";

const resp = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: status >= 200 && status < 300, status, ...(codigo ? { codigo } : {}) });

describe("decidirLecturaHistorial", () => {
  it("200 con cuerpo válido → éxito", () => {
    expect(decidirLecturaHistorial(resp(200))).toEqual({ exito: true, mensajeError: null });
  });
  it.each([
    ["red", { tipo: "error_red" } as RespuestaGuardado, "No se pudo cargar el historial: sin conexión con el servidor. Revisa tu conexión y vuelve a intentarlo."],
    ["401", resp(401), "No se pudo cargar el historial: no tienes permiso para verlo en este proyecto."],
    ["403", resp(403, "sin_permiso"), "No se pudo cargar el historial: no tienes permiso para verlo en este proyecto."],
    ["404", resp(404), "No se pudo cargar el historial: no se encontró el proyecto. Puede que ya no exista."],
    ["503 índice", resp(503, "indice_en_construccion"), TEXTO_HISTORIAL_INDICE_NO_LISTO],
    ["500 ilegible", resp(500, "historial_ilegible"), "No se pudo cargar el historial: hay un problema con los registros de esta fase. Avisa al equipo de Eskemma."],
    ["500", resp(500), "No se pudo cargar el historial. Vuelve a intentarlo en unos minutos."],
    ["502", resp(502), "No se pudo cargar el historial. Vuelve a intentarlo en unos minutos."],
    ["400", resp(400, "parametro_invalido"), "No se pudo cargar el historial. Vuelve a intentarlo en unos minutos."],
  ])("%s", (_n, r, texto) => {
    expect(decidirLecturaHistorial(r)).toEqual({ exito: false, mensajeError: texto });
  });
  it("200 con un cuerpo que no es el esperado → no se pudo cargar", () => {
    expect(decidirLecturaHistorial(resp(200), false)).toEqual({
      exito: false,
      mensajeError: "No se pudo cargar el historial. Vuelve a intentarlo en unos minutos.",
    });
  });
  it("ningún texto usa «CONFIRMAR» ni un código interno (palabra con guion bajo)", () => {
    const todas = [{ tipo: "error_red" } as RespuestaGuardado, resp(401), resp(404), resp(503, "indice_en_construccion"), resp(500, "historial_ilegible"), resp(500), resp(400, "x_y")];
    for (const r of todas) {
      const t = decidirLecturaHistorial(r).mensajeError ?? "";
      expect(t).not.toMatch(/CONFIRMAR|confirmar/);
      expect(t).not.toMatch(/[a-z]+_[a-z]+/);
      expect(t.startsWith("No se pudo cargar el historial") || t === TEXTO_HISTORIAL_INDICE_NO_LISTO).toBe(true);
    }
  });
  it("los textos siguen el criterio Hub/app y sin siglas", () => {
    for (const t of [TEXTO_HISTORIAL_INDICE_NO_LISTO, decidirLecturaHistorial(resp(500, "historial_ilegible")).mensajeError ?? ""]) {
      expect(t).not.toMatch(/Centinela|PESTEL|\b(HEI|DIE|RDA|M1|IA)\b/);
    }
  });
});
