import { describe, it, expect } from "vitest";
import { ventanaDeDiferencia } from "./ventanaDiferencia";
import { diffXpcto } from "./phasePropagation";

const rel = (s: string) => s.replace(/…/g, "");

describe("ventanaDeDiferencia", () => {
  it("valores cortos y distintos: completos y sin elipsis", () => {
    expect(ventanaDeDiferencia("casa roja", "casa azul")).toEqual({ anterior: "casa roja", nuevo: "casa azul" });
  });

  it("cambio al final de un texto largo: ventana con contexto, elipsis solo a la izquierda si falta texto", () => {
    const base = "x".repeat(100);
    const r = ventanaDeDiferencia(base + "A", base + "B");
    expect(r.anterior).toBe("…" + "x".repeat(15) + "A");
    expect(r.nuevo).toBe("…" + "x".repeat(15) + "B");
  });

  it("cambio al inicio: sin elipsis izquierda, elipsis derecha si excede max", () => {
    const resto = "y".repeat(100);
    const r = ventanaDeDiferencia("A" + resto, "B" + resto);
    expect(r.anterior).toBe("A" + "y".repeat(59) + "…");
    expect(r.nuevo).toBe("B" + "y".repeat(59) + "…");
  });

  it("cambio a la mitad: elipsis en ambos lados y mismo inicio", () => {
    const r = ventanaDeDiferencia("a".repeat(50) + "X" + "b".repeat(80), "a".repeat(50) + "Y" + "b".repeat(80));
    expect(r.anterior.startsWith("…" + "a".repeat(15) + "X")).toBe(true);
    expect(r.nuevo.startsWith("…" + "a".repeat(15) + "Y")).toBe(true);
    expect(r.anterior.endsWith("…")).toBe(true);
    expect(rel(r.anterior).length).toBe(60);
  });

  it("caso real sintético: frase larga con la diferencia pasado el carácter 40", () => {
    const antes = "Dos camionetas, un equipo de sonido y combustible para la campaña de Olmos en la región norte";
    const despues = "Dos camionetas, un equipo de sonido y combustible para la campaña de Olmos en la región sur";
    expect(antes.slice(0, 40)).toBe(despues.slice(0, 40)); // lo que se veía antes: idéntico
    const r = ventanaDeDiferencia(antes, despues);
    expect(r.anterior).not.toBe(r.nuevo);
    expect(r.anterior).toContain("norte");
    expect(r.nuevo).toContain("sur");
  });

  it("vacíos o ausentes se muestran como (vacío)", () => {
    expect(ventanaDeDiferencia("", "hola")).toEqual({ anterior: "(vacío)", nuevo: "hola" });
    expect(ventanaDeDiferencia(undefined, null)).toEqual({ anterior: "(vacío)", nuevo: "(vacío)" });
    expect(ventanaDeDiferencia("   ", "x")).toEqual({ anterior: "(vacío)", nuevo: "x" });
    expect(ventanaDeDiferencia("(vacío)", "x").anterior).toBe("(vacío)");
  });

  it("valores idénticos: ventana desde el inicio, «…» a la derecha si excede max, nunca vacía", () => {
    expect(ventanaDeDiferencia("igual", "igual")).toEqual({ anterior: "igual", nuevo: "igual" });
    const largo = "z".repeat(200);
    const r = ventanaDeDiferencia(largo, largo);
    expect(r.anterior).toBe("z".repeat(60) + "…");
    expect(r.nuevo).toBe(r.anterior);
  });

  it("un valor es prefijo del otro", () => {
    const r = ventanaDeDiferencia("hola", "hola mundo");
    expect(r).toEqual({ anterior: "hola", nuevo: "hola mundo" });
    const largo = "p".repeat(100);
    const r2 = ventanaDeDiferencia(largo, largo + "FIN");
    expect(r2.anterior).toBe("…" + "p".repeat(15) );
    expect(r2.nuevo).toBe("…" + "p".repeat(15) + "FIN");
  });

  it("mismo largo con un solo carácter distinto", () => {
    const a = "0123456789".repeat(10);
    const b = a.slice(0, 70) + "#" + a.slice(71);
    const r = ventanaDeDiferencia(a, b);
    expect(r.anterior).not.toBe(r.nuevo);
    expect(r.nuevo).toContain("#");
    expect(r.anterior).toContain(a[70]);
  });

  it("acentos y ñ: una letra acentuada cuenta como un carácter", () => {
    const base = "ñ".repeat(30);
    const r = ventanaDeDiferencia(base + "á", base + "a");
    expect(r.anterior).toBe("…" + "ñ".repeat(15) + "á");
    expect(r.nuevo).toBe("…" + "ñ".repeat(15) + "a");
  });

  it("combinante: e + acento no se parte", () => {
    const e = "é";
    const r = ventanaDeDiferencia(e.repeat(40) + "x", e.repeat(40) + "y", { max: 10, contexto: 2 });
    expect(r.anterior).toBe("…" + e.repeat(2) + "x");
    expect(r.nuevo).toBe("…" + e.repeat(2) + "y");
  });

  it("emoji (incluidos los compuestos) no se parten", () => {
    const fam = "👨‍👩‍👧";
    const r = ventanaDeDiferencia(fam.repeat(30) + "a", fam.repeat(30) + "b", { max: 6, contexto: 3 });
    expect(r.anterior).toBe("…" + fam.repeat(3) + "a");
    expect(r.nuevo).toBe("…" + fam.repeat(3) + "b");
  });

  it("saltos de línea y espacios consecutivos se muestran como un espacio, en una línea", () => {
    const r = ventanaDeDiferencia("uno\n\n  dos\t tres", "uno dos cuatro");
    expect(r.anterior).toBe("uno dos tres");
    expect(r.nuevo).toBe("uno dos cuatro");
    expect(r.anterior).not.toMatch(/[\n\t]/);
  });

  it("«…» es siempre el carácter único, nunca tres puntos", () => {
    const r = ventanaDeDiferencia("a".repeat(200) + "1" + "b".repeat(200), "a".repeat(200) + "2" + "b".repeat(200));
    expect(r.anterior).not.toContain("...");
    expect(r.nuevo).not.toContain("...");
  });

  it("respeta max y contexto personalizados", () => {
    const r = ventanaDeDiferencia("abcdefghij" + "1", "abcdefghij" + "2", { max: 4, contexto: 2 });
    expect(r).toEqual({ anterior: "…ij1", nuevo: "…ij2" });
  });

  it("textos de ~10 000 caracteres: rápido y con la ventana correcta", () => {
    const base = "palabra ".repeat(1250); // 10 000
    const t0 = Date.now();
    const r = ventanaDeDiferencia(base + "A".repeat(500), base + "B".repeat(500));
    const ms = Date.now() - t0;
    expect(ms).toBeLessThan(500);
    expect(r.anterior).toContain("A");
    expect(r.nuevo).toContain("B");
    expect(rel(r.anterior).length).toBeLessThanOrEqual(60);
  });

  describe("límite declarado: diferencias que la ventana no puede mostrar", () => {
    it("solo espacios: diffXpcto lo reporta como cambio, la ventana muestra ambos lados iguales", () => {
      const d = diffXpcto({ hito: "Ganar la elección" }, { hito: "Ganar  la elección " });
      expect(d).toHaveLength(1);
      const r = ventanaDeDiferencia(d[0].from, d[0].to);
      expect(r.anterior).toBe(r.nuevo);
    });

    it("solo forma Unicode (NFC vs NFD): se reporta como cambio y se ve igual", () => {
      const nfc = "Educación".normalize("NFC");
      const nfd = "Educación".normalize("NFD");
      expect(nfc).not.toBe(nfd);
      const d = diffXpcto({ hito: nfc }, { hito: nfd });
      expect(d).toHaveLength(1);
      const r = ventanaDeDiferencia(d[0].from, d[0].to);
      // Distintos como grafemas (misma apariencia): la ventana los muestra completos pero visualmente iguales.
      expect(r.anterior.normalize("NFC")).toBe(r.nuevo.normalize("NFC"));
    });
  });
});
