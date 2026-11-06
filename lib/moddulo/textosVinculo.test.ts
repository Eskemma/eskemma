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
    // T7 C2: el módulo exporta también una función (el conteo de sesgos); se prueba su salida con un conteo real.
    const todos = Object.values(textos).map((t) => (typeof t === "function" ? t(3) : t)) as string[];
    expect(todos.length).toBeGreaterThan(8);
    for (const t of todos) {
      expect(typeof t).toBe("string");
      expect(t).not.toMatch(/soporte/i);
      expect(t.length).toBeGreaterThan(20);
    }
    expect(textos.MENSAJE_MODDULO_CON_OTRO_PESTEL).toContain("«Desvincular»");
    expect(textos.MENSAJE_MODDULO_OTRA_VERSION).toContain("«Regresar a Moddulo F2 con resultados»");
    // Gate de origen (T7 C2): cada frase nombra un control que existe.
    expect(textos.MENSAJE_ORIGEN_NO_APROBADO).toContain("«Finalizar interpretación»");
    expect(textos.MENSAJE_ORIGEN_UN_SESGO).toContain("«Marcar como revisado»");
    expect(textos.mensajeOrigenSesgos(3)).toContain("3 alertas");
    expect(textos.mensajeOrigenSesgos(3)).toContain("«Marcar como revisado»");
    expect(textos.CAMINO_ORIGEN_VIGENTE).toContain("«Regresar a Moddulo F2 con resultados»");
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
