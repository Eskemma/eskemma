// T5b — el estado de «lo que se reemplazaría al volver» (servidor). Devuelve SOLO estado y rótulos de líneas.
import { describe, expect, it } from "vitest";
import { calcularSalida } from "./lineasAvisoSalida";
import { huellaMapaPESTEL } from "./m1Huella";

const MARCA = "CONTENIDO-SECRETO-DEL-MAPA";
const mapa = { P: { code: "P", classification: "NEUTRAL", narrative: MARCA, senalesFavorables: [{ descripcion: MARCA }], senalesAdversas: [], senalesInciertas: [] } };

describe("calcularSalida", () => {
  it("proyecto limpio (sin mapa, borrador ni motores) → sin líneas", () => {
    expect(calcularSalida(undefined)).toEqual({ estado: "sin_lineas" });
    expect(calcularSalida({ status: "in-progress" })).toEqual({ estado: "sin_lineas" });
    expect(calcularSalida({ linkedSource: { kind: "T22" } })).toEqual({ estado: "sin_lineas" }); // pendiente forma antigua
  });
  it("Express con mapa pero sin aprobación, ediciones ni motores → no hay nada que listar", () => {
    expect(calcularSalida({ linkedSource: { kind: "express", payload: mapa } })).toEqual({ estado: "sin_lineas" });
  });
  it("Express con el M1 aprobado → hay líneas (la aprobación se perdería)", () => {
    const aprobado = { linkedSource: { kind: "express", payload: mapa }, m1: { creadoEn: "x", aprobacion: { huella: huellaMapaPESTEL(mapa as never), por: "u", en: "e", categoriasEditadas: 0, total: 1, mapa } } };
    const r = calcularSalida(aprobado as never);
    expect(r.estado).toBe("con_lineas");
    expect(JSON.stringify(r)).toContain("aprobación");
  });
  it("motores aprobados o borrador, sin mapa → hay líneas con esos motores", () => {
    const r = calcularSalida({ motorAprobaciones: { M2: true }, draftDVS: { x: 1 } });
    expect(r.estado).toBe("con_lineas");
    expect(JSON.stringify(r)).toContain("M2");
  });
  it("solo un Reporte F2 finalizado (nada que se descarte) → sin líneas", () => {
    expect(calcularSalida({ dvs: { pip: [] } })).toEqual({ estado: "sin_lineas" });
  });
  it("Fase 2 cerrada → sin líneas aunque haya mapa y motores (el import respondería fase_cerrada)", () => {
    expect(calcularSalida({ status: "completed", linkedSource: { kind: "express", payload: mapa }, motorAprobaciones: { M2: true } })).toEqual({ estado: "sin_lineas" });
  });
  it("la respuesta tiene SOLO `estado` y `lineas` (textos), nunca el mapa, la copia aprobada, el reporte ni el payload", () => {
    const exp = {
      linkedSource: { kind: "express", payload: mapa },
      m1: { creadoEn: "x", aprobacion: { huella: "h", por: "u", en: "e", categoriasEditadas: 0, total: 6, mapa } },
      dvs: { pip: [{ pregunta: MARCA }] }, draftDVS: { m: MARCA }, motorAprobaciones: { M2: true },
    };
    const r = calcularSalida(exp as never);
    expect(Object.keys(r).sort()).toEqual(["estado", "lineas"]);
    expect((r as { lineas: unknown[] }).lineas.every((l) => typeof l === "string")).toBe(true);
    expect(JSON.stringify(r)).not.toContain(MARCA);
    expect(JSON.stringify(r)).not.toMatch(/payload|senales|narrative|huella/i);
  });
});
