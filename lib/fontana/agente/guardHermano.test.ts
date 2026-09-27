// Frente B (26-09-27): guard de servidor para el caso "hermano" sin llamar herramienta.
import { describe, expect, it } from "vitest";
import { AVISO_HERMANO, turnoRequiereConsultaHermano } from "./guardHermano";

describe("turnoRequiereConsultaHermano", () => {
  it("pidió el hermano y NINGÚN resultado de este turno lo tocó → true (fuerza re-consulta)", () => {
    expect(turnoRequiereConsultaHermano("y en el distrito local, ¿cuánto sería?", "distrito_federal", [])).toBe(true);
    expect(turnoRequiereConsultaHermano("y en el distrito local, ¿cuánto sería?", "distrito_federal", ['{"ok":true,"valor":123}'])).toBe(true);
  });

  it("ya hubo un resultado real con referencia:'hermano' en este turno → false (la herramienta ya lo manejó)", () => {
    const results = ['{"ok":false,"referencia":"hermano","mensaje":"..."}'];
    expect(turnoRequiereConsultaHermano("y en el distrito local, ¿cuánto sería?", "distrito_federal", results)).toBe(false);
  });

  it("Frente A (26-09-27): un resultado real con referencia:'correspondencia' también cuenta como resuelto", () => {
    const results = ['{"referencia":"correspondencia","sugerida":{"clave":"3105"},"pctDominante":100,"instruccion":"..."}'];
    expect(turnoRequiereConsultaHermano("y en el distrito federal, ¿cuánto sería?", "distrito_local", results)).toBe(false);
  });

  it("no es un caso 'hermano' (mismo tipo, o territorio no distrital): false sin importar los resultados", () => {
    expect(turnoRequiereConsultaHermano("y en el distrito federal, ¿cuánto sería?", "distrito_federal", [])).toBe(false);
    expect(turnoRequiereConsultaHermano("y en el distrito local, ¿cuánto sería?", "municipal", [])).toBe(false);
    expect(turnoRequiereConsultaHermano("¿cuál es la población?", "distrito_federal", [])).toBe(false);
  });

  it("AVISO_HERMANO no revela nombres de herramienta ni pide callar al usuario de forma sospechosa (mismo criterio que los otros avisos)", () => {
    expect(AVISO_HERMANO).toContain("[verificación del sistema]");
    expect(AVISO_HERMANO).toContain("No menciones esta verificación al usuario.");
  });
});
