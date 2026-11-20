// C4a-2a — contraste del panel «Historial». Lee los `--color-*` de `app/globals.css` (la fuente de verdad) y exige
// WCAG AA: >= 4.5 para texto y >= 3 para íconos y bordes que comunican algo. Fondos del panel (decisión de Raúl):
//   · claro  → `white-eske` (#f7fafb), el de las páginas de Moddulo;
//   · oscuro → #18324A (el fondo de los diálogos/modales; NO el #0F2233 de `ResponsivePanel`).
// Aquí van los pares ya conocidos; C4a-2b agrega los de la interfaz. Un par que no llegue al umbral rompe la prueba.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UMBRAL_NO_TEXTO, UMBRAL_TEXTO, componer, hexARgb, luminanciaRelativa, razonDeContraste, tokensDeCss } from "./contraste";

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");
const t = tokensDeCss(css);
const token = (n: string): string => {
  if (!t[n]) throw new Error(`El token --color-${n} no existe en globals.css`);
  return t[n];
};

const CLARO = token("white-eske");
const OSCURO = "#18324a"; // fondo oscuro de los diálogos (surface-2 de globals.css)
// Los literales hexadecimales de modo oscuro que usan los componentes (no son tokens): se fijan aquí.
const TEXTO_OSCURO = "#eaf2f8";
const SECUNDARIO_OSCURO = "#9aaebe";

interface Par { nombre: string; frente: string; fondo: string; umbral: number }
const pares: Par[] = [
  // Texto normal — claro
  { nombre: "texto principal (black-eske) sobre claro", frente: token("black-eske"), fondo: CLARO, umbral: UMBRAL_TEXTO },
  { nombre: "texto secundario (black-eske-20) sobre claro", frente: token("black-eske-20"), fondo: CLARO, umbral: UMBRAL_TEXTO },
  { nombre: "texto terciario (black-eske-10) sobre claro", frente: token("black-eske-10"), fondo: CLARO, umbral: UMBRAL_TEXTO },
  { nombre: "texto de proceso/error (red-eske-60) sobre claro", frente: token("red-eske-60"), fondo: CLARO, umbral: UMBRAL_TEXTO },
  { nombre: "aviso (brown-eske-60) sobre tinte amarillo /10", frente: token("brown-eske-60"), fondo: componer(token("yellow-eske"), CLARO, 0.1), umbral: UMBRAL_TEXTO },
  // Texto normal — oscuro
  { nombre: "texto principal sobre oscuro (#EAF2F8)", frente: TEXTO_OSCURO, fondo: OSCURO, umbral: UMBRAL_TEXTO },
  { nombre: "texto secundario sobre oscuro (#9AAEBE)", frente: SECUNDARIO_OSCURO, fondo: OSCURO, umbral: UMBRAL_TEXTO },
  { nombre: "texto de proceso/error (red-eske-10) sobre oscuro", frente: token("red-eske-10"), fondo: OSCURO, umbral: UMBRAL_TEXTO },
  { nombre: "aviso (yellow-eske) sobre tinte amarillo /10 oscuro", frente: token("yellow-eske"), fondo: componer(token("yellow-eske"), OSCURO, 0.1), umbral: UMBRAL_TEXTO },
  // Íconos y bordes que comunican algo (foco, botón de cerrar)
  { nombre: "anillo de foco claro: bluegreen-eske", frente: token("bluegreen-eske"), fondo: CLARO, umbral: UMBRAL_NO_TEXTO },
  { nombre: "anillo de foco oscuro: blue-eske-30", frente: token("blue-eske-30"), fondo: OSCURO, umbral: UMBRAL_NO_TEXTO },
  { nombre: "ícono de cerrar claro (black-eske-20)", frente: token("black-eske-20"), fondo: CLARO, umbral: UMBRAL_NO_TEXTO },
  { nombre: "ícono de cerrar oscuro (#9AAEBE)", frente: SECUNDARIO_OSCURO, fondo: OSCURO, umbral: UMBRAL_NO_TEXTO },
];

describe("contraste del panel «Historial» (WCAG AA, medido con los tokens reales)", () => {
  for (const p of pares) {
    it(`${p.nombre} ≥ ${p.umbral}:1`, () => {
      expect(razonDeContraste(p.frente, p.fondo)).toBeGreaterThanOrEqual(p.umbral);
    });
  }

  it("el token del anillo de foco por defecto (--color-focus-ring = blue-eske-30) NO llega a 3:1 sobre claro: por eso el panel usa bluegreen-eske", () => {
    expect(razonDeContraste(token("blue-eske-30"), CLARO)).toBeLessThan(UMBRAL_NO_TEXTO);
    expect(razonDeContraste(token("bluegreen-eske"), CLARO)).toBeGreaterThanOrEqual(UMBRAL_NO_TEXTO);
  });

  it("valores de referencia (fijan el cálculo contra cifras medidas a mano en la serie)", () => {
    expect(razonDeContraste(token("black-eske-20"), CLARO)).toBeCloseTo(7.45, 1);
    expect(razonDeContraste(SECUNDARIO_OSCURO, OSCURO)).toBeCloseTo(5.75, 1);
    expect(razonDeContraste(token("brown-eske-60"), componer(token("yellow-eske"), CLARO, 0.1))).toBeCloseTo(5.37, 1);
  });
});

describe("módulo de medición", () => {
  it("negro sobre blanco = 21:1 y un color consigo mismo = 1:1", () => {
    expect(razonDeContraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(razonDeContraste("#336699", "#336699")).toBeCloseTo(1, 5);
  });
  it("es simétrica", () => {
    expect(razonDeContraste("#2b2b2b", "#f7fafb")).toBeCloseTo(razonDeContraste("#f7fafb", "#2b2b2b"), 10);
  });
  it("luminancia de los extremos", () => {
    expect(luminanciaRelativa("#000000")).toBe(0);
    expect(luminanciaRelativa("#ffffff")).toBeCloseTo(1, 10);
  });
  it("componer: opacidad 0 = fondo, 1 = frente, intermedia = mezcla", () => {
    expect(componer("#ffd14a", "#18324a", 0)).toBe("#18324a");
    expect(componer("#ffd14a", "#18324a", 1)).toBe("#ffd14a");
    expect(hexARgb(componer("#000000", "#ffffff", 0.5))).toEqual([128, 128, 128]);
  });
  it("rechaza colores y opacidades inválidos", () => {
    expect(() => hexARgb("rojo")).toThrow();
    expect(() => hexARgb("#fff")).toThrow();
    expect(() => componer("#000000", "#ffffff", 1.5)).toThrow();
  });
  it("tokensDeCss: el último valor gana (gray-eske-60 se sobrescribe en un segundo @theme)", () => {
    expect(tokensDeCss("--color-a: #111111;\n--color-a: #222222;")).toEqual({ a: "#222222" });
    expect(token("gray-eske-60")).toBe("#9a9a9a");
  });
  it("el CSV real trae los tokens que usa el panel", () => {
    for (const n of ["white-eske", "black-eske", "black-eske-10", "black-eske-20", "red-eske-60", "red-eske-10", "brown-eske-60", "yellow-eske", "bluegreen-eske", "blue-eske-30"]) {
      expect(t[n], n).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
