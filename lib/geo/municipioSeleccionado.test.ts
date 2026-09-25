// lib/geo/municipioSeleccionado.test.ts
// Paso 2a (26-09-24). Uses the REAL catalog snapshot and the REAL shapes found in production
// territories (26-09-23/24 scan): the ZMG Moddulo project (municipiosPorEstado + legacy list +
// scalar), the linked Fontana session (10 plain names, empty municipiosPorEstado), scalar-only
// municipal territories and a Colombian one.

import { describe, expect, it } from "vitest";
import catalogo from "./__fixtures__/municipios_catalogo.json";
import { desambiguarReferencia, type MunicipioCatalogoRef } from "./desambiguar";
import {
  agregarMunicipioSeleccionado,
  aplicarRellenos,
  decidirAltaMunicipio,
  esResolubleEnCatalogo,
  mismoMunicipio,
  municipiosDeTerritorio,
  municipioDesdeCandidato,
  proponerRelleno,
  reemplazarMunicipioSeleccionado,
} from "./municipioSeleccionado";
import { resolverEstadoCve } from "./estados";
import type { MunicipioSeleccionado } from "@/types/shared.types";

const CAT = catalogo as MunicipioCatalogoRef[];

// Real shapes (names/estado exactly as stored).
const PROYECTO_ZMG = {
  nivel: "municipal",
  estado: "Jalisco",
  municipio: "Tlaquepaque",
  estadosSeleccionados: ["Jalisco"],
  municipiosSeleccionados: ["Tlaquepaque", "Tonalá", "Tlajomulco", "El Salto", "Juanacatlán", "Zapotlanejo", "Guadalajara", "Zapopan"],
  municipiosPorEstado: ["Tlaquepaque", "Tonalá", "Tlajomulco", "El Salto", "Juanacatlán", "Zapotlanejo", "Guadalajara", "Zapopan"].map(
    (nombre) => ({ nombre, estado: "Jalisco" })
  ),
};
const SESION_ZMG = {
  nivel: "municipal",
  estado: "Jalisco",
  municipio: "Zapopan",
  municipiosPorEstado: [] as MunicipioSeleccionado[],
  municipiosSeleccionados: ["Zapopan", "Tlaquepaque", "Tonalá", "Tlajomulco", "El Salto", "Juanacatlán", "Ixtlahuacán", "Acatlán", "Zapotlanejo", "Guadalajara"],
};
const SOLO_ESCALAR = { nivel: "municipal", estado: "Morelos", municipio: "Cuernavaca" };
const COLOMBIA = { nivel: "municipal", pais: "Colombia", estado: "Magdalena", municipio: "Nueva Granada" };

function resolver(m: MunicipioSeleccionado) {
  const estadoCve = resolverEstadoCve(m.estado) ?? undefined;
  return desambiguarReferencia(m.nombre, { estadoCve, municipios: CAT, tipos: ["municipio"] });
}
const propuestas = (lista: MunicipioSeleccionado[]) => lista.map((m) => proponerRelleno(m, resolver(m)));

describe("municipiosDeTerritorio: las 4 formas reales guardadas", () => {
  it("proyecto ZMG (mixto): usa municipiosPorEstado (8)", () => {
    expect(municipiosDeTerritorio(PROYECTO_ZMG)).toHaveLength(8);
  });
  it("sesión con lista plana y municipiosPorEstado vacío: reconstruye 10 con el estado escalar", () => {
    const l = municipiosDeTerritorio(SESION_ZMG);
    expect(l).toHaveLength(10);
    expect(l.every((m) => m.estado === "Jalisco" && !m.clave)).toBe(true);
  });
  it("solo escalar y Colombia: sin lista → []", () => {
    expect(municipiosDeTerritorio(SOLO_ESCALAR)).toEqual([]);
    expect(municipiosDeTerritorio(COLOMBIA)).toEqual([]);
    expect(municipiosDeTerritorio(null)).toEqual([]);
  });
});

describe("proponerRelleno sobre los datos reales", () => {
  it("proyecto ZMG: las 8 resuelven solas (Tlaquepaque por alias, Tlajomulco por parcial)", () => {
    const p = propuestas(municipiosDeTerritorio(PROYECTO_ZMG));
    expect(p.every((x) => x.clase === "unico")).toBe(true);
    const por = Object.fromEntries(p.map((x) => [x.entrada.nombre, x]));
    expect(por["Tlaquepaque"]).toMatchObject({ coincidencia: "alias", propuesta: { clave: "14:SAN PEDRO TLAQUEPAQUE" } });
    expect(por["Tlajomulco"]).toMatchObject({ coincidencia: "parcial", propuesta: { clave: "14:TLAJOMULCO DE ZUÑIGA" } });
    expect(por["Tonalá"]).toMatchObject({ coincidencia: "exacta", propuesta: { clave: "14:TONALA" } });
    expect(por["Guadalajara"].propuesta?.clave).toBe("14:GUADALAJARA");
  });

  it("sesión ZMG: 9 resuelven solas y Ixtlahuacán queda ambiguo con sus 2 candidatos reales", () => {
    const p = propuestas(municipiosDeTerritorio(SESION_ZMG));
    expect(p.filter((x) => x.clase === "unico")).toHaveLength(9);
    const ambiguo = p.filter((x) => x.clase === "ambiguo");
    expect(ambiguo).toHaveLength(1);
    expect(ambiguo[0].entrada.nombre).toBe("Ixtlahuacán");
    expect(ambiguo[0].candidatos?.map((c) => c.clave)).toEqual(["14:IXTLAHUACAN DE LOS MEMBRILLOS", "14:IXTLAHUACAN DEL RIO"]);
    const acatlan = p.find((x) => x.entrada.nombre === "Acatlán");
    expect(acatlan).toMatchObject({ clase: "unico", coincidencia: "parcial", propuesta: { clave: "14:ACATLAN DE JUAREZ" } });
  });

  it("Colombia (Magdalena) → sin catálogo: nunca se le inventa clave", () => {
    const m = { nombre: "Nueva Granada", estado: "Magdalena" };
    expect(esResolubleEnCatalogo(m)).toBe(false);
    expect(proponerRelleno(m, null).clase).toBe("sin_catalogo");
    expect(proponerRelleno(m, resolver(m)).clase).toBe("sin_catalogo");
  });

  it("una entrada que ya trae clave no se toca", () => {
    const m = { nombre: "Zapopan", estado: "Jalisco", clave: "14:ZAPOPAN" };
    expect(proponerRelleno(m, resolver(m)).clase).toBe("ya_tiene_clave");
  });

  it("aplicarRellenos completa solo las seguras, sin renombrar ni tocar la ambigua", () => {
    const lista = municipiosDeTerritorio(SESION_ZMG);
    const nueva = aplicarRellenos(lista, propuestas(lista));
    expect(nueva.map((m) => m.nombre)).toEqual(lista.map((m) => m.nombre));
    expect(nueva.filter((m) => m.clave)).toHaveLength(9);
    expect(nueva.find((m) => m.nombre === "Ixtlahuacán")?.clave).toBeUndefined();
  });
});

describe("alta de un municipio tecleado (decidirAltaMunicipio)", () => {
  const alta = (texto: string, estado = "Hidalgo") =>
    decidirAltaMunicipio(estado, texto, desambiguarReferencia(texto, { estadoCve: resolverEstadoCve(estado) ?? undefined, municipios: CAT, tipos: ["municipio"] }));

  it("Pachuca → se agrega como Pachuca de Soto con clave y aviso", () => {
    expect(alta("Pachuca")).toMatchObject({
      tipo: "agregar",
      entrada: { nombre: "Pachuca de Soto", estado: "Hidalgo", clave: "13:PACHUCA DE SOTO" },
      aviso: "«Pachuca» se interpretó como Pachuca de Soto.",
    });
  });

  it("un exacto conserva lo tecleado, con sus acentos, y trae clave sin aviso", () => {
    const r = alta("Tonalá", "Jalisco");
    expect(r).toEqual({ tipo: "agregar", entrada: { nombre: "Tonalá", estado: "Jalisco", clave: "14:TONALA" } });
  });

  it("Tlaquepaque (alias) → nombre oficial San Pedro Tlaquepaque", () => {
    expect(alta("Tlaquepaque", "Jalisco")).toMatchObject({ tipo: "agregar", entrada: { nombre: "San Pedro Tlaquepaque", clave: "14:SAN PEDRO TLAQUEPAQUE" } });
  });

  it("Ixtlahuacán en Jalisco → elegir entre los 2 reales", () => {
    const r = alta("Ixtlahuacán", "Jalisco");
    expect(r.tipo).toBe("elegir");
    if (r.tipo === "elegir") expect(r.candidatos).toHaveLength(2);
  });

  it("un nombre que no existe → se agrega tal cual, sin clave, con aviso (como antes)", () => {
    const r = alta("Narnia");
    expect(r).toMatchObject({ tipo: "sin_reconocer", entrada: { nombre: "Narnia", estado: "Hidalgo" } });
    expect((r as { entrada: MunicipioSeleccionado }).entrada.clave).toBeUndefined();
  });

  it("un nombre genérico dentro de su estado con >8 candidatos → precisar (San en Oaxaca)", () => {
    const r = alta("San", "Oaxaca");
    expect(r.tipo).toBe("precisar");
  });

  it("los dos San Juan Mixtepec del picker quedan como entradas distintas", () => {
    const r = alta("San Juan Mixtepec", "Oaxaca");
    expect(r.tipo).toBe("elegir");
    if (r.tipo === "elegir") {
      const [a, b] = r.candidatos.map((c) => municipioDesdeCandidato("Oaxaca", c));
      expect(a.clave).not.toBe(b.clave);
      const lista = agregarMunicipioSeleccionado(agregarMunicipioSeleccionado([], a), b);
      expect(lista).toHaveLength(2);
    }
  });
});

describe("dedup, upgrade y reemplazo", () => {
  const tlaq = { nombre: "Tlaquepaque", estado: "Jalisco" };

  it("mismo municipio por nombre (Tlaquepaque = San Pedro Tlaquepaque) sin clave", () => {
    expect(mismoMunicipio(tlaq, { nombre: "San Pedro Tlaquepaque", estado: "Jalisco" })).toBe(true);
    expect(mismoMunicipio(tlaq, { nombre: "Tlaquepaque", estado: "Nayarit" })).toBe(false);
  });

  it("con clave en ambos lados compara por clave", () => {
    expect(mismoMunicipio({ nombre: "a", estado: "Oaxaca", clave: "20:X#1" }, { nombre: "a", estado: "Oaxaca", clave: "20:X#2" })).toBe(false);
  });

  it("agregar el mismo con clave a uno sin clave lo completa, no lo duplica ni lo renombra", () => {
    const r = agregarMunicipioSeleccionado([tlaq], { nombre: "San Pedro Tlaquepaque", estado: "Jalisco", clave: "14:SAN PEDRO TLAQUEPAQUE" });
    expect(r).toEqual([{ nombre: "Tlaquepaque", estado: "Jalisco", clave: "14:SAN PEDRO TLAQUEPAQUE" }]);
  });

  it("un duplicado exacto o un nombre vacío no cambian la lista", () => {
    expect(agregarMunicipioSeleccionado([tlaq], tlaq)).toEqual([tlaq]);
    expect(agregarMunicipioSeleccionado([tlaq], { nombre: "  ", estado: "Jalisco" })).toEqual([tlaq]);
  });

  it("el mismo nombre en 2 estados distintos son 2 entradas", () => {
    const r = agregarMunicipioSeleccionado([{ nombre: "Ocampo", estado: "Chihuahua" }], { nombre: "Ocampo", estado: "Coahuila" });
    expect(r).toHaveLength(2);
  });

  it("reemplazar la entrada ambigua por la elegida conserva el orden", () => {
    const lista = [{ nombre: "Zapopan", estado: "Jalisco" }, { nombre: "Ixtlahuacán", estado: "Jalisco" }, { nombre: "Guadalajara", estado: "Jalisco" }];
    const elegida = { nombre: "Ixtlahuacan de los Membrillos", estado: "Jalisco", clave: "14:IXTLAHUACAN DE LOS MEMBRILLOS" };
    const r = reemplazarMunicipioSeleccionado(lista, lista[1], elegida);
    expect(r.map((m) => m.nombre)).toEqual(["Zapopan", "Ixtlahuacan de los Membrillos", "Guadalajara"]);
  });
});
