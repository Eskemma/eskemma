// lib/geo/estadoCveMapCF.test.ts
// GUARD BLOQUEANTE de la copia de Cloud Functions (functions/src/utils/estadoCveMap.ts).
// functions/ no puede importar de lib/, así que su resolución de estado → CVE es una
// copia; ahora se GENERA desde lib/geo/estados.ts (`npm run sync-geo-cf`) y este test
// falla —y por tanto bloquea el pre-push, cuyo primer paso es `npm run test`— si:
//   · el archivo commiteado difiere de lo que genera la fuente, o
//   · la copia responde distinto que `resolverEstadoCve` para alguna entrada de la batería.
// Es determinista, local y de milisegundos (sin red ni fechas): no tiene falsos positivos.
//
// Antes de generarla, la copia divergía en CDMX, "Distrito Federal", nombres oficiales
// largos, espacios de más y "nuevo_leon" (y lanzaba TypeError con entradas no-string).
// El fixture de abajo es esa lógica anterior, verbatim: prueba que el guard SÍ detecta
// divergencias reales, no solo que pasa cuando todo coincide.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCveEntidad as getCveEntidadCF } from "../../functions/src/utils/estadoCveMap";
import { buscarDivergenciasCF, generarEstadoCveMapCF, lineasDemasiadoLargas, RUTA_COPIA_CF } from "../../scripts/lib/geoCfSync";

// ── Lógica ANTERIOR de la copia de CF (verbatim, hasta 2026-09-20) ─────────────
const ESTADO_CVE_MAP_ANTERIOR: Record<string, string> = {
  "AGUASCALIENTES": "01", "BAJA CALIFORNIA": "02", "BAJA CALIFORNIA SUR": "03", "CAMPECHE": "04",
  "CHIAPAS": "07", "CHIHUAHUA": "08", "COAHUILA": "05", "COLIMA": "06", "CIUDAD DE MEXICO": "09",
  "DURANGO": "10", "GUANAJUATO": "11", "GUERRERO": "12", "HIDALGO": "13", "JALISCO": "14",
  "MEXICO": "15", "ESTADO DE MEXICO": "15", "MICHOACAN": "16", "MORELOS": "17", "NAYARIT": "18",
  "NUEVO LEON": "19", "OAXACA": "20", "PUEBLA": "21", "QUERETARO": "22", "QUINTANA ROO": "23",
  "SAN LUIS POTOSI": "24", "SINALOA": "25", "SONORA": "26", "TABASCO": "27", "TAMAULIPAS": "28",
  "TLAXCALA": "29", "VERACRUZ": "30", "YUCATAN": "31", "ZACATECAS": "32",
};
const getCveEntidadAnterior = (estadoNombre: string): string | null => {
  const normalized = estadoNombre.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return ESTADO_CVE_MAP_ANTERIOR[normalized] ?? null;
};

describe("copia de Cloud Functions de estado → CVE: sincronizada con lib/geo/estados.ts", () => {
  it("el archivo commiteado es EXACTAMENTE lo que genera la fuente (si falla: npm run sync-geo-cf)", () => {
    const actual = readFileSync(join(process.cwd(), RUTA_COPIA_CF), "utf8");
    expect(actual).toBe(generarEstadoCveMapCF());
  });

  it("el archivo generado respeta las 80 columnas del lint de functions", () => {
    expect(lineasDemasiadoLargas(generarEstadoCveMapCF())).toEqual([]);
  });

  it("batería de paridad: 0 entradas donde la copia responde distinto que resolverEstadoCve", () => {
    expect(buscarDivergenciasCF(getCveEntidadCF)).toEqual([]);
  });

  it("los casos que antes divergían ya resuelven igual que la fuente", () => {
    expect(getCveEntidadCF("CDMX")).toBe("09");
    expect(getCveEntidadCF("Distrito Federal")).toBe("09");
    expect(getCveEntidadCF("Coahuila de Zaragoza")).toBe("05");
    expect(getCveEntidadCF("Michoacán de Ocampo")).toBe("16");
    expect(getCveEntidadCF("Veracruz de Ignacio de la Llave")).toBe("30");
    expect(getCveEntidadCF("  jalisco  ")).toBe("14");
    expect(getCveEntidadCF("nuevo_leon")).toBe("19");
    expect(getCveEntidadCF("México")).toBe("15");
    expect(getCveEntidadCF("Nacional")).toBeNull();
    expect(getCveEntidadCF(undefined as unknown as string)).toBeNull();
  });
});

describe("el guard DETECTA divergencias (no solo pasa cuando todo coincide)", () => {
  it("la lógica anterior de la copia diverge exactamente en las 7 divergencias conocidas (y en las variantes de formato)", () => {
    const entradasQueDivergen = new Set(
      buscarDivergenciasCF(getCveEntidadAnterior).map((d) => String(d.entrada))
    );
    for (const conocida of ["CDMX", "Distrito Federal", "Coahuila de Zaragoza", "Michoacán de Ocampo", "Veracruz de Ignacio de la Llave", "  Jalisco  ", "nuevo_leon"]) {
      expect(entradasQueDivergen.has(conocida), conocida).toBe(true);
    }
    // y la batería también atrapa que la lógica anterior lanzaba con entradas no-string
    const noString = buscarDivergenciasCF(getCveEntidadAnterior).find((d) => d.entrada === null);
    expect(noString?.copiaCF).toBe("<lanza TypeError>");
  });

  it("una divergencia sintética inyectada (alias faltante o CVE equivocado) se detecta", () => {
    const sinAliasDF = (s: string) => (typeof s === "string" && s.trim().toUpperCase() === "CDMX" ? null : getCveEntidadCF(s));
    expect(buscarDivergenciasCF(sinAliasDF).map((d) => d.entrada)).toContain("CDMX");
    const cveEquivocado = (s: string) => (getCveEntidadCF(s) === "14" ? "15" : getCveEntidadCF(s));
    expect(buscarDivergenciasCF(cveEquivocado).length).toBeGreaterThan(0);
  });

  it("un archivo de CF editado a mano (diferente del generado) no pasaría la comparación de bytes", () => {
    const generado = generarEstadoCveMapCF();
    expect(generado.replace('"CDMX": "09"', '"CDMX": "10"')).not.toBe(generado);
    expect(generado).toContain('"CDMX": "09"');
  });
});
