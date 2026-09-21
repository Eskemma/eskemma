// lib/design/tokensColor.test.ts
// Guard anti-regresión del design system de color.
//
// Dos clases de bug que NO truenan en `tsc` ni en `next build` (una clase de Tailwind es solo un
// string) y son no-op silencioso en runtime:
//   1. Tokens -eske que NO existen en globals.css (p. ej. el paso 50, `black-eske-60`/`-80` o
//      `blue-eske-900`): el texto hereda el color del ancestro. Incidentes reales: 26-09-12 (badges
//      "Archivado" casi invisibles en modo oscuro), 26-09-13 (~150 ocurrencias en Moddulo) y la
//      auditoría 26-09-20/21. Desde 26-09-21 NO hay remanentes tolerados: cualquier token -eske que
//      no esté definido en globals.css rompe el test (sin ratchet, sin topes).
//   2. Colores genéricos de la escala numérica de Tailwind (`bg-red-50`, `text-gray-400`…) en
//      componentes ya migrados al design system (PESTEL, sub-ronda 26-09-20).
//
// Se lee globals.css como fuente de verdad de qué tokens existen.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const COLORES_ESKE = "blue|orange|white|gray|black|bluegreen|yellow|brown|green|red";

function archivos(dir: string, out: string[] = []): string[] {
  for (const nombre of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${nombre}`;
    const abs = join(RAIZ, rel);
    if (statSync(abs).isDirectory()) {
      if (nombre === "node_modules" || nombre === ".next") continue;
      archivos(rel, out);
    } else if (/\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) out.push(rel);
  }
  return out;
}

const tokensDefinidos = new Set(
  [...readFileSync(join(RAIZ, "app/globals.css"), "utf8").matchAll(/--color-([a-z]+-eske(?:-\d+)?):/g)].map((m) => m[1])
);

/** Ocurrencias de tokens -eske NO definidos en un texto: {token → n}. Pura, para poder probar el escáner. */
export function tokensIndefinidosEnTexto(texto: string, definidos: Set<string> = tokensDefinidos): Record<string, number> {
  // Sin lookbehind de "-": el token va PRECEDIDO por "-" (`text-` + color-eske-paso). Sí exige que no lo
  // preceda una letra/dígito (así "bluegreen-eske" no se lee como "green-eske").
  const re = new RegExp(`(?<![a-zA-Z0-9])((?:${COLORES_ESKE})-eske(?:-\\d+)?)(?![\\w-])`, "g");
  const out: Record<string, number> = {};
  for (const m of texto.matchAll(re)) {
    if (definidos.has(m[1])) continue;
    out[m[1]] = (out[m[1]] ?? 0) + 1;
  }
  return out;
}

/** {archivo → {token indefinido → ocurrencias}} */
function tokensIndefinidos(dirs: string[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const f of dirs.flatMap((d) => archivos(d))) {
    const t = tokensIndefinidosEnTexto(readFileSync(join(RAIZ, f), "utf8"));
    if (Object.keys(t).length) out[f] = t;
  }
  return out;
}

// Todo el código de la app. (Cloud Functions no usa clases de Tailwind; el resto de directorios raíz con
// código —context, types, utils— se incluye para que un token inexistente no se esconda fuera de app/lib.)
const DIRS_CODIGO = ["app", "lib", "context", "types", "utils"];

describe("tokens -eske: todo lo que se usa existe en globals.css (sin remanentes tolerados)", () => {
  it("NINGÚN token -eske indefinido en todo el código (repo entero = 0)", () => {
    expect(tokensIndefinidos(DIRS_CODIGO)).toEqual({});
  });

  it("los tokens que nunca existieron siguen prohibidos por nombre: paso 50, black-eske-60/-70/-80 y blue-eske-900", () => {
    const usados = Object.values(tokensIndefinidos(DIRS_CODIGO)).flatMap((t) => Object.keys(t));
    const prohibidos = usados.filter((t) => /-50$/.test(t) || /^black-eske-(50|60|70|80)$/.test(t) || t === "blue-eske-900");
    expect(prohibidos).toEqual([]);
  });

  it("el escáner funciona: detecta los tokens fantasma históricos y no marca los reales (evita un pase vacuo)", () => {
    const muestra =
      'className="text-black-eske-60 text-black-eske-80 dark:text-[#9AAEBE] text-blue-eske-900 text-gray-eske-50 ' +
      'text-black-eske-20 text-black-eske-10 text-blue-eske-90 bg-bluegreen-eske text-black-eske"' +
      ' fill="var(--color-black-eske-60)" hover:text-black-eske-80/50';
    expect(tokensIndefinidosEnTexto(muestra)).toEqual({
      "black-eske-60": 2,
      "black-eske-80": 2,
      "blue-eske-900": 1,
      "gray-eske-50": 1,
    });
  });

  it("globals.css define los tokens del mapeo por rol y NO define los fantasma (la fuente de verdad es la correcta)", () => {
    for (const t of ["black-eske", "black-eske-10", "black-eske-20", "black-eske-40", "black-eske-90", "blue-eske-90", "gray-eske-90"]) {
      expect(tokensDefinidos.has(t), t).toBe(true);
    }
    for (const t of ["black-eske-50", "black-eske-60", "black-eske-70", "black-eske-80", "blue-eske-900", "gray-eske-50"]) {
      expect(tokensDefinidos.has(t), t).toBe(false);
    }
  });
});

describe("PESTEL: sin colores genéricos de la escala numérica de Tailwind", () => {
  const ESCALA = new RegExp(
    "(?<![\\w-])(?:[\\w\\[\\]&>-]+:)*(?:bg|text|border|ring|fill|stroke|from|to|via|divide|placeholder|outline|shadow|accent|decoration|caret)-" +
      "(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}(?:/\\d+)?(?![\\w/-])",
    "g"
  );
  const dirs = ["app/centinela/pestel", "app/components/centinela/pestel"];

  it("única excepción: el cuadrante 'Vigilar' de ImpactMatrix (violeta, sin equivalente en la paleta -eske; pendiente de decisión de diseño)", () => {
    const hallazgos: string[] = [];
    for (const f of dirs.flatMap((d) => archivos(d))) {
      for (const m of readFileSync(join(RAIZ, f), "utf8").matchAll(ESCALA)) hallazgos.push(`${f} ${m[0]}`);
    }
    const esperado = ["text-violet-700", "dark:text-violet-400", "bg-violet-100/40", "dark:bg-violet-900/20", "text-violet-700", "dark:text-violet-400"].map(
      (t) => `app/components/centinela/pestel/interpretacion/ImpactMatrix.tsx ${t}`
    );
    expect(hallazgos).toEqual(esperado);
  });
});
