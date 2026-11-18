// C1b-1 — la pantalla distingue `historial_no_confirmado` (el registro del historial falló: NADA se guardó) del 409 de
// confirmación H15 de `m1-reopen` (`reemplazo_requiere_confirmacion`): comparten el status 409, así que se decide por el
// CÓDIGO `error` del cuerpo, nunca por el status. Funciones puras (sin DOM). Mismo patrón que `decidirRespuestaEntregaCanal1`.

import { describe, expect, it } from "vitest";
import {
  CODIGO_HISTORIAL_NO_CONFIRMADO, decidirReemplazoAnalisis, decidirResultadoGuardado, type RespuestaGuardado,
} from "./guardadoHonesto";
import { CODIGO_HISTORIAL_NO_CONFIRMADO as CODIGO_SERVIDOR } from "./versionado/respuestaHistorial";
import { CODIGO_HISTORIAL as CODIGO_ENTREGA } from "./respuestaEntregaCanal1";

const r = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: status < 400, status, codigo });

describe("el código es el mismo en servidor, pantalla de entrega y pantalla de M1", () => {
  it("una sola cadena", () => {
    expect(CODIGO_HISTORIAL_NO_CONFIRMADO).toBe(CODIGO_SERVIDOR);
    expect(CODIGO_HISTORIAL_NO_CONFIRMADO).toBe(CODIGO_ENTREGA);
  });
});

describe("reabrir_m1 — el 409 de CONFIRMACIÓN y el 409 de COLISIÓN del historial son cosas distintas", () => {
  it("409 reemplazo_requiere_confirmacion → pide confirmación (abre el modal)", () => {
    expect(decidirReemplazoAnalisis(r(409, "reemplazo_requiere_confirmacion"), { confirmado: false }, "reabrir_m1").tipo).toBe("requiere_confirmacion");
  });
  it("409 reemplazo_huella_vencida → huella vencida (reabre el modal con aviso)", () => {
    expect(decidirReemplazoAnalisis(r(409, "reemplazo_huella_vencida"), { confirmado: true }, "reabrir_m1").tipo).toBe("huella_vencida");
  });
  it("409 historial_no_confirmado (colisión) → ERROR con texto del historial; NUNCA el modal de confirmación", () => {
    const d = decidirReemplazoAnalisis(r(409, CODIGO_HISTORIAL_NO_CONFIRMADO), { confirmado: true }, "reabrir_m1");
    expect(d.tipo).toBe("error");
    if (d.tipo !== "error") throw new Error("no es error");
    expect(d.mensajeError).toBe("No se pudo CONFIRMAR el registro del historial. El análisis sigue aprobado; vuelve a intentarlo.");
  });
  it("500 historial_no_confirmado (inconsistencia) → error que pide no insistir", () => {
    const d = decidirReemplazoAnalisis(r(500, CODIGO_HISTORIAL_NO_CONFIRMADO), { confirmado: true }, "reabrir_m1");
    expect(d).toMatchObject({ tipo: "error", mensajeError: "No se pudo CONFIRMAR el registro del historial. El análisis sigue aprobado. Si vuelve a pasar, no insistas: hay que revisarlo." });
  });
  it("el mismo status 409 con OTRO código no se confunde: m1_no_aprobado sigue con su texto", () => {
    const d = decidirReemplazoAnalisis(r(409, "m1_no_aprobado"), { confirmado: true }, "reabrir_m1");
    expect(d.tipo).toBe("error");
    if (d.tipo === "error") expect(d.mensajeError).toContain("ya no está aprobado");
  });
});

describe("aprobar_m1 — historial_no_confirmado", () => {
  it("409 (colisión): el análisis sigue sin aprobar; no revierte ni marca guardado", () => {
    const d = decidirResultadoGuardado("aprobar_m1", r(409, CODIGO_HISTORIAL_NO_CONFIRMADO));
    expect(d).toMatchObject({
      exito: false, marcarGuardado: false, bloqueante: true,
      mensajeError: "No se pudo CONFIRMAR el registro del historial. El análisis sigue sin aprobar; vuelve a intentarlo.",
    });
  });
  it("500 (inconsistencia): pide no insistir", () => {
    expect(decidirResultadoGuardado("aprobar_m1", r(500, CODIGO_HISTORIAL_NO_CONFIRMADO)).mensajeError)
      .toBe("No se pudo CONFIRMAR el registro del historial. El análisis sigue sin aprobar. Si vuelve a pasar, no insistas: hay que revisarlo.");
  });
  it("el 409 m1_cambio conserva su texto (otra situación, mismo status)", () => {
    expect(decidirResultadoGuardado("aprobar_m1", r(409, "m1_cambio")).mensajeError).not.toContain("historial");
  });
  it("200 válido sigue siendo éxito", () => {
    expect(decidirResultadoGuardado("aprobar_m1", { tipo: "respuesta", ok: true, status: 200, cuerpoValido: true }).exito).toBe(true);
  });
});

describe("el código del historial NO cambia a otras acciones", () => {
  it("una acción que no es de M1 con ese código cae en su camino de siempre", () => {
    expect(decidirResultadoGuardado("guardar_edicion_m1", r(409, CODIGO_HISTORIAL_NO_CONFIRMADO)).mensajeError).not.toContain("registro del historial");
  });
});
