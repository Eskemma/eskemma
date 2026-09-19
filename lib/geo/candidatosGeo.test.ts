// lib/geo/candidatosGeo.test.ts
// Búsqueda por nombre que devuelve TODOS los candidatos (Estado, Municipio,
// Distrito federal, Distrito local). Casos guía con datos REALES verificados
// contra los CSV de Sefix en Storage (2026-09-19): Mérida (varios distritos del
// mismo estado), Querétaro (Estado + Municipio + distritos federales y locales) y
// Tonalá (mismo nombre en dos estados). Los catálogos de distritos son los JSON
// estáticos del repo; el de municipios se inyecta.

import { describe, expect, it } from "vitest";
import { buscarCandidatosPorNombre, nombresHistoricosDistrito, type MunicipioCatalogo } from "./candidatosGeo";

const municipios: MunicipioCatalogo[] = [
  { estadoCve: "22", nombre: "QUERETARO" },
  { estadoCve: "22", nombre: "EL MARQUES" },
  { estadoCve: "31", nombre: "MERIDA" },
  { estadoCve: "07", nombre: "TONALA" },
  { estadoCve: "14", nombre: "TONALA" },
  { estadoCve: "14", nombre: "SAN PEDRO TLAQUEPAQUE" },
];

const porTipo = (r: ReturnType<typeof buscarCandidatosPorNombre>) =>
  Object.fromEntries(
    ["estado", "municipio", "distrito_federal", "distrito_local"].map((t) => [t, r.filter((c) => c.tipo === t).map((c) => c.clave)])
  );

describe("buscarCandidatosPorNombre", () => {
  it("Querétaro: Estado + Municipio + distritos federales y locales, todos clasificados", () => {
    const r = buscarCandidatosPorNombre("Querétaro", { estadoCve: "22", municipios });
    const t = porTipo(r);
    expect(t.estado).toEqual(["22"]);
    expect(t.municipio).toEqual(["22:QUERETARO"]);
    // el catálogo 2025 dice SANTIAGO DE QUERETARO en 2203/2204/2206; el nombre histórico
    // "QUERETARO" (2006/2015) hace que "Querétaro" los encuentre igual
    expect(t.distrito_federal).toEqual(["2203", "2204", "2206"]);
    // 2203/2204 se llamaron QUERETARO (2006/2015) → exacta; 2206 solo existe como SANTIAGO DE QUERETARO → parcial
    const fed = r.filter((c) => c.tipo === "distrito_federal");
    expect(fed.map((c) => [c.clave, c.coincidencia])).toEqual([["2203", "exacta"], ["2204", "exacta"], ["2206", "parcial"]]);
    expect(t.distrito_local.length).toBeGreaterThanOrEqual(2);
    expect(r.filter((c) => c.tipo.startsWith("distrito")).every((c) => c.anio === 2025)).toBe(true);
    // display según la convención: estado con acentos, distrito con prefijo y sin acento
    expect(r[0]).toMatchObject({ tipo: "estado", nombre: "Querétaro" });
    expect(r.find((c) => c.clave === "2203" && c.tipo === "distrito_federal")?.nombre).toBe("2203 SANTIAGO DE QUERETARO");
  });

  it("dimensión temporal: 2203 federal trae el nombre de cada año (QUERETARO 2006/2015, SANTIAGO DE QUERETARO el resto)", () => {
    const r = buscarCandidatosPorNombre("Querétaro", { estadoCve: "22", tipos: ["distrito_federal"] });
    const d2203 = r.find((c) => c.clave === "2203");
    expect(d2203?.nombresPorAnio).toMatchObject({ "2006": "QUERETARO", "2009": "SANTIAGO DE QUERETARO", "2015": "QUERETARO", "2024": "SANTIAGO DE QUERETARO" });
    expect(nombresHistoricosDistrito("distrito_federal", "2203")).toEqual(d2203?.nombresPorAnio);
  });

  it("Mérida: 3 distritos federales de Yucatán (3103/3104/3106) + el municipio", () => {
    const r = buscarCandidatosPorNombre("Mérida", { estadoCve: "31", municipios });
    const t = porTipo(r);
    expect(t.municipio).toEqual(["31:MERIDA"]);
    expect(t.distrito_federal).toEqual(["3103", "3104", "3106"]);
    expect(t.estado).toEqual([]); // "Mérida" no es un estado
  });

  it("Mérida en un año concreto: los 3 distritos comparten el nombre en 2024 (37 nombres federales así en el país)", () => {
    const r = buscarCandidatosPorNombre("MERIDA", { estadoCve: "31", tipos: ["distrito_federal"] });
    expect(r.map((c) => c.nombre)).toEqual(["3103 MERIDA", "3104 MERIDA", "3106 MERIDA"]);
  });

  it("sin estadoCve, un nombre repetido entre estados devuelve los de todos (Tonalá: Chiapas y Jalisco)", () => {
    const r = buscarCandidatosPorNombre("Tonalá", { municipios });
    expect(porTipo(r).municipio).toEqual(["07:TONALA", "14:TONALA"]);
    expect(new Set(r.filter((c) => c.tipo.startsWith("distrito")).map((c) => c.estadoCve))).toEqual(new Set(["07", "14"]));
    // con estadoCve se restringe a un estado
    const jal = buscarCandidatosPorNombre("Tonalá", { estadoCve: "14", municipios });
    expect(new Set(jal.map((c) => c.estadoCve))).toEqual(new Set(["14"]));
    expect(porTipo(jal).distrito_federal).toEqual(["1407", "1420"]);
  });

  it("nombre NO ambiguo: un solo candidato (municipio con alias: 'Tlaquepaque' → San Pedro Tlaquepaque)", () => {
    const r = buscarCandidatosPorNombre("Tlaquepaque", { estadoCve: "14", municipios, tipos: ["municipio"] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tipo: "municipio", clave: "14:SAN PEDRO TLAQUEPAQUE", estadoCve: "14" });
  });

  it("estado solo: 'Jalisco' es únicamente el Estado (sin catálogo de municipios inyectado no se buscan municipios)", () => {
    const r = buscarCandidatosPorNombre("Jalisco");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tipo: "estado", clave: "14", nombre: "Jalisco" });
  });

  it("nombre inexistente, vacío o nulo → []", () => {
    expect(buscarCandidatosPorNombre("Narnia", { municipios })).toEqual([]);
    expect(buscarCandidatosPorNombre("   ")).toEqual([]);
    expect(buscarCandidatosPorNombre(null)).toEqual([]);
    expect(buscarCandidatosPorNombre("Nacional")).toEqual([]);
  });

  it("orden estable: estado, municipio, distrito federal, distrito local", () => {
    const r = buscarCandidatosPorNombre("Querétaro", { estadoCve: "22", municipios });
    const orden = r.map((c) => c.tipo);
    const rank = (t: string) => ["estado", "municipio", "distrito_federal", "distrito_local"].indexOf(t);
    expect(orden).toEqual([...orden].sort((a, b) => rank(a) - rank(b)));
  });
});
