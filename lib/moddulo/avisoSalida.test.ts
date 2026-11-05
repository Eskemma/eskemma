// T5b — decisiones y textos del aviso al salir hacia Centinela (puro).
import { describe, expect, it } from "vitest";
import {
  debeInterceptarClic, decidirAvisoSalida, requiereAvisoSalida, textoModalSalida, urlConsultaSalida,
  TEXTO_SALIDA_NO_VERIFICABLE, TIEMPO_MAXIMO_SALIDA_MS, TITULO_AVISO_SALIDA, INTRO_AVISO_SALIDA,
} from "./avisoSalida";

const ok = (salida: unknown) => ({ tipo: "respuesta" as const, ok: true, cuerpo: { found: false, salida } });

describe("decidirAvisoSalida", () => {
  it("sin líneas → navega directo", () => {
    expect(decidirAvisoSalida(ok({ estado: "sin_lineas" }), false)).toEqual({ tipo: "navegar" });
  });
  it("con líneas → avisa con esas líneas", () => {
    expect(decidirAvisoSalida(ok({ estado: "con_lineas", lineas: ["A", "B"] }), false)).toEqual({ tipo: "avisar", lineas: ["A", "B"] });
  });
  it("Fase 2 cerrada → navega directo aunque haya líneas", () => {
    expect(decidirAvisoSalida(ok({ estado: "con_lineas", lineas: ["A"] }), true)).toEqual({ tipo: "navegar" });
  });
  it("error de red, tiempo agotado y respuesta no OK → no verificable (se deja continuar)", () => {
    expect(decidirAvisoSalida({ tipo: "error" }, false)).toEqual({ tipo: "no_verificable" });
    expect(decidirAvisoSalida({ tipo: "tiempo_agotado" }, false)).toEqual({ tipo: "no_verificable" });
    expect(decidirAvisoSalida({ tipo: "respuesta", ok: false, cuerpo: { error: "x" } }, false)).toEqual({ tipo: "no_verificable" });
  });
  it("cuerpo sin `salida`, nulo, de forma rara o `no_verificable` del servidor → no verificable", () => {
    for (const cuerpo of [null, {}, { salida: null }, { salida: "x" }, { salida: { estado: "no_verificable" } }, { salida: { estado: "con_lineas" } },
      { salida: { estado: "con_lineas", lineas: [] } }, { salida: { estado: "con_lineas", lineas: [1] } }, { salida: { estado: "otro" } }]) {
      expect(decidirAvisoSalida({ tipo: "respuesta", ok: true, cuerpo }, false)).toEqual({ tipo: "no_verificable" });
    }
  });
});

describe("requiereAvisoSalida", () => {
  it("solo con la fase abierta y sin análisis importado", () => {
    expect(requiereAvisoSalida({ f2Cerrada: false, tieneAnalisisImportado: false })).toBe(true);
    expect(requiereAvisoSalida({ f2Cerrada: false, tieneAnalisisImportado: true })).toBe(false); // vinculado: T4 ya avisa
    expect(requiereAvisoSalida({ f2Cerrada: true, tieneAnalisisImportado: false })).toBe(false);
  });
});

describe("debeInterceptarClic (enlace «Ir a Centinela →»)", () => {
  const base = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
  it("intercepta solo el clic primario sin modificadores", () => {
    expect(debeInterceptarClic(base)).toBe(true);
  });
  it("con Ctrl, Cmd, Shift o Alt se deja el comportamiento nativo del <Link>", () => {
    for (const m of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) expect(debeInterceptarClic({ ...base, [m]: true })).toBe(false);
  });
  it("con el botón central o el derecho no intercepta", () => {
    expect(debeInterceptarClic({ ...base, button: 1 })).toBe(false);
    expect(debeInterceptarClic({ ...base, button: 2 })).toBe(false);
  });
  it("si otro manejador ya canceló el clic, no intercepta", () => {
    expect(debeInterceptarClic({ ...base, defaultPrevented: true })).toBe(false);
  });
});

describe("textos y constantes", () => {
  it("URL de la consulta: opt-in salida=1 sobre find-linked-pestel, con el id codificado", () => {
    expect(urlConsultaSalida("abc")).toBe("/api/moddulo/f2/find-linked-pestel?moddulo_project_id=abc&salida=1");
    expect(urlConsultaSalida("a b&c")).toContain("a%20b%26c");
  });
  it("el tiempo máximo es 8 s", () => {
    expect(TIEMPO_MAXIMO_SALIDA_MS).toBe(8000);
  });
  it("modal con líneas y modal «no verificable»: ambos dejan continuar y ninguno remite a soporte", () => {
    const a = textoModalSalida({ tipo: "avisar", lineas: ["X"] });
    expect(a).toEqual({ titulo: TITULO_AVISO_SALIDA, intro: [INTRO_AVISO_SALIDA], lineas: ["X"], cierre: null, confirmar: "Continuar a Centinela", cancelar: "Cancelar" });
    const n = textoModalSalida({ tipo: "no_verificable" });
    expect(n.intro).toEqual([TEXTO_SALIDA_NO_VERIFICABLE]);
    expect(n.confirmar).toBe("Continuar a Centinela");
    expect(JSON.stringify([a, n]).toLowerCase()).not.toContain("soporte");
    expect(JSON.stringify([a, n])).not.toMatch(/huella|payload|linkedSource/);
  });
});
