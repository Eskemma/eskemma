import { describe, expect, it } from "vitest";
import {
  decidirResultadoGuardado,
  esRespuestaVigente,
  type AccionGuardado,
  type RespuestaGuardado,
} from "./guardadoHonesto";

const ok: RespuestaGuardado = { tipo: "respuesta", ok: true, status: 200 };
const red: RespuestaGuardado = { tipo: "error_red" };
const fallo = (status: number): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status });

// Replica del comportamiento ANTERIOR de los handlers: `.catch(() => {})`, nunca
// revisa la respuesta, siempre afirma éxito y nunca revierte.
function comportamientoActual(_accion: AccionGuardado, _resp: RespuestaGuardado) {
  return { exito: true, mensajeError: null, revertirAprobacion: false, marcarGuardado: true };
}

describe("decidirResultadoGuardado — éxito", () => {
  it.each(["aprobar_motor", "guardar_borrador", "finalizar_analisis", "cerrar_fase"] as const)(
    "%s con 200 → éxito, sin mensaje, sin revertir",
    (a) => {
      const d = decidirResultadoGuardado(a, ok, { motor: "M2", aprobadoPrevio: false });
      expect(d).toMatchObject({ exito: true, mensajeError: null, revertirAprobacion: false, marcarGuardado: true, continuar: true });
    }
  );
});

describe("decidirResultadoGuardado — fallos", () => {
  const casos: [string, RespuestaGuardado][] = [
    ["400", fallo(400)], ["401", fallo(401)], ["403", fallo(403)],
    ["404", fallo(404)], ["500", fallo(500)], ["error de red", red],
  ];
  it.each(casos)("aprobar_motor con %s → revierte, mensaje con el motor, no marca guardado", (_n, r) => {
    const d = decidirResultadoGuardado("aprobar_motor", r, { motor: "M3", aprobadoPrevio: false });
    expect(d.exito).toBe(false);
    expect(d.revertirAprobacion).toBe(true);
    expect(d.valorRestaurado).toBe(false);
    expect(d.mensajeError).toContain("M3");
    expect(d.mensajeError).toContain("Se revirtió");
    expect(d.marcarGuardado).toBe(false);
    expect(d.continuar).toBe(false);
  });

  it("en modo edición (previo = true) restaura true, no false", () => {
    const d = decidirResultadoGuardado("aprobar_motor", red, { motor: "M2", aprobadoPrevio: true });
    expect(d.valorRestaurado).toBe(true);
  });

  it.each(casos)("guardar_borrador con %s → no revierte aprobación, dice que NO se guardó", (_n, r) => {
    const d = decidirResultadoGuardado("guardar_borrador", r, { motor: "M2" });
    expect(d.exito).toBe(false);
    expect(d.revertirAprobacion).toBe(false);
    expect(d.mensajeError).toContain("NO se guardaron");
    expect(d.marcarGuardado).toBe(false);
  });

  it("ok con cuerpo no-JSON o sin dvs (finalizar_analisis) → error y revierte", () => {
    const d = decidirResultadoGuardado(
      "finalizar_analisis",
      { tipo: "respuesta", ok: true, status: 200, cuerpoValido: false },
      { motor: "M5", aprobadoPrevio: false }
    );
    expect(d.exito).toBe(false);
    expect(d.revertirAprobacion).toBe(true);
    expect(d.mensajeError).toContain("no se finalizó");
  });

  it("mensajes distintos por causa (permiso / no existe / sin conexión)", () => {
    const m = (r: RespuestaGuardado) => decidirResultadoGuardado("aprobar_motor", r, { motor: "M2" }).mensajeError;
    expect(m(fallo(403))).toContain("permiso");
    expect(m(fallo(404))).toContain("ya no existe");
    expect(m(red)).toContain("Sin conexión");
  });

  it("cerrar_fase: fallo → no continuar, nombra la fase, no revierte aprobaciones", () => {
    const d = decidirResultadoGuardado("cerrar_fase", fallo(500), { fase: "Fase 2" });
    expect(d.continuar).toBe(false);
    expect(d.revertirAprobacion).toBe(false);
    expect(d.mensajeError).toContain("Fase 2");
    expect(d.mensajeError).toContain("sigue abierta");
  });
});

describe("el comportamiento anterior afirmaba éxito en TODOS los fallos (prueba en negativo)", () => {
  const acciones: AccionGuardado[] = ["aprobar_motor", "guardar_borrador", "finalizar_analisis", "cerrar_fase"];
  const fallos = [fallo(400), fallo(403), fallo(404), fallo(500), red];
  it("el código anterior diverge de la decisión correcta en cada combinación acción × fallo", () => {
    let divergencias = 0;
    for (const a of acciones) for (const f of fallos) {
      const antes = comportamientoActual(a, f);
      const ahora = decidirResultadoGuardado(a, f, { motor: "M2", fase: "Fase 1" });
      if (antes.exito !== ahora.exito) divergencias++;
      expect(antes.marcarGuardado).toBe(true);   // lo que NO debe pasar
      expect(ahora.marcarGuardado).toBe(false);
    }
    expect(divergencias).toBe(acciones.length * fallos.length);
  });
});

describe("esRespuestaVigente — orden de respuestas", () => {
  it("solo la última petición actualiza la pantalla", () => {
    // petición 1 lenta (falla) y petición 2 posterior (éxito): seq actual = 2
    expect(esRespuestaVigente(1, 2)).toBe(false); // el fallo viejo se ignora
    expect(esRespuestaVigente(2, 2)).toBe(true);
  });
  it("un éxito viejo tampoco esconde un fallo más nuevo", () => {
    expect(esRespuestaVigente(1, 2)).toBe(false);
  });
});
