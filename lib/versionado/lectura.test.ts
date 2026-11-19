// C4a-1 — reglas PURAS de lectura: vigente por manifiesto (nunca por `estado`), versiones que existen, recuperable y
// continuidad entre el contador del puntero y los eventos leídos (hueco = aviso, nunca «sin historial»).
import { describe, expect, it } from "vitest";
import {
  analizarContinuidad,
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
