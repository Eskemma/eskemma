// H80 — el formato abierto sobrevive a F5 con ?formato=: elección del formato inicial (función pura), URL y guarda estática del cableado.
// Límite declarado: el cableado real de la pantalla (leer la URL al cargar, replaceState al cambiar de pestaña, el clic durante la carga)
// NO tiene prueba de DOM; lo cubre la guía de navegador. La guarda estática solo impide que el cableado se pierda en silencio.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { elegirFormatoInicial, urlConFormato, REPORT_FORMATS, FORMATO_POR_REPORT_FORMAT } from "./informesSync";
import type { ReportFormat } from "./reportPrompts";
import type { InformeGenerado } from "@/types/pestel.types";

type Vigentes = Partial<Record<ReportFormat, InformeGenerado>>;
const inf = (rf: ReportFormat, generadoEn: string, extra: Partial<InformeGenerado> = {}): InformeGenerado => ({
  id: `i-${rf}`,
  formato: FORMATO_POR_REPORT_FORMAT[rf],
  contenidoTexto: `texto ${rf}`,
  datosEstructurados: { scorecard: [], mapaPESTEL: {} },
  generadoEn,
  ...extra,
});
const dia = (n: number) => `2026-11-${String(10 + n).padStart(2, "0")}T10:00:00.000Z`;
// Técnico y FODA guardados; FODA es el más reciente (el caso que encontró Raúl al verificar B1).
const tecnicoYFoda = (): Vigentes => ({ technical: inf("technical", dia(1)), foda: inf("foda", dia(5)) });

describe("elegirFormatoInicial CON preferido", () => {
  it("un preferido válido CON informe se honra aunque no sea el más reciente (F5 con Técnico abierto)", () => {
    expect(elegirFormatoInicial(tecnicoYFoda(), "technical")).toBe("technical");
    expect(elegirFormatoInicial(tecnicoYFoda(), "foda")).toBe("foda");
    for (const rf of REPORT_FORMATS) {
      const todos: Vigentes = {};
      REPORT_FORMATS.forEach((f, i) => (todos[f] = inf(f, dia(i + 1))));
      expect(elegirFormatoInicial(todos, rf)).toBe(rf);
    }
  });

  it("un preferido válido SIN informe cae al más reciente (no devuelve un formato sin informe)", () => {
    expect(elegirFormatoInicial(tecnicoYFoda(), "scenarios")).toBe("foda");
    expect(elegirFormatoInicial(tecnicoYFoda(), "insights_por_tipo")).toBe("foda");
  });

  it("un preferido cuyo informe no tiene texto vigente cae al más reciente", () => {
    const v: Vigentes = { technical: inf("technical", dia(9), { contenidoTexto: "" }), foda: inf("foda", dia(1)) };
    expect(elegirFormatoInicial(v, "technical")).toBe("foda");
  });

  it("inválido o basura: cae al más reciente", () => {
    const basura: unknown[] = ["", " ", "TECHNICAL", "technical ", "tecnico", "ejecutivo", "__proto__", "constructor", "toString", "../x", "<script>", "null", 5, 0, null, undefined, {}, ["technical"], true];
    for (const b of basura) expect(elegirFormatoInicial(tecnicoYFoda(), b), String(b)).toBe("foda");
  });

  it("sin informes: null, aunque el preferido sea válido", () => {
    expect(elegirFormatoInicial({}, "technical")).toBeNull();
    expect(elegirFormatoInicial({}, "basura")).toBeNull();
  });

  it("nunca devuelve un formato fuera de REPORT_FORMATS ni uno sin informe (32 subconjuntos × preferidos válidos y basura)", () => {
    const preferidos: unknown[] = [...REPORT_FORMATS, "otro", "__proto__", "", 7, null, undefined, {}];
    for (let mask = 0; mask < 1 << REPORT_FORMATS.length; mask++) {
      const v: Vigentes = {};
      REPORT_FORMATS.forEach((rf, i) => {
        if (mask & (1 << i)) v[rf] = inf(rf, dia(i + 1));
      });
      for (const p of preferidos) {
        const r = elegirFormatoInicial(v, p);
        if (mask === 0) expect(r).toBeNull();
        else {
          expect(REPORT_FORMATS).toContain(r);
          expect(v[r as ReportFormat]).toBeDefined();
        }
      }
    }
  });
});

describe("urlConFormato", () => {
  it("agrega ?formato= y conserva ruta y hash", () => {
    expect(urlConFormato("http://localhost:3000/centinela/pestel/p1/informes", "technical")).toBe("/centinela/pestel/p1/informes?formato=technical");
    expect(urlConFormato("http://localhost:3000/centinela/pestel/p1/informes#tabla", "foda")).toBe("/centinela/pestel/p1/informes?formato=foda#tabla");
  });
  it("reemplaza el valor anterior y conserva los otros parámetros", () => {
    expect(urlConFormato("http://localhost:3000/x/informes?formato=technical&otro=1", "foda")).toBe("/x/informes?formato=foda&otro=1");
  });
  it("un valor basura previo se sustituye por el formato elegido", () => {
    expect(urlConFormato("http://localhost:3000/x/informes?formato=%3Cscript%3E", "scenarios")).toBe("/x/informes?formato=scenarios");
  });
});

describe("cableado de la página (guarda estática, sin DOM)", () => {
  const fuente = readFileSync(join(__dirname, "../../app/centinela/pestel/[projectId]/informes/page.tsx"), "utf8");

  it("usa elegirFormatoInicial y urlConFormato con history.replaceState, y no pisa el clic del usuario", () => {
    expect(fuente).toContain("elegirFormatoInicial(vigentes, new URLSearchParams(window.location.search).get(\"formato\"))");
    expect(fuente).toContain("urlConFormato(window.location.href, format)");
    expect(fuente).toContain("window.history.replaceState(window.history.state,");
    expect(fuente).toContain("if (inicial && !formatoElegidoPorUsuario.current) setActiveFormat(inicial);");
  });

  it("setActiveFormat solo se llama en dos sitios (el helper seleccionarFormato y la carga inicial)", () => {
    expect([...fuente.matchAll(/setActiveFormat\(/g)]).toHaveLength(2);
  });

  it("un clic sobre un formato ya guardado no genera (también durante la carga) y no usa localStorage para el formato", () => {
    expect(fuente).toContain("informeVigentePorFormato(analysis.informes)[format]");
    expect(fuente).not.toMatch(/localStorage[^\n]*formato/i);
  });
});
