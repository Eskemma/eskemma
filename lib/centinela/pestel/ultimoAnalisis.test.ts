// T7 C1 — el helper único de «último análisis». Incluye una prueba de equivalencia contra la regla ANTIGUA
// copiada verbatim (la de latest-analysis y link-moddulo antes del refactor).
import { describe, expect, it } from "vitest";
import { elegirUltimoAnalisis, segundosDeAnalisis, type DatosEleccionAnalisis } from "./ultimoAnalisis";

type Doc = DatosEleccionAnalisis & { id: string };
const leer = (d: Doc): DatosEleccionAnalisis => d;
const ids = (docs: Doc[]) => elegirUltimoAnalisis(docs, leer)?.id ?? null;
const ts = (iso: string) => ({ _seconds: Date.parse(iso) / 1000 });

// --- Regla antigua, verbatim de latest-analysis/route.ts (antes de T7 C1) ---
function reglaAntigua(docs: Doc[]): string | null {
  if (docs.length === 0) return null;
  const getSeconds = (doc: Doc): number => {
    const v = doc.analyzedAt as { _seconds: number } | string | undefined;
    if (!v) return 0;
    if (typeof v === "object" && "_seconds" in v) return v._seconds;
    return new Date(v as string).getTime() / 1000;
  };
  const vigentes = docs.filter((d) => d.vigente !== false);
  const pool = vigentes.length > 0 ? vigentes : docs;
  pool.sort((a, b) => getSeconds(b) - getSeconds(a));
  return pool[0].id;
}

describe("segundosDeAnalisis", () => {
  it("ausente → 0; {_seconds} → sus segundos; texto → segundos de la fecha; ilegible → NaN", () => {
    expect(segundosDeAnalisis(undefined)).toBe(0);
    expect(segundosDeAnalisis(null)).toBe(0);
    expect(segundosDeAnalisis("")).toBe(0);
    expect(segundosDeAnalisis({ _seconds: 12 })).toBe(12);
    expect(segundosDeAnalisis("1970-01-01T00:01:00Z")).toBe(60);
    expect(Number.isNaN(segundosDeAnalisis("no-es-fecha"))).toBe(true);
  });
});

describe("elegirUltimoAnalisis", () => {
  it("sin elementos → null", () => expect(ids([])).toBeNull());

  it("prefiere vigente aunque exista uno no vigente más reciente", () => {
    expect(ids([{ id: "v", vigente: true, analyzedAt: "2026-01-01T00:00:00Z" }, { id: "n", vigente: false, analyzedAt: "2026-06-01T00:00:00Z" }])).toBe("v");
  });

  it("si ninguno es vigente, el más reciente de todos", () => {
    expect(ids([{ id: "a", vigente: false, analyzedAt: "2026-01-01T00:00:00Z" }, { id: "b", vigente: false, analyzedAt: "2026-05-01T00:00:00Z" }])).toBe("b");
  });

  it("`vigente` ausente cuenta como vigente", () => {
    expect(ids([{ id: "s", analyzedAt: "2026-01-01T00:00:00Z" }, { id: "n", vigente: false, analyzedAt: "2026-09-01T00:00:00Z" }])).toBe("s");
  });

  it("mezcla de {_seconds} y texto; sin fecha pierde", () => {
    expect(ids([{ id: "iso", analyzedAt: "2026-02-01T00:00:00Z" }, { id: "ts", analyzedAt: ts("2026-04-01T00:00:00Z") }, { id: "sin" }])).toBe("ts");
    expect(ids([{ id: "sin" }, { id: "con", analyzedAt: "2000-01-01T00:00:00Z" }])).toBe("con");
  });

  it("empate: gana el primero en el orden de entrada (estable)", () => {
    expect(ids([{ id: "a", analyzedAt: "2026-01-01T00:00:00Z" }, { id: "b", analyzedAt: "2026-01-01T00:00:00Z" }])).toBe("a");
    expect(ids([{ id: "b", analyzedAt: "2026-01-01T00:00:00Z" }, { id: "a", analyzedAt: "2026-01-01T00:00:00Z" }])).toBe("b");
  });

  it("no modifica el arreglo de entrada", () => {
    const docs: Doc[] = [{ id: "a", vigente: false, analyzedAt: "2026-01-01T00:00:00Z" }, { id: "b", vigente: false, analyzedAt: "2026-05-01T00:00:00Z" }];
    const copia = structuredClone(docs);
    elegirUltimoAnalisis(docs, leer);
    expect(docs).toEqual(copia);
  });

  it("NaN (fecha ilegible) se comporta igual que la regla antigua en varias disposiciones", () => {
    const casos: Doc[][] = [
      [{ id: "a", analyzedAt: "no-es-fecha" }],
      [{ id: "a", analyzedAt: "no-es-fecha" }, { id: "b", analyzedAt: "2026-01-01T00:00:00Z" }],
      [{ id: "b", analyzedAt: "2026-01-01T00:00:00Z" }, { id: "a", analyzedAt: "no-es-fecha" }, { id: "c", analyzedAt: "2026-03-01T00:00:00Z" }],
      [{ id: "a", analyzedAt: "x" }, { id: "b", analyzedAt: "y" }],
    ];
    for (const c of casos) expect(ids(structuredClone(c))).toBe(reglaAntigua(structuredClone(c)));
  });

  it("equivalencia con la regla antigua sobre 500 conjuntos generados (semilla fija)", () => {
    let semilla = 12345;
    const azar = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const fechas: unknown[] = [undefined, "", "no-es-fecha", "2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z", "2026-03-01T00:00:00Z", ts("2026-02-01T00:00:00Z"), ts("2026-04-01T00:00:00Z"), { otro: 1 }];
    const vig = [true, false, undefined];
    for (let i = 0; i < 500; i++) {
      const n = Math.floor(azar() * 6);
      const docs: Doc[] = Array.from({ length: n }, (_, k) => ({ id: `d${k}`, vigente: vig[Math.floor(azar() * 3)], analyzedAt: fechas[Math.floor(azar() * fechas.length)] }));
      expect(ids(structuredClone(docs))).toBe(reglaAntigua(structuredClone(docs)));
    }
  });
});
