// Guarda estática (sin emulador) de la regla de `pestel_analyses` en firestore.rules.
// Por qué: la colección solo la escriben rutas con Admin SDK y Cloud Functions (que ignoran las reglas); ningún cliente
// web la escribe. La regla anterior (`affectedKeys().hasAny([...])`) dejaba al dueño cambiar `userId`, `dimensions`,
// `informes`, etc. con solo tocar una de seis claves. Aquí se fija que `update` esté cerrado. Es una comprobación de
// TEXTO (no ejecuta la regla): no depende de espacios, saltos de línea ni comentarios.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Quita los comentarios de línea y de bloque, elimina TODO el espacio en blanco (así `if false` y `iffalse` son lo mismo para la comparación). */
export function normalizarReglas(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, "");
}

/** Devuelve el cuerpo (ya normalizado) de `match /<coleccion>/{...} { ... }`, o null si no hay exactamente uno. */
export function bloqueDeColeccion(reglas: string, coleccion: string): string | null {
  const n = normalizarReglas(reglas);
  const cabecera = new RegExp(`match/${coleccion}/\\{[A-Za-z]+\\}\\{`, "g");
  const inicios = [...n.matchAll(cabecera)];
  if (inicios.length !== 1) return null;
  let i = inicios[0].index! + inicios[0][0].length;
  const desde = i;
  let nivel = 1;
  while (i < n.length && nivel > 0) {
    if (n[i] === "{") nivel++;
    else if (n[i] === "}") nivel--;
    i++;
  }
  return nivel === 0 ? n.slice(desde, i - 1) : null;
}

const SENTENCIAS_ESPERADAS = [
  "allowread:ifrequest.auth!=null&&resource.data.userId==request.auth.uid",
  "allowupdate:iffalse",
  "allowcreate,delete:iffalse",
].sort();

/** Problemas del bloque; lista vacía = cumple (update cerrado, create/delete cerrados, read solo del dueño). */
export function problemasDelBloque(bloque: string | null): string[] {
  if (bloque === null) return ["no hay exactamente un bloque match /pestel_analyses/{...}"];
  const problemas: string[] = [];
  if (/hasAny/.test(bloque)) problemas.push("usa hasAny (denylist)");
  const sinEspacios = bloque.split(";").filter(Boolean);
  const esperadas = SENTENCIAS_ESPERADAS;
  for (const s of sinEspacios) if (!esperadas.includes(s)) problemas.push(`sentencia inesperada: ${s}`);
  for (const e of esperadas) if (!sinEspacios.includes(e)) problemas.push(`falta la sentencia: ${e}`);
  return problemas;
}

const REGLA_ANTERIOR = `
    match /pestel_analyses/{analysisId} {
      allow read: if request.auth != null
        && resource.data.userId == request.auth.uid;
      // Allow updating: bias acknowledgement (E5), human adjustments (E6), approval (E6)
      allow update: if request.auth != null
        && resource.data.userId == request.auth.uid
        && request.resource.data.diff(resource.data)
             .affectedKeys().hasAny([
               "biasAlerts", "status", "updatedAt",
               "adjustments", "approvedAt", "approvedBy"
             ]);
      allow create, delete: if false;
    }`;

describe("firestore.rules — pestel_analyses (guarda estática)", () => {
  const reglas = readFileSync(join(process.cwd(), "firestore.rules"), "utf-8");

  it("el archivo real tiene un solo bloque y cumple: update cerrado, create/delete cerrados, read solo del dueño", () => {
    const bloque = bloqueDeColeccion(reglas, "pestel_analyses");
    expect(problemasDelBloque(bloque)).toEqual([]);
  });

  it("[negativo] la regla anterior (hasAny) NO pasa la guarda", () => {
    const p = problemasDelBloque(bloqueDeColeccion(REGLA_ANTERIOR, "pestel_analyses"));
    expect(p.length).toBeGreaterThan(0);
    expect(p.join(" ")).toContain("hasAny");
  });

  it("la variante hasOnly con las seis claves tampoco pasa (permitiría forjar status/approvedBy desde el cliente)", () => {
    const a = REGLA_ANTERIOR.replace("hasAny", "hasOnly");
    expect(problemasDelBloque(bloqueDeColeccion(a, "pestel_analyses")).length).toBeGreaterThan(0);
  });

  it("no depende de espacios, saltos de línea ni comentarios", () => {
    const a = `match /pestel_analyses/{analysisId}{allow read:if request.auth!=null&&resource.data.userId==request.auth.uid;allow update:if false;allow create,delete:if false;}`;
    const b = `
      match   /pestel_analyses/{ analysisId }   {
        // allow update: if request.resource.data.diff(resource.data).affectedKeys().hasAny(["x"]);
        /* hasAny en un comentario de bloque */
        allow read:
          if request.auth != null
          && resource.data.userId == request.auth.uid;
        allow update:   if   false ;
        allow create ,  delete : if false;
      }`;
    expect(problemasDelBloque(bloqueDeColeccion(a, "pestel_analyses"))).toEqual([]);
    expect(problemasDelBloque(bloqueDeColeccion(b, "pestel_analyses"))).toEqual([]);
  });

  it("detecta: update abierto, write, read de cualquiera, falta create/delete, bloque duplicado o ausente", () => {
    const base = (cuerpo: string) => `match /pestel_analyses/{id} { ${cuerpo} }`;
    const leer = "allow read: if request.auth != null && resource.data.userId == request.auth.uid;";
    const cerrar = "allow create, delete: if false;";
    expect(problemasDelBloque(bloqueDeColeccion(base(`${leer} allow update: if request.auth != null; ${cerrar}`), "pestel_analyses")).length).toBeGreaterThan(0);
    expect(problemasDelBloque(bloqueDeColeccion(base(`${leer} allow update: if false; allow write: if true;`), "pestel_analyses")).length).toBeGreaterThan(0);
    expect(problemasDelBloque(bloqueDeColeccion(base(`allow read: if request.auth != null; allow update: if false; ${cerrar}`), "pestel_analyses")).length).toBeGreaterThan(0);
    expect(problemasDelBloque(bloqueDeColeccion(base(`${leer} allow update: if false;`), "pestel_analyses")).length).toBeGreaterThan(0);
    expect(problemasDelBloque(bloqueDeColeccion(`${base(`${leer} allow update: if false; ${cerrar}`)} ${base(`${leer} allow update: if false; ${cerrar}`)}`, "pestel_analyses"))).toEqual(["no hay exactamente un bloque match /pestel_analyses/{...}"]);
    expect(problemasDelBloque(bloqueDeColeccion("match /otra/{id} { allow read: if false; }", "pestel_analyses"))).toEqual(["no hay exactamente un bloque match /pestel_analyses/{...}"]);
  });

  it("no toca a las colecciones vecinas: su bloque se extrae aparte y no entra en el de pestel_analyses", () => {
    const bloque = bloqueDeColeccion(reglas, "pestel_analyses")!;
    expect(bloque).not.toContain("pestel_alerts");
    expect(bloqueDeColeccion(reglas, "pestel_projects")).not.toBeNull();
  });
});
