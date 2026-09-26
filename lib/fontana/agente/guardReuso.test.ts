import { describe, expect, it } from "vitest";
import { afirmaAusenciaDeDato, contieneTablaDeValores, respuestaRequiereConsulta } from "./guardReuso";

// Texto real (adaptado) del turno viejo de la sesión m4qUAX… que el modelo repitió sin consultar.
const AUSENCIA_REAL =
  "Para el D.F. 3102 PROGRESO: No existe dato directo a nivel distrital para este indicador; solo tengo el estatal.";
const TABLA =
  "| Nivel | Valor |\n|---|---|\n| Estatal | 65.7% |\n| Distrital | 22.62% |\n| Nacional | 19.4% |";

describe("guard de reuso", () => {
  it("detecta la ausencia repetida del incidente real", () => {
    expect(afirmaAusenciaDeDato(AUSENCIA_REAL)).toBe(true);
    expect(respuestaRequiereConsulta(AUSENCIA_REAL)).toBe(true);
  });
  it("detecta variantes de ausencia", () => {
    expect(afirmaAusenciaDeDato("No hay dato disponible a nivel municipal.")).toBe(true);
    expect(afirmaAusenciaDeDato("A nivel distrital no existe valor publicado.")).toBe(true);
  });
  it("detecta una tabla de valores", () => {
    expect(contieneTablaDeValores(TABLA)).toBe(true);
    expect(respuestaRequiereConsulta(TABLA)).toBe(true);
  });
  it("no marca respuestas conversacionales ni tablas sin números", () => {
    expect(respuestaRequiereConsulta("¿Te refieres al estado o al municipio de Colima?")).toBe(false);
    expect(respuestaRequiereConsulta("| Familia | Descripción |\n|---|---|\n| F1 | Demografía |\n| F2 | Bienestar |")).toBe(false);
    expect(respuestaRequiereConsulta("Con gusto, dime qué indicador quieres consultar.")).toBe(false);
  });
});
