// lib/geo/normalizadoresSueltos.test.ts
// Punto 5 (Bloque B): normalizadores/listas de estado que vivían sueltos fuera de
// Fontana/Sefix-storage y ahora derivan del núcleo (lib/geo/). Cada bloque compara
// contra el fixture ANTERIOR (copiado verbatim) para probar que no cambia nada que ya
// funcionaba, y prueba los casos que antes fallaban.

import { describe, expect, it } from "vitest";
import { ESTADOS, ESTADOS_ALFABETICOS, NOMBRES_ESTADO_ORDENADOS, claveEstadoSnake } from "./estados";
import { claveMunicipioDeEstado } from "./claveMunicipioEstado";
import { ESTADO_MAP, ESTADOS_LIST } from "@/lib/sefix/constants";
import { abreviaturaEstado } from "@/lib/moddulo/abreviaturaEstado";
import { checkTerritoryMatch } from "@/lib/moddulo/linkCompatibility";
import { detectarSenalesTexto } from "@/lib/moddulo/territorioHeuristicas";
import type { Territorio } from "@/types/shared.types";

// ── Fixtures anteriores (verbatim) ────────────────────────────────────────────
const ESTADO_MAP_ANTERIOR: Record<string, string> = {
  aguascalientes: "AGUASCALIENTES", baja_california: "BAJA CALIFORNIA", baja_california_sur: "BAJA CALIFORNIA SUR",
  campeche: "CAMPECHE", chiapas: "CHIAPAS", chihuahua: "CHIHUAHUA", coahuila: "COAHUILA", colima: "COLIMA",
  ciudad_de_mexico: "CIUDAD DE MEXICO", durango: "DURANGO", estado_de_mexico: "ESTADO DE MEXICO",
  guanajuato: "GUANAJUATO", guerrero: "GUERRERO", hidalgo: "HIDALGO", jalisco: "JALISCO", michoacan: "MICHOACAN",
  morelos: "MORELOS", nayarit: "NAYARIT", nuevo_leon: "NUEVO LEON", oaxaca: "OAXACA", puebla: "PUEBLA",
  queretaro: "QUERETARO", quintana_roo: "QUINTANA ROO", san_luis_potosi: "SAN LUIS POTOSI", sinaloa: "SINALOA",
  sonora: "SONORA", tabasco: "TABASCO", tamaulipas: "TAMAULIPAS", tlaxcala: "TLAXCALA", veracruz: "VERACRUZ",
  yucatan: "YUCATAN", zacatecas: "ZACATECAS",
};

// TerritorySelector.tsx — ESTADOS_MEXICO (valores que se guardan en territorio.estado)
const ESTADOS_MEXICO_ANTERIOR = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
  "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima",
  "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo",
  "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
  "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa",
  "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán",
  "Zacatecas",
];

// GeoNavegador.tsx — ENTIDADES
const ENTIDADES_ANTERIOR = [
  "AGUASCALIENTES", "BAJA CALIFORNIA", "BAJA CALIFORNIA SUR", "CAMPECHE", "COAHUILA", "COLIMA", "CHIAPAS",
  "CHIHUAHUA", "CIUDAD DE MÉXICO", "DURANGO", "GUANAJUATO", "GUERRERO", "HIDALGO", "JALISCO", "ESTADO DE MÉXICO",
  "MICHOACÁN", "MORELOS", "NAYARIT", "NUEVO LEÓN", "OAXACA", "PUEBLA", "QUERÉTARO", "QUINTANA ROO",
  "SAN LUIS POTOSÍ", "SINALOA", "SONORA", "TABASCO", "TAMAULIPAS", "TLAXCALA", "VERACRUZ", "YUCATÁN", "ZACATECAS",
];

// OrigenCharts.tsx — ESTADOS_ORIGEN_KEYS (32 estados, orden alfabético) y NOMBRES
const ORIGEN_KEYS_ANTERIOR: [string, string][] = [
  ["aguascalientes", "Aguascalientes"], ["baja_california", "Baja California"], ["baja_california_sur", "Baja California Sur"],
  ["campeche", "Campeche"], ["chiapas", "Chiapas"], ["chihuahua", "Chihuahua"], ["ciudad_de_mexico", "Ciudad de México"],
  ["coahuila", "Coahuila"], ["colima", "Colima"], ["durango", "Durango"], ["estado_de_mexico", "Estado de México"],
  ["guanajuato", "Guanajuato"], ["guerrero", "Guerrero"], ["hidalgo", "Hidalgo"], ["jalisco", "Jalisco"],
  ["michoacan", "Michoacán"], ["morelos", "Morelos"], ["nayarit", "Nayarit"], ["nuevo_leon", "Nuevo León"],
  ["oaxaca", "Oaxaca"], ["puebla", "Puebla"], ["queretaro", "Querétaro"], ["quintana_roo", "Quintana Roo"],
  ["san_luis_potosi", "San Luis Potosí"], ["sinaloa", "Sinaloa"], ["sonora", "Sonora"], ["tabasco", "Tabasco"],
  ["tamaulipas", "Tamaulipas"], ["tlaxcala", "Tlaxcala"], ["veracruz", "Veracruz"], ["yucatan", "Yucatán"],
  ["zacatecas", "Zacatecas"],
];

// exploracion/page.tsx — ESTADOS_ABREV (keyada por nombre normalizado, con alias a mano)
const ESTADOS_ABREV_ANTERIOR: Record<string, string> = {
  aguascalientes: "AGS.", baja_california: "BC.", baja_california_sur: "BCS.", campeche: "CAMP.", chiapas: "CHIS.",
  chihuahua: "CHIH.", coahuila: "COAH.", coahuila_de_zaragoza: "COAH.", colima: "COL.", cdmx: "CDMX",
  ciudad_de_mexico: "CDMX", df: "CDMX", durango: "DGO.", estado_de_mexico: "EDOMEX.", edomex: "EDOMEX.",
  mexico: "EDOMEX.", guanajuato: "GTO.", guerrero: "GRO.", hidalgo: "HGO.", jalisco: "JAL.", michoacan: "MICH.",
  michoacan_de_ocampo: "MICH.", morelos: "MOR.", nayarit: "NAY.", nuevo_leon: "NL.", oaxaca: "OAX.", puebla: "PUE.",
  queretaro: "QRO.", quintana_roo: "Q.ROO.", san_luis_potosi: "SLP.", sinaloa: "SIN.", sonora: "SON.",
  tabasco: "TAB.", tamaulipas: "TAMS.", tlaxcala: "TLAX.", veracruz: "VER.", veracruz_de_ignacio_de_la_llave: "VER.",
  yucatan: "YUC.", zacatecas: "ZAC.",
};

describe("Sefix: ESTADO_MAP / ESTADOS_LIST / llave snake derivados del catálogo", () => {
  it("ESTADO_MAP es idéntico al escrito a mano que había", () => {
    expect(ESTADO_MAP).toEqual(ESTADO_MAP_ANTERIOR);
  });

  it("ESTADOS_LIST conserva contenido y orden", () => {
    const anterior = Object.entries(ESTADO_MAP_ANTERIOR)
      .map(([key, nombre]) => ({ key, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    expect(ESTADOS_LIST).toEqual(anterior);
  });

  it("claveEstadoSnake == la transformación `lower + _` que tenían SemanalView y la ruta, para los 32 y para los nombres crudos del pipeline", () => {
    const anterior = (s: string) => s.toLowerCase().replace(/\s+/g, "_");
    for (const e of ESTADOS) expect(claveEstadoSnake(e.clave)).toBe(anterior(e.clave));
    // nombres crudos REALES de semanal/*.csv (Storage, 2026-09-20) tras normalizeEntidadName
    for (const clave of ["ESTADO DE MEXICO", "COAHUILA", "MICHOACAN", "VERACRUZ", "CIUDAD DE MEXICO", "SAN LUIS POTOSI"]) {
      expect(claveEstadoSnake(clave)).toBe(anterior(clave));
    }
    expect(claveEstadoSnake("ESTADO DE MEXICO")).toBe("estado_de_mexico");
  });
});

describe("listas de la UI derivadas del catálogo (mismo contenido y orden que las escritas a mano)", () => {
  it("TerritorySelector: ESTADOS_MEXICO (valores guardados en territorio.estado)", () => {
    expect([...NOMBRES_ESTADO_ORDENADOS]).toEqual(ESTADOS_MEXICO_ANTERIOR);
  });

  it("GeoNavegador: ENTIDADES (cve → nombre en MAYÚSCULAS con acentos)", () => {
    expect(ESTADOS.map((e) => e.nombre.toUpperCase())).toEqual(ENTIDADES_ANTERIOR);
    expect(ESTADOS.map((e) => e.cve)).toEqual(Array.from({ length: 32 }, (_, i) => String(i + 1).padStart(2, "0")));
  });

  it("OrigenCharts: ESTADOS_ORIGEN_KEYS y NOMBRES", () => {
    expect(ESTADOS_ALFABETICOS.map((e) => [claveEstadoSnake(e.clave), e.nombre])).toEqual(ORIGEN_KEYS_ANTERIOR);
    const nombres = Object.fromEntries(ESTADOS.map((e) => [claveEstadoSnake(e.clave), e.nombre]));
    expect(nombres).toEqual(Object.fromEntries(ORIGEN_KEYS_ANTERIOR));
  });
});

describe("Moddulo F2: abreviatura del estado por CVE", () => {
  const norm = (s: string) => s; // las llaves anteriores ya están normalizadas; se usan como ENTRADA (con "_")
  it("cada llave de la tabla anterior (incluidos alias) da la MISMA abreviatura", () => {
    for (const [llave, abrev] of Object.entries(ESTADOS_ABREV_ANTERIOR)) {
      expect(abreviaturaEstado(norm(llave)), llave).toBe(abrev);
    }
  });

  it("los nombres reales de los proyectos (selector) resuelven igual", () => {
    for (const [nombre, abrev] of [["Jalisco", "JAL."], ["Yucatán", "YUC."], ["Ciudad de México", "CDMX"], ["Estado de México", "EDOMEX."], ["Chihuahua", "CHIH."], ["Sinaloa", "SIN."], ["Morelos", "MOR."], ["Oaxaca", "OAX."]]) {
      expect(abreviaturaEstado(nombre)).toBe(abrev);
    }
  });

  it("alias que la tabla anterior NO resolvía (caían a slice(0,3)): 'Distrito Federal', 'Edo. Méx.'", () => {
    expect(abreviaturaEstado("Distrito Federal")).toBe("CDMX");
    expect(abreviaturaEstado("Edo. Méx.")).toBe("EDOMEX.");
    expect(ESTADOS_ABREV_ANTERIOR["distrito_federal"]).toBeUndefined();
  });

  it("un estado que no es mexicano (proyecto real de Colombia: 'Magdalena') → null, para que el llamador use su fallback", () => {
    expect(abreviaturaEstado("Magdalena")).toBeNull();
    expect(abreviaturaEstado(undefined)).toBeNull();
  });
});

describe("TerritorySelector: dedup de municipios tecleados por clave canónica", () => {
  // Lista REAL del proyecto O2RBnC (Jalisco, ZMG) y variantes que un usuario podría teclear después.
  const real = ["Tlaquepaque", "Tonalá", "Tlajomulco", "El Salto", "Juanacatlán", "Zapotlanejo", "Guadalajara", "Zapopan"];
  const anterior = (s: string) => s.trim().toLowerCase(); // el dedup previo
  const yaEsta = (lista: string[], nuevo: string, clave: (s: string) => string) => lista.some((m) => clave(m) === clave(nuevo));
  const claveNueva = (s: string) => claveMunicipioDeEstado("Jalisco", s);

  it("el mismo municipio con otro alias o con/sin acento ya NO se agrega dos veces (antes sí)", () => {
    for (const variante of ["San Pedro Tlaquepaque", "Tonala", "TONALÁ", "  zapopan "]) {
      expect(yaEsta(real, variante, anterior), `antes: ${variante}`).toBe(["TONALÁ", "  zapopan "].includes(variante)); // solo las que difieren en mayúsculas/espacios
      expect(yaEsta(real, variante, claveNueva), `ahora: ${variante}`).toBe(true);
    }
    // Ñ/Ü plegadas
    expect(claveNueva("Tlajomulco de Zúñiga")).toBe(claveNueva("Tlajomulco de Zuniga"));
  });

  it("municipios realmente distintos siguen siendo distintos", () => {
    for (const otro of ["Ixtlahuacán de los Membrillos", "Acatlán de Juárez", "Puerto Vallarta"]) {
      expect(yaEsta(real, otro, claveNueva), otro).toBe(false);
    }
  });

  it("sin CVE de estado (Colombia) solo pliega acentos y mayúsculas", () => {
    expect(claveMunicipioDeEstado("Magdalena", "Nueva Granada")).toBe(claveMunicipioDeEstado("Magdalena", "  NUEVA GRANADA "));
    expect(claveMunicipioDeEstado("Magdalena", "Nueva Granada")).not.toBe(claveMunicipioDeEstado("Magdalena", "Plato"));
  });
});

describe("territorioHeuristicas: el plegado compartido no cambia la detección", () => {
  it("acentos y mayúsculas en frases de nivel y en conjunción de estados", () => {
    expect(detectarSenalesTexto("Campaña por la SENADURÍA", "")?.nivel).toBe("nacional");
    expect(detectarSenalesTexto("Gubernatura", "de Nuevo León")?.nivel).toBe("estatal");
    expect(detectarSenalesTexto("Estrategia regional", "en Yucatán y Querétaro")).toMatchObject({ nivel: "estatal", esPlural: true });
    expect(detectarSenalesTexto("Campaña de comunicación", "movilidad interregional en la ZMG")?.nivel).toBe("municipal");
    expect(detectarSenalesTexto("Obra pública", "en un barrio")).toBeNull();
  });
});

// ── Vinculación Moddulo↔PESTEL/Fontana: checkTerritoryMatch por clave ─────────
const t = (x: Partial<Territorio> & { nivel: Territorio["nivel"] }): Territorio => ({ nombre: "", ...x });

describe("checkTerritoryMatch (linkCompatibility): compara por clave, no por cadena exacta", () => {
  // Territorios REALES (Firestore, 2026-09-20)
  const nZvpYu = t({ nivel: "distrito_local", estado: "Ciudad de México", municipio: "IZTAPALAPA", nombre: "Ciudad de México › IZTAPALAPA", cve_distrito: "027" });
  const sesion1qEjT = t({ nivel: "distrito_local", estado: "Ciudad de México", municipio: "Distrito Electoral Local 27 en la CDMX", nombre: "Ciudad de México › Distrito Electoral Local 27 en la CDMX" });

  it("falso negativo real: mismo distrito local 27 (estructurado vs texto) ya no es 'mismatch'", () => {
    expect(checkTerritoryMatch(nZvpYu, sesion1qEjT)).toBe("approximate"); // antes: "mismatch"
    expect(checkTerritoryMatch(sesion1qEjT, nZvpYu)).toBe("approximate"); // simétrico
  });

  it("distrito con otro número sigue siendo 'mismatch'", () => {
    const otro = { ...sesion1qEjT, municipio: "Distrito Electoral Local 12 en la CDMX" };
    expect(checkTerritoryMatch(nZvpYu, otro)).toBe("mismatch");
  });

  it("'exact' solo con cve_distrito en ambos lados (regla previa), y '27' == '027'", () => {
    expect(checkTerritoryMatch(nZvpYu, { ...nZvpYu, cve_distrito: "27" })).toBe("exact");
    expect(checkTerritoryMatch(nZvpYu, { ...nZvpYu, cve_distrito: "028" })).toBe("mismatch");
  });

  it("los proyectos legados de Puerto Vallarta (mismo texto, sin cve) siguen 'approximate', no 'exact'", () => {
    const pv = t({ nivel: "distrito_federal", estado: "Jalisco", municipio: "Distrito Electoral Federal V, con cabecera en Puerto Vallarta, Jalisco, México.", nombre: "Jalisco › Distrito Electoral Federal V, con cabecera en Puerto Vallarta, Jalisco, México." });
    expect(checkTerritoryMatch(pv, { ...pv })).toBe("approximate");
  });

  it("municipios realmente distintos (los 5 pares reales de Jalisco) siguen 'mismatch'", () => {
    const m = (municipio: string) => t({ nivel: "municipal", estado: "Jalisco", municipio, nombre: `Jalisco › ${municipio}` });
    for (const [a, b] of [["Guadalajara", "Tlaquepaque"], ["Guadalajara", "Zapopan"], ["Tlaquepaque", "Zapopan"]]) {
      expect(checkTerritoryMatch(m(a), m(b)), `${a}/${b}`).toBe("mismatch");
    }
  });

  it("el mismo municipio con alias/acentos ya no es 'mismatch'; el mismo estado con otro nombre tampoco", () => {
    const m = (municipio: string, estado = "Jalisco") => t({ nivel: "municipal", estado, municipio, nombre: municipio });
    expect(checkTerritoryMatch(m("Tlaquepaque"), m("San Pedro Tlaquepaque"))).toBe("approximate");
    expect(checkTerritoryMatch(m("Tonalá"), m("TONALA"))).toBe("approximate");
    expect(checkTerritoryMatch(t({ nivel: "estatal", estado: "México" }), t({ nivel: "estatal", estado: "Estado de México" }))).toBe("exact");
    expect(checkTerritoryMatch(t({ nivel: "estatal", estado: "Coahuila de Zaragoza" }), t({ nivel: "estatal", estado: "Coahuila" }))).toBe("exact");
  });

  it("estados distintos, niveles distintos y países distintos siguen 'mismatch'; sin territorio 'approximate'", () => {
    expect(checkTerritoryMatch(t({ nivel: "estatal", estado: "Jalisco" }), t({ nivel: "estatal", estado: "Colima" }))).toBe("mismatch");
    expect(checkTerritoryMatch(t({ nivel: "estatal", estado: "Jalisco" }), t({ nivel: "municipal", estado: "Jalisco" }))).toBe("mismatch");
    expect(checkTerritoryMatch(t({ nivel: "nacional", pais: "México" }), t({ nivel: "nacional", pais: "Colombia" }))).toBe("mismatch");
    expect(checkTerritoryMatch(t({ nivel: "nacional", pais: "México" }), t({ nivel: "nacional", pais: "Mexico" }))).toBe("exact");
    expect(checkTerritoryMatch(null, t({ nivel: "nacional" }))).toBe("approximate");
  });

  it("estado no mexicano (Colombia): se compara por texto sin acentos/mayúsculas", () => {
    expect(checkTerritoryMatch(t({ nivel: "estatal", estado: "Magdalena" }), t({ nivel: "estatal", estado: "MAGDALENA" }))).toBe("exact");
    expect(checkTerritoryMatch(t({ nivel: "estatal", estado: "Magdalena" }), t({ nivel: "estatal", estado: "Atlántico" }))).toBe("mismatch");
  });
});
