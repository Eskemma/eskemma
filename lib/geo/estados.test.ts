// lib/geo/estados.test.ts
// Resolución única de estado (lib/geo/estados.ts): integridad del catálogo,
// compatibilidad con lo que ya resolvían Sefix/Fontana, decisiones de producto
// (México → Estado de México) y el centinela de "Nacional".

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ESTADO_CVE_POR_CLAVE,
  ESTADOS,
  ESTADO_NACIONAL_CLAVE,
  claveAlmacenamiento,
  esAlcanceNacional,
  nombreEstadoDisplay,
  resolverEstado,
  resolverEstadoCve,
} from "./estados";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "./municipioCanonico";
import { getCveEntidad as getCveEntidadCF } from "../../functions/src/utils/estadoCveMap";

// El literal que vivía en lib/sefix/eleccionesConstants.ts ANTES de derivarlo del catálogo.
const ESTADO_CVE_MAP_ANTERIOR: Record<string, string> = {
  "AGUASCALIENTES": "01", "BAJA CALIFORNIA": "02", "BAJA CALIFORNIA SUR": "03", "CAMPECHE": "04",
  "COAHUILA": "05", "COLIMA": "06", "CHIAPAS": "07", "CHIHUAHUA": "08", "CIUDAD DE MEXICO": "09",
  "DURANGO": "10", "GUANAJUATO": "11", "GUERRERO": "12", "HIDALGO": "13", "JALISCO": "14",
  "ESTADO DE MEXICO": "15", "MICHOACAN": "16", "MORELOS": "17", "NAYARIT": "18", "NUEVO LEON": "19",
  "OAXACA": "20", "PUEBLA": "21", "QUERETARO": "22", "QUINTANA ROO": "23", "SAN LUIS POTOSI": "24",
  "SINALOA": "25", "SONORA": "26", "TABASCO": "27", "TAMAULIPAS": "28", "TLAXCALA": "29",
  "VERACRUZ": "30", "YUCATAN": "31", "ZACATECAS": "32",
};

// El algoritmo de toStorageKey ANTERIOR (exigía mayúsculas), como oráculo de regresión.
const toStorageKeyAnterior = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");

describe("catálogo de estados", () => {
  it("ESTADO_CVE_MAP (derivado del catálogo) es idéntico al literal anterior — 32 estados, mismas llaves y CVE", () => {
    expect(ESTADO_CVE_MAP).toEqual(ESTADO_CVE_MAP_ANTERIOR);
    expect(ESTADO_CVE_POR_CLAVE).toEqual(ESTADO_CVE_MAP_ANTERIOR);
    expect(ESTADOS).toHaveLength(32);
  });

  it("la clave interna es MAYÚSCULAS sin acentos y coincide con normalizeGeoName de su nombre a mostrar", () => {
    for (const e of ESTADOS) {
      expect(e.clave).toBe(e.clave.toUpperCase());
      expect(e.clave).not.toMatch(/[ÁÉÍÓÚ]/);
      // El display corto "Estado de México" ↔ clave "ESTADO DE MEXICO": display→clave siempre resuelve.
      expect(normalizeGeoName(e.nombre)).toBe(e.clave);
    }
  });

  it("nombre a mostrar: corto y con acentos ('Michoacán', 'Veracruz', 'Estado de México')", () => {
    expect(nombreEstadoDisplay("16")).toBe("Michoacán");
    expect(nombreEstadoDisplay("30")).toBe("Veracruz");
    expect(nombreEstadoDisplay("15")).toBe("Estado de México");
    expect(nombreEstadoDisplay("09")).toBe("Ciudad de México");
    expect(nombreEstadoDisplay("99")).toBeNull();
  });
});

describe("resolverEstado", () => {
  it("todas las claves del catálogo resuelven a su CVE, con cualquier capitalización y acentos", () => {
    for (const e of ESTADOS) {
      expect(resolverEstadoCve(e.clave)).toBe(e.cve);
      expect(resolverEstadoCve(e.nombre)).toBe(e.cve);
      expect(resolverEstadoCve(e.nombre.toLowerCase())).toBe(e.cve);
    }
  });

  it("DECISIÓN: 'México' es el Estado de México (CVE 15), igual que la copia de Cloud Functions", () => {
    expect(resolverEstado("México")).toMatchObject({ esNacional: false, cve: "15", clave: "ESTADO DE MEXICO", nombre: "Estado de México" });
    expect(resolverEstado("MEXICO")?.cve).toBe("15");
    expect(getCveEntidadCF("México")).toBe("15");
  });

  it("nombres oficiales largos, alias y variantes con espacios", () => {
    expect(resolverEstadoCve("Coahuila de Zaragoza")).toBe("05");
    expect(resolverEstadoCve("Michoacán de Ocampo")).toBe("16");
    expect(resolverEstadoCve("Veracruz de Ignacio de la Llave")).toBe("30");
    expect(resolverEstadoCve("CDMX")).toBe("09");
    expect(resolverEstadoCve("D.F.")).toBe("09");
    expect(resolverEstadoCve("Distrito Federal")).toBe("09");
    expect(resolverEstadoCve("edomex")).toBe("15");
    expect(resolverEstadoCve("nuevo_leon")).toBe("19");
    expect(resolverEstadoCve("  jalisco  ")).toBe("14");
    expect(resolverEstadoCve("Quintana   Roo")).toBe("23");
  });

  it("no adivina: lo desconocido y lo vacío son null", () => {
    expect(resolverEstado("Narnia")).toBeNull();
    expect(resolverEstado("")).toBeNull();
    expect(resolverEstado("   ")).toBeNull();
    expect(resolverEstado(undefined)).toBeNull();
    expect(resolverEstado(null)).toBeNull();
  });

  it("el país no se confunde con un estado inventado: 'Estados Unidos Mexicanos' no resuelve", () => {
    expect(resolverEstado("Estados Unidos Mexicanos")).toBeNull();
  });
});

describe("compatibilidad con el ESTADO_MAP anterior de Sefix (resolveEstadoName)", () => {
  // Las 37 claves que aceptaba (snake_case + alias) → lo que devolvían. Todas deben seguir igual.
  const ANTERIOR: Record<string, string> = {
    aguascalientes: "AGUASCALIENTES", baja_california: "BAJA CALIFORNIA", baja_california_sur: "BAJA CALIFORNIA SUR",
    campeche: "CAMPECHE", chiapas: "CHIAPAS", chihuahua: "CHIHUAHUA", coahuila: "COAHUILA", colima: "COLIMA",
    cdmx: "CIUDAD DE MEXICO", ciudad_de_mexico: "CIUDAD DE MEXICO", df: "CIUDAD DE MEXICO", durango: "DURANGO",
    estado_de_mexico: "ESTADO DE MEXICO", edomex: "ESTADO DE MEXICO", guanajuato: "GUANAJUATO", guerrero: "GUERRERO",
    hidalgo: "HIDALGO", jalisco: "JALISCO", michoacan: "MICHOACAN", morelos: "MORELOS", nayarit: "NAYARIT",
    nuevo_leon: "NUEVO LEON", oaxaca: "OAXACA", puebla: "PUEBLA", queretaro: "QUERETARO", quintana_roo: "QUINTANA ROO",
    san_luis_potosi: "SAN LUIS POTOSI", sinaloa: "SINALOA", sonora: "SONORA", tabasco: "TABASCO",
    tamaulipas: "TAMAULIPAS", tlaxcala: "TLAXCALA", veracruz: "VERACRUZ", yucatan: "YUCATAN", zacatecas: "ZACATECAS",
  };
  it.each(Object.entries(ANTERIOR))("'%s' → %s", (entrada, clave) => {
    expect(resolverEstado(entrada)?.clave).toBe(clave);
  });
});

describe("centinela 'Nacional'", () => {
  it("'Nacional' (cualquier capitalización/acento) → unión discriminada esNacional, sin CVE", () => {
    for (const x of ["Nacional", "NACIONAL", "nacional", " Nacional "]) {
      expect(resolverEstado(x)).toEqual({ esNacional: true, cve: null, clave: ESTADO_NACIONAL_CLAVE, nombre: "Nacional" });
      expect(esAlcanceNacional(x)).toBe(true);
    }
  });

  it("resolverEstadoCve('Nacional') es null: 'Nacional' no es un estado (mismo comportamiento que las 15 copias anteriores)", () => {
    expect(resolverEstadoCve("Nacional")).toBeNull();
  });

  it("vacío/undefined NO es nacional en el helper compartido (cada módulo decide en su borde)", () => {
    expect(esAlcanceNacional("")).toBe(false);
    expect(esAlcanceNacional(undefined)).toBe(false);
    expect(esAlcanceNacional(null)).toBe(false);
  });

  it("el país 'México' NO es alcance nacional — es el Estado de México", () => {
    expect(esAlcanceNacional("México")).toBe(false);
    expect(resolverEstado("México")?.esNacional).toBe(false);
  });

  it("'Nacional' no se confunde con el ámbito de Sefix 'extranjero'", () => {
    expect(esAlcanceNacional("Extranjero")).toBe(false);
    expect(resolverEstado("Extranjero")).toBeNull();
  });
});

describe("claveAlmacenamiento", () => {
  it("para TODA entrada que el algoritmo anterior aceptaba (mayúsculas) da el MISMO resultado — 32 claves + nombres largos", () => {
    const entradas = [
      ...ESTADOS.map((e) => e.clave),
      "COAHUILA DE ZARAGOZA", "MICHOACAN DE OCAMPO", "VERACRUZ DE IGNACIO DE LA LLAVE", "MEXICO",
    ];
    for (const e of entradas) expect(claveAlmacenamiento(e)).toBe(toStorageKeyAnterior(e));
  });

  it("acepta mayúsculas/minúsculas mezcladas y espacios de más", () => {
    expect(claveAlmacenamiento("Jalisco")).toBe("JALISCO");
    expect(claveAlmacenamiento("Nuevo León")).toBe("NUEVO_LEON");
    expect(claveAlmacenamiento("  San   Luis Potosí ")).toBe("SAN_LUIS_POTOSI");
  });

  it("conserva Ñ y Ü (patrón de clave interna) y el centinela del extranjero", () => {
    expect(claveAlmacenamiento("Cañadas")).toBe("CAÑADAS");
    expect(claveAlmacenamiento("Güémez")).toBe("GÜEMEZ");
    expect(claveAlmacenamiento("__EXTRANJERO__")).toBe("__EXTRANJERO__");
  });
});

describe("paridad con la copia de Cloud Functions (functions/src/utils/estadoCveMap.ts)", () => {
  // La copia de CF no puede importar de lib/. Se VERIFICA cuánto coincide; el guard
  // de sincronización formal queda para otra ronda. Estas son las divergencias
  // CONOCIDAS de hoy: si alguien las corrige (o aparece una nueva) este test lo dice.
  it("coincide en los 32 estados y en 'México'", () => {
    for (const e of ESTADOS) expect(getCveEntidadCF(e.nombre)).toBe(e.cve);
    expect(getCveEntidadCF("México")).toBe("15");
  });

  it("divergencias conocidas: CDMX/DF, nombres oficiales largos, espacios de más y guion bajo", () => {
    const divergencias = ["CDMX", "Distrito Federal", "Coahuila de Zaragoza", "Michoacán de Ocampo", "Veracruz de Ignacio de la Llave", "  jalisco  ", "nuevo_leon"]
      .filter((x) => getCveEntidadCF(x) !== resolverEstadoCve(x));
    expect(divergencias).toEqual([
      "CDMX", "Distrito Federal", "Coahuila de Zaragoza", "Michoacán de Ocampo",
      "Veracruz de Ignacio de la Llave", "  jalisco  ", "nuevo_leon",
    ]);
  });
});

describe("ratchet de resoluciones inline pendientes", () => {
  // Además de las 15 copias con nombre, el mismo cuerpo aparece INLINE
  // (`ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)]`) en adaptadores de
  // Fontana, tabla y rutas API. No estaban en el alcance de esta ronda y siguen
  // resolviendo el estado con la regla anterior (sin alias de "México", nombres
  // largos ni "CDMX"). Este ratchet impide que APAREZCAN NUEVAS mientras se
  // migran: al bajar el número, actualízalo; nunca debe subir.
  const PENDIENTES_INLINE = 32;

  it("no aumenta el número de resoluciones inline de estado (deuda registrada, ver CLAUDE.md)", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const cuenta = (dir: string): number =>
      fs.readdirSync(dir, { withFileTypes: true }).reduce((n, d) => {
        const ruta = join(dir, d.name);
        if (d.isDirectory()) return d.name === "node_modules" || d.name.startsWith(".") ? n : n + cuenta(ruta);
        if (!/\.(ts|tsx)$/.test(d.name) || /\.test\./.test(d.name)) return n;
        return n + (readFileSync(ruta, "utf8").match(/ESTADO_CVE_MAP\[normalizeGeoName\(/g)?.length ?? 0);
      }, 0);
    const total = cuenta(join(process.cwd(), "lib")) + cuenta(join(process.cwd(), "app"));
    expect(total).toBeLessThanOrEqual(PENDIENTES_INLINE);
  });
});
