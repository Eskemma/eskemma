// C4b-2b — pruebas ESTÁTICAS del cableado de «Volver a esta versión» (el repo no tiene pruebas de DOM): leen el código
// fuente y exigen lo que no puede perderse sin que nadie lo note. Lo visual (foco, inert real, hoja inferior) va en la guía.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const panel = sinComentarios(leer("app/moddulo/components/PanelHistorial.tsx"));
const vista = sinComentarios(leer("app/moddulo/components/VistaVolver.tsx"));
const hook = sinComentarios(leer("app/moddulo/components/useVolver.ts"));
const boton = sinComentarios(leer("app/moddulo/components/HistorialFase.tsx"));
const pagina = sinComentarios(leer("app/moddulo/proyecto/[projectId]/investigacion/page.tsx"));

function archivos(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".next") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) acc.push(p);
  }
  return acc;
}

describe("el botón «Volver a esta versión» solo existe con permiso del servidor", () => {
  it("`puedeVolver` sale de la respuesta del lector, solo en F3, y es lo que se pasa a la decisión del botón", () => {
    expect(panel).toMatch(/const puedeVolver = fase === "investigacion" && estado\.primera\?\.puedeVolver === true;/);
    expect(panel).toMatch(/puedeVolver && volver && destinosVolverDeFila\(f, puedeVolver\)/);
  });
  it("HistorialFase solo pasa `volver` en F3", () => {
    expect(boton).toMatch(/h\.fase === "investigacion"\s*\?/);
  });
  it("la fecha del botón es la de la FILA con el formateador del panel (`fechaTextoDeFila` → `formatearFechaFila`)", () => {
    expect(panel).toMatch(/fechaTexto: fechaTextoDeFila\(f\.en\)/);
    expect(panel).not.toMatch(/toLocale|new Intl|new Date/);
    expect(vista).not.toMatch(/toLocale|new Intl|new Date/);
    expect(sinComentarios(leer("lib/moddulo/versionado/estadoVolver.ts"))).toMatch(/formatearFechaFila\(en\)/);
  });
});

describe("con la escritura en vuelo («volviendo») NINGUNA salida cierra nada", () => {
  it("Escape, clic fuera y la salida de la vista pasan por UN solo guardia (`salirRef`) que respeta `enEscritura`", () => {
    expect(panel).toMatch(/const enEscritura = !!volver && volver\.estado\.fase === "volviendo";/);
    expect(panel).toMatch(/salirRef\.current = \(\) => \{\s*if \(enEscritura\) return;/);
    expect(panel).toMatch(/if \(ev\.key === "Escape"\) \{[\s\S]*?salirRef\.current\(\);/);
    expect(panel).toMatch(/if \(e\.target === e\.currentTarget\) salirRef\.current\(\);/);
  });
  it("el botón de cerrar del panel no hace nada mientras se escribe, y lo declara con aria-disabled", () => {
    expect(panel).toMatch(/onClick=\{\(\) => \{\s*if \(!enEscritura\) onCerrar\(\);\s*\}\}/);
    expect(panel).toMatch(/aria-disabled=\{enEscritura \|\| undefined\}/);
  });
  it("`cierreRef.current()` solo se llama dentro del guardia (nada cierra por otro camino)", () => {
    expect((panel.match(/cierreRef\.current\(\)/g) ?? []).length).toBe(1);
    expect(panel).not.toMatch(/onMouseDown=\{[^}]*onCerrar\(\)/);
  });
  it("Escape en la vista vuelve a la lista (onCancelar), no cierra el panel", () => {
    expect(panel).toMatch(/if \(vista\) volver\?\.onCancelar\(\);/);
  });
});

describe("el aviso a la pantalla de fondo ocurre una sola vez y solo tras un éxito confirmado", () => {
  it("`avisarProyectoActualizado` se llama UNA vez en useVolver, detrás del guardia del efecto de éxito", () => {
    expect((hook.match(/avisarProyectoActualizado\(/g) ?? []).length).toBe(1);
    expect(hook).toMatch(/if \(estado\.efecto !== "avisar_y_recargar" \|\| efectoHecho\.current === estado\.contador\) return;[\s\S]*avisarProyectoActualizado\(projectId\)/);
    expect(hook).toMatch(/dispatch\(\{ tipo: "efecto_hecho" \}\)/);
  });
  it("ningún otro archivo de la app avisa (solo el hook del panel)", () => {
    const quienes = [...archivos(join(RAIZ, "app")), ...archivos(join(RAIZ, "lib"))]
      .filter((f) => /avisarProyectoActualizado\(/.test(readFileSync(f, "utf8")) && !f.endsWith("eventosProyecto.ts"))
      .map((f) => f.replace(RAIZ + "/", ""));
    expect(quienes).toEqual(["app/moddulo/components/useVolver.ts"]);
  });
  it("tras el éxito se recarga la primera página del historial solo si el panel está abierto", () => {
    expect(boton).toMatch(/useVolver\(projectId, \(\) => \{\s*if \(abierto\) h\.actualizar\(\);/);
  });
});

describe("la página de F3 se suscribe y se desuscribe", () => {
  it("se suscribe con el id del proyecto, vuelve a leer proyecto y resultados, y devuelve el desuscriptor", () => {
    expect(pagina).toMatch(/return suscribirProyectoActualizado\(projectId, \(\) => \{\s*loadProject\(\);\s*loadResultados\(\);\s*\}\);/);
  });
  it("el efecto devuelve directamente el desuscriptor (se limpia al desmontar)", () => {
    const i = pagina.indexOf("suscribirProyectoActualizado(projectId");
    expect(pagina.slice(i - 40, i)).toMatch(/return\s+$/);
  });
});

describe("H-V63: cabecera y pie inertes mientras el panel está abierto", () => {
  it("HistorialFase aplica `inertarCubiertos(document)` y restaura en el cleanup ANTES de devolver el foco", () => {
    expect(boton).toMatch(/const restaurarCubiertos = inertarCubiertos\(document\);/);
    const cleanup = boton.slice(boton.indexOf("return () => {"));
    expect(cleanup.indexOf("restaurarCubiertos()")).toBeGreaterThan(-1);
    expect(cleanup.indexOf("restaurarCubiertos()")).toBeLessThan(cleanup.indexOf("botonRef.current?.focus()"));
  });
});

describe("la vista no ofrece reintento a ciegas ni confirma fuera de «confirmando»", () => {
  it("el botón de confirmar solo se pinta con `ofreceConfirmar(estado)` y es el único que usa onConfirmar", () => {
    expect((vista.match(/onClick=\{onConfirmar\}/g) ?? []).length).toBe(1);
    expect(vista).toMatch(/ofreceConfirmar\(estado\) && \(/);
  });
  it("«Ver el historial» solo con `ofreceVerHistorial`; el error es role=alert y el progreso role=status", () => {
    expect(vista).toMatch(/ofreceVerHistorial\(estado\) && <button/);
    expect(vista).toMatch(/role="alert"/);
    expect(vista).toMatch(/role="status"[^>]*>\{TEXTOS_VISTA_VOLVER\.volviendo\}/);
  });
  it("es una vista del mismo diálogo, no otro: sin role=dialog propio", () => {
    expect(vista).not.toMatch(/role="dialog"|aria-modal/);
  });
});

describe("foco", () => {
  it("al abrir la vista el foco va a su título; al volver a la lista, al botón de la fila o, si no está, al título", () => {
    expect(panel).toMatch(/if \(debeEnfocarTituloVista\(antes, faseVolver\)\) vistaTituloRef\.current\?\.focus\(\);/);
    // el efecto depende de la ETAPA (no solo de «hay vista»): se dispara en confirmando, volviendo, éxito y error
    expect(panel).toMatch(/\}, \[faseVolver, claveBoton\]\);/);
    expect(panel).toMatch(/data-volver-clave=\{claveBotonVolver\(f\.revisionN, d\.resultadoId\)\}/);
    expect(panel).toMatch(/dondeVuelveFocoVolver\(el !== null\)/);
  });
  it("las cargas del panel no le quitan el foco a la vista", () => {
    expect(panel).toMatch(/if \(vistaRef\.current\) return;/);
  });
});

describe("objetivos táctiles: todos los botones del panel y de la vista miden al menos 44 px en móvil", () => {
  const estilos = sinComentarios(leer("app/moddulo/components/estilosPanel.ts"));
  it("BOTON fija min-h-[44px] sin breakpoint y solo baja a 36 px desde `sm:`", () => {
    const boton = estilos.match(/export const BOTON = `([^`]*)`/)?.[1] ?? "";
    expect(boton).toMatch(/(^|\s)min-h-\[44px\](\s|$)/);
    expect(boton).not.toMatch(/(^|\s)(max-[a-z]+:)?min-h-\[(?!44px)[0-9]+px\]/);
    expect(boton).toMatch(/\bsm:min-h-\[36px\]/);
  });
  it("cada <button> de VistaVolver y de PanelHistorial usa BOTON o declara min-h-[44px]", () => {
    for (const [n, src] of Object.entries({ panel, vista })) {
      const botones = src.match(/<button[\s\S]*?<\/button>/g) ?? [];
      expect(botones.length, n).toBeGreaterThan(0);
      for (const b of botones) expect(b, `${n}: ${b}`).toMatch(/\$\{BOTON\}|BOTON\b|min-h-\[44px\]/);
    }
  });
});

describe("Tab desde un elemento fuera de la lista (el título con tabIndex=-1)", () => {
  it("el manejador calcula cuántos enfocables PRECEDEN al activo en el documento y se lo pasa a siguienteEnCiclo", () => {
    expect(panel).toMatch(/compareDocumentPosition\(el\) & Node\.DOCUMENT_POSITION_PRECEDING/);
    expect(panel).toMatch(/siguienteEnCiclo\(.*ev\.shiftKey, antes\)/);
    expect(panel).toMatch(/dialogoRef\.current\?\.contains\(activo\)/);
  });
});
