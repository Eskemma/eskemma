// Commit 4 (paso 4): cómo falló la petición se clasifica ANTES de decir por qué. Red caída, respuesta sin estado
// válido (0), excepción de fetch, 401 (sesión) y 403 (permiso) no comparten texto: solo 401/403 son afirmaciones del
// servidor.
import { describe, expect, it } from "vitest";
import { clasificarFallo, debeEnviar, estadoHttpValido, TEXTO_SESION } from "./textosAcceso";
import { GRUPO_ACCION, decidirResultadoGuardado, type AccionGuardado, type RespuestaGuardado } from "./guardadoHonesto";
import { decidirConfirmacionImport, decidirSondeo } from "./sondeoCandado";
import { leerRespuestaGuardado } from "./leerRespuestaGuardado";

const r = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: status >= 200 && status < 400, status, codigo });
const red: RespuestaGuardado = { tipo: "error_red" };

describe("clasificarFallo", () => {
  it("red caída, estado 0/NaN, 401 y 403 son clases distintas; el resto no es ninguna", () => {
    expect(clasificarFallo(red)).toBe("sin_conexion");
    expect(clasificarFallo(r(0))).toBe("sin_respuesta_valida");
    expect(clasificarFallo(r(Number.NaN))).toBe("sin_respuesta_valida");
    expect(clasificarFallo(r(401))).toBe("sesion");
    expect(clasificarFallo(r(403))).toBe("permiso");
    for (const s of [200, 400, 404, 409, 500, 503]) expect(clasificarFallo(r(s))).toBeNull();
  });
  it("estadoHttpValido", () => {
    expect([0, -1, 99, 600, 1.5, Number.NaN, "200", undefined].map(estadoHttpValido)).toEqual(Array(8).fill(false));
    expect([100, 200, 401, 599].map(estadoHttpValido)).toEqual([true, true, true, true]);
  });
  it("una excepción de fetch (TypeError de red, AbortError) llega como error_red", async () => {
    for (const e of [new TypeError("Failed to fetch"), Object.assign(new Error("x"), { name: "AbortError" })]) {
      const { resp } = await leerRespuestaGuardado(() => Promise.reject(e));
      expect(resp).toEqual({ tipo: "error_red" });
    }
  });
  it("debeEnviar: con el navegador sin conexión NO se envía; sin navigator o en línea, sí", () => {
    expect(debeEnviar(false)).toBe(false);
    expect(debeEnviar(true)).toBe(true);
    expect(debeEnviar(undefined)).toBe(true);
  });
});

describe("el sondeo da cuatro mensajes distintos", () => {
  const msg = (resp: RespuestaGuardado) => (decidirSondeo("nuevo_analisis", resp) as { mensaje: string }).mensaje;
  it("red / estado 0 / 401 / 403", () => {
    const m = [msg(red), msg(r(0)), msg(r(401)), msg(r(403))];
    expect(new Set(m).size).toBe(4);
    for (const t of [m[0], m[1]]) {
      expect(t).toContain("No se pudo CONFIRMAR");
      expect(t).not.toMatch(/permiso|sesión/i);
    }
    expect(m[2]).toContain(TEXTO_SESION);
    expect(m[2]).not.toContain("No tienes permiso");
    expect(m[3]).toContain("No tienes permiso");
    expect(m[3]).not.toContain("sesión");
  });
  it("red y estado 0 ofrecen reintento; 401/403 no", () => {
    for (const resp of [red, r(0)]) expect(decidirSondeo("desvincular", resp)).toMatchObject({ tipo: "error", reintentable: true });
    for (const s of [401, 403]) expect(decidirSondeo("desvincular", r(s))).toMatchObject({ tipo: "error", reintentable: false });
  });
});

describe("la confirmación del import: lo mismo", () => {
  const msg = (resp: RespuestaGuardado) => (decidirConfirmacionImport(resp) as { mensaje: string }).mensaje;
  it("red y estado 0 = «No se pudo CONFIRMAR»; 401 = sesión; 403 = permiso", () => {
    expect(msg(red)).toContain("No se pudo CONFIRMAR");
    expect(msg(r(0))).toContain("No se pudo CONFIRMAR");
    expect(msg(r(401))).toContain(TEXTO_SESION);
    expect(msg(r(403))).toContain("No tienes permiso");
    expect(new Set([msg(red), msg(r(0)), msg(r(401)), msg(r(403))]).size).toBe(4);
  });
});

describe("TODAS las acciones de guardado", () => {
  const acciones = Object.keys(GRUPO_ACCION) as AccionGuardado[];
  const m = (a: AccionGuardado, resp: RespuestaGuardado) => decidirResultadoGuardado(a, resp, { motor: "M2", fase: "Fase 2", dimension: "Político", nombre: "x", cambio: "el cambio" }).mensajeError ?? "";
  it.each(acciones)("%s: red caída y estado 0 no mencionan permiso ni sesión; 401 no dice «permiso»; 403 no dice «sesión»", (a) => {
    for (const resp of [red, r(0)]) expect(m(a, resp)).not.toMatch(/No tienes permiso|sesión no es válida/i);
    expect(m(a, r(401))).not.toMatch(/No tienes permiso/);
    expect(m(a, r(403))).not.toMatch(/sesión no es válida/);
  });
  it("las que dependen de status (4xx) dicen la sesión con 401 y el permiso con 403", () => {
    for (const a of ["guardar_borrador", "aprobar_motor", "eliminar_proyecto"] as AccionGuardado[]) {
      expect(m(a, r(401))).toContain(TEXTO_SESION);
      expect(m(a, r(403))).toMatch(/No tienes permiso/);
    }
  });
});
