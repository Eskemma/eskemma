// C4a-2a — contraste del panel «Historial». Lee los `--color-*` de `app/globals.css` (la fuente de verdad) y exige
// WCAG AA: >= 4.5 para texto y >= 3 para íconos y bordes que comunican algo. Fondos del panel (decisión de Raúl):
//   · claro  → `white-eske` (#f7fafb), el de las páginas de Moddulo;
//   · oscuro → #18324A (el fondo de los diálogos/modales; NO el #0F2233 de `ResponsivePanel`).
// Aquí van los pares ya conocidos; C4a-2b agrega los de la interfaz. Un par que no llegue al umbral rompe la prueba.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UMBRAL_NO_TEXTO, UMBRAL_TEXTO, bloqueCss, componer, hexARgb, luminanciaRelativa, razonDeContraste, tokensDeCss, variablesDeCss } from "./contraste";

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");
const t = tokensDeCss(css);
const token = (n: string): string => {
  if (!t[n]) throw new Error(`El token --color-${n} no existe en globals.css`);
  return t[n];
};

const CLARO = token("white-eske");
// Modo oscuro: se LEE del bloque `.dark` de globals.css (superficie y colores de texto de los diálogos). Lo único que sigue
// fijo en los componentes son las clases `dark:text-[#EAF2F8]` y `dark:text-[#9AAEBE]`, que son exactamente --text-hi y
// --text-mid; la prueba comprueba que valen eso.
const oscuroCss = variablesDeCss(bloqueCss(css, ".dark,\n[data-theme=\"dark\"]"));
const dark = (n: string): string => {
  if (!oscuroCss[n]) throw new Error(`La variable --${n} no existe en el bloque .dark de globals.css`);
  return oscuroCss[n];
};
const OSCURO = dark("surface-2"); // #18324A: fondo de los diálogos (NO el #0F2233 de ResponsivePanel)
const TEXTO_OSCURO = dark("text-hi");
const SECUNDARIO_OSCURO = dark("text-mid");

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
  // ---- C4a-2b: pares de la interfaz ----
  // Botón «Historial» de la cabecera (fondo bluegreen-eske en claro Y en oscuro: la cabecera no cambia de tema)
  { nombre: "botón Historial: texto e ícono white-eske sobre la cabecera", frente: token("white-eske"), fondo: token("bluegreen-eske"), umbral: UMBRAL_TEXTO },
  { nombre: "botón Historial en hover (white-eske/10 sobre la cabecera)", frente: token("white-eske"), fondo: componer(token("white-eske"), token("bluegreen-eske"), 0.1), umbral: UMBRAL_TEXTO },
  { nombre: "botón Historial: anillo de foco white-eske sobre la cabecera", frente: token("white-eske"), fondo: token("bluegreen-eske"), umbral: UMBRAL_NO_TEXTO },
  // Título, marcas y avisos sobre el panel
  { nombre: "marca «★ Versión actual» claro (bluegreen-eske)", frente: token("bluegreen-eske"), fondo: CLARO, umbral: UMBRAL_TEXTO },
  { nombre: "marca «★ Versión actual» oscuro (blue-eske-30)", frente: token("blue-eske-30"), fondo: OSCURO, umbral: UMBRAL_TEXTO },
  { nombre: "marcas de cambio nuevo / sin registro / retención claro (brown-eske-60)", frente: token("brown-eske-60"), fondo: CLARO, umbral: UMBRAL_TEXTO },
  { nombre: "marcas de cambio nuevo / sin registro / retención oscuro (yellow-eske)", frente: token("yellow-eske"), fondo: OSCURO, umbral: UMBRAL_TEXTO },
  { nombre: "ícono de aviso claro (brown-eske-60)", frente: token("brown-eske-60"), fondo: CLARO, umbral: UMBRAL_NO_TEXTO },
  // Error con tinte (role="alert")
  { nombre: "error claro (red-eske-60) sobre tinte rojo /10", frente: token("red-eske-60"), fondo: componer(token("red-eske"), CLARO, 0.1), umbral: UMBRAL_TEXTO },
  { nombre: "error oscuro (red-eske-10) sobre tinte rojo /10", frente: token("red-eske-10"), fondo: componer(token("red-eske"), OSCURO, 0.1), umbral: UMBRAL_TEXTO },
  // Botones «Actualizar», «Cargar más», «Reintentar», «Comprobar cambios sin registro»: texto y borde, reposo y hover
  { nombre: "botón claro: borde y texto bluegreen-eske", frente: token("bluegreen-eske"), fondo: CLARO, umbral: UMBRAL_NO_TEXTO },
  { nombre: "botón claro en hover (bluegreen-eske sobre su tinte /10)", frente: token("bluegreen-eske"), fondo: componer(token("bluegreen-eske"), CLARO, 0.1), umbral: UMBRAL_TEXTO },
  { nombre: "botón oscuro: borde y texto blue-eske-30", frente: token("blue-eske-30"), fondo: OSCURO, umbral: UMBRAL_NO_TEXTO },
  { nombre: "botón oscuro en hover (blue-eske-30 sobre su tinte /10)", frente: token("blue-eske-30"), fondo: componer(token("blue-eske-30"), OSCURO, 0.1), umbral: UMBRAL_TEXTO },
  // Botón de cerrar en hover
  { nombre: "cerrar claro en hover (black-eske-20 sobre gray-eske-10)", frente: token("black-eske-20"), fondo: token("gray-eske-10"), umbral: UMBRAL_TEXTO },
  { nombre: "cerrar oscuro en hover (#9AAEBE sobre blanco/5)", frente: SECUNDARIO_OSCURO, fondo: componer("#ffffff", OSCURO, 0.05), umbral: UMBRAL_TEXTO },
  // Textos de fila y de estado final (secundario) sobre el panel: ya cubiertos arriba; el estado final usa la caja de aviso
  { nombre: "texto principal oscuro sobre el panel (título y filas)", frente: TEXTO_OSCURO, fondo: OSCURO, umbral: UMBRAL_TEXTO },
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

describe("las clases fijas de modo oscuro de los componentes valen lo que dice globals.css", () => {
  it("#EAF2F8 = --text-hi, #9AAEBE = --text-mid y #18324A = --surface-2 (el único literal que queda en el código)", () => {
    expect(TEXTO_OSCURO).toBe("#eaf2f8");
    expect(SECUNDARIO_OSCURO).toBe("#9aaebe");
    expect(OSCURO).toBe("#18324a");
  });
  it("las variables oscuras vienen del bloque .dark, no del claro", () => {
    expect(bloqueCss(css, ".dark,\n[data-theme=\"dark\"]")).toContain("--surface-2");
    expect(bloqueCss(css, "no-existe")).toBe("");
  });
});
