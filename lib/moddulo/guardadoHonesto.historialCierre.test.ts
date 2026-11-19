// C1b-3b — el cierre de fase (F1, F2 y F3) muestra el texto de `historial_no_confirmado` decidido por el CÓDIGO `error`
// del cuerpo (nunca por el status: el 409 de colisión comparte status con los 409 de compuerta de F2). Solo cambia ESE
// caso: los fallos que NO son del historial (401, 403, 404, 409 sin código, 500 genérico, red, 409 de compuerta) se ven
// EXACTAMENTE igual que antes (literales capturados del código de 0084b73). Pruebas puras: sin DOM.
import { describe, expect, it } from "vitest";
import { decidirCierreDeFase, decidirResultadoGuardado, type RespuestaGuardado } from "./guardadoHonesto";

const resp = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status, ...(codigo ? { codigo } : {}) });
const cierre = (r: RespuestaGuardado, fase = "Fase 1") => decidirCierreDeFase(r, null, { fase });

describe("cerrar_fase — historial_no_confirmado", () => {
  it("409 (colisión): «La fase sigue abierta; vuelve a intentarlo.» y NO navega (el modal / el aviso se queda)", () => {
    const d = cierre(resp(409, "historial_no_confirmado"));
    expect(d.navegar).toBe(false);
    expect(d.mensajeBloqueante).toBe("No se pudo CONFIRMAR el registro del historial. La fase sigue abierta; vuelve a intentarlo.");
  });
  it("500 (inconsistencia): «…no insistas: hay que revisarlo.» y NO navega", () => {
    const d = cierre(resp(500, "historial_no_confirmado"));
    expect(d.navegar).toBe(false);
    expect(d.mensajeBloqueante).toBe("No se pudo CONFIRMAR el registro del historial. La fase sigue abierta. Si vuelve a pasar, no insistas: hay que revisarlo.");
  });
  it("lo decide el CÓDIGO: el mismo 409 SIN código, o con un código de compuerta, no muestra el texto del historial", () => {
    expect(cierre(resp(409)).mensajeBloqueante).not.toContain("historial");
    expect(cierre(resp(409, "m1_no_aprobado"), "Fase 2").mensajeBloqueante).not.toContain("historial");
  });
  it("el texto sale igual con la fase 2 y 3 (no depende del contexto)", () => {
    for (const fase of ["Fase 1", "Fase 2", "Fase 3"]) {
      expect(cierre(resp(409, "historial_no_confirmado"), fase).mensajeBloqueante).toBe("No se pudo CONFIRMAR el registro del historial. La fase sigue abierta; vuelve a intentarlo.");
    }
  });
  it("un 200 con el mismo código no es un fallo: navega", () => {
    expect(decidirCierreDeFase({ tipo: "respuesta", ok: true, status: 200, codigo: "historial_no_confirmado" }, null, { fase: "Fase 1" }).navegar).toBe(true);
  });
  it("el código en otra acción de F2/F3 no cambia (p. ej. aprobar_motor no muestra «La fase sigue abierta»)", () => {
    expect(decidirResultadoGuardado("aprobar_motor", resp(409, "historial_no_confirmado"), { motor: "M2" }).mensajeError).not.toContain("La fase");
  });
});

describe("cerrar_fase — los fallos que NO son del historial se ven EXACTAMENTE igual que en 0084b73", () => {
  const casos: Array<[string, RespuestaGuardado, string]> = [
    ["403", resp(403), "No se pudo registrar el cierre de Fase 1. No tienes permiso para guardar en este proyecto. La fase sigue abierta; inténtalo de nuevo."],
    ["404", resp(404), "No se pudo registrar el cierre de Fase 1. El proyecto ya no existe o no tienes acceso. La fase sigue abierta; inténtalo de nuevo."],
    ["401", resp(401), "No se pudo registrar el cierre de Fase 1. Tu sesión no es válida o expiró. Vuelve a iniciar sesión. La fase sigue abierta; inténtalo de nuevo."],
    ["500 genérico", resp(500), "No se pudo registrar el cierre de Fase 1. El servidor no pudo completar la operación. La fase sigue abierta; inténtalo de nuevo."],
    ["500 con el texto de error de la ruta como código", resp(500, "Error al completar la fase"), "No se pudo registrar el cierre de Fase 1. El servidor no pudo completar la operación. La fase sigue abierta; inténtalo de nuevo."],
    ["409 sin código", resp(409), "No se pudo registrar el cierre de Fase 1. El servidor no pudo completar la operación. La fase sigue abierta; inténtalo de nuevo."],
    ["red caída", { tipo: "error_red" }, "No se pudo CONFIRMAR el cierre de Fase 1: sin conexión con el servidor. Puede que sí se haya registrado; recarga la página para verificar el estado."],
  ];
  it.each(casos)("%s", (_n, r, texto) => {
    const d = cierre(r);
    expect(d.mensajeBloqueante).toBe(texto);
    expect(d.navegar).toBe(false);
  });
  it("409 de compuerta de la Fase 2 (m1_no_aprobado): su texto de siempre", () => {
    expect(cierre(resp(409, "m1_no_aprobado"), "Fase 2").mensajeBloqueante).toBe(
      "No se pudo cerrar la Fase 2: el análisis (M1) aún no está aprobado. Apruébalo y finaliza el Reporte F2 con ese análisis. La fase sigue abierta."
    );
  });
});
