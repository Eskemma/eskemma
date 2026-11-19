// C4a-1 — guarda del índice compuesto que necesita el lector del historial (H-V45): `eventos (fase ↑, revisionN ↓)`.
// Una consulta `where fase == … orderBy revisionN desc` SIN este índice falla en Firestore real (el mock no lo
// ejercita). La prueba exige (1) la definición en `firestore.indexes.json` y (2) que la consulta del lector use
// EXACTAMENTE esos campos y ese orden (si cambia una, cambia la otra).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..");

describe("índice compuesto de eventos", () => {
  const indices = JSON.parse(readFileSync(join(RAIZ, "firestore.indexes.json"), "utf8")).indexes as Array<{
    collectionGroup: string; queryScope: string; fields: Array<{ fieldPath: string; order: string }>;
  }>;

  it("firestore.indexes.json define `eventos` con fase ASC y revisionN DESC (ámbito de colección)", () => {
    const i = indices.filter((x) => x.collectionGroup === "eventos");
    expect(i).toHaveLength(1);
    expect(i[0].queryScope).toBe("COLLECTION");
    expect(i[0].fields).toEqual([
      { fieldPath: "fase", order: "ASCENDING" },
      { fieldPath: "revisionN", order: "DESCENDING" },
    ]);
  });

  it("los índices que ya existían siguen (no se borró ninguno)", () => {
    const nombres = indices.map((x) => x.collectionGroup).sort();
    expect(nombres).toEqual(expect.arrayContaining(["pestel_alerts", "pestel_indicator_cache", "eventos"]));
  });

  it("la consulta del lector usa esos mismos campos y ese orden", () => {
    const src = readFileSync(join(RAIZ, "lib/moddulo/versionado/leerHistorial.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
    expect(src).toMatch(/\.collection\("eventos"\)\.where\("fase",\s*"==",\s*fase\)\.orderBy\("revisionN",\s*"desc"\)/);
  });

  it("ningún otro lugar del repo consulta `eventos` fuera del registrador y del lector", () => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const usos: string[] = [];
    for (const dir of ["app", "lib"]) {
      for (const rel of readdirSync(join(RAIZ, dir), { recursive: true }) as string[]) {
        if (!/\.tsx?$/.test(rel) || /\.test\.|__tests__/.test(rel)) continue;
        const ruta = join(RAIZ, dir, rel);
        if (!statSync(ruta).isFile()) continue;
        if (/collection\("eventos"\)/.test(readFileSync(ruta, "utf8"))) usos.push(`${dir}/${rel}`);
      }
    }
    // El registrador ESCRIBE los eventos y el lector los consulta; nadie más (una consulta nueva exigiría su índice).
    expect(usos.sort()).toEqual(["lib/moddulo/versionado/leerHistorial.ts", "lib/versionado/registrar.ts"]);
  });
});
