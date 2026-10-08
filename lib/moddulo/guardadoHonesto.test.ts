import { describe, expect, it } from "vitest";
import {
  AVISOS_CIERRE,
  decidirCierreDeFase,
  decidirEstadoLista,
  decidirResultadoGuardado,
  esRespuestaVigente,
  mensajeDeAviso,
  urlSinAviso,
  urlTrasCierre,
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
  const conRespuesta = casos.filter(([n]) => n !== "error de red");

  it.each(conRespuesta)("aprobar_motor con %s → revierte, dice que no se registró, nombra el motor", (_n, r) => {
    const d = decidirResultadoGuardado("aprobar_motor", r, { motor: "M3", aprobadoPrevio: false });
    expect(d.exito).toBe(false);
    expect(d.revertirAprobacion).toBe(true);
    expect(d.valorRestaurado).toBe(false);
    expect(d.mensajeError).toContain("No se pudo registrar");
    expect(d.mensajeError).toContain("M3");
    expect(d.mensajeError).toContain("Se revirtió");
    expect(d.marcarGuardado).toBe(false);
    expect(d.continuar).toBe(false);
    expect(d.bloqueante).toBe(true);
  });

  it.each(["aprobar_motor", "finalizar_analisis", "cerrar_fase"] as const)(
    "%s con error de red → dice que no se pudo CONFIRMAR y sugiere recargar; nunca afirma que no se registró",
    (a) => {
      const d = decidirResultadoGuardado(a, red, { motor: "M3", fase: "Fase 2", aprobadoPrevio: false });
      expect(d.exito).toBe(false);
      expect(d.mensajeError).toContain("No se pudo CONFIRMAR");
      expect(d.mensajeError).toContain("recarga la página para verificar");
      expect(d.mensajeError).not.toContain("No se pudo registrar");
      expect(d.mensajeError).not.toContain("NO se guardaron");
    }
  );

  it("guardar_borrador con error de red conserva la advertencia: guardar de nuevo ANTES de recargar", () => {
    const d = decidirResultadoGuardado("guardar_borrador", red, { motor: "M2" });
    expect(d.mensajeError).toContain("No se pudo CONFIRMAR");
    expect(d.mensajeError).toContain("vuelve a intentar guardar antes de recargar");
    expect(d.mensajeError).not.toContain("recarga la página para verificar");
    expect(d.marcarGuardado).toBe(false);
  });

  it("en modo edición (previo = true) restaura true, no false", () => {
    const d = decidirResultadoGuardado("aprobar_motor", red, { motor: "M2", aprobadoPrevio: true });
    expect(d.valorRestaurado).toBe(true);
  });

  it.each(conRespuesta)("guardar_borrador con %s → no revierte aprobación, dice que NO se guardó", (_n, r) => {
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
    expect(m(red)).toContain("sin conexión");
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

describe("decidirCierreDeFase — cierre en dos pasos", () => {
  it.each([["400", fallo(400)], ["403", fallo(403)], ["404", fallo(404)], ["500", fallo(500)], ["red", red]] as [string, RespuestaGuardado][])(
    "paso 1 falla (%s) → no navega, error bloqueante y NO hay aviso (el paso 2 no debe ejecutarse)",
    (_n, r) => {
      const d = decidirCierreDeFase(r, null, { fase: "Fase 2" });
      expect(d.navegar).toBe(false);
      expect(d.mensajeBloqueante).toContain("Fase 2");
      expect(d.avisoNoBloqueante).toBeNull();
    }
  );

  it("paso 1 falla aunque el paso 2 vinieran bien: nunca navega", () => {
    const d = decidirCierreDeFase(fallo(500), ok, { fase: "Fase 2" });
    expect(d.navegar).toBe(false);
    expect(d.avisoNoBloqueante).toBeNull();
  });

  it.each([["500", fallo(500)], ["403", fallo(403)], ["red", red]] as [string, RespuestaGuardado][])(
    "paso 1 ok y paso 2 falla (%s) → navega igual y lleva el aviso, sin error bloqueante",
    (_n, r) => {
      const d = decidirCierreDeFase(ok, r, { fase: "Fase 2" });
      expect(d.navegar).toBe(true);
      expect(d.mensajeBloqueante).toBeNull();
      expect(d.avisoNoBloqueante).toBe("aprobacion_no_registrada");
    }
  );

  it("ambos pasos bien, o F1/F3 sin paso 2 → navega sin mensajes", () => {
    for (const d of [decidirCierreDeFase(ok, ok, { fase: "Fase 2" }), decidirCierreDeFase(ok, null, { fase: "Fase 1" })]) {
      expect(d).toEqual({ navegar: true, mensajeBloqueante: null, avisoNoBloqueante: null });
    }
  });

  it("registrar_aprobacion no es bloqueante y su texto no habla de revertir", () => {
    const d = decidirResultadoGuardado("registrar_aprobacion", fallo(500), { fase: "Fase 2" });
    expect(d.bloqueante).toBe(false);
    expect(d.continuar).toBe(true);
    expect(d.mensajeError).toContain("La fase se cerró");
  });

  it("el comportamiento anterior (navegar SIEMPRE) diverge en todos los fallos del paso 1", () => {
    const fallos = [fallo(400), fallo(403), fallo(404), fallo(500), red];
    const navegaAntes = () => true; // `await fetch(...)` sin revisar → router.push
    for (const f of fallos) {
      expect(navegaAntes()).toBe(true);
      expect(decidirCierreDeFase(f, null, { fase: "Fase 1" }).navegar).toBe(false);
    }
  });
});

describe("avisos del cierre (?aviso=) — lista cerrada", () => {
  it("un código conocido produce su texto fijo", () => {
    expect(mensajeDeAviso("aprobacion_no_registrada")).toBe(AVISOS_CIERRE.aprobacion_no_registrada);
  });
  it.each(["<script>alert(1)</script>", "otro", "", "constructor", "__proto__", "toString", "hasOwnProperty", " aprobacion_no_registrada", "APROBACION_NO_REGISTRADA"])(
    "un código desconocido (%j) no produce ningún mensaje",
    (c) => expect(mensajeDeAviso(c)).toBeNull()
  );
  it("null / undefined no producen mensaje", () => {
    expect(mensajeDeAviso(null)).toBeNull();
    expect(mensajeDeAviso(undefined)).toBeNull();
  });
  it("el mensaje nunca contiene el valor recibido", () => {
    const forjado = "http://evil.example";
    expect(mensajeDeAviso(forjado)).toBeNull();
  });
  it("urlTrasCierre añade el parámetro solo con aviso", () => {
    expect(urlTrasCierre("/moddulo/proyecto/p/investigacion", null)).toBe("/moddulo/proyecto/p/investigacion");
    expect(urlTrasCierre("/moddulo/proyecto/p/investigacion", "aprobacion_no_registrada")).toBe(
      "/moddulo/proyecto/p/investigacion?aviso=aprobacion_no_registrada"
    );
  });
});

describe("urlSinAviso — quita el aviso de la URL conservando el resto", () => {
  it("quita solo aviso", () => {
    expect(urlSinAviso("/p/investigacion", "aviso=aprobacion_no_registrada")).toBe("/p/investigacion");
  });
  it("conserva otros parámetros (p. ej. fontana_sesion_id)", () => {
    expect(urlSinAviso("/p/investigacion", "fontana_sesion_id=abc&aviso=aprobacion_no_registrada")).toBe(
      "/p/investigacion?fontana_sesion_id=abc"
    );
  });
  it("sin aviso no cambia nada", () => {
    expect(urlSinAviso("/p", "x=1")).toBe("/p?x=1");
    expect(urlSinAviso("/p", "")).toBe("/p");
  });
  it("un aviso forjado también se quita (aunque no produzca mensaje)", () => {
    expect(urlSinAviso("/p", "aviso=%3Cscript%3E")).toBe("/p");
  });
});

describe("decidirEstadoLista — cargando / vacío / fallido", () => {
  const ctx = { lista: "tus proyectos" };
  it("200 con 0 elementos → vacío", () => {
    expect(decidirEstadoLista(ok, 0, ctx)).toEqual({ estado: "vacio", mensajeError: null });
  });
  it("200 con elementos → cargado", () => {
    expect(decidirEstadoLista(ok, 3, ctx)).toEqual({ estado: "cargado", mensajeError: null });
  });
  it.each([["401", fallo(401)], ["500", fallo(500)], ["red", red], ["cuerpo no-JSON", { tipo: "respuesta", ok: true, status: 200, cuerpoValido: false } as RespuestaGuardado]] as [string, RespuestaGuardado][])(
    "%s → fallido con mensaje, NUNCA vacío (aunque cantidad sea 0)",
    (_n, r) => {
      const d = decidirEstadoLista(r, 0, ctx);
      expect(d.estado).toBe("fallido");
      expect(d.mensajeError).toContain("No se pudo cargar tus proyectos");
    }
  );
  it("el comportamiento anterior (lista [] ante cualquier fallo) se leía como «vacío»", () => {
    for (const r of [fallo(500), red]) {
      const antes = ((): EstadoLista => "vacio")();
      expect(antes).toBe("vacio");
      expect(decidirEstadoLista(r, 0, ctx).estado).not.toBe("vacio");
    }
  });
});

type EstadoLista = "cargado" | "vacio" | "fallido";
