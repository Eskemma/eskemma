// lib/design/tokensColor.test.ts
// Guard anti-regresión del design system de color (ratchet, mismo patrón que estados.test.ts).
//
// Dos clases de bug que NO truenan en `tsc` ni en `next build` (una clase de Tailwind es solo un
// string) y son no-op silencioso en runtime:
//   1. Tokens -eske que NO existen en globals.css (p. ej. el paso 50 de gray-eske, o black-eske-60):
//      el texto hereda el color del ancestro. Incidentes reales: 26-09-12 (badges "Archivado" casi
//      invisibles en modo oscuro) y 26-09-13 (~150 ocurrencias en Moddulo). Sub-ronda 26-09-20:
//      el paso 50 llegó a 0 en todo el repo.
//   2. Colores genéricos de la escala numérica de Tailwind (`bg-red-50`, `text-gray-400`…) en
//      componentes ya migrados al design system (PESTEL, sub-ronda 26-09-20).
//
// Se lee globals.css como fuente de verdad de qué tokens existen. Los remanentes CONOCIDOS de la
// clase 1 están en TOPE_REMANENTE: pueden bajar (y deben, bajando también el tope), nunca subir.

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

/** {archivo → {token indefinido → ocurrencias}} */
function tokensIndefinidos(dirs: string[]): Record<string, Record<string, number>> {
  // Sin lookbehind de "-": el token va PRECEDIDO por "-" (`text-` + color-eske-paso). Sí exige que no lo
  // preceda una letra/dígito (así "bluegreen-eske" no se lee como "green-eske").
  const re = new RegExp(`(?<![a-zA-Z0-9])((?:${COLORES_ESKE})-eske(?:-\\d+)?)(?![\\w-])`, "g");
  const out: Record<string, Record<string, number>> = {};
  for (const f of dirs.flatMap((d) => archivos(d))) {
    for (const m of readFileSync(join(RAIZ, f), "utf8").matchAll(re)) {
      if (tokensDefinidos.has(m[1])) continue;
      ((out[f] ??= {})[m[1]] ??= 0);
      out[f][m[1]]++;
    }
  }
  return out;
}

function totalPorToken(r: Record<string, Record<string, number>>): Record<string, number> {
  const t: Record<string, number> = {};
  for (const porToken of Object.values(r)) for (const [tok, n] of Object.entries(porToken)) t[tok] = (t[tok] ?? 0) + n;
  return t;
}

// Remanentes conocidos (2026-09-20), pendientes de sus propias sub-rondas: Sefix (`black-eske-60`, 224),
// Fontana (`black-eske-80`, 131) y el resto del sitio. BAJAR estos topes al corregir; nunca subirlos.
const TOPE_REMANENTE: Record<string, number> = {
  "black-eske-60": 252,
  "black-eske-80": 148,
  "blue-eske-900": 1,
};

describe("tokens -eske: todo lo que se usa existe en globals.css", () => {
  const global = tokensIndefinidos(["app", "lib"]);

  it("el paso 50 no existe y NO se usa en ningún archivo (llegó a 0 el 2026-09-20)", () => {
    const con50 = Object.entries(global).filter(([, t]) => Object.keys(t).some((k) => /-50$/.test(k)));
    expect(con50.map(([f]) => f)).toEqual([]);
  });

  it("el escáner funciona: ve los remanentes conocidos (evita un pase vacuo si el regex se rompe)", () => {
    const totales = totalPorToken(global);
    for (const tok of Object.keys(TOPE_REMANENTE)) expect(totales[tok] ?? 0, tok).toBeGreaterThan(0);
  });

  it("no aparecen tokens inexistentes NUEVOS (fuera de los remanentes conocidos) y los remanentes no crecen", () => {
    const totales = totalPorToken(global);
    const nuevos = Object.keys(totales).filter((t) => !(t in TOPE_REMANENTE));
    expect(nuevos).toEqual([]);
    for (const [tok, tope] of Object.entries(TOPE_REMANENTE)) expect(totales[tok] ?? 0, tok).toBeLessThanOrEqual(tope);
  });

  it("PESTEL no usa NINGÚN token inexistente (ni siquiera los remanentes conocidos)", () => {
    const pestel = tokensIndefinidos(["app/centinela/pestel", "app/components/centinela/pestel"]);
    expect(pestel).toEqual({});
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
