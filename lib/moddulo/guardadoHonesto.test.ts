import { describe, expect, it } from "vitest";
import {
  ACCIONES_F3,
  ACCIONES_NO_BLOQUEANTES,
  ACCIONES_SIMPLES,
  GRUPO_ACCION,
  AVISOS_CIERRE,
  decidirCierreDeFase,
  decidirReemplazoAnalisis,
  decidirResultadoGeneracionF2,
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
  const ctx = { lista: "tus proyectos", plural: true };
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
      expect(d.mensajeError).toContain("No se pudieron cargar tus proyectos");
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

describe("concordancia del mensaje de lista", () => {
  it("singular: «No se pudo cargar la papelera»", () => {
    expect(decidirEstadoLista(red, 0, { lista: "la papelera" }).mensajeError).toContain(
      "No se pudo cargar la papelera"
    );
  });
  it("plural: «No se pudieron cargar tus sesiones»", () => {
    expect(
      decidirEstadoLista(fallo(500), 0, { lista: "tus sesiones", plural: true }).mensajeError
    ).toContain("No se pudieron cargar tus sesiones");
  });
});

describe("actualizar_proyecto (hub de PESTEL: estado, nombre y color)", () => {
  const ctx = { cambio: "el cambio de estado del proyecto" };
  // Comportamiento anterior: try/catch vacío que llamaba onStatusChanged /
  // onUpdated y cerraba el editor aunque el PATCH fallara (o ni se revisara).
  const antes = (_r: RespuestaGuardado) => ({ llamaCallback: true, cierraEditor: true });
  const despues = (r: RespuestaGuardado) => {
    const d = decidirResultadoGuardado("actualizar_proyecto", r, ctx);
    return { llamaCallback: d.exito, cierraEditor: d.exito };
  };

  it("200 → éxito: llama al callback y cierra el editor", () => {
    expect(despues(ok)).toEqual({ llamaCallback: true, cierraEditor: true });
    expect(decidirResultadoGuardado("actualizar_proyecto", ok, ctx).mensajeError).toBeNull();
  });

  it.each([["400", fallo(400)], ["401", fallo(401)], ["403", fallo(403)], ["404", fallo(404)], ["500", fallo(500)], ["red", red]] as [string, RespuestaGuardado][])(
    "%s → no llama al callback, no cierra el editor, hay mensaje; el comportamiento anterior diverge",
    (_n, r) => {
      const d = decidirResultadoGuardado("actualizar_proyecto", r, ctx);
      expect(d.exito).toBe(false);
      expect(d.bloqueante).toBe(true);
      expect(d.revertirAprobacion).toBe(false);
      expect(d.marcarGuardado).toBe(false);
      expect(d.mensajeError).toContain("el cambio de estado del proyecto");
      expect(despues(r)).toEqual({ llamaCallback: false, cierraEditor: false });
      expect(antes(r)).not.toEqual(despues(r));
    }
  );

  it("error de red: dice «no se pudo CONFIRMAR» y sugiere recargar; nunca «no se registró»", () => {
    const m = decidirResultadoGuardado("actualizar_proyecto", red, ctx).mensajeError!;
    expect(m).toContain("No se pudo CONFIRMAR");
    expect(m).toContain("recarga");
    expect(m).not.toContain("No se pudo registrar");
  });

  it("respuesta con status: «No se pudo registrar» y conserva el valor anterior", () => {
    const m = decidirResultadoGuardado("actualizar_proyecto", fallo(500), ctx).mensajeError!;
    expect(m).toContain("No se pudo registrar");
    expect(m).toContain("Se conserva el valor anterior");
  });
});

describe("importar_adjuntos_moddulo (PESTEL datos — aviso no bloqueante)", () => {
  it.each([["400", fallo(400)], ["403", fallo(403)], ["404", fallo(404)], ["500", fallo(500)], ["red", red]] as [string, RespuestaGuardado][])(
    "%s → aviso no bloqueante con mensaje",
    (_n, r) => {
      const d = decidirResultadoGuardado("importar_adjuntos_moddulo", r);
      expect(d.exito).toBe(false);
      expect(d.bloqueante).toBe(false);
      expect(d.continuar).toBe(true);
      expect(d.mensajeError).toBeTruthy();
    }
  );
  it("200 → sin mensaje", () => {
    expect(decidirResultadoGuardado("importar_adjuntos_moddulo", ok).mensajeError).toBeNull();
  });
  it("red: «no se pudo CONFIRMAR»; con status: «No se pudieron importar» (concordancia)", () => {
    expect(decidirResultadoGuardado("importar_adjuntos_moddulo", red).mensajeError).toContain("No se pudo CONFIRMAR");
    expect(decidirResultadoGuardado("importar_adjuntos_moddulo", fallo(500)).mensajeError).toContain("No se pudieron importar");
  });
  it("el comportamiento anterior (.catch vacío) no producía ningún mensaje", () => {
    for (const r of [fallo(500), red]) {
      expect(decidirResultadoGuardado("importar_adjuntos_moddulo", r).mensajeError).not.toBeNull();
    }
  });
});

describe("eliminar_proyecto (hub de PESTEL)", () => {
  // Comportamiento anterior: el `finally` cerraba el modal siempre, no había
  // mensaje, y un fallo de red lanzaba un rechazo no capturado.
  const antes = (r: RespuestaGuardado) => ({
    cierraModal: true,
    mensaje: null as string | null,
    quitaDeLista: r.tipo === "respuesta" && r.ok,
  });
  const despues = (r: RespuestaGuardado) => {
    const d = decidirResultadoGuardado("eliminar_proyecto", r);
    return { cierraModal: d.exito, mensaje: d.mensajeError, quitaDeLista: d.exito };
  };

  it("200 → quita de la lista y cierra el modal, sin mensaje", () => {
    expect(despues(ok)).toEqual({ cierraModal: true, mensaje: null, quitaDeLista: true });
  });

  it.each([["400", fallo(400)], ["401", fallo(401)], ["403", fallo(403)], ["404", fallo(404)], ["500", fallo(500)], ["red", red]] as [string, RespuestaGuardado][])(
    "%s → el modal queda abierto con mensaje y no se quita de la lista; el comportamiento anterior diverge",
    (_n, r) => {
      const d = despues(r);
      expect(d.cierraModal).toBe(false);
      expect(d.quitaDeLista).toBe(false);
      expect(d.mensaje).toBeTruthy();
      expect(antes(r).cierraModal).toBe(true);
      expect(antes(r).mensaje).toBeNull();
      expect(antes(r)).not.toEqual(d);
    }
  );

  it("red: «No se pudo CONFIRMAR…», sugiere recargar, no afirma que no se registró", () => {
    const m = despues(red).mensaje!;
    expect(m).toContain("No se pudo CONFIRMAR la eliminación del proyecto");
    expect(m).toContain("recarga");
    expect(m).not.toContain("No se pudo registrar");
  });

  it("404: puede que ya se haya eliminado; NO dice que el proyecto sigue en la lista", () => {
    const m = despues(fallo(404)).mensaje!;
    expect(m).toBe("No se encontró el proyecto; puede que ya se haya eliminado. Recarga la lista para verificar.");
    expect(m).not.toContain("sigue en tu lista");
  });

  it.each([["400", fallo(400)], ["403", fallo(403)], ["500", fallo(500)]] as [string, RespuestaGuardado][])(
    "%s: «No se pudo registrar…» y el proyecto sigue en la lista",
    (_n, r) => {
      const m = despues(r).mensaje!;
      expect(m).toContain("No se pudo registrar la eliminación del proyecto");
      expect(m).toContain("El proyecto sigue en tu lista");
    }
  );

  it("el 404 solo es especial para eliminar_proyecto (actualizar_proyecto conserva su texto)", () => {
    const m = decidirResultadoGuardado("actualizar_proyecto", fallo(404), { cambio: "x" }).mensajeError!;
    expect(m).toContain("El proyecto ya no existe o no tienes acceso");
    expect(m).not.toContain("puede que ya se haya eliminado");
  });
});

// ── commit 2: reemplazar_analisis (M8) y generar_analisis (#8) ───────────────

const con409 = (codigo: string): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status: 409, codigo });
const conCodigo = (status: number, codigo?: string, motor?: string): RespuestaGuardado => ({
  tipo: "respuesta", ok: false, status, codigo, motor,
});
const okConDvs: RespuestaGuardado = { tipo: "respuesta", ok: true, status: 200, cuerpoValido: true };

describe("decidirReemplazoAnalisis — tres 409 que NO son fallos, y fallos reales", () => {
  it("200 con dvs → éxito", () => {
    expect(decidirReemplazoAnalisis(okConDvs, { confirmado: true })).toEqual({ tipo: "exito" });
  });
  it("200 sin dvs en el cuerpo → error (nunca éxito)", () => {
    const d = decidirReemplazoAnalisis({ tipo: "respuesta", ok: true, status: 200, cuerpoValido: false }, { confirmado: true });
    expect(d.tipo).toBe("error");
  });
  it("los tres 409 se distinguen entre sí y de un fallo", () => {
    expect(decidirReemplazoAnalisis(con409("reemplazo_requiere_confirmacion"))).toEqual({ tipo: "requiere_confirmacion" });
    expect(decidirReemplazoAnalisis(con409("reemplazo_bloqueado"))).toEqual({ tipo: "bloqueado" });
    expect(decidirReemplazoAnalisis(con409("reemplazo_huella_vencida"))).toEqual({ tipo: "huella_vencida" });
  });
  it("un 409 con otro código es un fallo real, no una confirmación", () => {
    expect(decidirReemplazoAnalisis(con409("otra_cosa")).tipo).toBe("error");
    expect(decidirReemplazoAnalisis({ tipo: "respuesta", ok: false, status: 409 }).tipo).toBe("error");
  });
  it("red con confirmación → «No se pudo CONFIRMAR…», nunca «no se registró»", () => {
    const d = decidirReemplazoAnalisis(red, { confirmado: true });
    expect(d.tipo).toBe("error");
    const m = (d as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo CONFIRMAR el reemplazo del análisis finalizado");
    expect(m).toContain("Puede que sí se haya reemplazado");
    expect(m).not.toContain("No se pudo registrar");
  });
  it("red en la verificación inicial (sin confirmar) → no se reemplazó nada, y es verdad por construcción", () => {
    const m = (decidirReemplazoAnalisis(red, { confirmado: false }) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo verificar el impacto del reemplazo");
    expect(m).toContain("No se reemplazó nada, porque aún no habías confirmado");
  });
  it.each([502, 503, 504])("%s con confirmación es ambiguo (el servidor pudo escribir)", (status) => {
    const m = (decidirReemplazoAnalisis(conCodigo(status), { confirmado: true }) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo CONFIRMAR el reemplazo");
    expect(m).not.toContain("sigue vigente");
  });
  it("el código «escritura incierta» del servidor también es ambiguo", () => {
    const m = (decidirReemplazoAnalisis(conCodigo(500, "reemplazo_escritura_incierta"), { confirmado: true }) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo CONFIRMAR el reemplazo");
  });
  it("500 de un motor (Claude falló antes de escribir) → «sigue vigente» y nombra el motor", () => {
    const m = (decidirReemplazoAnalisis(conCodigo(500, undefined, "M5"), { confirmado: true }) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo registrar el reemplazo del análisis finalizado (falló M5)");
    expect(m).toContain("El análisis anterior sigue vigente; inténtalo de nuevo.");
  });
  it.each([401, 403, 404])("%s → error con «sigue vigente»", (status) => {
    const m = (decidirReemplazoAnalisis(conCodigo(status), { confirmado: true }) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo registrar el reemplazo");
    expect(m).toContain("sigue vigente");
  });
  it("negativo — el handler anterior trataba todo como éxito o texto genérico, sin distinguir los 409", () => {
    const antes = (_r: RespuestaGuardado) => ({ abreModal: false, mensaje: "No se pudo regenerar el reporte. Intenta de nuevo." });
    for (const r of [con409("reemplazo_requiere_confirmacion"), con409("reemplazo_bloqueado"), con409("reemplazo_huella_vencida")]) {
      expect(antes(r).abreModal).toBe(false);
      expect(["requiere_confirmacion", "bloqueado", "huella_vencida"]).toContain(decidirReemplazoAnalisis(r).tipo);
    }
    expect((decidirReemplazoAnalisis(red, { confirmado: true }) as { mensajeError: string }).mensajeError).not.toBe(antes(red).mensaje);
  });
});

describe("decidirResultadoGeneracionF2 — camino #8", () => {
  // Comportamiento anterior: ejecutaba checkBackPropagation, setMode("completed") y
  // setShowReporte(true) aunque generate-dvs fallara.
  const antes = () => ({ propagar: true, pasarACompleted: true, abrirReporte: true });

  it("éxito → propaga, pasa a completed y abre el reporte", () => {
    expect(decidirResultadoGeneracionF2(okConDvs)).toEqual({
      exito: true, mensajeError: null, propagar: true, pasarACompleted: true, abrirReporte: true,
    });
  });
  it.each([
    ["400", fallo(400)], ["403", fallo(403)], ["500", conCodigo(500, undefined, "M5")], ["red", red],
    ["409 (pantalla desactualizada)", con409("reemplazo_requiere_confirmacion")],
    ["200 sin dvs", { tipo: "respuesta", ok: true, status: 200, cuerpoValido: false } as RespuestaGuardado],
  ] as [string, RespuestaGuardado][])("%s → no propaga, no pasa a completed, no abre el reporte, y hay mensaje; el comportamiento anterior diverge", (_n, r) => {
    const d = decidirResultadoGeneracionF2(r);
    expect(d).toMatchObject({ exito: false, propagar: false, pasarACompleted: false, abrirReporte: false });
    expect(d.mensajeError).toBeTruthy();
    expect(antes()).not.toEqual({ propagar: d.propagar, pasarACompleted: d.pasarACompleted, abrirReporte: d.abrirReporte });
  });
  it("409: dice que la pantalla está desactualizada y que no se reemplazó nada; no ofrece confirmar", () => {
    const m = decidirResultadoGeneracionF2(con409("reemplazo_huella_vencida")).mensajeError!;
    expect(m).toContain("esta pantalla está desactualizada");
    expect(m).toContain("Los cambios del formulario sí se guardaron. No se reemplazó nada");
    expect(m).toContain("recarga la página");
  });
  it("500 de la ruta legacy (motor «legacy»): «sigue vigente» en reemplazar_analisis y «formulario guardado» en generar_analisis", () => {
    const r = conCodigo(500, undefined, "legacy");
    const a = (decidirReemplazoAnalisis(r, { confirmado: true }) as { mensajeError: string }).mensajeError;
    expect(a).toContain("No se pudo registrar el reemplazo del análisis finalizado (falló legacy)");
    expect(a).toContain("El análisis anterior sigue vigente");
    expect(a).not.toContain("CONFIRMAR");
    const g = decidirResultadoGeneracionF2(r).mensajeError!;
    expect(g).toContain("No se pudo registrar la generación del análisis (falló legacy)");
    expect(g).toContain("Los cambios del formulario sí se guardaron");
    expect(g).not.toContain("CONFIRMAR");
  });
  it("red: «No se pudo CONFIRMAR…» y aclara que los cambios del formulario sí se guardaron", () => {
    const m = decidirResultadoGeneracionF2(red).mensajeError!;
    expect(m).toContain("No se pudo CONFIRMAR la generación del análisis");
    expect(m).toContain("Los cambios del formulario sí se guardaron");
    expect(m).not.toContain("No se pudo registrar");
  });
  it("500 con motor: «No se pudo registrar la generación del análisis (falló M5)» + formulario guardado", () => {
    const m = decidirResultadoGeneracionF2(conCodigo(500, undefined, "M5")).mensajeError!;
    expect(m).toContain("No se pudo registrar la generación del análisis (falló M5)");
    expect(m).toContain("Los cambios del formulario sí se guardaron; vuelve a intentarlo.");
  });
});

// ── commit 3: «Guardar cambios» (guardar_analisis) y «Finalizar análisis» sobre un dvs ya finalizado ──

const TRES_409 = ["reemplazo_requiere_confirmacion", "reemplazo_bloqueado", "reemplazo_huella_vencida"] as const;
const TIPO_409 = { reemplazo_requiere_confirmacion: "requiere_confirmacion", reemplazo_bloqueado: "bloqueado", reemplazo_huella_vencida: "huella_vencida" } as const;

describe("guardar_analisis — «Guardar cambios» de un análisis finalizado", () => {
  it.each(TRES_409)("%s se distingue de un fallo y NO lleva reversión de aprobación", (codigo) => {
    const d = decidirReemplazoAnalisis(con409(codigo), { confirmado: false }, "guardar_analisis");
    expect(d.tipo).toBe(TIPO_409[codigo]);
    expect(d).toEqual({ tipo: TIPO_409[codigo] });
  });
  it("200 con dvs → éxito; 200 sin dvs → error", () => {
    expect(decidirReemplazoAnalisis(okConDvs, {}, "guardar_analisis")).toEqual({ tipo: "exito" });
    expect(decidirReemplazoAnalisis({ tipo: "respuesta", ok: true, status: 200, cuerpoValido: false }, {}, "guardar_analisis").tipo).toBe("error");
  });
  it.each([false, true])("red (confirmado=%s) → SIEMPRE «No se pudo CONFIRMAR…»: sin confirmación el servidor también puede haber escrito", (confirmado) => {
    const m = (decidirReemplazoAnalisis(red, { confirmado }, "guardar_analisis") as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo CONFIRMAR el guardado de los cambios del análisis");
    expect(m).toContain("Puede que sí se hayan guardado");
    expect(m).toContain("tus cambios siguen en pantalla");
    expect(m).not.toContain("No se guardó nada");
  });
  it.each([502, 503, 504])("%s y el código «escritura incierta» → ambiguo, sin «sigue vigente»", (status) => {
    for (const codigo of [undefined, "reemplazo_escritura_incierta"]) {
      const m = (decidirReemplazoAnalisis(conCodigo(status, codigo), { confirmado: false }, "guardar_analisis") as { mensajeError: string }).mensajeError;
      expect(m).toContain("No se pudo CONFIRMAR el guardado");
      expect(m).not.toContain("sigue vigente");
    }
    const inc = (decidirReemplazoAnalisis(conCodigo(500, "reemplazo_escritura_incierta"), {}, "guardar_analisis") as { mensajeError: string }).mensajeError;
    expect(inc).toContain("No se pudo CONFIRMAR el guardado");
  });
  it("F — 500 de antes de la transacción: «sigue vigente», «tus cambios siguen en pantalla» y se queda en edición", () => {
    const m = (decidirReemplazoAnalisis(conCodigo(500, "finalize_fallo_previo"), { confirmado: false }, "guardar_analisis") as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo registrar el guardado de los cambios del análisis");
    expect(m).toContain("Sigues en modo edición y tus cambios siguen en pantalla");
    expect(m).toContain("el análisis anterior sigue vigente");
    expect(m).not.toContain("CONFIRMAR");
  });
  it.each([401, 403, 404])("%s → error con «Sigues en modo edición»", (status) => {
    const m = (decidirReemplazoAnalisis(conCodigo(status), {}, "guardar_analisis") as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo registrar el guardado");
    expect(m).toContain("Sigues en modo edición");
  });
  it("negativo — el handler anterior respondía lo mismo ante cualquier fallo (texto genérico, ninguna distinción de 409)", () => {
    const antes = (_r: RespuestaGuardado) => ({ abreModal: false, mensaje: "No se pudo guardar los cambios. Sigues en modo edición, tus cambios no se han perdido: intenta guardar de nuevo." });
    for (const c of TRES_409) {
      expect(antes(con409(c)).abreModal).toBe(false);
      expect(decidirReemplazoAnalisis(con409(c), {}, "guardar_analisis").tipo).not.toBe("error");
    }
    expect((decidirReemplazoAnalisis(red, {}, "guardar_analisis") as { mensajeError: string }).mensajeError).not.toBe(antes(red).mensaje);
  });
});

describe("finalizar_analisis sobre un análisis ya finalizado (A) — reversión de la aprobación de M5", () => {
  it.each(TRES_409)("A — %s: la aprobación vuelve a su valor previo (Cancelar deja la pantalla como antes del clic)", (codigo) => {
    for (const aprobadoPrevio of [false, true]) {
      const d = decidirReemplazoAnalisis(con409(codigo), { aprobadoPrevio, confirmado: false }, "finalizar_analisis");
      expect(d.tipo).toBe(TIPO_409[codigo]);
      expect(d).toMatchObject({ revertirAprobacion: true, valorRestaurado: aprobadoPrevio });
    }
  });
  it("A — sin valor previo conocido restaura «no aprobado»", () => {
    expect(decidirReemplazoAnalisis(con409("reemplazo_requiere_confirmacion"), {}, "finalizar_analisis")).toMatchObject({
      revertirAprobacion: true, valorRestaurado: false,
    });
  });
  it("A — un fallo real (500, red) también revierte, igual que antes", () => {
    for (const r of [conCodigo(500), red]) {
      expect(decidirReemplazoAnalisis(r, { aprobadoPrevio: false }, "finalizar_analisis")).toMatchObject({ tipo: "error", revertirAprobacion: true, valorRestaurado: false });
    }
  });
  it("A — el éxito no revierte nada", () => {
    expect(decidirReemplazoAnalisis(okConDvs, { aprobadoPrevio: false }, "finalizar_analisis")).toEqual({ tipo: "exito" });
  });
  it("F — el error previo a la transacción NO dice «tus cambios siguen en pantalla» (no hay cambios del usuario que conservar)", () => {
    const m = (decidirReemplazoAnalisis(conCodigo(500, "finalize_fallo_previo"), {}, "finalizar_analisis") as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo registrar la finalización del análisis");
    expect(m).toContain("El análisis no se finalizó; inténtalo de nuevo.");
    expect(m).not.toContain("cambios siguen en pantalla");
    expect(m).not.toContain("CONFIRMAR");
  });
  it("500 incierto o 502/503/504 al finalizar → «No se pudo CONFIRMAR la finalización»", () => {
    for (const r of [conCodigo(502), conCodigo(504), conCodigo(500, "reemplazo_escritura_incierta")]) {
      const m = (decidirReemplazoAnalisis(r, {}, "finalizar_analisis") as { mensajeError: string }).mensajeError;
      expect(m).toContain("No se pudo CONFIRMAR la finalización del análisis");
      expect(m).toContain("recarga la página");
    }
  });
  it("los otros dos usos de decidirReemplazoAnalisis no llevan campos de reversión (regresión de commit 2)", () => {
    expect(decidirReemplazoAnalisis(con409("reemplazo_bloqueado"))).toEqual({ tipo: "bloqueado" });
    expect(decidirReemplazoAnalisis(con409("reemplazo_huella_vencida"), {}, "reemplazar_analisis")).toEqual({ tipo: "huella_vencida" });
  });
});

// ── commit 4 (H-M3): generar_sintesis / generar_veredicto / generar_tablero / sincronizar_tablero ──

import { decidirGeneracionF3UI } from "./guardadoHonesto";

const conMensaje = (status: number, codigo: string, mensaje?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status, codigo, mensaje });
const ACCIONES_GEN = ["generar_sintesis", "generar_veredicto"] as const;
const ACCIONES_TAB = ["generar_tablero", "sincronizar_tablero"] as const;

describe("decidirGeneracionF3UI", () => {
  it("200 → éxito", () => {
    for (const a of [...ACCIONES_GEN, ...ACCIONES_TAB]) expect(decidirGeneracionF3UI(a, ok)).toEqual({ tipo: "exito" });
  });
  it("409 «ya existe»: pantalla desactualizada, nada generado, recarga — sin ofrecer confirmar", () => {
    const s = decidirGeneracionF3UI("generar_sintesis", con409("f3_ya_existe"));
    expect(s).toEqual({
      tipo: "ya_existe",
      mensajeError: "Esta pantalla está desactualizada: la síntesis ya existe. No se generó nada; recarga la página.",
    });
    const v = decidirGeneracionF3UI("generar_veredicto", con409("f3_ya_existe"));
    expect(v).toEqual({
      tipo: "ya_existe",
      mensajeError: "Esta pantalla está desactualizada: el veredicto ya existe. No se generó nada; recarga la página.",
    });
  });
  it("409 bloqueado usa el motivo del servidor; sin él, el de la acción; nunca «DIE»", () => {
    const conSrv = decidirGeneracionF3UI("generar_sintesis", conMensaje(409, "reemplazo_bloqueado", "MOTIVO DEL SERVIDOR"));
    expect(conSrv).toEqual({ tipo: "bloqueado", mensajeError: "MOTIVO DEL SERVIDOR" });
    for (const [a, frase] of [
      ["generar_sintesis", "Generar la síntesis de nuevo"], ["generar_veredicto", "Generar el veredicto de nuevo"],
      ["generar_tablero", "Generar el tablero de nuevo"], ["sincronizar_tablero", "Sincronizar el tablero"],
    ] as const) {
      const d = decidirGeneracionF3UI(a, con409("reemplazo_bloqueado")) as { tipo: string; mensajeError: string };
      expect(d.tipo).toBe("bloqueado");
      expect(d.mensajeError).toContain(frase);
      expect(d.mensajeError).not.toMatch(/\bDIE\b/);
    }
  });
  it("un 409 con otro código (o «ya existe» en el tablero) es un fallo real, no un caso especial", () => {
    expect(decidirGeneracionF3UI("generar_sintesis", con409("otra_cosa")).tipo).toBe("error");
    expect(decidirGeneracionF3UI("generar_tablero", con409("f3_ya_existe")).tipo).toBe("error");
  });
  it.each([...ACCIONES_GEN, ...ACCIONES_TAB])("%s — red: SIEMPRE «No se pudo CONFIRMAR…», nunca «no se registró»", (a) => {
    const m = (decidirGeneracionF3UI(a, red) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo CONFIRMAR");
    expect(m).toContain("Puede que sí se haya");
    expect(m).not.toContain("No se pudo registrar");
  });
  it.each([...ACCIONES_GEN, ...ACCIONES_TAB])("%s — 502/503/504 y «escritura incierta» → ambiguo", (a) => {
    for (const r of [conCodigo(502), conCodigo(503), conCodigo(504), conCodigo(500, "reemplazo_escritura_incierta")]) {
      const m = (decidirGeneracionF3UI(a, r) as { mensajeError: string }).mensajeError;
      expect(m).toContain("No se pudo CONFIRMAR");
      expect(m).not.toContain("sigue como estaba");
    }
  });
  it.each([...ACCIONES_GEN, ...ACCIONES_TAB])("%s — 500 que nombra el motor (falló antes de escribir) → «sigue como estaba»", (a) => {
    const m = (decidirGeneracionF3UI(a, conCodigo(500, undefined, "M3")) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo registrar");
    expect(m).toContain("(falló M3)");
    expect(m).toContain("No se guardó nada; la Fase 3 sigue como estaba. Inténtalo de nuevo.");
    expect(m).not.toContain("CONFIRMAR");
  });
  it.each([...ACCIONES_GEN, ...ACCIONES_TAB])("%s — 500 sin motor ni código (pudo escribir) → ambiguo", (a) => {
    const m = (decidirGeneracionF3UI(a, fallo(500)) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo CONFIRMAR");
  });
  it.each([401, 403, 404])("%s → «No se pudo registrar» con la consecuencia", (status) => {
    const m = (decidirGeneracionF3UI("generar_sintesis", fallo(status)) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo registrar la generación de la síntesis");
    expect(m).toContain("la Fase 3 sigue como estaba");
  });
  it("negativo — el handler anterior ignoraba todo lo que no fuera 200 (sin mensaje alguno)", () => {
    const antes = (r: RespuestaGuardado) => (r.tipo === "respuesta" && r.ok ? "exito" : "silencio");
    for (const r of [con409("f3_ya_existe"), con409("reemplazo_bloqueado"), conCodigo(500, undefined, "M3"), red]) {
      expect(antes(r)).toBe("silencio");
      expect(decidirGeneracionF3UI("generar_sintesis", r).tipo).not.toBe("exito");
      expect((decidirGeneracionF3UI("generar_sintesis", r) as { mensajeError: string }).mensajeError).toBeTruthy();
    }
  });
});

// ── commit 5a (H25 #6): aprobar_veredicto ────────────────────────────────────

describe("decidirGeneracionF3UI — aprobar_veredicto", () => {
  const aprobar = (r: RespuestaGuardado) => decidirGeneracionF3UI("aprobar_veredicto", r);
  const okConDie: RespuestaGuardado = { tipo: "respuesta", ok: true, status: 200, cuerpoValido: true };
  it("200 con die → éxito", () => expect(aprobar(okConDie)).toEqual({ tipo: "exito" }));
  it("2 — 200 SIN die: ambiguo («No se pudo CONFIRMAR…»), nunca «no se registró»", () => {
    const m = (aprobar({ tipo: "respuesta", ok: true, status: 200, cuerpoValido: false }) as { tipo: string; mensajeError: string });
    expect(m.tipo).toBe("error");
    expect(m.mensajeError).toContain("No se pudo CONFIRMAR la aprobación del veredicto");
    expect(m.mensajeError).toContain("Puede que sí se haya aprobado");
    expect(m.mensajeError).not.toContain("No se pudo registrar");
    expect(m.mensajeError).not.toContain("No se aprobó nada");
  });
  it("409 f3_ya_aprobado: pantalla desactualizada, sin afirmar que NO lo aprobaste tú", () => {
    expect(aprobar(con409("f3_ya_aprobado"))).toEqual({
      tipo: "desactualizado",
      mensajeError: "Esta pantalla está desactualizada: el veredicto ya fue aprobado. No se aprobó nada de nuevo; recarga la página.",
    });
  });
  it("409 f3_estado_cambio: el veredicto cambió, no se aprobó nada", () => {
    expect(aprobar(con409("f3_estado_cambio"))).toEqual({
      tipo: "desactualizado",
      mensajeError: "El veredicto cambió desde que lo viste. No se aprobó nada; recarga la página y revísalo.",
    });
  });
  it("un 409 con otro código es un fallo real", () => {
    expect(aprobar(con409("otra_cosa")).tipo).toBe("error");
  });
  it("3 — red, 502/503/504, 500 sin código y «escritura incierta» son AMBIGUOS siempre", () => {
    for (const r of [red, conCodigo(502), conCodigo(503), conCodigo(504), fallo(500), conCodigo(500, "reemplazo_escritura_incierta")]) {
      const m = (aprobar(r) as { mensajeError: string }).mensajeError;
      expect(m).toContain("No se pudo CONFIRMAR la aprobación del veredicto");
      expect(m).toContain("Puede que sí se haya aprobado");
      expect(m).not.toContain("sigue como estaba");
    }
  });
  it.each([400, 401, 403, 404])("%s → solo un 4xx puede afirmar «la Fase 3 sigue como estaba»", (status) => {
    const m = (aprobar(fallo(status)) as { mensajeError: string }).mensajeError;
    expect(m).toContain("No se pudo registrar la aprobación del veredicto");
    expect(m).toContain("No se aprobó nada; la Fase 3 sigue como estaba. Inténtalo de nuevo.");
    expect(m).not.toContain("CONFIRMAR");
  });
  it("negativo — el handler anterior no distinguía nada: silencio ante todo lo que no fuera 200 y una excepción ante un 200 sin die", () => {
    const antes = (r: RespuestaGuardado) => (r.tipo === "respuesta" && r.ok ? "lee d.die" : "silencio");
    for (const r of [con409("f3_ya_aprobado"), con409("f3_estado_cambio"), fallo(500), red]) {
      expect(antes(r)).toBe("silencio");
      expect((aprobar(r) as { mensajeError: string }).mensajeError).toBeTruthy();
    }
  });
});

// ── Commit 5b (H25): revisar territorio, eliminar exploración, eliminar tarjeta, aceptar RDA ──
describe("decidirResultadoGuardado — acciones del commit 5b", () => {
  const conCodigo5b = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status, codigo });
  const msg = (a: AccionGuardado, r: RespuestaGuardado, ctx = {}) => {
    const d = decidirResultadoGuardado(a, r, ctx);
    expect(d.exito).toBe(false);
    expect(d.bloqueante).toBe(true);
    return d.mensajeError as string;
  };
  const casos: Array<{ accion: AccionGuardado; hecho: string; verificar: string; ctx?: object; que: string }> = [
    { accion: "revisar_territorio_fuente", hecho: "registrado", verificar: "vuelve a pulsar «Revisar» para repetirla.", que: "la revisión del territorio de la fuente" },
    { accion: "eliminar_sesion", hecho: "eliminado", verificar: "recarga la lista para verificar.", que: "la eliminación de la exploración" },
    { accion: "eliminar_tarjeta_canvas", hecho: "eliminado", verificar: "recarga el Canvas para verificar.", que: "la eliminación de la tarjeta" },
    { accion: "aceptar_condicion_rda", hecho: "aceptado", verificar: "recarga la página para verificar.", ctx: { nombre: "Variable X" }, que: "la aceptación de «Variable X» como condición" },
  ];

  describe.each(casos)("$accion", ({ accion, hecho, verificar, ctx, que }) => {
    it("éxito: 200 → exito, sin mensaje", () => {
      expect(decidirResultadoGuardado(accion, ok, ctx)).toMatchObject({ exito: true, mensajeError: null });
    });
    it("un 200 con cuerpo inválido es AMBIGUO (el servidor pudo escribir)", () => {
      const m = msg(accion, { tipo: "respuesta", ok: true, status: 200, cuerpoValido: false }, ctx);
      expect(m).toContain(`No se pudo CONFIRMAR ${que}`);
      expect(m).toContain(`Puede que sí se haya ${hecho}; ${verificar}`);
    });
    it("red, 500 sin código, 502/503/504 y «escritura incierta» son AMBIGUOS siempre", () => {
      for (const r of [red, fallo(500), fallo(502), fallo(503), fallo(504), conCodigo5b(500, "reemplazo_escritura_incierta")]) {
        const m = msg(accion, r, ctx);
        expect(m).toContain(`No se pudo CONFIRMAR ${que}`);
        expect(m).toContain(`Puede que sí se haya ${hecho}; ${verificar}`);
        expect(m).not.toContain("sigue");
      }
    });
    it("un 404 NO afirma que el objeto sigue ahí (H22: tras una red ambigua suele ser que ya se hizo)", () => {
      const m = msg(accion, fallo(404), ctx);
      expect(m).not.toMatch(/sigue (en tu|activo|como estaba)/);
      expect(m).not.toContain("CONFIRMAR");
      expect(m).toMatch(/Recarga/);
    });
    it("401 y 403: solo un 4xx puede afirmar que el estado anterior se conserva", () => {
      for (const status of [401, 403]) {
        const m = msg(accion, fallo(status), ctx);
        expect(m).toContain(`No se pudo registrar ${que}`);
        expect(m).toMatch(/sigue (como estaba|en tu|activo)|sigue como estaba/);
        expect(m).not.toContain("CONFIRMAR");
      }
    });
  });

  it("revisar territorio: 404 → fuente no encontrada; 400 → no es de Canal 3", () => {
    expect(msg("revisar_territorio_fuente", fallo(404))).toBe(
      "No se encontró la fuente; puede que ya no esté vinculada. Recarga la página para verificar."
    );
    // The route puts its text in `error`: only the real "not Canal 3" 400 gets that message.
    expect(msg("revisar_territorio_fuente", conCodigo5b(400, "Este resultado no es de Canal 3 — no aplica"))).toBe(
      "Esta fuente no es de Canal 3: no aplica la revisión de territorio."
    );
    expect(msg("revisar_territorio_fuente", conCodigo5b(400, "projectId y resultadoId son requeridos"))).toContain(
      "No se pudo registrar la revisión del territorio de la fuente."
    );
  });
  it("revisar territorio: un 401 conserva el veredicto anterior", () => {
    expect(msg("revisar_territorio_fuente", fallo(401))).toContain("Tu veredicto de territorio anterior sigue como estaba; inténtalo de nuevo.");
  });
  it("eliminar exploración: 404 nunca dice «sigue en tu lista»; 409 sesion_vinculada tiene su texto", () => {
    expect(msg("eliminar_sesion", fallo(404))).toBe(
      "No se encontró la exploración; puede que ya se haya eliminado. Recarga la lista para verificar."
    );
    expect(msg("eliminar_sesion", conCodigo5b(409, "sesion_vinculada"))).toBe(
      "Esta exploración ya está vinculada a un proyecto de Moddulo y no se puede eliminar desde aquí. Recarga la lista."
    );
    expect(msg("eliminar_sesion", fallo(403))).toContain("La exploración sigue en tu lista; inténtalo de nuevo.");
  });
  it("eliminar tarjeta: 404 → «puede que ya se haya eliminado»; 403 → «sigue en tu Canvas»", () => {
    expect(msg("eliminar_tarjeta_canvas", fallo(404))).toBe(
      "No se encontró la tarjeta; puede que ya se haya eliminado. Recarga el Canvas para verificar."
    );
    expect(msg("eliminar_tarjeta_canvas", fallo(403))).toContain("La tarjeta sigue en tu Canvas; inténtalo de nuevo.");
  });
  it("RDA: item_no_activo dice «puede que ya se haya aceptado» (no «sigue activo»); 403 sí conserva «sigue activo»", () => {
    const m = msg("aceptar_condicion_rda", conCodigo5b(400, "item_no_activo"), { nombre: "Variable X" });
    expect(m).toBe("Este ítem ya no está activo; puede que ya se haya aceptado. Recarga la página para verificar.");
    expect(msg("aceptar_condicion_rda", fallo(403), { nombre: "Variable X" })).toContain("El ítem sigue activo; inténtalo de nuevo.");
  });
  it("RDA sin nombre: usa «este ítem»", () => {
    expect(msg("aceptar_condicion_rda", red)).toContain("la aceptación de este ítem como condición");
  });

  it("negativo — los handlers anteriores cerraban el modal siempre o callaban: ningún fallo se distinguía de un éxito", () => {
    // Antes: el modal se cerraba en `finally` (tarjeta, RDA) o quedaba sin mensaje (exploración,
    // revisar territorio), salvo un 200 que sí avisaba al padre. Es decir, todo fallo se veía igual.
    const antes = (r: RespuestaGuardado) => (r.tipo === "respuesta" && r.ok ? "éxito" : "se cierra o calla");
    for (const a of ["revisar_territorio_fuente", "eliminar_sesion", "eliminar_tarjeta_canvas", "aceptar_condicion_rda"] as AccionGuardado[]) {
      for (const r of [red, fallo(404), fallo(409), fallo(500), fallo(504)]) {
        expect(antes(r)).toBe("se cierra o calla");
        const d = decidirResultadoGuardado(a, r);
        expect(d.exito).toBe(false);
        expect(d.mensajeError).toBeTruthy();
      }
    }
  });
});

// ── 6a (H25): catálogo único de acciones — no-regresión de la infraestructura ──
describe("catálogo de acciones (6a): la infraestructura derivada no cambia la pertenencia de ningún grupo", () => {
  // Snapshot LITERAL de los tres arrays tal como eran antes de derivarlos del catálogo
  // (ACCIONES_5B se llama ahora ACCIONES_SIMPLES).
  it("ACCIONES_F3 es exactamente la lista anterior", () => {
    expect([...ACCIONES_F3]).toEqual([
      "generar_sintesis",
      "generar_veredicto",
      "generar_tablero",
      "sincronizar_tablero",
      "aprobar_veredicto",
    ]);
  });
  it("ACCIONES_SIMPLES: las 4 de 5b y las 5 de 6b en el mismo orden, seguidas de las 7 de 6c", () => {
    expect([...ACCIONES_SIMPLES]).toEqual([
      "revisar_territorio_fuente",
      "eliminar_sesion",
      "eliminar_tarjeta_canvas",
      "aceptar_condicion_rda",
      // 6b
      "eliminar_cadena_impacto",
      "eliminar_reporte_sesion",
      "desvincular_sesion",
      "cambiar_monitoreo_automatico",
      "desvincular_pestel",
      // 6c
      "agregar_cadena_impacto",
      "marcar_alerta_leida",
      "aprobar_resultado",
      "cambiar_asignacion",
      "reconocer_sesgo",
      "editar_exploracion",
      "archivar_exploracion",
    ]);
  });
  it("ACCIONES_NO_BLOQUEANTES es exactamente la lista anterior", () => {
    expect([...ACCIONES_NO_BLOQUEANTES]).toEqual(["registrar_aprobacion", "importar_adjuntos_moddulo"]);
  });

  it("el catálogo clasifica TODAS las acciones (32), sin duplicar grupos ni dejar ninguna fuera", () => {
    const todas = Object.keys(GRUPO_ACCION).sort();
    expect(todas).toEqual(
      [
        "aprobar_motor", "guardar_borrador", "finalizar_analisis", "cerrar_fase", "registrar_aprobacion",
        "actualizar_proyecto", "eliminar_proyecto", "importar_adjuntos_moddulo", "reemplazar_analisis",
        "generar_analisis", "guardar_analisis", "generar_sintesis", "generar_veredicto", "generar_tablero",
        "sincronizar_tablero", "aprobar_veredicto", "revisar_territorio_fuente", "eliminar_sesion",
        "eliminar_tarjeta_canvas", "aceptar_condicion_rda",
        "eliminar_cadena_impacto", "eliminar_reporte_sesion", "desvincular_sesion",
        "cambiar_monitoreo_automatico", "desvincular_pestel",
        "agregar_cadena_impacto", "marcar_alerta_leida", "aprobar_resultado", "cambiar_asignacion",
        "reconocer_sesgo", "editar_exploracion", "archivar_exploracion",
      ].sort()
    );
    const clasicas = todas.filter((a) => GRUPO_ACCION[a as keyof typeof GRUPO_ACCION] === "clasica");
    expect(clasicas.length + ACCIONES_F3.length + ACCIONES_SIMPLES.length).toBe(todas.length);
  });

  it("toda acción del catálogo produce un mensaje de fallo no vacío y respeta bloqueante / no bloqueante", () => {
    const fallo403: RespuestaGuardado = { tipo: "respuesta", ok: false, status: 403 };
    for (const a of Object.keys(GRUPO_ACCION) as AccionGuardado[]) {
      const d = decidirResultadoGuardado(a, fallo403, { motor: "M2", fase: "Fase 1", cambio: "el cambio", nombre: "X" });
      expect(d.exito).toBe(false);
      expect((d.mensajeError ?? "").length).toBeGreaterThan(10);
      expect(d.bloqueante).toBe(!(ACCIONES_NO_BLOQUEANTES as readonly string[]).includes(a));
      // Ambiguo siempre ante la red: nunca «no se registró» sin confirmar (salvo las 2 no bloqueantes con texto propio).
      const red = decidirResultadoGuardado(a, { tipo: "error_red" }, { motor: "M2", fase: "Fase 1", cambio: "el cambio", nombre: "X" });
      expect(red.exito).toBe(false);
      expect((red.mensajeError ?? "").length).toBeGreaterThan(10);
    }
  });
});

// ── Commit 6b (H25): cadenas de impacto, reporte de sesión, desvincular exploración,
//    monitoreo automático y desvincular PESTEL ──
describe("decidirResultadoGuardado — acciones del commit 6b", () => {
  const conCodigo6b = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status, codigo });
  const msg = (a: AccionGuardado, r: RespuestaGuardado, ctx = {}) => {
    const d = decidirResultadoGuardado(a, r, ctx);
    expect(d.exito).toBe(false);
    expect(d.bloqueante).toBe(true);
    return d.mensajeError as string;
  };
  const casos: Array<{ accion: AccionGuardado; que: string; hecho: string; verificar: string; ctx?: object; permiso: string; sigue: string }> = [
    {
      accion: "eliminar_cadena_impacto", que: "la eliminación de la cadena de impacto", hecho: "eliminado",
      verificar: "revisa la lista antes de volver a intentarlo.", permiso: "No tienes permiso para eliminarla.",
      sigue: "La cadena sigue en la lista.",
    },
    {
      accion: "eliminar_reporte_sesion", que: "la eliminación del reporte", hecho: "eliminado",
      verificar: "recarga la página para verificar.", permiso: "No tienes permiso para eliminar este reporte.",
      sigue: "El reporte sigue en tu exploración; inténtalo de nuevo.",
    },
    {
      accion: "desvincular_sesion", que: "la desvinculación de la exploración", hecho: "desvinculado",
      verificar: "recarga la lista para verificar.", permiso: "No tienes permiso para desvincular esta exploración.",
      sigue: "La exploración sigue vinculada; inténtalo de nuevo.",
    },
    {
      accion: "cambiar_monitoreo_automatico", que: "la activación del monitoreo automático", hecho: "registrado",
      verificar: "recarga la página para verificar el estado.", permiso: "No tienes permiso para cambiar este ajuste.",
      sigue: "El monitoreo automático queda como estaba; inténtalo de nuevo.",
      ctx: { cambio: "la activación del monitoreo automático" },
    },
    {
      accion: "desvincular_pestel", que: "la desvinculación del análisis de Centinela PESTEL", hecho: "desvinculado",
      verificar: "recarga la página para verificar.", permiso: "No tienes permiso para desvincular este proyecto.",
      sigue: "El proyecto sigue vinculado; inténtalo de nuevo.",
    },
  ];

  describe.each(casos)("$accion", ({ accion, que, hecho, verificar, ctx, permiso, sigue }) => {
    it("éxito: 200 → exito, sin mensaje", () => {
      expect(decidirResultadoGuardado(accion, ok, ctx)).toMatchObject({ exito: true, mensajeError: null });
    });
    it("un 200 con cuerpo inválido es AMBIGUO (el servidor pudo escribir)", () => {
      const m = msg(accion, { tipo: "respuesta", ok: true, status: 200, cuerpoValido: false }, ctx);
      expect(m).toContain(`No se pudo CONFIRMAR ${que}`);
      expect(m).toContain(`Puede que sí se haya ${hecho}; ${verificar}`);
    });
    it("red, 500 sin código, 502/503/504 y «escritura incierta» son AMBIGUOS siempre", () => {
      for (const r of [red, fallo(500), fallo(502), fallo(503), fallo(504), conCodigo6b(500, "reemplazo_escritura_incierta")]) {
        const m = msg(accion, r, ctx);
        expect(m).toContain(`No se pudo CONFIRMAR ${que}`);
        expect(m).toContain(`Puede que sí se haya ${hecho}; ${verificar}`);
        expect(m).not.toMatch(/sigue (en la lista|en tu|vinculad|como estaba)|queda como estaba/);
      }
    });
    it("un 404 NO afirma que el objeto sigue ahí (H22)", () => {
      const m = msg(accion, fallo(404), ctx);
      expect(m).not.toContain("CONFIRMAR");
      expect(m).not.toMatch(/sigue (en la lista|en tu|vinculad)|queda como estaba/);
      expect(m).toMatch(/Recarga|se actualizó/);
    });
    it("401 y 403: solo un 4xx afirma que el estado anterior se conserva, con el texto de permiso propio", () => {
      for (const status of [401, 403]) {
        const m = msg(accion, fallo(status), ctx);
        expect(m).toContain(`No se pudo registrar ${que}`);
        expect(m).toContain(permiso);
        expect(m).toContain(sigue);
        expect(m).not.toContain("CONFIRMAR");
        expect(m).not.toContain("en este proyecto");
      }
    });
  });

  it("textos propios por acción", () => {
    expect(msg("eliminar_cadena_impacto", fallo(404))).toBe("No se encontró la cadena; puede que ya se haya eliminado. La lista se actualizó.");
    expect(msg("eliminar_reporte_sesion", fallo(404))).toBe(
      "No se encontró la exploración; puede que ya se haya eliminado el reporte. Recarga la página para verificar."
    );
    expect(msg("desvincular_sesion", fallo(404))).toBe("No se encontró la exploración; puede que ya no exista. Recarga la lista para verificar.");
    expect(msg("desvincular_sesion", conCodigo6b(400, "sesion_no_vinculada"))).toBe(
      "Esta exploración ya no está vinculada a ningún proyecto; puede que ya se haya desvinculado. Recarga la lista para verificar."
    );
    expect(msg("desvincular_sesion", conCodigo6b(409, "escenario_a_no_desvinculable"))).toBe(
      "Esta exploración nace de una tarea del PIP de un proyecto y no se puede desvincular desde aquí. Recarga la lista."
    );
    expect(msg("cambiar_monitoreo_automatico", fallo(404))).toBe(
      "No se encontró el proyecto; puede que ya no exista o no tengas acceso. Recarga la página para verificar."
    );
    expect(msg("desvincular_pestel", conCodigo6b(400, "not_linked"))).toBe(
      "Este proyecto ya no está vinculado a ningún análisis de Centinela PESTEL; puede que ya se haya desvinculado. Recarga la página para verificar."
    );
  });
  it("un 400 o 409 con otro código es un fallo real, no el texto propio", () => {
    expect(msg("desvincular_sesion", conCodigo6b(400, "otra_cosa"))).toContain("No se pudo registrar la desvinculación de la exploración.");
    expect(msg("desvincular_pestel", conCodigo6b(400, "otra_cosa"))).toContain("No se pudo registrar la desvinculación del análisis");
  });
  it("monitoreo: el texto sigue a la acción (activar / desactivar)", () => {
    expect(msg("cambiar_monitoreo_automatico", red, { cambio: "la desactivación del monitoreo automático" })).toContain(
      "No se pudo CONFIRMAR la desactivación del monitoreo automático"
    );
  });

  it("negativo (local, sin DOM) — los handlers anteriores ignoraban el resultado o lo trataban como éxito", () => {
    // Antes: DELETE de cadena sin leer la respuesta; eliminar reporte cerraba el modal en `finally`;
    // desvincular y el toggle solo actuaban con `ok` y callaban el resto; desvincular PESTEL cerraba
    // la confirmación ANTES de pedir. Es decir: ningún fallo se distinguía de un éxito.
    const antes = (r: RespuestaGuardado) => (r.tipo === "respuesta" && r.ok ? "éxito" : "se cierra o calla");
    for (const a of ["eliminar_cadena_impacto", "eliminar_reporte_sesion", "desvincular_sesion", "cambiar_monitoreo_automatico", "desvincular_pestel"] as AccionGuardado[]) {
      for (const r of [red, fallo(404), fallo(409), fallo(500), fallo(504)]) {
        expect(antes(r)).toBe("se cierra o calla");
        const d = decidirResultadoGuardado(a, r);
        expect(d.exito).toBe(false);
        expect(d.mensajeError).toBeTruthy();
      }
    }
  });
});

// ── Commit 6c (H25): hermanos de la auditoría (cadena, alerta, resultado, asignación, sesgo,
//    editar y archivar exploración) ──
describe("decidirResultadoGuardado — acciones del commit 6c", () => {
  const conCodigo6c = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status, codigo });
  const msg = (a: AccionGuardado, r: RespuestaGuardado, ctx = {}) => {
    const d = decidirResultadoGuardado(a, r, ctx);
    expect(d.exito).toBe(false);
    expect(d.bloqueante).toBe(true);
    return d.mensajeError as string;
  };
  const casos: Array<{ accion: AccionGuardado; que: string; hecho: string; verificar: string; ctx?: object; permiso: string; sigue: string; noEncontrado: string }> = [
    {
      accion: "agregar_cadena_impacto", que: "la adición de la cadena de impacto", hecho: "agregado",
      verificar: "revisa la lista de cadenas antes de volver a intentarlo; lo que escribiste sigue en el formulario.",
      permiso: "No tienes permiso para agregar cadenas a este análisis.",
      sigue: "La cadena no se agregó; lo que escribiste sigue en el formulario.",
      noEncontrado: "No se encontró el análisis; puede que ya no exista. Recarga la página para verificar.",
    },
    {
      accion: "marcar_alerta_leida", que: "el marcado de la alerta como leída", hecho: "marcado",
      verificar: "recarga la página para verificar.", permiso: "No tienes permiso para marcar esta alerta.",
      sigue: "La alerta sigue sin leer; inténtalo de nuevo.",
      noEncontrado: "No se encontró la alerta; puede que ya no exista. Recarga la página para verificar.",
    },
    {
      accion: "aprobar_resultado", que: "la aprobación del resultado", hecho: "aprobado",
      verificar: "recarga la página para verificar el estado.", permiso: "No tienes permiso para aprobar este resultado.",
      sigue: "El resultado sigue sin aprobar; inténtalo de nuevo.",
      noEncontrado: "No se encontró el resultado o el proyecto; puede que ya no exista. Recarga la página para verificar.",
    },
    {
      accion: "cambiar_asignacion", que: "la activación de la asignación", hecho: "registrado",
      verificar: "recarga la página para verificar el estado.", ctx: { cambio: "la activación de la asignación" },
      permiso: "No tienes permiso para cambiar esta asignación.",
      sigue: "La asignación queda como estaba; inténtalo de nuevo.",
      noEncontrado: "No se encontró la asignación; puede que el tablero haya cambiado. Recarga la página para verificar.",
    },
    {
      accion: "reconocer_sesgo", que: "el reconocimiento del sesgo", hecho: "registrado",
      verificar: "recarga la página para verificar el estado.", permiso: "No tienes permiso para reconocer este sesgo.",
      sigue: "El sesgo sigue sin reconocer; inténtalo de nuevo.",
      noEncontrado: "No se encontró el análisis o la alerta de sesgo; puede que ya no exista. Recarga la página para verificar.",
    },
    {
      accion: "editar_exploracion", que: "el guardado de los cambios de la exploración", hecho: "guardado",
      verificar: "recarga la lista para verificar.", permiso: "No tienes permiso para editar esta exploración.",
      sigue: "Se conservan los datos anteriores; tus cambios siguen en el formulario. Inténtalo de nuevo.",
      noEncontrado: "No se encontró la exploración; puede que ya no exista. Recarga la lista para verificar.",
    },
    {
      accion: "archivar_exploracion", que: "el archivado de la exploración", hecho: "registrado",
      verificar: "recarga la lista para verificar.", permiso: "No tienes permiso para cambiar esta exploración.",
      sigue: "La exploración queda como estaba; inténtalo de nuevo.",
      noEncontrado: "No se encontró la exploración; puede que ya no exista. Recarga la lista para verificar.",
    },
  ];

  describe.each(casos)("$accion", ({ accion, que, hecho, verificar, ctx, permiso, sigue, noEncontrado }) => {
    it("éxito: 200 → exito, sin mensaje", () => {
      expect(decidirResultadoGuardado(accion, ok, ctx)).toMatchObject({ exito: true, mensajeError: null });
    });
    it("un 200 con cuerpo inválido es AMBIGUO (el servidor pudo escribir)", () => {
      const m = msg(accion, { tipo: "respuesta", ok: true, status: 200, cuerpoValido: false }, ctx);
      expect(m).toContain(`No se pudo CONFIRMAR ${que}`);
      expect(m).toContain(`Puede que sí se haya ${hecho}; ${verificar}`);
    });
    it("red, 500 sin código, 502/503/504 y «escritura incierta» son AMBIGUOS siempre", () => {
      for (const r of [red, fallo(500), fallo(502), fallo(503), fallo(504), conCodigo6c(500, "reemplazo_escritura_incierta")]) {
        const m = msg(accion, r, ctx);
        expect(m).toContain(`No se pudo CONFIRMAR ${que}`);
        expect(m).toContain(`Puede que sí se haya ${hecho}; ${verificar}`);
        expect(m).not.toContain(sigue);
      }
    });
    it("un 404 no afirma el estado previo ni que el objeto sigue ahí (H22)", () => {
      const m = msg(accion, fallo(404), ctx);
      expect(m).toBe(noEncontrado);
      expect(m).not.toContain(sigue);
    });
    it("401 y 403: solo un 4xx afirma que el estado anterior se conserva, con el texto de permiso propio", () => {
      for (const status of [401, 403]) {
        const m = msg(accion, fallo(status), ctx);
        expect(m).toContain(`No se pudo registrar ${que}`);
        expect(m).toContain(permiso);
        expect(m).toContain(sigue);
        expect(m).not.toContain("CONFIRMAR");
        expect(m).not.toContain("en este proyecto");
      }
    });
  });

  it("aprobar resultado: el 404 «Asignación no encontrada» es AMBIGUO (la ruta ya escribió `aprobado`)", () => {
    const m = msg("aprobar_resultado", conCodigo6c(404, "Asignación no encontrada en el tablero"));
    expect(m).toBe(
      "No se pudo CONFIRMAR la aprobación del resultado: el servidor pudo marcarlo como aprobado, pero no encontró la asignación en el tablero. Recarga la página para verificar el estado antes de volver a intentarlo."
    );
    expect(m).not.toContain("sigue sin aprobar");
    // Los otros 404 de la ruta ocurren ANTES de escribir, pero tampoco afirman nada.
    expect(msg("aprobar_resultado", conCodigo6c(404, "Resultado no encontrado"))).not.toContain("sigue sin aprobar");
  });
  it("cambiar asignación y editar/archivar: el texto sigue a la acción", () => {
    expect(msg("cambiar_asignacion", red, { cambio: "la desactivación de la asignación" })).toContain(
      "No se pudo CONFIRMAR la desactivación de la asignación"
    );
    expect(msg("archivar_exploracion", red, { cambio: "la reactivación de la exploración" })).toContain(
      "No se pudo CONFIRMAR la reactivación de la exploración"
    );
    expect(msg("archivar_exploracion", red)).toContain("No se pudo CONFIRMAR el archivado de la exploración");
  });
  it("las entradas de 5b y 6b no cambian al evaluar `especifico` antes del 404", () => {
    expect(msg("eliminar_sesion", fallo(404))).toBe(
      "No se encontró la exploración; puede que ya se haya eliminado. Recarga la lista para verificar."
    );
    expect(msg("desvincular_pestel", conCodigo6c(400, "not_linked"))).toContain("ya no está vinculado");
    expect(msg("aceptar_condicion_rda", conCodigo6c(400, "item_no_activo"))).toContain("ya no está activo");
  });

  it("negativo (local, sin DOM) — los handlers anteriores ignoraban el resultado o lo trataban como éxito", () => {
    // Antes: el POST de cadena limpiaba y cerraba el formulario siempre; «marcar leída» marcaba en
    // pantalla sin mirar `ok`; «Aprobar» y el select de asignación refrescaban como si hubiera
    // funcionado; los dos reconocimientos de sesgo callaban o recargaban igual; patchSesion
    // devolvía `null` (texto genérico «No se pudo guardar» que afirmaba más de lo que sabía).
    const antes = (r: RespuestaGuardado) => (r.tipo === "respuesta" && r.ok ? "éxito" : "se cierra, refresca o calla");
    for (const a of ["agregar_cadena_impacto", "marcar_alerta_leida", "aprobar_resultado", "cambiar_asignacion", "reconocer_sesgo", "editar_exploracion", "archivar_exploracion"] as AccionGuardado[]) {
      for (const r of [red, fallo(404), fallo(409), fallo(500), fallo(504)]) {
        expect(antes(r)).toBe("se cierra, refresca o calla");
        const d = decidirResultadoGuardado(a, r);
        expect(d.exito).toBe(false);
        expect(d.mensajeError).toBeTruthy();
      }
    }
  });
});
