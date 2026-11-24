// app/dev/guardaDev.test.ts
// Guarda estática de las páginas de prueba (app/dev). Exige DOS capas:
//   1. proxy.ts da 404 REAL a /dev y /dev/* en producción (un notFound() en un
//      layout NO lo da: responde 200 con la página «no encontrada»; medido el
//      24-nov-2026 con next build + next start, H-V83).
//   2. Cada página queda guardada en el código:
//      · si lee secretos o consulta algo (importa "@/lib/dev/", usa
//        process.env, fetch o es "use client"): la guarda
//        `if (process.env.NODE_ENV === "production") notFound();` es la
//        PRIMERA sentencia de su page.tsx (así no se lee nada aunque el proxy
//        fallara; un layout no sirve: layout y página se renderizan en paralelo);
//      · si no (p. ej. geo-test): basta un layout.tsx con la guarda en su
//        carpeta o en una carpeta ancestro dentro de app/dev.
// Un page.tsx nuevo bajo app/dev sin guarda rompe este archivo.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();
const DIR_DEV = path.join(RAIZ, "app", "dev");

const GUARDA = 'if (process.env.NODE_ENV === "production") notFound();';
const IMPORTA_NOTFOUND =
  /import\s*\{[^}]*\bnotFound\b[^}]*\}\s*from\s*["']next\/navigation["']/;

/** Quita comentarios de línea y de bloque (suficiente para estos archivos). */
export function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** ¿La guarda es la primera sentencia de la función exportada por defecto? */
export function guardaEsPrimeraSentencia(src: string): boolean {
  const limpio = sinComentarios(src);
  if (!IMPORTA_NOTFOUND.test(limpio)) return false;
  const m = limpio.match(
    /export\s+default\s+(?:async\s+)?function\s+\w*\s*\([^)]*\)\s*(?::\s*[^{]+)?\{\s*/
  );
  if (!m || m.index === undefined) return false;
  const cuerpo = limpio.slice(m.index + m[0].length);
  return cuerpo.startsWith(GUARDA);
}

/** ¿El layout contiene la guarda y llama a notFound importado? */
export function layoutTieneGuarda(src: string): boolean {
  const limpio = sinComentarios(src);
  return IMPORTA_NOTFOUND.test(limpio) && limpio.includes(GUARDA);
}

/** ¿La página lee secretos o consulta algo (necesita guarda propia)? */
export function paginaNecesitaGuardaPropia(src: string): boolean {
  const limpio = sinComentarios(src);
  return (
    /^\s*["']use client["']/.test(limpio) ||
    /from\s*["']@\/lib\/dev\//.test(limpio) ||
    /process\.env\.(?!NODE_ENV\b)/.test(limpio) ||
    /\bfetch\s*\(/.test(limpio)
  );
}

/** Rama de /dev en proxy.ts: 404 real, antes de buscar reglas, y matcher. */
export function proxyDa404ADev(src: string): string[] {
  const problemas: string[] = [];
  const limpio = sinComentarios(src);
  const iRama = limpio.indexOf('pathname.startsWith("/dev/")');
  const iRegla = limpio.indexOf("PROTECTED_ROUTES.find");
  if (iRama === -1) problemas.push("falta la rama de /dev");
  if (iRegla === -1) problemas.push("no se encontró PROTECTED_ROUTES.find");
  if (iRama !== -1 && iRegla !== -1 && iRama > iRegla)
    problemas.push("la rama de /dev debe ir ANTES de buscar reglas");
  const bloque = iRama === -1 ? "" : limpio.slice(Math.max(0, iRama - 200), iRama + 400);
  if (!/process\.env\.NODE_ENV\s*===\s*"production"/.test(bloque))
    problemas.push("la rama de /dev no condiciona a producción");
  if (!/NextResponse\.rewrite\(/.test(bloque) || !/status:\s*404/.test(bloque))
    problemas.push("la rama de /dev no responde con rewrite y status 404");
  if (!/matcher:\s*\[[\s\S]*"\/dev\/:path\*"[\s\S]*\]/.test(limpio))
    problemas.push('el matcher no incluye "/dev/:path*"');
  return problemas;
}

function archivosBajo(dir: string, nombre: string): string[] {
  const salida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...archivosBajo(p, nombre));
    else if (e.name === nombre) salida.push(p);
  }
  return salida;
}

const leer = (p: string) => fs.readFileSync(p, "utf8");

/** Layouts de la carpeta de la página y de sus ancestros dentro de app/dev. */
function layoutsQueCubren(pagina: string): string[] {
  const resultado: string[] = [];
  let dir = path.dirname(pagina);
  while (dir.startsWith(DIR_DEV)) {
    const l = path.join(dir, "layout.tsx");
    if (fs.existsSync(l)) resultado.push(l);
    if (dir === DIR_DEV) break;
    dir = path.dirname(dir);
  }
  return resultado;
}

describe("app/dev — páginas de prueba solo para desarrollo local", () => {
  const paginas = archivosBajo(DIR_DEV, "page.tsx");

  it("el escáner encuentra las 4 páginas conocidas (evita un pase vacuo)", () => {
    const nombres = paginas.map((p) => path.relative(DIR_DEV, path.dirname(p))).sort();
    expect(nombres).toEqual(["fontana-banxico", "fontana-inegi", "fontana-iter", "geo-test"]);
  });

  it("proxy.ts da 404 real a /dev y /dev/* en producción", () => {
    expect(proxyDa404ADev(leer(path.join(RAIZ, "proxy.ts")))).toEqual([]);
  });

  for (const pagina of paginas) {
    const rel = path.relative(RAIZ, pagina);
    it(`${rel}: tiene guarda`, () => {
      const src = leer(pagina);
      if (paginaNecesitaGuardaPropia(src) && !/^\s*["']use client["']/.test(src)) {
        expect(guardaEsPrimeraSentencia(src), `${rel}: la guarda debe ser la primera sentencia`).toBe(true);
      } else {
        const layouts = layoutsQueCubren(pagina);
        expect(
          layouts.some((l) => layoutTieneGuarda(leer(l))),
          `${rel}: sin guarda propia necesita un layout.tsx con la guarda`
        ).toBe(true);
      }
    });
  }

  it("las 3 páginas con tokens llevan la guarda propia como primera sentencia", () => {
    for (const n of ["fontana-banxico", "fontana-inegi", "fontana-iter"]) {
      const src = leer(path.join(DIR_DEV, n, "page.tsx"));
      expect(paginaNecesitaGuardaPropia(src)).toBe(true);
      expect(guardaEsPrimeraSentencia(src), n).toBe(true);
    }
  });

  it("geo-test tiene su layout con guarda", () => {
    expect(layoutTieneGuarda(leer(path.join(DIR_DEV, "geo-test", "layout.tsx")))).toBe(true);
  });
});

describe("el propio escáner (negativos)", () => {
  const ok = `import { notFound } from "next/navigation";
export default async function P() {
  // c
  if (process.env.NODE_ENV === "production") notFound();
  const x = await algo();
}`;
  it("acepta la forma correcta", () => expect(guardaEsPrimeraSentencia(ok)).toBe(true));
  it("rechaza la guarda tras otra sentencia", () =>
    expect(guardaEsPrimeraSentencia(ok.replace("  // c\n", "  const t = process.env.X;\n"))).toBe(false));
  it("rechaza si falta el import de notFound", () =>
    expect(guardaEsPrimeraSentencia(ok.replace(/import[^\n]*\n/, ""))).toBe(false));
  it("rechaza si falta la guarda", () =>
    expect(guardaEsPrimeraSentencia(ok.replace(/\s*if \(process[^\n]*\n/, "\n"))).toBe(false));
  it("rechaza la condición invertida", () =>
    expect(guardaEsPrimeraSentencia(ok.replace("=== ", "!== "))).toBe(false));
  it("el layout sin guarda no pasa", () =>
    expect(layoutTieneGuarda('import { notFound } from "next/navigation"; export default function L(){return null}')).toBe(false));
  it("una guarda dentro de un comentario no cuenta", () =>
    expect(guardaEsPrimeraSentencia(ok.replace(GUARDA, "// " + GUARDA))).toBe(false));
  it("detecta páginas que leen secretos o consultan", () => {
    expect(paginaNecesitaGuardaPropia('import { x } from "@/lib/dev/a";')).toBe(true);
    expect(paginaNecesitaGuardaPropia("const t = process.env.INEGI_TOKEN;")).toBe(true);
    expect(paginaNecesitaGuardaPropia("await fetch(url)")).toBe(true);
    expect(paginaNecesitaGuardaPropia("export default function P(){return <p/>}")).toBe(false);
  });
  it("proxy sin la rama, sin matcher o con la rama tarde no pasa", () => {
    const bueno = `export async function proxy(request) {
  const { pathname } = request.nextUrl;
  if (process.env.NODE_ENV === "production" && (pathname === "/dev" || pathname.startsWith("/dev/"))) {
    return NextResponse.rewrite(new URL("/x", request.url), { status: 404 });
  }
  const rule = PROTECTED_ROUTES.find((r) => r.pattern.test(pathname));
}
export const config = { matcher: ["/a/:path*", "/dev/:path*"] };`;
    expect(proxyDa404ADev(bueno)).toEqual([]);
    expect(proxyDa404ADev(bueno.replace('"/dev/:path*"', '"/zzz/:path*"')).length).toBeGreaterThan(0);
    expect(proxyDa404ADev(bueno.replace("status: 404", "status: 200")).length).toBeGreaterThan(0);
    expect(proxyDa404ADev(bueno.replace('=== "production"', '!== "production"')).length).toBeGreaterThan(0);
    const tarde = bueno.replace(/  if \(process[\s\S]*?\n  }\n/, "").replace("const rule", "const rule") + "";
    expect(proxyDa404ADev(tarde).length).toBeGreaterThan(0);
  });
});
