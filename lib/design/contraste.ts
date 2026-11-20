// lib/design/contraste.ts
// C4a-2a — medición de contraste WCAG 2.x (módulo PURO, sin DOM). Hasta ahora las razones de contraste de la serie se
// calculaban a mano y quedaban en comentarios (H-V57); este módulo las calcula leyendo los colores REALES de
// `app/globals.css`, de modo que un token que cambie de valor rompe la prueba que lo usa.
//
//   · `tokensDeCss(css)`     → `--color-*` con valor hexadecimal de 6 dígitos (el ÚLTIMO valor gana, como en CSS: p. ej.
//                              `gray-eske-60` se sobrescribe en un segundo `@theme`).
//   · `razonDeContraste(a,b)`→ (L1 + 0.05) / (L2 + 0.05) con L = luminancia relativa.
//   · `componer(f, fondo, a)`→ color resultante de un tinte por opacidad (`bg-yellow-eske/10`) sobre su fondo.
// Umbrales (WCAG AA): 4.5 texto normal, 3 texto grande, íconos y bordes que comunican algo.

export const UMBRAL_TEXTO = 4.5;
export const UMBRAL_NO_TEXTO = 3;

type Rgb = [number, number, number];

export function hexARgb(hex: string): Rgb {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) throw new Error(`Color hexadecimal inválido: «${hex}»`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const canal = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export function luminanciaRelativa(hex: string): number {
  const [r, g, b] = hexARgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function razonDeContraste(a: string, b: string): number {
  const la = luminanciaRelativa(a);
  const lb = luminanciaRelativa(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Color que resulta de pintar `frente` con opacidad `alfa` (0 a 1) sobre `fondo`. */
export function componer(frente: string, fondo: string, alfa: number): string {
  if (!(alfa >= 0 && alfa <= 1)) throw new Error(`Opacidad fuera de rango: ${alfa}`);
  const f = hexARgb(frente);
  const g = hexARgb(fondo);
  const mezcla = f.map((v, i) => Math.round(v * alfa + g[i] * (1 - alfa)));
  return `#${mezcla.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** `--color-<nombre>: #rrggbb;` → { nombre: "#rrggbb" }. El último valor definido gana. */
export function tokensDeCss(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2].toLowerCase();
  return tokens;
}
