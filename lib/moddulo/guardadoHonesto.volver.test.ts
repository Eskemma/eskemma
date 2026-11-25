// C4b-1b — `volver_a_version` en guardadoHonesto: textos EXACTOS, decisión por el CÓDIGO `error` (nunca por el status),
// los 3 409 de la familia (i) y `historial_no_confirmado`. El servidor NO formatea fechas (la frase de apertura y el
// mensaje de éxito los compone la interfaz con la fecha de la fila del panel).
import { describe, expect, it } from "vitest";
import {
  ACCIONES_SIMPLES, GRUPO_ACCION, TEXTOS_VOLVER, decidirReemplazoAnalisis, decidirResultadoGuardado, type RespuestaGuardado,
} from "./guardadoHonesto";

const res = (status: number, codigo?: string, mensaje?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: status < 400, status, ...(codigo ? { codigo } : {}), ...(mensaje ? { mensaje } : {}) });
const red: RespuestaGuardado = { tipo: "error_red" };
const msg = (r: RespuestaGuardado) => decidirResultadoGuardado("volver_a_version", r).mensajeError;
const AMBIGUO = "No se pudo CONFIRMAR que se haya vuelto a la versión anterior. Puede que sí; abre el historial y revisa antes de intentarlo de nuevo.";

describe("volver_a_version: catálogo", () => {
  it("es una acción «simple» y está en ACCIONES_SIMPLES", () => {
    expect(GRUPO_ACCION.volver_a_version).toBe("simple");
    expect(ACCIONES_SIMPLES).toContain("volver_a_version");
  });
});

describe("volver_a_version: ambiguos (SIEMPRE «No se pudo CONFIRMAR…»)", () => {
  it("red caída, 500 sin código, 502/503/504, reemplazo_escritura_incierta y 200 con cuerpo inválido", () => {
    expect(msg(red)).toBe(AMBIGUO);
    for (const s of [500, 502, 503, 504]) expect(msg(res(s))).toBe(AMBIGUO);
    expect(msg(res(500, "reemplazo_escritura_incierta"))).toBe(AMBIGUO);
    expect(msg({ tipo: "respuesta", ok: true, status: 200, cuerpoValido: false })).toBe(AMBIGUO);
  });
  it("nunca dice «no se hizo» ni «sigue como estaba» ante un fallo ambiguo", () => {
    for (const r of [red, res(500), res(503)]) {
      const m = msg(r)!;
      expect(m).not.toMatch(/sigue como estaba|no se volvió/i);
    }
  });
});

describe("volver_a_version: 4xx", () => {
  it("401: sesión; 403: permiso; ambos afirman que el resultado sigue como estaba (la petición no pasó)", () => {
    expect(msg(res(401))).toBe(TEXTOS_VOLVER.sesion);
    expect(msg(res(403))).toBe(TEXTOS_VOLVER.permiso);
    expect(TEXTOS_VOLVER.sesion).toContain("El resultado sigue como estaba.");
    expect(TEXTOS_VOLVER.permiso).toContain("El resultado sigue como estaba.");
  });
  it("404 NUNCA afirma que el resultado o la versión siguen ahí (tras una red ambigua el primer intento pudo volver)", () => {
    expect(msg(res(404))).toBe("No se encontró el resultado o esa versión; puede que ya no se conserve. Recarga el historial.");
    expect(msg(res(404))).not.toMatch(/sigue/i);
  });
  it("409 por CÓDIGO: huella vencida, bloqueado (con el motivo del servidor), version_no_restaurable y sin_cambios", () => {
    expect(msg(res(409, "reemplazo_huella_vencida"))).toBe("Algo cambió mientras decidías. No se hizo nada: revisa el aviso actualizado y confirma de nuevo.");
    expect(msg(res(409, "reemplazo_bloqueado", "MOTIVO DEL SERVIDOR"))).toBe("MOTIVO DEL SERVIDOR");
    expect(msg(res(409, "reemplazo_bloqueado"))).toBe("Ya se emitió el «Reporte F3». Mientras exista no se puede volver a una versión anterior de un resultado.");
    expect(msg(res(409, "version_no_restaurable"))).toBe("Esa versión es demasiado grande para guardarse completa; no se puede restaurar.");
    expect(msg(res(409, "sin_cambios"))).toBe(TEXTOS_VOLVER.sinCambios);
  });
  it("el bloqueo no usa siglas (H-V50)", () => {
    expect(TEXTOS_VOLVER.bloqueado).not.toMatch(/\b(HEI|DIE)\b/);
  });
  it("un 409 con OTRO código es un fallo real con la consecuencia de la acción", () => {
    expect(msg(res(409, "otra_cosa"))).toContain("No se pudo registrar la vuelta a la versión anterior.");
    expect(msg(res(409, "otra_cosa"))).toContain("El resultado sigue como estaba.");
  });
});

describe("volver_a_version: historial_no_confirmado (decide el CÓDIGO, no el status)", () => {
  it("409 (colisión): vuelve a intentarlo", () => {
    expect(msg(res(409, "historial_no_confirmado"))).toBe("No se pudo CONFIRMAR el registro del historial. El resultado sigue como estaba; vuelve a intentarlo.");
  });
  it("500 (inconsistencia): no insistas", () => {
    expect(msg(res(500, "historial_no_confirmado"))).toBe("No se pudo CONFIRMAR el registro del historial. El resultado sigue como estaba. Si vuelve a pasar, no insistas: hay que revisarlo.");
  });
});

describe("volver_a_version: familia (i) de decidirReemplazoAnalisis (por el código `error`)", () => {
  const d = (r: RespuestaGuardado) => decidirReemplazoAnalisis(r, {}, "volver_a_version");
  it("los tres 409 abren/actualizan el modal; el status solo no decide", () => {
    expect(d(res(409, "reemplazo_requiere_confirmacion")).tipo).toBe("requiere_confirmacion");
    expect(d(res(409, "reemplazo_bloqueado", "m")).tipo).toBe("bloqueado");
    expect(d(res(409, "reemplazo_huella_vencida")).tipo).toBe("huella_vencida");
  });
  it("el 409 de colisión del historial NO se confunde con la pregunta: es un error con su texto", () => {
    const r = d(res(409, "historial_no_confirmado"));
    expect(r.tipo).toBe("error");
  });
  it("éxito y otros errores; no revierte ninguna aprobación (no hay aprobación optimista)", () => {
    expect(d(res(200)).tipo).toBe("exito");
    const e = d(res(404)) as { tipo: string; revertirAprobacion?: boolean };
    expect(e.tipo).toBe("error");
    expect(e.revertirAprobacion).toBeUndefined();
  });
});
