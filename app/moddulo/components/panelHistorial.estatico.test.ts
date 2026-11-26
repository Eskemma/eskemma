// C4a-2b — prueba ESTÁTICA de accesibilidad y contrato del panel «Historial» (el repo no tiene pruebas de DOM). Lee el
// código fuente y exige lo que no puede perderse sin que nadie lo note. Complementa la guía manual de navegador.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const panel = sinComentarios(leer("app/moddulo/components/PanelHistorial.tsx"));
const boton = sinComentarios(leer("app/moddulo/components/HistorialFase.tsx"));
const vistaVolver = sinComentarios(leer("app/moddulo/components/VistaVolver.tsx"));
const hook = sinComentarios(leer("app/moddulo/components/useHistorialFase.ts"));
const layout = sinComentarios(leer("app/moddulo/proyecto/[projectId]/layout.tsx"));

describe("PanelHistorial: contrato de accesibilidad", () => {
  it("NO usa useFocusTrap, ResponsivePanel ni dangerouslySetInnerHTML (R1)", () => {
    for (const [n, src] of Object.entries({ panel, boton, hook })) {
      expect(src, n).not.toMatch(/useFocusTrap|ResponsivePanel|dangerouslySetInnerHTML/);
    }
  });
  it("es un diálogo modal con aria-labelledby que apunta a un id que EXISTE en el título", () => {
    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('aria-modal="true"');
    // C4b-2b: el diálogo apunta al título de la lista o al de la vista «Volver», según cuál esté a la vista; ambos existen.
    expect(panel).toMatch(/aria-labelledby=\{vista \? idVista : idTitulo\}/);
    expect(panel).toMatch(/<h2 id=\{idTitulo\}/);
    expect(vistaVolver).toMatch(/<h2 id=\{idTitulo\}/);
    expect(panel).toMatch(/idTitulo=\{idVista\}/);
    expect(panel).toMatch(/<h2[^>]*tabIndex=\{-1\}/); // foco inicial y tras «Actualizar» en el título (R3)
  });
  it("trampa de foco propia: siguienteEnCiclo recalculando los enfocables en cada Tab (R1)", () => {
    expect(panel).toContain("siguienteEnCiclo");
    expect(panel).toMatch(/querySelectorAll<HTMLElement>\(ENFOCABLES\)/);
    // la consulta está DENTRO del manejador del teclado, no fuera (se recalcula en cada pulsación)
    const manejador = panel.slice(panel.indexOf("const alTeclear"), panel.indexOf("addEventListener"));
    expect(manejador).toContain("querySelectorAll");
  });
  it("Escape y Tab: UN solo listener en `document`, en fase de captura, retirado al desmontar, con stopPropagation (R4, H-V65)", () => {
    expect(panel.match(/addEventListener\("keydown"/g)).toHaveLength(1);
    expect(panel).toMatch(/document\.addEventListener\("keydown", alTeclear, true\)/);
    expect(panel).toMatch(/document\.removeEventListener\("keydown", alTeclear, true\)/);
    expect(panel).toContain('ev.key === "Escape"');
    expect(panel).toContain("ev.stopPropagation()");
    // no hay un segundo listener atado al contenedor (no recibiría teclas con el foco en body)
    expect(panel).not.toMatch(/(?:raizRef|dialogoRef)\.current[^;]*addEventListener/);
  });
  it("el foco no puede quedar fuera del diálogo: se atiende `cargando`, `actualizando` y `cargandoMas` con dondeVaElFoco (H-V65)", () => {
    for (const campo of ["estado.cargando", "estado.actualizando", "estado.cargandoMas"]) expect(panel).toContain(campo);
    for (const m of ["cargando_inicio", "cargado", "actualizado", "cargado_mas"]) expect(panel).toContain(`dondeVaElFoco("${m}"`);
    // las TRANSICIONES de `cargando` (empezar y terminar) están en el efecto, no solo mencionadas
    expect(panel).toMatch(/estado\.cargando && !p\.carg/);
    expect(panel).toMatch(/p\.carg && !estado\.cargando/);
  });
  it("sin fetch propio, sin sondeo y sin textos prohibidos", () => {
    for (const [n, src] of Object.entries({ panel, boton })) expect(src, n).not.toMatch(/fetch\(|setInterval|setTimeout/);
    for (const [n, src] of Object.entries({ panel, boton, hook })) expect(src, n).not.toMatch(/CONFIRMAR|Centinela|\bHEI\b|\bDIE\b/);
  });
  it("objetivos táctiles de 44 px, safe-area y sin animaciones", () => {
    expect(panel).toContain("min-h-[44px]");
    expect(panel).toContain("env(safe-area-inset-bottom)");
    expect(panel).not.toMatch(/\banimate-|transition-transform|duration-/);
  });
  it("conserva el slot de acciones por fila; «Volver» (C4b-2b) llega por la prop `volver`, no por el slot", () => {
    expect(panel).toContain("renderAcciones");
    expect(boton).not.toContain("renderAcciones");
    expect(panel).toContain("volver");
  });
});

describe("HistorialFase, hook y layout", () => {
  it("el contenido de la página queda inert y el panel va en un portal fuera de él", () => {
    expect(boton).toMatch(/contenido\.inert = true/);
    expect(boton).toMatch(/contenido\.inert = false/);
    expect(boton).toContain("createPortal(");
    expect(boton).toContain("document.body");
  });
  it("al cerrar el foco vuelve al botón «Historial» DESPUÉS de quitar el inert", () => {
    const limpieza = boton.slice(boton.indexOf("return () =>"));
    expect(limpieza.indexOf("inert = false")).toBeLessThan(limpieza.indexOf("botonRef.current?.focus()"));
  });
  it("el botón solo existe donde faseDeRuta da una fase y el hook ejecuta una sola petición con AbortController", () => {
    expect(boton).toContain("if (!h.fase) return null");
    expect(hook).toContain("faseDeRuta(pathname)");
    expect(hook).toContain("new AbortController()");
    expect(hook).toContain("ac.abort()");
    expect(hook.match(/fetch\(/g)).toHaveLength(1);
    expect(hook).not.toMatch(/setInterval|setTimeout/);
  });
  it("el layout NO agrega fetch ni lecturas (H-V56) y no deriva la fase con includes", () => {
    expect(layout.match(/fetch\(/g)).toHaveLength(1); // el del proyecto, que ya existía
    expect(layout).toContain("<HistorialFase");
    expect(layout).toMatch(/ref=\{contenidoRef\}/);
    expect(layout).not.toMatch(/pathname\.includes\(["']\/(proposito|exploracion|investigacion)/);
  });
});
