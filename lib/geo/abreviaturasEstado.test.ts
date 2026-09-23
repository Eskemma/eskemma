// lib/geo/abreviaturasEstado.test.ts
// Guard for the unified state abbreviations (26-09-23). Three forms from one
// table; display only; MEX/COL reserved for countries; data keys untouched.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ESTADOS, claveEstadoSnake, nombreEstadoDisplay } from "@/lib/geo/estados";
import {
  CODIGO_ESTADO_POR_CVE,
  CODIGO_ESTADO_POR_SNAKE,
  abreviaturaConPunto,
  codigoEstado,
  nombreEstadoProsa,
} from "@/lib/geo/abreviaturasEstado";
import { abreviaturaEstado } from "@/lib/moddulo/abreviaturaEstado";
import { ESTADOS_PROSA_POR_SNAKE } from "@/lib/sefix/semanalUtils";
import { PAIS_ISO3_POR_NOMBRE } from "@/lib/fontana/familia4Catalogo";

// The 32 compact codes, fixed by Raúl 26-09-23 (COLI for Colima, EDOMEX for Estado de México).
const TABLA_DEFINITIVA: [string, string][] = [
  ["01", "AGS"], ["02", "BC"], ["03", "BCS"], ["04", "CAMP"], ["05", "COAH"], ["06", "COLI"],
  ["07", "CHIS"], ["08", "CHIH"], ["09", "CDMX"], ["10", "DGO"], ["11", "GTO"], ["12", "GRO"],
  ["13", "HGO"], ["14", "JAL"], ["15", "EDOMEX"], ["16", "MICH"], ["17", "MOR"], ["18", "NAY"],
  ["19", "NL"], ["20", "OAX"], ["21", "PUE"], ["22", "QRO"], ["23", "QROO"], ["24", "SLP"],
  ["25", "SIN"], ["26", "SON"], ["27", "TAB"], ["28", "TAMPS"], ["29", "TLAX"], ["30", "VER"],
  ["31", "YUC"], ["32", "ZAC"],
];

// Verbatim from OrigenCharts.tsx before the migration: the key order of `ABREV`, from which
// RECEPTOR_ORDER = Object.keys(ABREV) and ORIGIN_SUFFIXES = [...RECEPTOR_ORDER, "87", "88"].
const RECEPTOR_ORDER_ANTERIOR = [
  "aguascalientes", "baja_california", "baja_california_sur", "campeche", "chiapas", "chihuahua",
  "ciudad_de_mexico", "coahuila", "colima", "durango", "estado_de_mexico", "guanajuato",
  "guerrero", "hidalgo", "jalisco", "michoacan", "morelos", "nayarit", "nuevo_leon", "oaxaca",
  "puebla", "queretaro", "quintana_roo", "san_luis_potosi", "sinaloa", "sonora", "tabasco",
  "tamaulipas", "tlaxcala", "veracruz", "yucatan", "zacatecas",
];

// Verbatim from semanalUtils.ts before the migration: ESTADOS_ABBR (key → label).
const ESTADOS_ABBR_ANTERIOR: Record<string, string> = {
  aguascalientes: "Aguascalientes", baja_california: "Baja California",
  baja_california_sur: "B.C.S.", campeche: "Campeche", chiapas: "Chiapas",
  chihuahua: "Chihuahua", ciudad_de_mexico: "CDMX", coahuila: "Coahuila",
  colima: "Colima", durango: "Durango", estado_de_mexico: "Edo. México",
  guanajuato: "Guanajuato", guerrero: "Guerrero", hidalgo: "Hidalgo",
  jalisco: "Jalisco", michoacan: "Michoacán", morelos: "Morelos",
  nayarit: "Nayarit", nuevo_leon: "Nuevo León", oaxaca: "Oaxaca",
  puebla: "Puebla", queretaro: "Querétaro", quintana_roo: "Q. Roo",
  san_luis_potosi: "S.L.P.", sinaloa: "Sinaloa", sonora: "Sonora",
  tabasco: "Tabasco", tamaulipas: "Tamaulipas", tlaxcala: "Tlaxcala",
  veracruz: "Veracruz", yucatan: "Yucatán", zacatecas: "Zacatecas",
};

describe("tabla de códigos compactos", () => {
  it("coincide con la tabla definitiva de 32 (fijada por Raúl, 26-09-23)", () => {
    // Compare by lookup, not Object.entries order: JS orders integer-like keys ("10".."32")
    // before "01".."09", so entry order of this record is not the CVE order.
    expect(TABLA_DEFINITIVA.map(([cve]) => [cve, CODIGO_ESTADO_POR_CVE[cve]])).toEqual(TABLA_DEFINITIVA);
    expect(Object.keys(CODIGO_ESTADO_POR_CVE)).toHaveLength(TABLA_DEFINITIVA.length);
  });

  it("cubre exactamente los 32 CVE del catálogo", () => {
    expect(Object.keys(CODIGO_ESTADO_POR_CVE).sort()).toEqual(ESTADOS.map((e) => e.cve));
  });

  it("códigos únicos, MAYÚSCULAS sin puntuación ni acentos, de 2 a 6 letras", () => {
    const codigos = Object.values(CODIGO_ESTADO_POR_CVE);
    expect(new Set(codigos).size).toBe(32);
    for (const c of codigos) expect(c, c).toMatch(/^[A-Z]{2,6}$/);
  });

  it("MEX está reservado para el país: ningún estado lo usa (el Estado de México es EDOMEX)", () => {
    expect(Object.values(CODIGO_ESTADO_POR_CVE)).not.toContain("MEX");
    expect(codigoEstado("15")).toBe("EDOMEX");
  });

  it("ningún código coincide con un ISO3 de país conocido por el sistema (Fontana F4)", () => {
    const iso3 = new Set(Object.values(PAIS_ISO3_POR_NOMBRE));
    expect(iso3.has("MEX") && iso3.has("COL")).toBe(true); // el test no es vacuo
    for (const [cve, codigo] of Object.entries(CODIGO_ESTADO_POR_CVE)) {
      expect(iso3.has(codigo), `${cve} ${codigo}`).toBe(false);
    }
    expect(codigoEstado("06")).toBe("COLI"); // Colima ≠ Colombia
  });
});

describe("las tres formas salen de la misma tabla", () => {
  it("forma con punto = código + '.', salvo CDMX (sin punto)", () => {
    for (const [cve, codigo] of TABLA_DEFINITIVA) {
      expect(abreviaturaConPunto(cve)).toBe(cve === "09" ? "CDMX" : `${codigo}.`);
    }
  });

  it("nombre completo = catálogo; la prosa lo usa para todos salvo CDMX", () => {
    for (const e of ESTADOS) {
      expect(nombreEstadoProsa(e.cve)).toBe(e.cve === "09" ? "CDMX" : nombreEstadoDisplay(e.cve));
    }
  });

  it("CVE desconocido → null", () => {
    expect(codigoEstado("99")).toBeNull();
    expect(abreviaturaConPunto(undefined)).toBeNull();
  });

  it("Moddulo: los 3 cambios visibles y los que no cambian", () => {
    expect(abreviaturaEstado("Colima")).toBe("COLI.");
    expect(abreviaturaEstado("Tamaulipas")).toBe("TAMPS.");
    expect(abreviaturaEstado("Quintana Roo")).toBe("QROO.");
    expect(abreviaturaEstado("Estado de México")).toBe("EDOMEX.");
    expect(abreviaturaEstado("Ciudad de México")).toBe("CDMX");
  });
});

describe("las llaves y el orden de datos NO cambian (solo los valores de display)", () => {
  it("OrigenCharts: RECEPTOR_ORDER (Object.keys de ABREV) idéntico al anterior, verbatim", () => {
    expect(Object.keys(CODIGO_ESTADO_POR_SNAKE)).toEqual(RECEPTOR_ORDER_ANTERIOR);
  });

  it("OrigenCharts: ORIGIN_SUFFIXES = [...RECEPTOR_ORDER, '87', '88'] sigue derivándose de las llaves", () => {
    const src = readFileSync("app/sefix/components/lne/charts/OrigenCharts.tsx", "utf8");
    expect(src).toContain("const RECEPTOR_ORDER = Object.keys(ABREV);");
    expect(src).toContain('const ORIGIN_SUFFIXES = [...RECEPTOR_ORDER, "87", "88"];');
    expect(src).toContain("const ABREV: Record<string, string> = CODIGO_ESTADO_POR_SNAKE;");
  });

  it("OrigenCharts: cada llave sigue siendo la llave snake del estado (la de las columnas ln_<estado>)", () => {
    for (const e of ESTADOS) {
      expect(CODIGO_ESTADO_POR_SNAKE[claveEstadoSnake(e.clave)]).toBe(CODIGO_ESTADO_POR_CVE[e.cve]);
    }
  });

  it("semanalUtils: la iteración conserva llaves y orden idénticos al ESTADOS_ABBR anterior", () => {
    expect(Object.keys(ESTADOS_PROSA_POR_SNAKE)).toEqual(Object.keys(ESTADOS_ABBR_ANTERIOR));
  });

  it("semanalUtils: solo cambian los 4 valores de prosa esperados (nombres completos), CDMX se conserva", () => {
    const cambios = Object.entries(ESTADOS_PROSA_POR_SNAKE)
      .filter(([k, v]) => v !== ESTADOS_ABBR_ANTERIOR[k])
      .map(([k, v]) => [k, ESTADOS_ABBR_ANTERIOR[k], v]);
    expect(cambios).toEqual([
      ["baja_california_sur", "B.C.S.", "Baja California Sur"],
      ["estado_de_mexico", "Edo. México", "Estado de México"],
      ["quintana_roo", "Q. Roo", "Quintana Roo"],
      ["san_luis_potosi", "S.L.P.", "San Luis Potosí"],
    ]);
    expect(ESTADOS_PROSA_POR_SNAKE.ciudad_de_mexico).toBe("CDMX");
  });
});

describe("ratchet: las tablas y literales viejos no reaparecen", () => {
  it("ni ESTADOS_ABBR ni los literales 'TAMS.', 'Q.ROO.', 'Edo. México' en código de producción", () => {
    for (const f of [
      "lib/sefix/semanalUtils.ts",
      "lib/moddulo/abreviaturaEstado.ts",
      "app/sefix/components/lne/charts/OrigenCharts.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/ESTADOS_ABBR\b/);
      expect(src, f).not.toContain('"TAMS."');
      expect(src, f).not.toContain('"Q.ROO."');
      expect(src, f).not.toContain('"Edo. México"');
      expect(src, f).not.toMatch(/estado_de_mexico:\s*"MEX"/);
    }
  });
});
