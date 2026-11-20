// C4a-2a — los módulos puros del panel son importables desde un componente de CLIENTE: solo dependen de módulos que ya
// lo son (nada de `node:crypto`, Admin SDK, `registrar`, `huella` ni lectura de archivos). `next build` NO detecta esa
// fuga (se midió en C1a), así que lo guarda esta prueba estática.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(join(__dirname, "..", "..", "..", rel), "utf8").replace(/^\s*\/\/.*$/gm, "");
const imports = (src: string) => [...src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);

const PERMITIDOS: Record<string, string[]> = {
  "lib/moddulo/versionado/estadoPanelHistorial.ts": ["@/lib/versionado/lectura", "./textosHistorial", "@/lib/moddulo/guardadoHonesto"],
  "lib/moddulo/versionado/textosHistorial.ts": ["@/lib/versionado/tipos"],
  "lib/design/contraste.ts": [],
};

describe("módulos puros del panel: importables desde el cliente", () => {
  for (const [archivo, permitidos] of Object.entries(PERMITIDOS)) {
    it(`${archivo} solo importa ${permitidos.length ? permitidos.join(", ") : "nada"}`, () => {
      const src = leer(archivo);
      for (const i of imports(src)) expect(permitidos, `importa ${i}`).toContain(i);
      expect(src).not.toMatch(/node:crypto|node:fs|firebase-admin|require\(|\bfetch\(/);
    });
  }
});
