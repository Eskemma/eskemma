// lib/geo/normalizacionGeografica.test.ts
// Los 4 fallos REALES confirmados en el diagnóstico de normalización geográfica
// (26-09-18/19) — escritos ANTES del fix y verificados contra el código de
// entonces (los 4 fallaban). Cada bloque asserta el comportamiento CORRECTO.
// Los datos de los fixtures son reales: opciones de distritos de Sefix
// (Jalisco, dip 2024) y nombres DERFE del padrón semanal.

import { Readable } from "node:stream";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Doble de Storage para getPadronByGeo (CSV semanal del padrón) ───────────
const CSV_SEMANAL = [
  "nombre_entidad,nombre_municipio,cve_distrito,padron_hombres,padron_mujeres,padron_no_binario,padron_electoral,lista_hombres,lista_mujeres,lista_no_binario,lista_nominal",
  "JALISCO,SAN PEDRO TLAQUEPAQUE,08,260000,274762,0,534762,250000,265000,0,515000",
  "JALISCO,ZAPOPAN,10,600000,650000,0,1250000,580000,630000,0,1210000",
  "JALISCO,TLAJOMULCO DE ZUÑIGA,14,230000,254618,0,484618,225000,250000,0,475000",
  "NUEVO LEON,GRAL. ESCOBEDO,05,170000,189463,0,359463,165000,185000,0,350000",
  "NUEVO LEON,MONTERREY,06,500000,560000,0,1060000,490000,550000,0,1040000",
  // DERFE llama "MEXICO" al Estado de México y usa nombre constitucional largo en 3 estados.
  "MEXICO,ECATEPEC DE MORELOS,01,400000,430000,0,830000,390000,420000,0,810000",
  "MEXICO,TOLUCA,02,300000,320000,0,620000,290000,310000,0,600000",
  "COAHUILA DE ZARAGOZA,SALTILLO,03,350000,370000,0,720000,340000,360000,0,700000",
].join("\n");

vi.mock("@/lib/firebase-admin", () => ({ adminApp: {} }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      getFiles: async () => [[{ name: "sefix/pdln/semanal/20260914_sexo.csv" }]],
      file: () => ({ createReadStream: () => Readable.from([CSV_SEMANAL]) }),
    }),
  }),
}));

import { getPadronByEstado, getPadronByGeo, resolveEstadoName, toStorageKey } from "@/lib/sefix/storage";
import { matchDistrito } from "@/lib/sefix/districtMatching";
import { getCveEntidad } from "@/lib/geo/estadoCve";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";

beforeEach(() => vi.clearAllMocks());

// ── 1. matchDistrito con acentos ────────────────────────────────────────────
describe("fallo 1 — matchDistrito tolera acentos (Strategy 3, cabecera)", () => {
  // Opciones reales de Sefix (Jalisco, dip 2024): MAYÚSCULAS sin acento, Ñ conservada.
  const opciones = [
    { cve: "04", nombre: "1404 ZAPOPAN" },
    { cve: "05", nombre: "1405 PUERTO VALLARTA" },
    { cve: "07", nombre: "1407 TONALA" },
    { cve: "10", nombre: "1410 ZAPOPAN" },
    { cve: "14", nombre: "1414 TLAJOMULCO DE ZUÑIGA" },
    { cve: "20", nombre: "1420 TONALA" },
  ];
  const territorio = (ciudad: string) => ({
    nombre: `Jalisco › Distrito Electoral Federal, con cabecera en ${ciudad}, Jalisco, México.`,
  });

  it("'Tlajomulco de Zúñiga' (con acentos) resuelve al mismo distrito que 'Tlajomulco de Zuñiga'", () => {
    expect(matchDistrito(opciones, territorio("Tlajomulco de Zuñiga"))).toBe("1414 TLAJOMULCO DE ZUÑIGA");
    expect(matchDistrito(opciones, territorio("Tlajomulco de Zúñiga"))).toBe("1414 TLAJOMULCO DE ZUÑIGA");
  });

  it("'Tonalá' (con acento) resuelve igual que 'Tonala' — no null", () => {
    const sinAcento = matchDistrito(opciones, territorio("Tonala"));
    expect(sinAcento).not.toBeNull();
    expect(matchDistrito(opciones, territorio("Tonalá"))).toBe(sinAcento);
  });

  it("mayúsculas y minúsculas no importan; el nombre canónico sin acento sigue funcionando", () => {
    expect(matchDistrito(opciones, territorio("PUERTO VALLARTA"))).toBe("1405 PUERTO VALLARTA");
    expect(matchDistrito(opciones, territorio("puerto vallarta"))).toBe("1405 PUERTO VALLARTA");
  });
});

// ── 2. getPadronByGeo: municipio por nombre común ───────────────────────────
describe("fallo 2 — getPadronByGeo resuelve el municipio con el canónico (alias)", () => {
  it("'Tlaquepaque' → padrón MUNICIPAL de San Pedro Tlaquepaque, no el estatal", async () => {
    const r = await getPadronByGeo("Jalisco", { municipioNombre: "Tlaquepaque" });
    expect(r?.granularidadReal).toBe("municipal");
    expect(r?.padronElectoral).toBe(534762);
  });

  it("'General Escobedo' → 'GRAL. ESCOBEDO' (Nuevo León), municipal", async () => {
    const r = await getPadronByGeo("Nuevo Leon", { municipioNombre: "General Escobedo" });
    expect(r?.granularidadReal).toBe("municipal");
    expect(r?.padronElectoral).toBe(359463);
  });

  it("control: el nombre oficial y la variante con/sin acento siguen dando el mismo municipal", async () => {
    const oficial = await getPadronByGeo("Jalisco", { municipioNombre: "San Pedro Tlaquepaque" });
    expect(oficial?.padronElectoral).toBe(534762);
    const conAcento = await getPadronByGeo("Jalisco", { municipioNombre: "Tlajomulco de Zúñiga" });
    const sinAcento = await getPadronByGeo("Jalisco", { municipioNombre: "Tlajomulco de Zuñiga" });
    expect(conAcento?.granularidadReal).toBe("municipal");
    expect(conAcento?.padronElectoral).toBe(sinAcento?.padronElectoral);
  });

  it("estados con nombre DERFE distinto ('MEXICO', 'COAHUILA DE ZARAGOZA'): getPadronByEstado ya no devuelve null", async () => {
    const edomex = await getPadronByEstado("Estado de México");
    expect(edomex?.padronElectoral).toBe(830000 + 620000);
    // "México" (decisión de producto) → mismo estado
    expect((await getPadronByEstado("México"))?.padronElectoral).toBe(830000 + 620000);
    expect((await getPadronByEstado("Coahuila de Zaragoza"))?.padronElectoral).toBe(720000);
  });

  it("un municipio que no existe sigue cayendo al dato estatal, y lo DECLARA (granularidadReal:'estatal')", async () => {
    const r = await getPadronByGeo("Jalisco", { municipioNombre: "Municipio Inexistente" });
    expect(r?.granularidadReal).toBe("estatal");
  });
});

// ── 3. Resolvers de estado: una sola respuesta ──────────────────────────────
describe("fallo 3 — todos los resolvers de estado dan la MISMA respuesta", () => {
  // [entrada, CVE esperado] — decisiones de producto: "México" → Estado de México (15).
  const casos: [string, string][] = [
    ["Jalisco", "14"],
    ["Estado de México", "15"],
    ["México", "15"],
    ["Ciudad de México", "09"],
    ["CDMX", "09"],
    ["Distrito Federal", "09"],
    ["Coahuila de Zaragoza", "05"],
    ["Michoacán de Ocampo", "16"],
    ["Veracruz de Ignacio de la Llave", "30"],
    ["Quintana  Roo", "23"],
    ["  jalisco  ", "14"],
    ["NUEVO LEÓN", "19"],
    ["nuevo_leon", "19"],
  ];

  it.each(casos)("'%s' → %s en Sefix y en lib/geo", (entrada, cve) => {
    const sefix = resolveEstadoName(entrada);
    expect(sefix ? ESTADO_CVE_MAP[sefix] : null).toBe(cve);
    expect(getCveEntidad(entrada)).toBe(cve);
  });

  it("los adaptadores de Fontana ya no definen su propia copia de resolveEstadoCve", () => {
    const dir = join(process.cwd(), "lib/fontana/ingesta");
    const conCopiaPropia = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => /function resolveEstadoCve\(/.test(readFileSync(join(dir, f), "utf8")));
    expect(conCopiaPropia).toEqual([]);
  });
});

// ── 4. toStorageKey con mayúsculas/minúsculas mezcladas ─────────────────────
describe("fallo 4 — toStorageKey normaliza internamente", () => {
  it.each([
    ["Jalisco", "JALISCO"],
    ["jalisco", "JALISCO"],
    ["Nuevo León", "NUEVO_LEON"],
    ["QUERÉTARO", "QUERETARO"],
    ["  San Luis Potosí ", "SAN_LUIS_POTOSI"],
    ["ESTADO DE MEXICO", "ESTADO_DE_MEXICO"],
  ])("'%s' → '%s'", (entrada, clave) => {
    expect(toStorageKey(entrada)).toBe(clave);
  });

  it("el centinela del extranjero se conserva tal cual", () => {
    expect(toStorageKey("__EXTRANJERO__")).toBe("__EXTRANJERO__");
  });
});
