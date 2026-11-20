// C4a-1 — reglas PURAS de lectura: vigente por manifiesto (nunca por `estado`), versiones que existen, recuperable y
// continuidad entre el contador del puntero y los eventos leídos (hueco = aviso, nunca «sin historial»).
import { describe, expect, it } from "vitest";
import {
  analizarContinuidad,
  clasificarEvento,
  esCursorValido,
  esFaseConHistorial,
  recuperabilidad,
  revisionDeEvento,
  versionesExistentes,
  vigenteDeManifiesto,
} from "./lectura";

const entrada = (versionId: string, retenidas: string[]) => ({
  versionId,
  n: 1,
  retenidas: retenidas.map((id, i) => ({ id, n: i + 1, aprobada: false, protegida: false })),
});

describe("vigenteDeManifiesto / versionesExistentes", () => {
  it("la vigente sale del MANIFIESTO (no de ningún campo `estado` de la versión)", () => {
    const m = { artefactos: { f2M1: entrada("f2M1__000003", ["f2M1__000001", "f2M1__000003"]) } };
    expect(vigenteDeManifiesto(m, "f2M1")).toBe("f2M1__000003");
    expect(vigenteDeManifiesto(m, "otro")).toBeNull();
    expect(vigenteDeManifiesto(undefined, "f2M1")).toBeNull();
    expect(vigenteDeManifiesto({ artefactos: { f2M1: { ...entrada("", []) } } }, "f2M1")).toBeNull();
  });
  it("existen = las `retenidas` de TODOS los artefactos más la vigente de cada uno", () => {
    const m = {
      artefactos: {
        a: entrada("a__000002", ["a__000001", "a__000002"]),
        b: entrada("b__000005", ["b__000004"]), // la vigente no figura en retenidas: aun así existe
      },
    };
    expect([...versionesExistentes(m)].sort()).toEqual(["a__000001", "a__000002", "b__000004", "b__000005"]);
    expect(versionesExistentes(undefined).size).toBe(0);
  });
});

describe("recuperabilidad", () => {
  const existen = new Set(["a__1", "b__1"]);
  it("completo / parcial / no", () => {
    expect(recuperabilidad(["a__1", "b__1"], existen)).toBe("completo");
    expect(recuperabilidad(["a__1", "b__9"], existen)).toBe("parcial");
    expect(recuperabilidad(["a__9", "b__9"], existen)).toBe("no");
    expect(recuperabilidad([null], existen)).toBe("no");
    expect(recuperabilidad([], existen)).toBe("no");
  });
});

describe("revisionDeEvento", () => {
  const ev = (data: Record<string, unknown>) => ({ id: "e", data });
  it("solo acepta un entero >= 1 de la misma fase", () => {
    expect(revisionDeEvento(ev({ revisionN: 3, fase: "exploracion" }), "exploracion")).toBe(3);
    expect(revisionDeEvento(ev({ revisionN: 0, fase: "exploracion" }), "exploracion")).toBeNull();
    expect(revisionDeEvento(ev({ revisionN: 2.5, fase: "exploracion" }), "exploracion")).toBeNull();
    expect(revisionDeEvento(ev({ revisionN: "3", fase: "exploracion" }), "exploracion")).toBeNull();
    expect(revisionDeEvento(ev({ fase: "exploracion" }), "exploracion")).toBeNull();
    expect(revisionDeEvento(ev({ revisionN: 3, fase: "proposito" }), "exploracion")).toBeNull();
  });
});

describe("analizarContinuidad", () => {
  it("página llena y contigua: sin huecos y con cursor", () => {
    const r = analizarContinuidad([10, 9, 8], { techo: 10, pedidos: 3, limite: 3 });
    expect(r).toEqual({ faltantes: [], faltantesTotal: 0, siguienteCursor: 8 });
  });
  it("última página corta que llega a 1: sin huecos y sin cursor", () => {
    const r = analizarContinuidad([3, 2, 1], { techo: 3, pedidos: 3, limite: 20 });
    expect(r).toEqual({ faltantes: [], faltantesTotal: 0, siguienteCursor: null });
  });
  it("hueco en medio: lo reporta", () => {
    const r = analizarContinuidad([6, 5, 3, 2, 1], { techo: 6, pedidos: 5, limite: 20 });
    expect(r.faltantes).toEqual([4]);
    expect(r.faltantesTotal).toBe(1);
  });
  it("página corta que NO llega a 1: faltan los antiguos (no es el final)", () => {
    const r = analizarContinuidad([5, 4, 3], { techo: 5, pedidos: 3, limite: 20 });
    expect(r.faltantes).toEqual([2, 1]);
    expect(r.siguienteCursor).toBeNull();
  });
  it("sin ningún evento pero el contador dice n: faltan todos", () => {
    const r = analizarContinuidad([], { techo: 3, pedidos: 0, limite: 20 });
    expect(r.faltantes).toEqual([3, 2, 1]);
    expect(r.faltantesTotal).toBe(3);
  });
  it("el primero es menor que el techo (faltan los más recientes)", () => {
    const r = analizarContinuidad([3, 2, 1], { techo: 5, pedidos: 3, limite: 20 });
    expect(r.faltantes).toEqual([5, 4]);
  });
  it("sin historial (techo 0): nada que reportar", () => {
    expect(analizarContinuidad([], { techo: 0, pedidos: 0, limite: 20 })).toEqual({ faltantes: [], faltantesTotal: 0, siguienteCursor: null });
  });
  it("páginas siguientes: el techo es cursor - 1", () => {
    const r = analizarContinuidad([25, 24, 23], { techo: 25, pedidos: 3, limite: 3 });
    expect(r.faltantes).toEqual([]);
    expect(r.siguienteCursor).toBe(23);
  });
  it("una página llena con cursor que llega a 1 no pide otra", () => {
    expect(analizarContinuidad([3, 2, 1], { techo: 3, pedidos: 3, limite: 3 }).siguienteCursor).toBeNull();
  });
  it("un duplicado o un valor fuera de orden no cuenta como hueco", () => {
    const r = analizarContinuidad([5, 5, 4], { techo: 5, pedidos: 3, limite: 3 });
    expect(r.faltantes).toEqual([]);
  });
  it("lista como máximo 50 faltantes pero cuenta todos", () => {
    const r = analizarContinuidad([], { techo: 120, pedidos: 0, limite: 20 });
    expect(r.faltantes).toHaveLength(50);
    expect(r.faltantesTotal).toBe(120);
  });
});

describe("esFaseConHistorial", () => {
  it("solo las fases 1 a 3 (las demás son marcadores vacíos)", () => {
    for (const f of ["proposito", "exploracion", "investigacion"]) expect(esFaseConHistorial(f)).toBe(true);
    for (const f of ["diagnostico", "estrategia", "tactica", "gerencia", "seguimiento", "evaluacion", "", null, undefined, 3]) {
      expect(esFaseConHistorial(f)).toBe(false);
    }
  });
});

// ---- C4a-2a (H-V54): el cursor cumple EXACTAMENTE la validación de la ruta ----
describe("esCursorValido (misma regla que la ruta: entero >= 1 y de hasta 9 dígitos)", () => {
  it("acepta enteros desde 1 hasta 999 999 999", () => {
    for (const v of [1, 2, 7, 20, 999_999_999]) expect(esCursorValido(v)).toBe(true);
  });
  it("rechaza 0, negativos, fracciones, texto, NaN, infinitos, null, undefined y más de 9 dígitos", () => {
    for (const v of [0, -1, -7, 7.5, 0.5, "7", "", NaN, Infinity, -Infinity, null, undefined, {}, [], true, 1_000_000_000]) {
      expect(esCursorValido(v)).toBe(false);
    }
  });
});

describe("analizarContinuidad: el cursor producido siempre es válido (H-V54)", () => {
  it("una página llena de revisiones inválidas (0, 7.5, NaN, negativos) NO produce cursor", () => {
    const r = analizarContinuidad([0, 7.5, NaN, -3, -1], { techo: 10, pedidos: 5, limite: 5 });
    expect(r.siguienteCursor).toBeNull();
  });
  it("valores inválidos mezclados con válidos: el cursor sale del menor VÁLIDO, nunca del inválido", () => {
    const r = analizarContinuidad([9, 8, 0.5, -2], { techo: 9, pedidos: 4, limite: 4 });
    expect(r.siguienteCursor).toBe(8);
    expect(esCursorValido(r.siguienteCursor)).toBe(true);
  });
  it("el último válido es 1 → no hay nada debajo → sin cursor", () => {
    expect(analizarContinuidad([3, 2, 1], { techo: 3, pedidos: 3, limite: 3 }).siguienteCursor).toBeNull();
  });
  it("página corta con inválidos → sin cursor (la consulta se agotó)", () => {
    expect(analizarContinuidad([5, 0], { techo: 5, pedidos: 2, limite: 20 }).siguienteCursor).toBeNull();
  });
  it("un cursor de más de 9 dígitos (la ruta lo rechazaría) no se devuelve nunca", () => {
    const r = analizarContinuidad([1_000_000_002, 1_000_000_001], { techo: 1_000_000_002, pedidos: 2, limite: 2 });
    expect(r.siguienteCursor).toBeNull();
  });
  it("todo cursor devuelto (barrido de formas de página) cumple esCursorValido", () => {
    const cabezas = [[10, 9], [10, 7.5], [10, NaN], [0], [], [1], [2, 1], [999_999_999, 999_999_998]];
    for (const rev of cabezas) {
      const c = analizarContinuidad(rev, { techo: 999_999_999, pedidos: rev.length, limite: rev.length || 1 }).siguienteCursor;
      expect(c === null || esCursorValido(c)).toBe(true);
    }
  });
});

// ---- C4a-2a (H-V55): evento incompleto ≠ retención ----
describe("clasificarEvento", () => {
  const existentes = new Set(["a__000001", "a__000002"]);
  it("todas las versiones existen → ni incompleto ni retención", () => {
    expect(clasificarEvento(["a__000001", "a__000002"], existentes)).toEqual({ incompleto: false, retencionParcial: false });
  });
  it("una versión citada que ya no existe → retención (no incompleto)", () => {
    expect(clasificarEvento(["a__000001", "a__000009"], existentes)).toEqual({ incompleto: false, retencionParcial: true });
  });
  it("evento sin artefactos → INCOMPLETO y no retención", () => {
    expect(clasificarEvento([], existentes)).toEqual({ incompleto: true, retencionParcial: false });
  });
  it("artefacto sin versionId (null) → INCOMPLETO y no retención", () => {
    expect(clasificarEvento([null], existentes)).toEqual({ incompleto: true, retencionParcial: false });
    expect(clasificarEvento(["a__000001", null], existentes)).toEqual({ incompleto: true, retencionParcial: false });
  });
  it("null más una versión podada → ambas cosas, cada una por su causa", () => {
    expect(clasificarEvento([null, "a__000009"], existentes)).toEqual({ incompleto: true, retencionParcial: true });
  });
});
