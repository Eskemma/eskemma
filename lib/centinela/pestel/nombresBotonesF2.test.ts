// T8b — the button names quoted in the F2 prompt (block «CÓMO SE CONECTAN F2 Y LA APP PESTEL» and instruction B) and in
// the welcome message must exist today in the screen code. If a button is renamed, this test fails until the texts follow.
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getPhaseSystemPrompt } from "@/lib/ai/phases/prompts";

const RAIZ = path.resolve(__dirname, "../../..");
const leer = (p: string) => fs.readFileSync(path.join(RAIZ, p), "utf8");
const F2 = "app/moddulo/proyecto/[projectId]/exploracion";

/** Confirmed list (each name read in its file): file → names. */
export const BOTONES: Record<string, string[]> = {
  [`${F2}/page.tsx`]: ["Abrir PESTEL", "Regresar a PESTEL →", "Analizar con PESTEL", "Nuevo análisis", "Vincular con análisis independiente", "Editar narrativas", "Desvincular", "Vincular de nuevo"],
  [`${F2}/components/PendientePestel.tsx`]: ["Cancelar vínculo pendiente"],
  [`${F2}/components/AvisoOrigenPestel.tsx`]: ["Ver en Centinela →"],
  [`${F2}/components/M1Pie.tsx`]: ["Reabrir análisis"],
  "lib/moddulo/pantallaM1.ts": ["Aprobar análisis"],
  "app/components/centinela/pestel/ModduloButton.tsx": ["Iniciar proyecto en Moddulo", "Vincular a proyecto existente", "Regresar a Moddulo F2 con resultados"],
  "lib/moddulo/invitacionF1.ts": ["Ir a F1-Propósito →"],
  "app/centinela/pestel/[projectId]/datos/page.tsx": ["Ejecutar análisis IA"],
};
/** Screen titles (not buttons) the texts may quote; each is checked in its file too. */
const TITULOS: Record<string, string[]> = { [`${F2}/page.tsx`]: ["Análisis por motores"] };
const todos = Object.values(BOTONES).flat();
const citados = (t: string) => [...t.matchAll(/"([^"\n]+)"|«([^»\n]+)»/g)].map((m) => (m[1] ?? m[2]).trim());
const conocido = (n: string) => [...todos, ...Object.values(TITULOS).flat()].some((t) => n === t || n === `${t} ↺`);

describe("nombres de botón del prompt de F2 y de la bienvenida", () => {
  const prompt = getPhaseSystemPrompt("exploracion");
  const iBloque = prompt.indexOf("CÓMO SE CONECTAN F2 Y LA APP PESTEL");
  const iB = prompt.indexOf("B) Si el consultor dice que quiere usar la App PESTEL");
  const iRol = prompt.indexOf("TU ROL MIENTRAS EL CONSULTOR DECIDE");
  const iActuar = prompt.indexOf("CÓMO ACTUAR SEGÚN LA VÍA ELEGIDA");
  // The prohibition line quotes nothing, but it says "se importa automáticamente": it is excluded from the content checks.
  const sinProhibicion = (t: string) => t.split("\n").filter((l) => !l.includes("Nunca digas que algo se importa")).join("\n");
  const bloque = sinProhibicion(prompt.slice(iBloque, iActuar));
  const instruccionB = prompt.slice(iB, iRol);
  const bienvenida = leer("app/moddulo/components/ModduloChat.tsx").match(/exploracion: "(Estamos en la Fase 2[^\n]*?)",\n/)![1];

  it("los textos existen y están en el orden esperado", () => {
    expect(iBloque).toBeGreaterThan(0);
    expect(iActuar).toBeGreaterThan(iBloque);
    expect(iB).toBeGreaterThan(iActuar);
    expect(iRol).toBeGreaterThan(iB);
  });
  it("cada nombre de la lista existe hoy en su archivo", () => {
    for (const [archivo, nombres] of Object.entries(BOTONES)) for (const n of nombres) expect(leer(archivo), `${n} en ${archivo}`).toContain(n);
  });
  it("los títulos citados existen en su archivo", () => {
    for (const [archivo, nombres] of Object.entries(TITULOS)) for (const n of nombres) expect(leer(archivo), `${n} en ${archivo}`).toContain(n);
  });
  it("el bloque, la instrucción B y la bienvenida citan solo nombres de la lista", () => {
    const todosLosCitados = [...citados(bloque), ...citados(instruccionB), ...citados(bienvenida)];
    expect(todosLosCitados.length).toBeGreaterThan(5);
    const desconocidos = todosLosCitados.filter((n) => !conocido(n) && /^[A-ZÁÉÍÓÚ⋮]/.test(n) && n.split(" ").length <= 6);
    expect(desconocidos).toEqual([]);
  });
  it("[negativo] un nombre inventado sí lo detecta el verificador", () => {
    expect(citados('usa "Enviar a Centinela" y «Abrir PESTEL»').filter((n) => !conocido(n))).toEqual(["Enviar a Centinela"]);
  });
  it("(a)(b)(c) de «Empezar» dicen el lugar de cada botón", () => {
    expect(bloque).toContain('(a) sin análisis, botón "Abrir PESTEL" debajo del chat');
    expect(bloque).toContain('(b) con un análisis express ya hecho, menú ⋮ → "Analizar con PESTEL"');
    expect(bloque).toContain('(c) con un análisis importado o un proyecto PESTEL en preparación');
    expect(bloque).toContain('"Regresar a PESTEL →" en la barra "Análisis por motores"');
  });
  it("la instrucción B ya no dice «barra de botones» y no promete nada automático", () => {
    expect(instruccionB).not.toContain("barra de botones");
    expect(instruccionB).not.toContain("automáticamente");
    expect(instruccionB).toContain("debajo del chat");
  });
  it("ninguna afirmación de importación automática en el bloque ni en la bienvenida", () => {
    expect(bloque).not.toMatch(/se importa(n)? (a F2 )?automáticamente/);
    expect(bienvenida).not.toContain("recuperará automáticamente");
    expect(bienvenida).toContain("(conviene tener F1-Propósito completo)");
  });
  it("«Reabrir análisis» no se cita en «Ajustes» ni en ningún lado del bloque", () => {
    expect(bloque).not.toContain("Reabrir análisis");
  });
});
