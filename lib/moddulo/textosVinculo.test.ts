import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as textos from "./textosVinculo";

const RAIZ = path.resolve(__dirname, "../..");

function fuentes(dir: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre === ".next" || nombre === "lib" && dir.endsWith("functions")) continue;
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) fuentes(ruta, salida);
    else if (/\.(ts|tsx)$/.test(nombre) && !/\.test\.(ts|tsx)$/.test(nombre) && !nombre.endsWith(".d.ts")) salida.push(ruta);
  }
  return salida;
}

describe("rechazos de vincular: ningún mensaje remite a «contacta soporte»", () => {
  it("los textos de textosVinculo.ts nombran un camino que existe en la pantalla", () => {
    for (const t of Object.values(textos)) {
      expect(t).not.toMatch(/soporte/i);
      expect(t.length).toBeGreaterThan(20);
    }
    expect(textos.MENSAJE_MODDULO_CON_OTRO_PESTEL).toContain("«Desvincular»");
    expect(textos.MENSAJE_MODDULO_OTRA_VERSION).toContain("«Regresar a Moddulo F2 con resultados»");
  });

  it("ningún archivo de app/, lib/ ni functions/src contiene la frase", () => {
    const hallados = ["app", "lib", "functions/src"]
      .flatMap((d) => fuentes(path.join(RAIZ, d)))
      .filter((f) => /contacta (a )?soporte/i.test(readFileSync(f, "utf-8")))
      .map((f) => path.relative(RAIZ, f));
    expect(
      hallados,
      `Estos archivos remiten a «contacta soporte»; di qué camino existe en la pantalla (ver lib/moddulo/textosVinculo.ts): ${hallados.join(", ")}`
    ).toEqual([]);
  });
});
