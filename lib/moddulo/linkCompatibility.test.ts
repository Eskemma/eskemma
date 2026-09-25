// lib/moddulo/linkCompatibility.test.ts
// Paso 2b (26-09-24): comparación de territorios por CONJUNTOS. Los casos existentes de
// `checkTerritoryMatch` siguen en lib/geo/normalizadoresSueltos.test.ts, sin editar.

import { describe, expect, it } from "vitest";
import type { Territorio } from "@/types/shared.types";
import {
  checkTerritoryMatch,
  compararTerritorios,
  explicarTerritorioApproximate,
} from "@/lib/moddulo/linkCompatibility";
import { unidadesDeTerritorio } from "@/lib/geo/unidadesTerritoriales";
import fixture from "./__tests__/fixtures/territorios32.json";

const t = (x: Partial<Territorio> & { nivel: Territorio["nivel"] }): Territorio => ({ nombre: "", ...x });

const zmg = (nombres: string[], conClave = true): Territorio =>
  t({
    nivel: "municipal",
    estado: "Jalisco",
    municipio: nombres[0],
    municipiosPorEstado: nombres.map((nombre) => ({
      nombre,
      estado: "Jalisco",
      ...(conClave ? { clave: `14:${nombre.toUpperCase()}` } : {}),
    })),
  });

// ── Caracterización con los 32 territorios REALES (496 pares) ────────────────
describe("checkTerritoryMatch: caracterización con los 32 territorios reales", () => {
  const ts = fixture.territorios as { id: string; territorio: Territorio }[];
  const pares: { i: number; j: number; anterior: string }[] = [];
  let k = 0;
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) pares.push({ i, j, anterior: fixture.resultadoAnterior[k++] });
  }
  const nuevo = pares.map((p) => checkTerritoryMatch(ts[p.i].territorio, ts[p.j].territorio));

  it("el fixture tiene 32 territorios y 496 pares", () => {
    expect(ts).toHaveLength(32);
    expect(pares).toHaveLength(496);
  });

  it("matriz anterior → nuevo: 463 / 5 / 22 / 1 / 5 y nada más", () => {
    const matriz: Record<string, number> = {};
    pares.forEach((p, n) => {
      const clave = `${p.anterior}>${nuevo[n][0]}`;
      matriz[clave] = (matriz[clave] ?? 0) + 1;
    });
    expect(matriz).toEqual({ "m>m": 463, "m>a": 5, "a>a": 22, "a>e": 1, "e>e": 5 });
  });

  it("es simétrica en los 496 pares", () => {
    for (const p of pares) {
      expect(checkTerritoryMatch(ts[p.j].territorio, ts[p.i].territorio)).toBe(
        checkTerritoryMatch(ts[p.i].territorio, ts[p.j].territorio)
      );
    }
  });

  it("los únicos 6 pares que cambian son los de la familia ZMG/Guadalajara/Zapopan y Progreso", () => {
    const cambios = pares
      .map((p, n) => ({ p, n }))
      .filter(({ p, n }) => p.anterior !== nuevo[n][0])
      .map(({ p, n }) => `${p.anterior}>${nuevo[n][0]} ${ts[p.i].id.slice(0, 9)} ${ts[p.j].id.slice(0, 9)}`)
      .sort();
    expect(cambios).toEqual(
      [
        "m>a fon/1g2Bp mod/O2RBn", // Guadalajara (sesión) vs proyecto ZMG de 8 municipios
        "m>a fon/1g2Bp fon/vO9JF", // Guadalajara vs sesión Zapopan (10 municipios)
        "m>a fon/vO9JF mod/0rSXt", // sesión Zapopan (10) vs proyecto Guadalajara
        "m>a fon/vO9JF mod/O2RBn", // sesión Zapopan (10) vs ZMG (8)
        "m>a mod/0rSXt mod/O2RBn", // proyecto Guadalajara vs ZMG
        "a>e fon/3wsyh mod/Q5ZYk", // Progreso: claves iguales en ambos lados
      ].sort()
    );
  });

  it("ningún par real pasa de 'exact' a otra cosa (no se estrecha nada que hoy funcione)", () => {
    pares.forEach((p, n) => {
      if (p.anterior === "e") expect(nuevo[n]).toBe("exact");
    });
  });
});

// ── Municipal plural: conjuntos en vez del primer elemento ───────────────────
describe("compararTerritorios: municipal por conjuntos", () => {
  const ZMG8 = ["Tlaquepaque", "Guadalajara", "Zapopan", "Tonalá", "Tlajomulco de Zúñiga", "El Salto", "Juanacatlán", "Ixtlahuacán de los Membrillos"];
  const guadalajara = t({ nivel: "municipal", estado: "Jalisco", municipio: "Guadalajara", municipiosPorEstado: [{ nombre: "Guadalajara", estado: "Jalisco", clave: "14:GUADALAJARA" }] });

  it("Guadalajara está DENTRO de la ZMG: ya no es 'mismatch' por mirar solo el primer municipio", () => {
    const r = compararTerritorios(zmg(ZMG8), guadalajara);
    expect(r).toEqual({ match: "approximate", relacion: "cubre" });
    expect(compararTerritorios(guadalajara, zmg(ZMG8))).toEqual({ match: "approximate", relacion: "cubierto" });
  });

  it("traslape parcial: comparten unos y cada uno tiene otros → approximate", () => {
    expect(compararTerritorios(zmg(["Zapopan", "Guadalajara"]), zmg(["Guadalajara", "Tonalá"]))).toEqual({ match: "approximate", relacion: "traslape" });
  });

  it("conjuntos disjuntos → mismatch, aunque compartan el estado", () => {
    expect(checkTerritoryMatch(zmg(["Zapopan", "Guadalajara"]), zmg(["Tonalá", "El Salto"]))).toBe("mismatch");
  });

  it("mismo conjunto, en otro orden y con claves en ambos lados → exact (por primera vez un municipal puede serlo)", () => {
    expect(compararTerritorios(zmg(["Zapopan", "Guadalajara"]), zmg(["Guadalajara", "Zapopan"]))).toEqual({ match: "exact", relacion: "igual" });
  });

  it("mismo conjunto pero con claves derivadas de texto en algún lado → approximate: nunca 'exact' por interpretar texto", () => {
    expect(compararTerritorios(zmg(["Zapopan", "Guadalajara"]), zmg(["Zapopan", "Guadalajara"], false))).toEqual({ match: "approximate", relacion: "igual" });
  });

  it("municipal con solo el `municipio` escalar (sin lista): clave derivada, se compara igual", () => {
    const a = t({ nivel: "municipal", estado: "Morelos", municipio: "Cuernavaca" });
    const b = t({ nivel: "municipal", estado: "Morelos", municipio: "CUERNAVACA" });
    expect(compararTerritorios(a, b)).toEqual({ match: "approximate", relacion: "igual" });
    expect(checkTerritoryMatch(a, t({ nivel: "municipal", estado: "Morelos", municipio: "Cuautla" }))).toBe("mismatch");
  });

  it("mismo nombre en otro estado NO es el mismo municipio", () => {
    const a = t({ nivel: "municipal", estado: "Jalisco", municipio: "Tonalá" });
    const b = t({ nivel: "municipal", estado: "Chiapas", municipio: "Tonalá" });
    expect(checkTerritoryMatch(a, b)).toBe("mismatch");
  });

  it("el plegado de Ñ/Ü del lado derivado no rompe la igualdad con la clave guardada", () => {
    const guardada = t({ nivel: "municipal", estado: "Jalisco", municipiosPorEstado: [{ nombre: "Tlajomulco de Zúñiga", estado: "Jalisco", clave: "14:TLAJOMULCO DE ZUÑIGA" }] });
    const tecleada = t({ nivel: "municipal", estado: "Jalisco", municipio: "Tlajomulco de Zuniga" });
    expect(compararTerritorios(guardada, tecleada).relacion).toBe("igual");
  });

  it("municipal sin ningún municipio → approximate / no_comparable (no se inventa)", () => {
    expect(compararTerritorios(t({ nivel: "municipal", estado: "Jalisco" }), guadalajara)).toEqual({ match: "approximate", relacion: "no_comparable" });
  });
});

// ── Estatal plural: el 'exact' ya no se concede por el primer estado ─────────
describe("compararTerritorios: estatal por conjuntos", () => {
  const est = (...estados: string[]) => t({ nivel: "estatal", estado: estados[0], estadosSeleccionados: estados });

  it("[Jalisco, Colima] vs [Jalisco, Nayarit]: comparten solo el primero → approximate (antes 'exact' falso)", () => {
    expect(compararTerritorios(est("Jalisco", "Colima"), est("Jalisco", "Nayarit"))).toEqual({ match: "approximate", relacion: "traslape" });
  });

  it("[Jalisco] vs [Jalisco, Colima]: uno contiene al otro → approximate", () => {
    expect(compararTerritorios(est("Jalisco"), est("Jalisco", "Colima")).relacion).toBe("cubierto");
  });

  it("mismo conjunto de estados (otro orden, otros nombres) → exact", () => {
    expect(checkTerritoryMatch(est("México", "Coahuila de Zaragoza"), est("Coahuila", "Estado de México"))).toBe("exact");
  });

  it("estatal sin ningún estado en algún lado → approximate (antes 'exact' sin verificar nada)", () => {
    expect(compararTerritorios(t({ nivel: "estatal" }), est("Jalisco"))).toEqual({ match: "approximate", relacion: "no_comparable" });
  });
});

// ── Lo que NO cambia ──────────────────────────────────────────────────────────
describe("compararTerritorios: políticas vigentes se conservan", () => {
  it("niveles distintos → mismatch (contención entre niveles queda para el Paso 2c)", () => {
    expect(compararTerritorios(t({ nivel: "estatal", estado: "Jalisco" }), zmg(["Zapopan"]))).toEqual({ match: "mismatch", relacion: "no_comparable" });
    expect(checkTerritoryMatch(t({ nivel: "nacional" }), t({ nivel: "estatal", estado: "Jalisco" }))).toBe("mismatch");
    expect(checkTerritoryMatch(t({ nivel: "distrito_federal", estado: "Jalisco" }), t({ nivel: "distrito_local", estado: "Jalisco" }))).toBe("mismatch");
  });

  it("nacional: países comparables → exact; distintos → mismatch; sin país declarado no se decide en contra", () => {
    expect(checkTerritoryMatch(t({ nivel: "nacional", pais: "México" }), t({ nivel: "nacional", pais: "Mexico" }))).toBe("exact");
    expect(checkTerritoryMatch(t({ nivel: "nacional", pais: "México" }), t({ nivel: "nacional", pais: "Colombia" }))).toBe("mismatch");
    expect(checkTerritoryMatch(t({ nivel: "nacional" }), t({ nivel: "nacional", pais: "Colombia" }))).toBe("exact");
  });

  it("sin territorio en algún lado → approximate", () => {
    expect(compararTerritorios(null, t({ nivel: "nacional" }))).toEqual({ match: "approximate", relacion: "no_comparable" });
    expect(compararTerritorios(t({ nivel: "nacional" }), undefined).match).toBe("approximate");
  });
});

// ── Distritos ─────────────────────────────────────────────────────────────────
describe("compararTerritorios: distritos", () => {
  const d = (cve: string, estado = "Ciudad de México", nivel: Territorio["nivel"] = "distrito_local") =>
    t({ nivel, estado, distritosSeleccionados: [{ cve, nombre: "X", estado }] });

  it("el distrito 27 de CDMX es el código 0927 (estado + distrito), no '027' a secas", () => {
    expect([...unidadesDeTerritorio(d("027")).claves]).toEqual(["0927"]);
  });

  it("mismo número en otro estado NO coincide", () => {
    expect(checkTerritoryMatch(d("005", "Jalisco", "distrito_federal"), d("005", "Yucatán", "distrito_federal"))).toBe("mismatch");
  });

  it("listas de distritos: mismo conjunto → exact; contiene → approximate; disjunto → mismatch", () => {
    const lista = (...cves: string[]) => t({ nivel: "distrito_local", estado: "Ciudad de México", distritosSeleccionados: cves.map((cve) => ({ cve, nombre: "X", estado: "Ciudad de México" })) });
    expect(checkTerritoryMatch(lista("027", "028"), lista("028", "027"))).toBe("exact");
    expect(compararTerritorios(lista("027", "028"), lista("027")).relacion).toBe("cubre");
    expect(checkTerritoryMatch(lista("027", "028"), lista("001"))).toBe("mismatch");
  });

  it("texto libre sin número en un lado: se conserva la comparación por cabecera de siempre", () => {
    const pvA = t({ nivel: "distrito_federal", estado: "Jalisco", municipio: "Distrito Electoral Federal V, con cabecera en Puerto Vallarta, Jalisco, México." });
    const sinNumero = (ciudad: string) => t({ nivel: "distrito_federal", estado: "Jalisco", municipio: `con cabecera en ${ciudad}, Jalisco` });
    expect(checkTerritoryMatch(pvA, sinNumero("Puerto Vallarta"))).toBe("approximate");
    expect(checkTerritoryMatch(pvA, sinNumero("Ocotlán"))).toBe("mismatch");
  });
});

// ── Textos ───────────────────────────────────────────────────────────────────
describe("explicarTerritorioApproximate", () => {
  it("cada relación tiene un texto distinto y solo 'igual'/'no_comparable' dice 'parecen coincidir'", () => {
    const textos = (["igual", "no_comparable", "cubre", "cubierto", "traslape"] as const).map(explicarTerritorioApproximate);
    expect(textos[0]).toContain("parecen coincidir");
    expect(textos[1]).toContain("parecen coincidir");
    for (const x of textos.slice(2)) expect(x).not.toContain("parecen coincidir");
    expect(textos[2]).toContain("contiene al otro");
    expect(textos[4]).toContain("comparten algunas unidades");
  });
});
