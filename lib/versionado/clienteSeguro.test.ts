// C1a — qué se puede importar desde un componente de CLIENTE. `tipos.ts` no puede arrastrar `node:crypto` ni el
// Admin SDK; `retencion.ts` y `tamano.ts` (puros) solo pueden depender de `tipos.ts`. Complementa la
// verificación con `next build` (guía): esta prueba la mantiene aunque nadie vuelva a construir.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const leer = (nombre: string) => readFileSync(join(__dirname, nombre), "utf8");
/** Código sin comentarios de línea (los comentarios pueden NOMBRAR node:crypto sin importarlo). */
const sinComentarios = (fuente: string) => fuente.replace(/^\s*\/\/.*$/gm, "");
const importsDe = (fuente: string) => [...fuente.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
const importsDeTipos = (fuente: string) =>
  [...fuente.matchAll(/^\s*import\s+type\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);

describe("módulos importables desde cliente", () => {
  it("tipos.ts no importa NADA (ni node:crypto, ni el Admin SDK, ni otros módulos)", () => {
    const f = sinComentarios(leer("tipos.ts"));
    expect(importsDe(f)).toEqual([]);
    expect(f).not.toMatch(/node:crypto|firebase-admin|require\(/);
  });
  it("retencion.ts y tamano.ts (puros) solo dependen de tipos.ts, y tamano.ts no usa node:crypto", () => {
    for (const n of ["retencion.ts", "tamano.ts"]) {
      const f = sinComentarios(leer(n));
      const runtime = importsDe(f).filter((i) => !importsDeTipos(f).includes(i) || /^\.\/tipos$/.test(i));
      expect(runtime.every((i) => i === "./tipos")).toBe(true);
      expect(f).not.toMatch(/node:crypto|firebase-admin/);
    }
  });
  it("lo que usa node:crypto o el Admin SDK es SOLO SERVIDOR y está declarado como tal", () => {
    for (const n of ["huella.ts", "registrar.ts", "serializacion.ts"]) {
      const f = sinComentarios(leer(n));
      const usaServidor = /node:crypto|firebase-admin|lib\/moddulo\/serializacionEstable/.test(f);
      expect(usaServidor, `${n} debería depender de algo solo-servidor`).toBe(true);
    }
    expect(leer("index.ts")).toMatch(/SOLO SERVIDOR/);
    expect(leer("tipos.ts")).toMatch(/SEGURO PARA CLIENTE/);
  });
});
