// T4 — contrato de escritores, CAPA A: todo archivo que escribe en Firestore y menciona la colección
// `pestel_analyses` está en ESCRITORES_DE_ANALISIS. Ver escritoresDeAnalisis.ts para el porqué.
//
// Límites declarados: el escaneo es por texto. No ve una escritura hecha por un helper en OTRO archivo ni una
// colección cuyo nombre se arma dinámicamente; esos casos los cubre la capa B solo para las rutas listadas.

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ESCRITORES_DE_ANALISIS } from "./escritoresDeAnalisis";

const RAIZ = path.resolve(__dirname, "../../..");
const DIRS = ["app", "lib", "functions/src", "scripts"];
const ESCRITURA = /\.(update|set|add|delete|create)\(|\btx\.(update|set|delete)\b|\bbatch\.|\barrayUnion\b|FieldValue\.delete/;

function archivos(dir: string, salida: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === "lib" && dir.endsWith("functions")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivos(p, salida);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) salida.push(p);
  }
  return salida;
}

/** Quita comentarios (bloque y de línea) para no contar menciones ni escrituras que solo están en texto explicativo. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("contrato de escritores de pestel_analyses — capa A", () => {
  const encontrados = DIRS.flatMap((d) => {
    const dir = path.join(RAIZ, d);
    return fs.existsSync(dir) ? archivos(dir) : [];
  })
    .map((abs) => ({ rel: path.relative(RAIZ, abs).split(path.sep).join("/"), codigo: sinComentarios(fs.readFileSync(abs, "utf8")) }))
    .filter((f) => f.codigo.includes("pestel_analyses") && ESCRITURA.test(f.codigo));

  it("el escaneo encuentra archivos (no es un pase vacío)", () => {
    expect(encontrados.length).toBeGreaterThanOrEqual(10);
  });

  it("todo archivo que escribe y menciona la colección está en la lista", () => {
    const registrados = new Set(ESCRITORES_DE_ANALISIS.map((e) => e.archivo));
    const faltan = encontrados.filter((f) => !registrados.has(f.rel)).map((f) => f.rel);
    expect(
      faltan,
      faltan
        .map(
          (r) =>
            `[contrato pestel_analyses] El archivo ${r} escribe en Firestore y menciona la colección pestel_analyses, pero no está en ESCRITORES_DE_ANALISIS (lib/centinela/pestel/escritoresDeAnalisis.ts). ` +
            "Razón: la huella de origen asume que solo `adjust` cambia `dimensions`/`adjustments` de un análisis existente. " +
            "Pasos: 1) revisa que no escriba dimensions, adjustments, globalConfidence ni version; 2) agrégalo a la lista con { archivo, toca, nota }; " +
            "3) si SÍ los escribe, detente y avisa antes de seguir."
        )
        .join("\n")
    ).toEqual([]);
  });

  it("una entrada obsoleta (el archivo ya no existe o ya no escribe) solo avisa, no falla", () => {
    const vistos = new Set(encontrados.map((f) => f.rel));
    const obsoletas = ESCRITORES_DE_ANALISIS.filter((e) => !vistos.has(e.archivo)).map((e) => e.archivo);
    if (obsoletas.length > 0) console.warn(`[contrato pestel_analyses] entradas que el escaneo ya no ve: ${obsoletas.join(", ")}`);
    expect(Array.isArray(obsoletas)).toBe(true);
  });

  it("cada entrada declara qué toca y nadie declara tocar los campos protegidos", () => {
    for (const e of ESCRITORES_DE_ANALISIS) {
      expect(e.nota.length, e.archivo).toBeGreaterThan(10);
      for (const campo of ["dimensions", "globalConfidence", "version"]) {
        expect(e.toca, `${e.archivo} declara tocar ${campo}`).not.toContain(campo);
      }
    }
  });

  it("el escáner detecta lo que debe: un archivo sintético con escritura y mención se ve; uno sin escritura o solo comentado, no", () => {
    const ve = (src: string) => sinComentarios(src).includes("pestel_analyses") && ESCRITURA.test(sinComentarios(src));
    expect(ve('db.collection("pestel_analyses").doc(i).update({ x: 1 });')).toBe(true);
    expect(ve('const s = db.collection("pestel_analyses").doc(i).get();')).toBe(false);
    expect(ve('// pestel_analyses\ndb.collection("otra").doc(i).update({ x: 1 });')).toBe(false);
    expect(ve('/* pestel_analyses */ tx.update(ref, {});')).toBe(false);
  });
});
