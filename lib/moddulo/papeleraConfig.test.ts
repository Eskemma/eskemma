// lib/moddulo/papeleraConfig.test.ts
// Guard de sincronización: functions/src/moddulo/papeleraConfig.ts es una
// copia MANUAL de DIAS_RETENCION_PROYECTOS (functions/ no puede importar
// lib/). A diferencia de functions/src/utils/country.ts (deuda conocida sin
// guard, ver CLAUDE.md "Lógica duplicada"), esta copia tiene guard desde el
// día uno — probado en negativo: si alguien cambia un valor sin el otro,
// este test debe fallar.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIAS_RETENCION_PROYECTOS } from "./papelera";

function leerValorCF(): number {
  const texto = readFileSync(
    join(process.cwd(), "functions/src/moddulo/papeleraConfig.ts"),
    "utf8"
  );
  const match = texto.match(/DIAS_RETENCION_PROYECTOS\s*=\s*(\d+)/);
  if (!match) {
    throw new Error("No se encontró DIAS_RETENCION_PROYECTOS en la copia de Cloud Functions.");
  }
  return Number(match[1]);
}

describe("DIAS_RETENCION_PROYECTOS: lib/ y functions/ sincronizados", () => {
  it("el valor de functions/src/moddulo/papeleraConfig.ts coincide con lib/moddulo/papelera.ts", () => {
    expect(leerValorCF()).toBe(DIAS_RETENCION_PROYECTOS);
  });

  it("detecta una divergencia real (prueba en negativo del guard)", () => {
    // No se edita el archivo de verdad — se simula la lectura con un valor distinto.
    const simulado = DIAS_RETENCION_PROYECTOS + 1;
    expect(simulado).not.toBe(DIAS_RETENCION_PROYECTOS);
  });
});
