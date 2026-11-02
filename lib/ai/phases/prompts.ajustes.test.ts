// T3 (D3): el ajuste del analista en la serialización del mapa y en la sección de precedencia. Sin ajuste, la salida
// no cambia ni un byte (la caracterización existente y la de abajo lo fijan).
import { describe, expect, it } from "vitest";
import {
  mapaTieneAjustes, PRECEDENCIA_PESTL_AJUSTE, PRECEDENCIA_PESTL_CUERPO, PRECEDENCIA_PESTL_APROBADO, serializeMapaPESTEL, seccionPrecedenciaPESTL,
  getDVSM2Prompt, getDVSM3Prompt, getDVSM4Prompt, getDVSM5Prompt,
} from "./prompts";

const base = { code: "P", label: "Político", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [], narrativa: "Narrativa previa.", confidence: 80 };
const SIN = { P: { ...base, clasificacion: "AMENAZA" } };
const CON = {
  P: { ...base, clasificacion: "OPORTUNIDAD", ajuste: { clasificacionOriginal: "AMENAZA", clasificacionAjustada: "OPORTUNIDAD", justificacion: "Cambió el contexto" } },
};

describe("serializeMapaPESTEL — ajuste del analista (T3)", () => {
  it("sin ajuste: la salida es la de siempre", () => {
    expect(serializeMapaPESTEL(SIN)).toBe("[P] Político — AMENAZA (confianza: 80%)\n  Narrativa: Narrativa previa.");
  });
  it("con ajuste: clasificación ajustada, confianza rotulada «de la clasificación original» y la línea del ajuste", () => {
    expect(serializeMapaPESTEL(CON)).toBe(
      "[P] Político — OPORTUNIDAD (confianza de la clasificación original: 80%)\n  Narrativa: Narrativa previa.\n" +
        "  Ajuste del analista: AMENAZA→OPORTUNIDAD. Justificación: Cambió el contexto. La narrativa es previa al ajuste."
    );
  });
  it("ajuste solo de posición: lo dice sin inventar un cambio de clasificación", () => {
    const m = { P: { ...CON.P, ajuste: { ...CON.P.ajuste, clasificacionAjustada: "AMENAZA" } } };
    expect(serializeMapaPESTEL(m)).toContain("Ajuste del analista: posición ajustada; la clasificación no cambió.");
  });
  it("una justificación que ya termina en punto no duplica el punto", () => {
    const m = { P: { ...CON.P, ajuste: { ...CON.P.ajuste, justificacion: "Cambió el contexto.  " } } };
    expect(serializeMapaPESTEL(m)).toContain("Justificación: Cambió el contexto. La narrativa es previa al ajuste.");
  });
  it("mapaTieneAjustes", () => {
    expect(mapaTieneAjustes(SIN)).toBe(false);
    expect(mapaTieneAjustes(CON)).toBe(true);
    expect(mapaTieneAjustes(undefined)).toBe(false);
  });
});

describe("seccionPrecedenciaPESTL — frase del ajuste (T3)", () => {
  it("por defecto (sin ajustes) es exactamente la de antes", () => {
    expect(seccionPrecedenciaPESTL(true)).toBe(`== PRECEDENCIA DEL ANÁLISIS PEST-L ==\n${PRECEDENCIA_PESTL_APROBADO} ${PRECEDENCIA_PESTL_CUERPO}`);
    expect(seccionPrecedenciaPESTL(true, false)).toBe(seccionPrecedenciaPESTL(true));
  });
  it("con ajustes agrega la frase al final", () => {
    expect(seccionPrecedenciaPESTL(true, true)).toBe(`${seccionPrecedenciaPESTL(true)} ${PRECEDENCIA_PESTL_AJUSTE}`);
    expect(PRECEDENCIA_PESTL_AJUSTE).toContain("prevalece sobre su narrativa");
  });
  it("la cláusula de atribución: los hechos de la justificación son del analista, no una fuente verificada", () => {
    expect(PRECEDENCIA_PESTL_AJUSTE).toContain("afirmación del analista, no una fuente verificada");
    expect(PRECEDENCIA_PESTL_AJUSTE).toContain("«según el ajuste del analista»");
    expect(PRECEDENCIA_PESTL_AJUSTE).toContain("no los presentes como dato del entorno");
    expect(seccionPrecedenciaPESTL(false, true)).toContain("según el ajuste del analista");
    expect(seccionPrecedenciaPESTL(true)).not.toContain("según el ajuste del analista");
    expect(seccionPrecedenciaPESTL(false)).not.toContain("según el ajuste del analista");
  });
  it("los 4 motores la llevan solo cuando se les indica", () => {
    const x = { hito: "h" };
    const con = [getDVSM2Prompt("electoral", x, "m", true, true).user, getDVSM3Prompt("electoral", x, "m", true, true).user, getDVSM4Prompt("m", [], true, true).user, getDVSM5Prompt("electoral", x, "m", [], [], true, true).user];
    const sin = [getDVSM2Prompt("electoral", x, "m", true).user, getDVSM3Prompt("electoral", x, "m", true).user, getDVSM4Prompt("m", [], true).user, getDVSM5Prompt("electoral", x, "m", [], [], true).user];
    for (const u of con) expect(u).toContain(PRECEDENCIA_PESTL_AJUSTE);
    for (const u of sin) expect(u).not.toContain("Ajuste del analista");
  });
});
