// F2 cerrada: 409 con código propio `fase_cerrada` del servidor → el cliente lo afirma (no se guardó nada).
import { describe, expect, it } from "vitest";
import { decidirReemplazoAnalisis, MENSAJE_FASE_CERRADA_REEMPLAZO, type RespuestaGuardado } from "./guardadoHonesto";
import { mensajeRechazoVincularCentinela } from "./textosModalM1";
import { leerRespuestaGuardado } from "./leerRespuestaGuardado";

const r409 = (codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: false, status: 409, codigo });
const TEXTO = "La Fase 2 está cerrada: no se puede reemplazar el análisis. No se guardó nada.";

describe("fase_cerrada en el cliente", () => {
  it("el texto es el pedido", () => expect(MENSAJE_FASE_CERRADA_REEMPLAZO).toBe(TEXTO));
  it("generar_m1 (con y sin confirmación, con y sin análisis previo) lo dice", () => {
    for (const confirmado of [true, undefined, false]) for (const hayAnalisisPrevio of [true, false, undefined]) {
      const d = decidirReemplazoAnalisis(r409("fase_cerrada"), { confirmado, hayAnalisisPrevio }, "generar_m1") as { tipo: string; mensajeError: string };
      expect(d.tipo).toBe("error");
      expect(d.mensajeError).toBe(TEXTO);
    }
  });
  it("el rechazo de Centinela (link-moddulo desde PESTEL) lo cubre", () => {
    expect(mensajeRechazoVincularCentinela({ status: 409, codigo: "fase_cerrada" })).toBe(TEXTO);
    expect(mensajeRechazoVincularCentinela({ status: 409, codigo: "pestel_already_linked" })).toBeNull();
  });
  it("un 5xx SIN código no afirma que la fase esté cerrada", () => {
    for (const status of [500, 502, 503, 504]) {
      const d = decidirReemplazoAnalisis({ tipo: "respuesta", ok: false, status }, { confirmado: true }, "generar_m1") as { mensajeError: string };
      expect(d.mensajeError).not.toContain("cerrada");
    }
  });
  it("leerRespuestaGuardado toma el código de `error` ({error:\"fase_cerrada\"}, la forma real del servidor)", async () => {
    const resp = new Response(JSON.stringify({ error: "fase_cerrada" }), { status: 409 });
    const { resp: leida } = await leerRespuestaGuardado(async () => resp);
    expect(leida).toMatchObject({ tipo: "respuesta", status: 409, codigo: "fase_cerrada" });
  });
});
