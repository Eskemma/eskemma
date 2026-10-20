// M1 de F2 (commit 3a): las 5 acciones nuevas de guardadoHonesto. Todas son «API nueva»; las que
// comparten la regla de la serie la comprueban de nuevo (nunca afirma lo que el servidor no
// confirmó: 404/400 no afirman existencia, solo 401/403 afirman el estado previo, la red y los
// 5xx son ambiguos «No se pudo CONFIRMAR…»).

import { describe, expect, it } from "vitest";
import {
  ACCIONES_SIMPLES,
  GRUPO_ACCION,
  decidirReemplazoAnalisis,
  decidirResultadoGuardado,
  type AccionGuardado,
  type ContextoGuardado,
  type RespuestaGuardado,
} from "./guardadoHonesto";

const r = (status: number, codigo?: string, motor?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: status < 400, status, codigo, motor });
const ok200: RespuestaGuardado = { tipo: "respuesta", ok: true, status: 200, cuerpoValido: true };
const ok200Invalido: RespuestaGuardado = { tipo: "respuesta", ok: true, status: 200, cuerpoValido: false };
const red: RespuestaGuardado = { tipo: "error_red" };
const msg = (a: AccionGuardado, resp: RespuestaGuardado, ctx: ContextoGuardado = {}) => {
  const d = decidirResultadoGuardado(a, resp, ctx);
  expect(d.exito).toBe(false);
  expect(d.marcarGuardado).toBe(false);
  return d.mensajeError as string;
};

describe("catálogo: grupo de cada acción de M1", () => {
  it("3 simples (una escritura con sus propios 409) y 2 clásicas (familia de la confirmación H15)", () => {
    expect(GRUPO_ACCION.guardar_edicion_m1).toBe("simple");
    expect(GRUPO_ACCION.aprobar_m1).toBe("simple");
    expect(GRUPO_ACCION.generar_motores).toBe("simple");
    expect(GRUPO_ACCION.reabrir_m1).toBe("clasica");
    expect(GRUPO_ACCION.generar_m1).toBe("clasica");
    expect(ACCIONES_SIMPLES.slice(-3)).toEqual(["guardar_edicion_m1", "aprobar_m1", "generar_motores"]);
  });
  it("el catálogo pasó de 32 a 37 acciones", () => {
    expect(Object.keys(GRUPO_ACCION)).toHaveLength(37);
  });
});

describe("guardar_edicion_m1 — guardar la edición de una dimensión", () => {
  const ctx = { dimension: "Político" };
  it("solo con 200 y cuerpo válido dice «guardado» (marcarGuardado); un 200 sin cuerpo válido NO", () => {
    expect(decidirResultadoGuardado("guardar_edicion_m1", ok200, ctx)).toMatchObject({ exito: true, marcarGuardado: true, mensajeError: null });
    const inv = msg("guardar_edicion_m1", ok200Invalido, ctx);
    expect(inv).toContain("No se pudo CONFIRMAR tu edición de «Político»");
    expect(inv).not.toMatch(/no se guardó/i);
  });
  it("401/403: afirma el estado previo (sin guardar) y el permiso", () => {
    for (const s of [401, 403]) {
      const m = msg("guardar_edicion_m1", r(s), ctx);
      expect(m).toContain(s === 401 ? "Tu sesión no es válida o expiró" : "No tienes permiso para editar este análisis"); // paso 4: 401 = sesión
      expect(m).toContain("Tu texto sigue en pantalla, sin guardar");
    }
  });
  it("404 (incluidos dimension_no_encontrada y m1_no_encontrado): no afirma que algo exista ni que se guardó", () => {
    for (const c of [undefined, "dimension_no_encontrada", "m1_no_encontrado", "Proyecto no encontrado"]) {
      const m = msg("guardar_edicion_m1", r(404, c), ctx);
      expect(m).toContain("No se encontró el análisis o la categoría; puede que haya cambiado");
      expect(m).not.toMatch(/sigue vinculad|sigue en tu lista/i);
    }
  });
  it("409 con cada código real de m1-edit", () => {
    expect(msg("guardar_edicion_m1", r(409, "m1_aprobado"))).toContain("ya está aprobado y bloqueado; no se guardó tu edición. Para modificarlo usa «Editar narrativas»");
    expect(msg("guardar_edicion_m1", r(409, "m1_cambio"))).toContain("cambió en otra pestaña o sesión; no se guardó la edición");
    expect(msg("guardar_edicion_m1", r(409, "m1_no_editable_centinela"))).toContain("viene de Centinela y no se edita desde aquí");
    expect(msg("guardar_edicion_m1", r(409, "fase_cerrada"))).toContain("Fase 2 ya está cerrada");
  });
  it("400 de validación", () => {
    expect(msg("guardar_edicion_m1", r(400, "texto_invalido"))).toContain("no puede estar vacío ni pasar de 10 000 caracteres");
    expect(msg("guardar_edicion_m1", r(400, "clasificacion_invalida"))).toContain("clasificación elegida no es válida");
  });
  it("red, 500 sin código, 502/504 y reemplazo_escritura_incierta: ambiguos, nunca «no se guardó»", () => {
    const casos: RespuestaGuardado[] = [red, r(500), r(502), r(504), r(500, "reemplazo_escritura_incierta")];
    for (const c of casos) {
      const m = msg("guardar_edicion_m1", c, ctx);
      expect(m).toContain("No se pudo CONFIRMAR");
      expect(m).toContain("Puede que sí se haya guardado");
      expect(m).not.toMatch(/no se guardó/i);
    }
  });
  it("sin dimensión en el contexto usa un sujeto genérico", () => {
    expect(msg("guardar_edicion_m1", red)).toContain("tu edición de la categoría");
  });
});

describe("aprobar_m1 — aprobar el análisis", () => {
  it("«Aprobado» solo con 200 y cuerpo válido (yaAprobado también es 200: el estado final es el pedido)", () => {
    expect(decidirResultadoGuardado("aprobar_m1", ok200)).toMatchObject({ exito: true, marcarGuardado: true });
    expect(msg("aprobar_m1", ok200Invalido)).toContain("No se pudo CONFIRMAR la aprobación del análisis");
  });
  it("401/403 afirman que sigue sin aprobar; 404 no afirma existencia", () => {
    expect(msg("aprobar_m1", r(403))).toContain("No tienes permiso para aprobar este análisis");
    expect(msg("aprobar_m1", r(403))).toContain("El análisis sigue sin aprobar");
    const n = msg("aprobar_m1", r(404, "m1_no_encontrado"));
    expect(n).toContain("puede que ya no exista o no tengas acceso");
    expect(n).not.toContain("sigue sin aprobar");
  });
  it("409 m1_cambio y fase_cerrada", () => {
    expect(msg("aprobar_m1", r(409, "m1_cambio"))).toContain("no se aprobó nada. Recarga la página, revísalo y apruébalo de nuevo");
    expect(msg("aprobar_m1", r(409, "fase_cerrada"))).toContain("Fase 2 ya está cerrada; no se aprobó nada");
  });
  it("red y 5xx: ambiguos («Puede que sí se haya aprobado»)", () => {
    for (const c of [red, r(500), r(503), r(504)]) {
      const m = msg("aprobar_m1", c);
      expect(m).toContain("No se pudo CONFIRMAR la aprobación del análisis");
      expect(m).toContain("Puede que sí se haya aprobado");
    }
  });
});

describe("generar_motores — la generación de M2–M5 es un paso aparte", () => {
  it("éxito solo con el cuerpo del análisis; sin él, nunca afirma que se generaron", () => {
    expect(decidirResultadoGuardado("generar_motores", ok200).exito).toBe(true);
    const m = msg("generar_motores", ok200Invalido);
    expect(m).toContain("No se pudo CONFIRMAR");
    expect(m).not.toMatch(/no se generaron|ya se generaron/i);
  });
  it("500 que nombra el motor: falló ANTES de escribir → «Tu análisis sigue aprobado; M2–M5 no se generaron. Reintentar generación.»", () => {
    expect(msg("generar_motores", r(500, "Error en M4", "M4"))).toBe("No se pudo generar M4. Tu análisis sigue aprobado; M2–M5 no se generaron. Reintentar generación.");
    expect(msg("generar_motores", r(500, undefined, "M3"))).toBe("No se pudo generar M3. Tu análisis sigue aprobado; M2–M5 no se generaron. Reintentar generación.");
    expect(msg("generar_motores", r(500, undefined, "M2/M3"))).toContain("No se pudo generar M2 o M3.");
    expect(msg("generar_motores", r(500, undefined, "legacy"))).toContain("No se pudo generar los motores.");
  });
  it("5xx sin motor, 504 y red: ambiguos — puede que sí se hayan generado; no afirma que no", () => {
    for (const c of [red, r(500), r(502), r(504), r(500, "reemplazo_escritura_incierta")]) {
      const m = msg("generar_motores", c);
      expect(m).toContain("No se pudo CONFIRMAR");
      expect(m).toContain("Puede que sí se haya generado");
      expect(m).toContain("tu análisis sigue aprobado");
      expect(m).not.toMatch(/no se generaron/i);
    }
  });
  it("409 m1_no_aprobado y fase_cerrada; 401/403; 404 sin afirmar existencia", () => {
    expect(msg("generar_motores", r(409, "m1_no_aprobado"))).toContain("ya no está aprobado; no se generaron los motores. Apruébalo de nuevo");
    expect(msg("generar_motores", r(409, "fase_cerrada"))).toContain("no se generaron los motores");
    expect(msg("generar_motores", r(403))).toContain("No tienes permiso para generar los motores");
    expect(msg("generar_motores", r(404))).not.toMatch(/no se generaron/i);
  });
  it("ningún fallo, de ninguna clase, afirma que los motores YA se generaron", () => {
    const todos: RespuestaGuardado[] = [red, ok200Invalido, r(400), r(401), r(403), r(404), r(409), r(500), r(500, "x", "M5"), r(504)];
    for (const c of todos) expect(msg("generar_motores", c)).not.toMatch(/ya se generaron|se generaron correctamente|se generó correctamente/i);
  });
});

describe("reabrir_m1 y generar_m1 — familia de la confirmación (decidirReemplazoAnalisis)", () => {
  for (const accion of ["reabrir_m1", "generar_m1"] as const) {
    describe(accion, () => {
      it("los 3 409 de H15 abren el modal y NO son errores; sin revertir aprobaciones", () => {
        expect(decidirReemplazoAnalisis(r(409, "reemplazo_requiere_confirmacion"), {}, accion)).toEqual({ tipo: "requiere_confirmacion" });
        expect(decidirReemplazoAnalisis(r(409, "reemplazo_huella_vencida"), {}, accion)).toEqual({ tipo: "huella_vencida" });
        expect(decidirReemplazoAnalisis(r(409, "reemplazo_bloqueado"), {}, accion)).toEqual({ tipo: "bloqueado" });
      });
      it("200 con cuerpo válido: éxito", () => {
        expect(decidirReemplazoAnalisis(ok200, { confirmado: true }, accion)).toEqual({ tipo: "exito" });
      });
      it("sin confirmación, la red no deja dudas: no se cambió nada porque aún no habías confirmado", () => {
        const d = decidirReemplazoAnalisis(red, { confirmado: false }, accion);
        expect(d.tipo).toBe("error");
        expect((d as { mensajeError: string }).mensajeError).toMatch(/aún no habías confirmado/);
        expect((d as { mensajeError: string }).mensajeError).toMatch(/No se (reabrió|reemplazó) nada/);
      });
      it("con confirmación (o donde no se pide), la red y los 5xx son ambiguos: «No se pudo CONFIRMAR…»", () => {
        for (const ctx of [{ confirmado: true }, {}]) {
          // EDITADA a propósito (diagnóstico de generate-m1-express): un 500 SIN código ya no dice
          // «Puede que sí se haya reemplazado» para generar_m1; ese caso lo cubre guardadoHonesto.m1Codigos.test.ts.
          const bare500 = accion === "generar_m1" ? [] : [r(500)];
          for (const c of [red, ...bare500, r(502), r(504), r(500, "reemplazo_escritura_incierta"), ok200Invalido]) {
            const d = decidirReemplazoAnalisis(c, ctx, accion) as { tipo: string; mensajeError: string };
            expect(d.tipo).toBe("error");
            expect(d.mensajeError).toContain("No se pudo CONFIRMAR");
            expect(d.mensajeError).toMatch(/Puede que sí se haya (reabierto|reemplazado)/);
          }
        }
      });
      it("sin confirmar, un 5xx tampoco afirma que cambió algo", () => {
        const d = decidirReemplazoAnalisis(r(500), { confirmado: false }, accion) as { mensajeError: string };
        expect(d.mensajeError).toMatch(/aún no habías confirmado/);
        expect(d.mensajeError).not.toMatch(/Puede que sí/);
      });
      it("fase_cerrada; 404 no afirma existencia; 401/403 afirman el estado previo", () => {
        const f = decidirReemplazoAnalisis(r(409, "fase_cerrada"), { confirmado: true }, accion) as { mensajeError: string };
        // EDITADA a propósito (opción A): generar_m1 usa el texto nuevo de «cerrada = solo lectura»; reabrir_m1 conserva el suyo.
        expect(f.mensajeError).toContain(accion === "reabrir_m1" ? "Fase 2 ya está cerrada" : "La Fase 2 está cerrada: no se puede reemplazar el análisis. No se guardó nada.");
        const n = decidirReemplazoAnalisis(r(404, "m1_no_encontrado"), {}, accion) as { mensajeError: string };
        expect(n.mensajeError).toContain("puede que ya no exista o no tengas acceso");
        expect(n.mensajeError).not.toMatch(/se conserva|sigue aprobado/);
        const p = decidirReemplazoAnalisis(r(403), {}, accion) as { mensajeError: string };
        expect(p.mensajeError).toContain("No tienes permiso");
        expect(p.mensajeError).toMatch(accion === "reabrir_m1" ? /El análisis sigue aprobado/ : /Tu análisis actual se conserva/);
      });
    });
  }

  it("reabrir_m1: m1_no_aprobado no afirma quién lo reabrió", () => {
    const d = decidirReemplazoAnalisis(r(409, "m1_no_aprobado"), { confirmado: true }, "reabrir_m1") as { mensajeError: string };
    expect(d.mensajeError).toContain("ya no está aprobado (puede que ya se haya reabierto); no se reabrió nada");
  });
  it("generar_m1: pestel_linked y el error de parseo de Claude (fallo ANTES de escribir)", () => {
    // EDITADA a propósito: el tipo de falla ya no se deduce del prefijo «Error al parsear» sino del
    // `codigo` propio (ver guardadoHonesto.m1Codigos.test.ts); con solo ese texto el cliente no atribuye causa.
    const l = decidirReemplazoAnalisis(r(409, "pestel_linked"), {}, "generar_m1") as { mensajeError: string };
    expect(l.mensajeError).toContain("Centinela vinculado; desvincúlalo antes de generar uno nuevo con Moddulo. No se generó nada");
    const p = decidirReemplazoAnalisis(r(500, "Error al parsear la respuesta del modelo"), { confirmado: true }, "generar_m1") as { mensajeError: string };
    expect(p.mensajeError).toContain("El servidor no pudo completar el análisis");
    expect(p.mensajeError).not.toContain("no fue válida");
  });
  it("no revierte ninguna aprobación optimista (estas acciones no tienen)", () => {
    const d = decidirReemplazoAnalisis(r(500), { confirmado: true }, "reabrir_m1") as unknown as Record<string, unknown>;
    expect(d.revertirAprobacion).toBeUndefined();
  });
});
