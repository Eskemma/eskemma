// Pieza 1b — guard de confirmación por clave: una sugerencia por tecleo nunca se acepta sin confirmación humana.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({ adminDb: {} }));

import { nombreDeClave, sugerenciaConfirmada, type ToolContext } from "./tools";

const ctx = (usuario: string, asistente: string): ToolContext => ({ ultimoMensajeUsuario: usuario, ultimoMensajeAsistente: asistente } as ToolContext);

describe("nombreDeClave", () => {
  it("municipio, homónimo con #cve y estado", () => {
    expect(nombreDeClave("14:GUADALAJARA")).toBe("GUADALAJARA");
    expect(nombreDeClave("20:SAN JUAN MIXTEPEC#208")).toBe("SAN JUAN MIXTEPEC");
    expect(nombreDeClave("06")).toBe("Colima");
    expect(nombreDeClave("basura")).toBeNull();
    expect(nombreDeClave("MEX")).toBeNull();
  });
});

describe("sugerenciaConfirmada", () => {
  it("SIN confirmación: el usuario solo escribió el nombre mal → false (el modelo no puede aceptarla por él)", () => {
    expect(sugerenciaConfirmada("14:GUADALAJARA", ctx("dame la población de Guadalajra", "Hola, ¿en qué te ayudo?"))).toBe(false);
  });

  it("el asistente PROPUSO la sugerencia y el usuario confirmó → true", () => {
    expect(sugerenciaConfirmada("14:GUADALAJARA", ctx("sí", "No reconozco «Guadalajra». ¿Quisiste decir Guadalajara, Jalisco?"))).toBe(true);
    expect(sugerenciaConfirmada("14:GUADALAJARA", ctx("Sí, esa", "¿Quisiste decir Guadalajara, Jalisco?"))).toBe(true);
  });

  it("el asistente propuso pero el usuario NO confirmó (respuesta distinta) → false", () => {
    expect(sugerenciaConfirmada("14:GUADALAJARA", ctx("no, otra cosa", "¿Quisiste decir Guadalajara, Jalisco?"))).toBe(false);
    expect(sugerenciaConfirmada("14:GUADALAJARA", ctx("mejor dame la pobreza", "¿Quisiste decir Guadalajara, Jalisco?"))).toBe(false);
  });

  it("el usuario escribió él mismo el nombre completo → true", () => {
    expect(sugerenciaConfirmada("14:GUADALAJARA", ctx("Guadalajara", "¿Quisiste decir otra cosa?"))).toBe(true);
  });

  it("el asistente NUNCA propuso ese territorio: un «sí» suelto no alcanza", () => {
    expect(sugerenciaConfirmada("14:GUADALAJARA", ctx("sí", "¿Quieres ver la pobreza?"))).toBe(false);
  });

  it("agujero cerrado: «San Pedro Tlaqepaque» mal tecleado NO confirma a SAN PEDRO TLAQUEPAQUE por compartir «PEDRO»", () => {
    expect(sugerenciaConfirmada("14:SAN PEDRO TLAQUEPAQUE", ctx("población de San Pedro Tlaqepaque", "Hola"))).toBe(false);
  });

  it("una clave fabricada o vacía nunca se confirma", () => {
    expect(sugerenciaConfirmada("99:INVENTADO", ctx("sí", "¿Quisiste decir Guadalajara?"))).toBe(false);
    expect(sugerenciaConfirmada(null, ctx("sí", "¿Quisiste decir Guadalajara?"))).toBe(false);
    expect(sugerenciaConfirmada("", ctx("sí", "x"))).toBe(false);
  });

  it("estado: «¿Quisiste decir Colima?» + «sí» confirma la clave 06", () => {
    expect(sugerenciaConfirmada("06", ctx("sí", "¿Quisiste decir Colima?"))).toBe(true);
  });
});
