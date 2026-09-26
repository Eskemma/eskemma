// lib/ai/phases/prompts.test.ts
// Regresión de las reglas "LÍMITES DE TU INFORMACIÓN" (forense 26-09-18): el
// chat inventó una causa técnica ("la integración Moddulo–Sefix debe habilitarla
// el administrador") y dio un dato institucional equivocado con total
// naturalidad. Viven en el prompt base compartido, así que deben estar en
// TODAS las fases con chat (proposito, exploracion, investigacion).

import { describe, expect, it } from "vitest";
import { getPhaseSystemPrompt } from "./prompts";
import { PHASE_ORDER } from "@/types/moddulo.types";

const FASES_CON_CHAT = ["proposito", "exploracion", "investigacion"] as const;

describe("prompt base — LÍMITES DE TU INFORMACIÓN", () => {
  it.each(FASES_CON_CHAT)("fase %s: prohíbe inventar la causa técnica y exige decir 'no tengo ese dato'", (fase) => {
    const prompt = getPhaseSystemPrompt(fase);
    expect(prompt).toContain("LÍMITES DE TU INFORMACIÓN — REGLA ABSOLUTA");
    expect(prompt).toContain('"no tengo ese dato en este momento"');
    expect(prompt).toContain("NUNCA inventes una causa técnica");
    expect(prompt).toContain("lo habilita el administrador");
  });

  it.each(FASES_CON_CHAT)("fase %s: los datos propios no verificados se señalan como tales, sin URLs inventadas", (fase) => {
    const prompt = getPhaseSystemPrompt(fase);
    expect(prompt).toContain("NUNCA presentes como dato verificado");
    expect(prompt).toContain("conocimiento general mío, no lo he verificado");
    expect(prompt).toContain("NUNCA inventes direcciones web");
  });

  it.each(FASES_CON_CHAT)("fase %s: precisión de cifras y fechas en el bloque JSON", (fase) => {
    expect(getPhaseSystemPrompt(fase)).toContain("si dio mes y año, no agregues un día");
  });

  it("está en el prompt base: las 9 fases lo heredan", () => {
    for (const fase of PHASE_ORDER) {
      expect(getPhaseSystemPrompt(fase)).toContain("LÍMITES DE TU INFORMACIÓN — REGLA ABSOLUTA");
    }
  });

  it("no rompe la regla existente de adjuntos de F1 (mismo estilo imperativo)", () => {
    expect(getPhaseSystemPrompt("proposito")).toContain('NUNCA digas que "no tienes acceso a archivos adjuntos"');
  });
});

// ─── Paso 4a (26-09-26): bloque de territorio como sección ADICIONAL ───────────────────────────────
// Baseline generado con el código anterior al cambio (fecha fija, 9 fases, con y sin contexto).
import { afterAll, beforeAll, vi } from "vitest";
import baseline from "./__fixtures__/prompts-antes-4a.json";
import type { Territorio } from "@/types/shared.types";
import { bloqueTerritorioModdulo } from "@/lib/geo/bloqueTerritorio";

const FRASE_F2_ANTES =
  "Infiere el país, estado o territorio a partir del XPCTO (sujeto, hito, contexto del proyecto).";
const FRASE_F2_AHORA =
  "Si el prompt incluye el bloque «TERRITORIO DEL PROYECTO», ese es el territorio: úsalo tal cual. Solo si NO existe ese bloque, infiere el país, estado o territorio a partir del XPCTO (sujeto, hito, contexto del proyecto).";

const TERR: Territorio = {
  nivel: "distrito_federal",
  nombre: "PROGRESO",
  estado: "Yucatán",
  pais: "México",
  distritosSeleccionados: [{ cve: "002", nombre: "PROGRESO", estado: "Yucatán" }],
};

describe("Paso 4a — el bloque de territorio no desplaza la guía de ninguna fase", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });
  afterAll(() => vi.useRealTimers());

  it.each(PHASE_ORDER)("fase %s: SIN territorio el prompt es idéntico byte a byte al anterior", (fase) => {
    const antes = baseline.sinContexto[fase as keyof typeof baseline.sinContexto];
    const esperado = fase === "exploracion" ? antes.replace(FRASE_F2_ANTES, FRASE_F2_AHORA) : antes;
    expect(getPhaseSystemPrompt(fase)).toBe(esperado);
    expect(getPhaseSystemPrompt(fase, undefined, undefined, null)).toBe(esperado);
    const conCtx = baseline.conContexto[fase as keyof typeof baseline.conContexto];
    expect(getPhaseSystemPrompt(fase, { campo: "valor" }, { hito: "h", sujeto: "s" })).toBe(
      fase === "exploracion" ? conCtx.replace(FRASE_F2_ANTES, FRASE_F2_AHORA) : conCtx
    );
  });

  it.each(PHASE_ORDER)("fase %s: CON territorio es superset — solo se inserta el bloque tras el XPCTO", (fase) => {
    const sin = getPhaseSystemPrompt(fase, { campo: "valor" }, { hito: "h", sujeto: "s" });
    const con = getPhaseSystemPrompt(fase, { campo: "valor" }, { hito: "h", sujeto: "s" }, TERR);
    const bloque = bloqueTerritorioModdulo(TERR);
    expect(bloque.length).toBeGreaterThan(0);
    // Quitar el bloque insertado reproduce el prompt sin territorio: nada se acortó ni se reemplazó.
    expect(con.replace(`\n\n${bloque}`, "")).toBe(sin);
    // Orden: XPCTO → TERRITORIO → datos capturados (guía y RAE quedan antes/aparte).
    const iXpcto = con.indexOf("CONTEXTO DEL PROYECTO — XPCTO");
    const iTerr = con.indexOf("TERRITORIO DEL PROYECTO (dato estructurado");
    const iDatos = con.indexOf("DADOS YA CAPTURADOS EN ESTA FASE");
    expect(iXpcto).toBeGreaterThan(0);
    expect(iTerr).toBeGreaterThan(iXpcto);
    expect(iDatos).toBeGreaterThan(iTerr);
  });

  it("el bloque es pequeño frente al prompt base de cada fase (< 12 %)", () => {
    for (const fase of PHASE_ORDER) {
      const sin = getPhaseSystemPrompt(fase);
      const extra = getPhaseSystemPrompt(fase, undefined, undefined, TERR).length - sin.length;
      expect(extra / sin.length).toBeLessThan(0.12);
    }
  });

  it("F2 ya no ordena inferir el territorio si existe el bloque", () => {
    expect(getPhaseSystemPrompt("exploracion")).toContain("Solo si NO existe ese bloque, infiere");
  });
});
