// H75 / B0 — guarda estática del techo de duración de generate-report.
// Un informe puede tardar 70-120 s en generarse (≈ 50 tok/s: Insights de 3165 tokens = 69 s, 6000 tokens ≈ 118 s), así que con
// el techo de 60 s la plataforma podía cortar CUALQUIERA de los cinco formatos. 300 s es el máximo de Vercel Hobby con Fluid.
// Se lee el texto del archivo (no se importa la ruta) para fijar el valor declarado sin montar Firebase ni el SDK.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RUTA = join(__dirname, "route.ts");

describe("generate-report — maxDuration (B0)", () => {
  it("declara exactamente un maxDuration y vale 300", () => {
    const fuente = readFileSync(RUTA, "utf8");
    const declaraciones = [...fuente.matchAll(/^export const maxDuration\s*=\s*(\d+)\s*;/gm)];
    expect(declaraciones).toHaveLength(1);
    expect(Number(declaraciones[0][1])).toBe(300);
  });
});
