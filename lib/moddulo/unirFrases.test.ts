// T7 C3b: el mensaje de un rechazo 4xx del import no pega dos frases («No autorizado No se importó nada.»).
import { describe, expect, it } from "vitest";
import { unirFrases } from "./unirFrases";
import { decidirConfirmacionImport, decidirFranjaImport } from "./sondeoCandado";

const rechazo = (status: number, codigo?: string) => ({ tipo: "respuesta" as const, ok: false as const, status, ...(codigo ? { codigo } : {}) });

describe("unirFrases", () => {
  it("agrega el punto cuando la base no cierra con puntuación", () => {
    expect(unirFrases("No autorizado", "No se importó nada.")).toBe("No autorizado. No se importó nada.");
  });
  it.each(["Ya vinculado.", "¿Seguro?", "Listo!", "Se cortó…", "Dijo «no».", "Texto (aparte.)"])("no duplica la puntuación de «%s»", (base) => {
    expect(unirFrases(base, "No se importó nada.")).toBe(`${base} No se importó nada.`);
  });
  it("espacios sobrantes y base vacía", () => {
    expect(unirFrases("  No autorizado  ", "X.")).toBe("No autorizado. X.");
    expect(unirFrases("   ", "No se importó nada.")).toBe("No se importó nada.");
  });
});

describe("el rechazo 401 del import (franja y modal)", () => {
  it("«No autorizado» del servidor sale con punto antes de «No se importó nada.»", () => {
    const d = decidirConfirmacionImport(rechazo(401, "No autorizado"), { error: "No autorizado" });
    expect(d).toMatchObject({ tipo: "error", mensaje: "No autorizado. No se importó nada.", reintentable: false });
    expect(decidirFranjaImport(rechazo(401, "No autorizado"), { error: "No autorizado" }).mensaje).toBe("No autorizado. No se importó nada.");
  });
  it("un texto del servidor que ya termina en punto no se duplica", () => {
    expect(decidirFranjaImport(rechazo(400), { message: "No es de Canal 3." }).mensaje).toBe("No es de Canal 3. No se importó nada.");
  });
  it("sin texto del servidor, los textos propios (404 / permiso) no cambian", () => {
    expect(decidirFranjaImport(rechazo(404), {}).mensaje).toBe("No se encontró el análisis o el proyecto; puede que ya no exista. No se importó nada.");
  });
});
