// C4a-1 — `lectura.ts` es importable desde un componente de CLIENTE: solo depende de `tipos.ts` (ni `node:crypto`, ni el
// Admin SDK, ni otros módulos). Complementa `clienteSeguro.test.ts` (que no se edita) para el archivo nuevo.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "lectura.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
const importaciones = [...src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);

describe("lectura.ts importable desde cliente", () => {
  it("solo importa `./tipos`", () => {
    expect(importaciones.every((i) => i === "./tipos")).toBe(true);
  });
  it("no usa node:crypto, el Admin SDK ni require", () => {
    expect(src).not.toMatch(/node:crypto|firebase-admin|require\(|\bfs\b/);
  });
});
