import { describe, expect, it } from "vitest";
import { decidirConfirmacionImport, decidirSondeo, urlAlCancelarImport, urlSinParametro } from "./sondeoCandado";
import type { RespuestaGuardado } from "./guardadoHonesto";

const r = (status: number, codigo?: string, extra: Partial<Extract<RespuestaGuardado, { tipo: "respuesta" }>> = {}): RespuestaGuardado =>
  ({ tipo: "respuesta", ok: status < 400, status, codigo, ...extra });

describe("decidirSondeo — nuevo análisis", () => {
  it("200 verificado (proyecto limpio): continúa SIN modal", () => {
    expect(decidirSondeo("nuevo_analisis", r(200, undefined, { cuerpoValido: true }))).toEqual({ tipo: "continuar" });
  });
  it("409 requiere confirmación: abre el modal con las líneas y la huella DEL SERVIDOR", () => {
    expect(decidirSondeo("nuevo_analisis", r(409, "reemplazo_requiere_confirmacion"), { lineas: ["a", "b"], huella: "h1" })).toEqual({
      tipo: "confirmar", lineas: ["a", "b"], huella: "h1", aviso: null,
    });
  });
  it("409 huella vencida: abre el modal con un aviso", () => {
    const d = decidirSondeo("nuevo_analisis", r(409, "reemplazo_huella_vencida"), { lineas: [], huella: "h2" });
    expect(d).toMatchObject({ tipo: "confirmar", huella: "h2" });
    expect((d as { aviso: string }).aviso).toContain("cambió");
  });
  it("líneas que no son una lista de textos se ignoran (el modal usa las suyas)", () => {
    expect(decidirSondeo("nuevo_analisis", r(409, "reemplazo_requiere_confirmacion"), { lineas: [1, 2], huella: "h" })).toMatchObject({ lineas: undefined });
  });
  it("red caída o 5xx: NO abre el modal; «No se pudo CONFIRMAR…», sin cambios y con reintento", () => {
    for (const resp of [{ tipo: "error_red" } as RespuestaGuardado, r(500), r(502), r(503), r(504), r(500, "reemplazo_escritura_incierta")]) {
      const d = decidirSondeo("nuevo_analisis", resp);
      expect(d.tipo).toBe("error");
      expect((d as { mensaje: string }).mensaje).toContain("No se pudo CONFIRMAR lo que se perdería al generar un análisis nuevo");
      expect((d as { mensaje: string }).mensaje).toContain("No se hizo ningún cambio");
      expect((d as { reintentable: boolean }).reintentable).toBe(true);
    }
  });
  it("Fase 2 cerrada y pestel_linked: mensaje propio, sin reintento", () => {
    expect(decidirSondeo("nuevo_analisis", r(409, "fase_cerrada"))).toMatchObject({ tipo: "error", reintentable: false, mensaje: expect.stringContaining("Fase 2 está cerrada") });
    expect(decidirSondeo("nuevo_analisis", r(409, "pestel_linked"))).toMatchObject({ tipo: "error", reintentable: false, mensaje: expect.stringContaining("desvincúlalo") });
  });
  it("404 y 401/403 no afirman más de lo sabido", () => {
    expect(decidirSondeo("nuevo_analisis", r(404))).toMatchObject({ tipo: "error", reintentable: false });
    expect((decidirSondeo("nuevo_analisis", r(403)) as { mensaje: string }).mensaje).toContain("No tienes permiso");
  });
  it("un 200 con cuerpo inválido no continúa", () => {
    expect(decidirSondeo("nuevo_analisis", r(200, undefined, { cuerpoValido: false })).tipo).toBe("error");
  });
});

describe("decidirSondeo — desvincular", () => {
  it("409 abre el modal; un 200 NO es lo esperado (siempre pregunta) y no se toma por éxito", () => {
    expect(decidirSondeo("desvincular", r(409, "reemplazo_requiere_confirmacion"), { lineas: [], huella: "h" }).tipo).toBe("confirmar");
    expect(decidirSondeo("desvincular", r(200)).tipo).toBe("error");
  });
  it("not_linked y fase_cerrada: mensaje propio sin reintento; red/5xx: CONFIRMAR con reintento", () => {
    expect(decidirSondeo("desvincular", r(400, "not_linked"))).toMatchObject({ tipo: "error", reintentable: false });
    expect(decidirSondeo("desvincular", r(409, "fase_cerrada"))).toMatchObject({ tipo: "error", reintentable: false, mensaje: expect.stringContaining("no se puede desvincular") });
    const d = decidirSondeo("desvincular", r(500));
    expect(d).toMatchObject({ tipo: "error", reintentable: true });
    expect((d as { mensaje: string }).mensaje).toContain("desvincular el análisis de Centinela");
  });
});

describe("importación automática — la URL", () => {
  it("quita pest_analysis_id y conserva lo demás (parámetros y hash)", () => {
    expect(urlSinParametro("https://x.test/moddulo/proyecto/p1/exploracion?pest_analysis_id=a1&fontana_sesion_id=s1#abajo")).toBe(
      "/moddulo/proyecto/p1/exploracion?fontana_sesion_id=s1#abajo"
    );
    expect(urlSinParametro("/moddulo/proyecto/p1/exploracion?pest_analysis_id=a1")).toBe("/moddulo/proyecto/p1/exploracion");
  });
  it("sin el parámetro (o URL inválida): null, no hay nada que reemplazar", () => {
    expect(urlSinParametro("/moddulo/proyecto/p1/exploracion?otro=1")).toBeNull();
    expect(urlSinParametro("http://[")).toBeNull();
  });
  it("cancelar la confirmación del import automático («sync») limpia la URL; el «relink» manual no toca nada", () => {
    const href = "https://x.test/p?pest_analysis_id=a1";
    expect(urlAlCancelarImport("sync", href)).toBe("/p");
    expect(urlAlCancelarImport("relink", href)).toBeNull();
    expect(urlAlCancelarImport("sync", "https://x.test/p")).toBeNull();
  });
});

describe("decidirConfirmacionImport — el modal no se cierra en silencio", () => {
  it("red caída y 5xx: «No se pudo CONFIRMAR…» sin afirmar que se importó ni que no, con reintento", () => {
    for (const resp of [{ tipo: "error_red" } as RespuestaGuardado, r(500), r(502), r(503), r(504), r(500, "reemplazo_escritura_incierta"), r(200)]) {
      const d = decidirConfirmacionImport(resp);
      expect(d.tipo).toBe("error");
      const m = (d as { mensaje: string }).mensaje;
      expect(m).toContain("No se pudo CONFIRMAR la importación");
      expect(m).toContain("No se puede saber si se completó");
      expect(m).not.toMatch(/No se importó nada|se importó correctamente|ya se importó/);
      expect((d as { reintentable: boolean }).reintentable).toBe(true);
    }
  });
  it("409 de estado cambiado: vuelve a pedir confirmación con las líneas y la huella nuevas", () => {
    for (const codigo of ["conflict", "reemplazo_requiere_confirmacion", "reemplazo_huella_vencida"]) {
      expect(decidirConfirmacionImport(r(409, codigo), { lineas: ["a"], huella: "h" })).toMatchObject({ tipo: "reconfirmar", lineas: ["a"], huella: "h" });
    }
  });
  it("4xx con texto del servidor: lo muestra y dice que no se importó nada; sin reintento", () => {
    const d = decidirConfirmacionImport(r(403), { error: "Sin permisos para este análisis PESTEL" });
    expect(d).toEqual({ tipo: "error", mensaje: "Sin permisos para este análisis PESTEL No se importó nada.", reintentable: false });
    expect(decidirConfirmacionImport(r(404), { message: "Análisis PESTEL no encontrado." })).toMatchObject({ mensaje: "Análisis PESTEL no encontrado. No se importó nada." });
  });
  it("4xx con solo un código (sin texto legible): texto propio por status, nunca el código crudo", () => {
    const d = decidirConfirmacionImport(r(404), { error: "not_found" }) as { mensaje: string };
    expect(d.mensaje).not.toContain("not_found");
    expect(d.mensaje).toContain("No se importó nada");
    expect((decidirConfirmacionImport(r(401)) as { mensaje: string }).mensaje).toContain("Tu sesión no es válida o expiró"); // paso 4: 401 = sesión
    expect((decidirConfirmacionImport(r(403)) as { mensaje: string }).mensaje).toContain("No tienes permiso");
  });
  it("Fase 2 cerrada: su texto propio, sin reintento", () => {
    expect(decidirConfirmacionImport(r(409, "fase_cerrada"))).toMatchObject({ tipo: "error", reintentable: false, mensaje: expect.stringContaining("Fase 2 está cerrada") });
  });
});
