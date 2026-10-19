// G (paso 4): los registros describen la FORMA (longitud, tipo de documento, claves, clase y status del
// error), nunca el texto del modelo ni del proyecto.
import { describe, expect, it } from "vitest";
import { descripcionError, descripcionEstructural, registrarErrorEstructural } from "./registroModelo";
import { vi } from "vitest";

describe("descripcionEstructural", () => {
  it("objeto: longitud, forma y claves; ningún valor", () => {
    const d = descripcionEstructural(JSON.stringify({ hei: { tensionCentral: "SECRETO-DEL-PROYECTO" }, pip: [] }));
    expect(d).toMatch(/^longitud=\d+ forma=objeto claves=hei,pip$/);
    expect(d).not.toContain("SECRETO");
  });
  it("arreglo, texto, vacío, objeto/arreglo incompletos y valla ```json", () => {
    expect(descripcionEstructural("[1,2]")).toBe("longitud=5 forma=arreglo");
    expect(descripcionEstructural("hola SECRETO")).toBe("longitud=12 forma=texto");
    expect(descripcionEstructural("")).toBe("longitud=0 forma=vacio");
    expect(descripcionEstructural('{"P": {"narra SECRETO')).toMatch(/forma=objeto_incompleto$/);
    expect(descripcionEstructural("[{\"a\": SECRETO")).toMatch(/forma=arreglo_incompleto$/);
    expect(descripcionEstructural('```json\n{"P":{}}\n```')).toMatch(/forma=objeto claves=P$/);
  });
  it("claves que no parecen del esquema se enmascaran (no se filtra texto por una clave)", () => {
    expect(descripcionEstructural(JSON.stringify({ "texto largo con espacios del usuario": 1 }))).toMatch(/claves=\?$/);
  });
  it("NUNCA contiene el texto, aunque sea largo", () => {
    const largo = "Narrativa-del-proyecto ".repeat(200);
    expect(descripcionEstructural(largo)).toBe(`longitud=${largo.length} forma=texto`);
  });
});

describe("descripcionError / registrarErrorEstructural", () => {
  it("solo clase y status; nunca el mensaje", () => {
    const e = Object.assign(new Error("mensaje con DATOS-DEL-USUARIO"), { status: 529, name: "APIError" });
    expect(descripcionError(e)).toBe("clase=APIError status=529");
    expect(descripcionError("texto suelto")).toBe("clase=Error status=n/a");
    expect(descripcionError(null)).toBe("clase=Error status=n/a");
  });
  it("registra sin el mensaje; el marcador de crédito agotado se conserva sin copiar el mensaje", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    registrarErrorEstructural("ruta", "falló algo", new Error("DATOS-DEL-USUARIO"));
    registrarErrorEstructural("ruta", "falló otra", new Error("Your credit balance is too low (DATOS)"));
    const t = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(t).toContain("[ruta] falló algo clase=Error status=n/a");
    expect(t).toContain("[ANTHROPIC_CREDIT_EXHAUSTED] ruta falló otra");
    expect(t).not.toContain("DATOS");
    spy.mockRestore();
  });
});
