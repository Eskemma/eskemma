// El pie de cada señal: fuente en su propio bloque (sin recortes), fecha/«Intl.»/confianza juntas en otra fila
// y cada pieza sin partirse por dentro. No hay DOM en la suite: se comprueba el marcado.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SenalesGrupo, { PieSenal } from "./SenalesGrupo";

const MAS_LARGA = "Fuente: PNUD/Desigualdad de Género, 2020"; // la más larga de los M1 reales (40 caracteres)
const MAS_CORTA = "DOF"; // de las más cortas (3 caracteres)
const senal = (o: Partial<Record<keyof Parameters<typeof PieSenal>[0]["s"], string | boolean>> = {}) =>
  ({ descripcion: "d", fuente: MAS_LARGA, fechaCorte: "2026-10", nivelConfianza: "medio", origenInternacional: false, ...o } as Parameters<typeof PieSenal>[0]["s"]);
const html = (o?: Parameters<typeof senal>[0]) => renderToStaticMarkup(<PieSenal s={senal(o)} />);

describe("PieSenal", () => {
  it("la fuente va en su propio bloque, completa y sin recortes", () => {
    const h = html();
    expect(h).toMatch(/<p class="break-words">Fuente: PNUD\/Desigualdad de Género, 2020<\/p>/);
    expect(h).not.toMatch(/truncate|text-ellipsis|line-clamp|overflow-hidden|…/);
  });
  it("fecha y confianza están juntas en una fila aparte, cada una sin partirse (nowrap)", () => {
    const h = html();
    const fila = h.slice(h.indexOf('<div class="flex flex-wrap'));
    expect(fila).toContain('<span class="whitespace-nowrap">2026-10</span>');
    expect(fila).toMatch(/<span class="whitespace-nowrap px-1\.5[^"]*">medio<\/span>/);
    expect(fila.indexOf("2026-10")).toBeLessThan(fila.indexOf("medio"));
    expect(h.indexOf("Fuente: PNUD")).toBeLessThan(h.indexOf("2026-10"));
  });
  it("«sin fecha» y las fechas largas tampoco se parten", () => {
    expect(html({ fechaCorte: "sin fecha" })).toContain('<span class="whitespace-nowrap">sin fecha</span>');
    expect(html({ fechaCorte: "2025-12-25" })).toContain('<span class="whitespace-nowrap">2025-12-25</span>');
  });
  it("la fuente más corta y una fuente vacía no dejan bloques huecos", () => {
    expect(html({ fuente: MAS_CORTA })).toContain(">DOF</p>");
    expect(html({ fuente: "" })).not.toContain("break-words");
  });
  it("«Intl.» y la confianza (alto, medio, bajo) con variante oscura y sin partirse", () => {
    const h = html({ origenInternacional: true, nivelConfianza: "alto" });
    expect(h).toMatch(/whitespace-nowrap[^"]*">Intl\.<\/span>/);
    for (const n of ["alto", "medio", "bajo"]) expect(html({ nivelConfianza: n })).toMatch(/dark:bg-/);
  });
  it("el tamaño de letra es el de siempre (text-xs), no se reduce", () => {
    expect(html()).toContain("text-xs");
    expect(html()).not.toContain("text-[10px]");
  });
});

describe("SenalesGrupo", () => {
  const props = { colorClass: "c", summaryClass: "s" };
  it("favorables y de riesgo usan el mismo pie", () => {
    const fav = renderToStaticMarkup(<SenalesGrupo title="Señales favorables" signals={[senal()]} {...props} />);
    const adv = renderToStaticMarkup(<SenalesGrupo title="Señales adversas" signals={[senal()]} {...props} />);
    const pie = (h: string) => h.slice(h.indexOf("data-pie-senal") - 40, h.indexOf("</li>"));
    expect(pie(fav)).toEqual(pie(adv));
  });
  it("sin señales no pinta nada", () => {
    expect(renderToStaticMarkup(<SenalesGrupo title="x" signals={[]} {...props} />)).toBe("");
  });
});
