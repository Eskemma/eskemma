import { describe, expect, it } from "vitest";
import { debeMostrarNotFound } from "./proyectoNoEncontrado";

const ruta = (fase: string) => `/moddulo/proyecto/dFUSiVXEvRIan54C6x2A/${fase}`;

describe("debeMostrarNotFound", () => {
  it.each(["proposito", "investigacion", "diagnostico", "estrategia", "tactica", "gerencia", "seguimiento", "evaluacion"])(
    "404 en %s → página 404",
    (fase) => expect(debeMostrarNotFound(404, ruta(fase))).toBe(true)
  );

  it("404 en exploración → NO (la maneja OrphanRecoveryView), con o sin barra final", () => {
    expect(debeMostrarNotFound(404, ruta("exploracion"))).toBe(false);
    expect(debeMostrarNotFound(404, `${ruta("exploracion")}/`)).toBe(false);
  });

  it("solo el 404: 500, 401, 403 o éxito no muestran not-found", () => {
    for (const s of [200, 401, 403, 500, 503]) expect(debeMostrarNotFound(s, ruta("proposito"))).toBe(false);
  });

  it("una ruta que solo CONTIENE la palabra (p. ej. un id) no se confunde con exploración", () => {
    expect(debeMostrarNotFound(404, "/moddulo/proyecto/exploracionX/proposito")).toBe(true);
  });
});
