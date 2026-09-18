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
