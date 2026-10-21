// Paso 6: la instrucción de precedencia del análisis aprobado en los prompts de M2–M5. Se fijan anclas estables
// (no el texto completo) para que un retoque de redacción no rompa las pruebas.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getDVSM2Prompt, getDVSM3Prompt, getDVSM4Prompt, getDVSM5Prompt,
  PRECEDENCIA_PESTL_CUERPO, seccionPrecedenciaPESTL,
} from "./prompts";

const MAPA = "[P] Político — AMENAZA\n  Narrativa: N.";
const XPCTO = { hito: "H", sujeto: "S" };
const M2 = [{ dimension: "X", veredicto: "coherente", argumentacion: "a" }];
const construir = (aprobado: boolean) => ({
  M2: getDVSM2Prompt("electoral", XPCTO, MAPA, aprobado),
  M3: getDVSM3Prompt("electoral", XPCTO, MAPA, aprobado),
  M4: getDVSM4Prompt(MAPA, M2, aprobado),
  M5: getDVSM5Prompt("electoral", XPCTO, MAPA, [], [], aprobado),
});
const MOTORES = ["M2", "M3", "M4", "M5"] as const;

describe.each([true, false])("precedencia del análisis PEST-L — aprobado=%s", (aprobado) => {
  const p = construir(aprobado);
  it.each(MOTORES)("%s: la sección aparece UNA vez en el prompt de usuario, después del mapa y antes de las instrucciones", (m) => {
    const u = p[m].user;
    expect(u.match(/== PRECEDENCIA DEL ANÁLISIS PEST-L ==/g)).toHaveLength(1);
    const iMapa = u.indexOf(MAPA);
    const iSec = u.indexOf("== PRECEDENCIA");
    const iInstr = u.indexOf("== INSTRUCCIONES");
    expect(iMapa).toBeGreaterThan(-1);
    expect(iSec).toBeGreaterThan(iMapa);
    expect(iInstr).toBeGreaterThan(iSec);
  });
  it.each(MOTORES)("%s: no está en el prompt de sistema", (m) => {
    expect(p[m].system).not.toMatch(/PRECEDENCIA|prevalecen/);
  });
  it.each(MOTORES)("%s: anclas de la regla y de los matices; sin «Claude» ni cifras en la sección", (m) => {
    const ini = p[m].user.indexOf("== PRECEDENCIA");
    const sec = p[m].user.slice(ini, p[m].user.indexOf("\n==", ini + 5)); // up to the next section
    expect(sec).toContain("OPORTUNIDAD, NEUTRAL o AMENAZA");
    expect(sec).toContain("prevalecen sobre las señales individuales");
    expect(sec).toContain("cualquier otra lectura que tú harías de esa dimensión");
    expect(sec).toContain("no las uses para reclasificar la dimensión");
    expect(sec).toContain("Puedes señalar matices o incertidumbres");
    expect(sec).not.toMatch(/Claude|\d/);
  });
});

describe("las dos variantes", () => {
  it("con aprobación: «revisó y aprobó» y «en su caso»", () => {
    const s = seccionPrecedenciaPESTL(true);
    expect(s).toContain("revisó y aprobó y, en su caso, con los ajustes que hizo");
    expect(s).not.toContain("el vigente de este proyecto");
  });
  it("sin registro de revisión: «el vigente de este proyecto», sin afirmar que el usuario aprobó", () => {
    const s = seccionPrecedenciaPESTL(false);
    expect(s).toContain("El análisis PEST-L de arriba es el vigente de este proyecto.");
    expect(s).not.toMatch(/revisó|aprobó|en su caso/);
  });
  it("comparten exactamente la misma segunda parte (una sola constante)", () => {
    expect(seccionPrecedenciaPESTL(true).endsWith(PRECEDENCIA_PESTL_CUERPO)).toBe(true);
    expect(seccionPrecedenciaPESTL(false).endsWith(PRECEDENCIA_PESTL_CUERPO)).toBe(true);
  });
});

describe("frases ajustadas", () => {
  it("M2 revisa clasificación, narrativa y señales (ya no solo «señales relevantes»)", () => {
    const u = construir(true).M2.user;
    expect(u).toContain("Revisa TODAS las dimensiones PEST-L (su clasificación, su narrativa y sus señales)");
    expect(u).not.toContain("Escanea TODAS las dimensiones");
  });
  it("M4 considera todas las señales inciertas", () => {
    expect(construir(true).M4.user).toContain("Todas las señales inciertas del PEST-L");
  });
  it("lo que no se ajusta se conserva (M3 prioriza actores, M5 mantiene sus 2–4 factores)", () => {
    const p = construir(true);
    expect(p.M3.user).toContain("prioriza los de mayor riesgo");
    expect(p.M5.user).toContain("2–4 factores del PEST-L que favorecen el hito");
  });
});

describe("un solo constructor para las dos rutas", () => {
  it("generate-dvs y regenerate-m5 importan getDVSM5Prompt del mismo módulo", () => {
    for (const ruta of ["../../../app/api/moddulo/f2/generate-dvs/route.ts", "../../../app/api/moddulo/f2/regenerate-m5/route.ts"]) {
      const fuente = readFileSync(new URL(ruta, import.meta.url), "utf8");
      expect(fuente).toMatch(/getDVSM5Prompt[\s\S]{0,80}from "@\/lib\/ai\/phases\/prompts"|from "@\/lib\/ai\/phases\/prompts"[\s\S]*getDVSM5Prompt/);
      expect(fuente).not.toMatch(/function getDVSM5Prompt/);
    }
  });
});
