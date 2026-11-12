// Static guard (no emulator) for the `retiros_rutas` rule in firestore.rules: the counters are written only by the
// Admin SDK and read from the Firestore console, so the client must have NO access at all. It checks TEXT (it does
// not run the rule), independent of spaces, line breaks and comments.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const normalizar = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ").replace(/\s+/g, "");

/** Body of the only `match /retiros_rutas/{...} { ... }`, or null if there is not exactly one. */
export function bloqueRetiros(reglas: string): string | null {
  const n = normalizar(reglas);
  const cab = [...n.matchAll(/match\/retiros_rutas\/\{[A-Za-z]+\}\{/g)];
  if (cab.length !== 1) return null;
  let i = cab[0].index! + cab[0][0].length;
  const desde = i;
  let nivel = 1;
  while (i < n.length && nivel > 0) {
    if (n[i] === "{") nivel++;
    else if (n[i] === "}") nivel--;
    i++;
  }
  return nivel === 0 ? n.slice(desde, i - 1) : null;
}

export function problemasRetiros(bloque: string | null): string[] {
  if (bloque === null) return ["no hay exactamente un bloque match /retiros_rutas/{...}"];
  return bloque === "allowread,write:iffalse;" ? [] : [`el bloque no es «allow read, write: if false;»: ${bloque}`];
}

describe("firestore.rules — retiros_rutas (guarda estática)", () => {
  it("el archivo real cierra la colección al cliente", () => {
    const reglas = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");
    expect(problemasRetiros(bloqueRetiros(reglas))).toEqual([]);
  });
  it("[negativo] un read abierto, un write abierto, un bloque duplicado o ausente no pasan", () => {
    const base = (cuerpo: string) => `match /retiros_rutas/{r} { ${cuerpo} }`;
    expect(problemasRetiros(bloqueRetiros(base("allow read, write: if false;")))).toEqual([]);
    expect(problemasRetiros(bloqueRetiros(base("allow read: if request.auth != null;")))).not.toEqual([]);
    expect(problemasRetiros(bloqueRetiros(base("allow read, write: if request.auth != null;")))).not.toEqual([]);
    expect(problemasRetiros(bloqueRetiros(base("allow read: if false; allow write: if true;")))).not.toEqual([]);
    expect(problemasRetiros(bloqueRetiros("match /otra/{x} { allow read: if false; }"))).not.toEqual([]);
    expect(problemasRetiros(bloqueRetiros(base("allow read, write: if false;") + base("allow read, write: if false;")))).not.toEqual([]);
  });
  it("no depende de espacios, saltos de línea ni comentarios", () => {
    expect(problemasRetiros(bloqueRetiros("match /retiros_rutas/{r}{\n // c\n allow   read ,\n write :\n if   false ;\n}"))).toEqual([]);
  });
});
