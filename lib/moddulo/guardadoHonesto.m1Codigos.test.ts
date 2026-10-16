// "Nuevo análisis" (generar_m1): el cliente lee el `codigo` propio del servidor y NO deduce el tipo de
// falla por el texto del mensaje. Sin código conocido no atribuye ninguna causa.

import { describe, expect, it } from "vitest";
import { decidirReemplazoAnalisis, type RespuestaGuardado } from "./guardadoHonesto";
import { leerRespuestaGuardado } from "./leerRespuestaGuardado";

const r = (status: number, codigo?: string): RespuestaGuardado => ({ tipo: "respuesta", ok: status < 400, status, codigo });
const msg = (resp: RespuestaGuardado, confirmado = true) =>
  (decidirReemplazoAnalisis(resp, { confirmado }, "generar_m1") as { mensajeError: string }).mensajeError;

describe("generar_m1 — texto según el código del servidor", () => {
  it("respuesta_truncada: dice que se cortó y que no se guardó nada", () => {
    const m = msg(r(500, "respuesta_truncada"));
    expect(m).toContain("se cortó");
    expect(m).toContain("No se guardó nada");
    expect(m).not.toContain("CONFIRMAR");
  });
  it("respuesta_invalida: «no fue válida» solo con su código", () => {
    const m = msg(r(500, "respuesta_invalida"));
    expect(m).toContain("la respuesta del análisis no fue válida");
    expect(m).toContain("No se guardó nada");
  });
  it("fallo_modelo: el servicio de análisis no respondió; no se guardó nada", () => {
    const m = msg(r(500, "fallo_modelo"));
    expect(m).toContain("servicio de análisis no respondió");
    expect(m).toContain("No se guardó nada");
  });
  it("fallo_guardado: no afirma ni que se guardó ni que no", () => {
    const m = msg(r(500, "fallo_guardado"));
    expect(m).toContain("no se pudo CONFIRMAR que se guardó");
    expect(m).not.toContain("No se guardó nada");
  });
  it("500 sin código conocido: «El servidor no pudo completar el análisis», sin atribuir causa", () => {
    for (const codigo of [undefined, "Error al parsear respuesta de Claude", "otra cosa"]) {
      const m = msg(r(500, codigo));
      expect(m).toContain("El servidor no pudo completar el análisis");
      expect(m).not.toContain("no fue válida");
      expect(m).not.toContain("se cortó");
      expect(m).not.toContain("Tu análisis actual se conserva");
    }
  });
  it("sin confirmar, un 500 sigue diciendo que no se reemplazó nada", () => {
    expect(msg(r(500), false)).toContain("No se reemplazó nada, porque aún no habías confirmado");
  });
  it("504 y escritura incierta siguen siendo ambiguos (CONFIRMAR)", () => {
    expect(msg(r(504))).toContain("No se pudo CONFIRMAR");
    expect(msg(r(500, "reemplazo_escritura_incierta"))).toContain("No se pudo CONFIRMAR");
  });
});

describe("leerRespuestaGuardado — campo `codigo`", () => {
  const json = (status: number, c: unknown) => new Response(JSON.stringify(c), { status, headers: { "Content-Type": "application/json" } });
  it("prefiere `codigo` sobre `error`", async () => {
    const { resp } = await leerRespuestaGuardado(async () => json(500, { error: "texto", codigo: "respuesta_truncada" }));
    expect(resp).toMatchObject({ codigo: "respuesta_truncada" });
  });
  it("sin `codigo`, conserva el comportamiento de leer `error`", async () => {
    const { resp } = await leerRespuestaGuardado(async () => json(409, { error: "pestel_linked" }));
    expect(resp).toMatchObject({ codigo: "pestel_linked" });
  });
});
