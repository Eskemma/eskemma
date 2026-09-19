// lib/sefix/resultadosFederalesMunicipio.test.ts
// Resultados FEDERALES (getResultadosFiltered) — el municipio se compara por
// clave canónica, igual que en locales (resultadosLocalesMunicipio.test.ts).
//
// Evidencia real (Storage, 2026-09-19, pef_dip_*.csv): en los CSV federales no
// hay mojibake ni '?' en municipios (0 casos), pero 12 municipios cambian de
// nombre CRUDO entre años: TLAQUEPAQUE (2006-2012) ↔ SAN PEDRO TLAQUEPAQUE
// (2015+), SILAO ↔ SILAO DE LA VICTORIA, MEDELLIN ↔ MEDELLIN DE BRAVO,
// ACAMBAY ↔ ACAMBAY DE RUIZ CASTAÑEDA (2015+; sin Ñ en el resto)… El endpoint
// `allYears` pasa la MISMA cadena a todos los años, así que con igualdad exacta
// los años con otro nombre daban 0 en silencio.

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const cabecera =
  "Id,anio,cve_ambito,ambito,cve_cargo,cargo,cve_principio,principio,cve_tipo,tipo,cve_circunscripcion,circunscripcion,cve_estado,estado,cve_def,cabecera,cve_mun,municipio,seccion,total_votos,lne,vot_nul,PAN,PRI";
const fila = (estado: string, cveEstado: string, cab: string, mun: string, sec: string, tv: number, lne: number) =>
  `1,2009,1,FEDERAL,1,DIPUTADOS,1,MAYORIA RELATIVA,1,ORDINARIA,1,1,${cveEstado},${estado},1,${cab},1,${mun},${sec},${tv},${lne},10,${Math.round(tv / 2)},${Math.round(tv / 3)}`;

const CSVS: Record<string, string> = {
  // 2009: nombres CORTOS (tal como están en el CSV real)
  "sefix/results/federals/pef_dip_2009.csv": [
    cabecera,
    fila("JALISCO", "14", "1416 TLAQUEPAQUE", "TLAQUEPAQUE", "100", 130000, 260000),
    fila("JALISCO", "14", "1410 ZAPOPAN", "ZAPOPAN", "200", 500000, 900000),
    fila("MEXICO", "15", "1503 ATLACOMULCO", "ACAMBAY", "300", 20000, 50000),
    fila("GUANAJUATO", "11", "1102 SAN MIGUEL DE ALLENDE", "SILAO", "400", 45000, 90000),
  ].join("\n"),
  // 2024: nombres LARGOS (tal como están en el CSV real)
  "sefix/results/federals/pef_dip_2024.csv": [
    cabecera,
    fila("JALISCO", "14", "1416 SAN PEDRO TLAQUEPAQUE", "SAN PEDRO TLAQUEPAQUE", "100", 284031, 521997),
    fila("JALISCO", "14", "1410 ZAPOPAN", "ZAPOPAN", "200", 700000, 1100000),
    fila("MEXICO", "15", "1503 ATLACOMULCO DE FABELA", "ACAMBAY DE RUIZ CASTAÑEDA", "300", 30000, 60000),
    fila("GUANAJUATO", "11", "1102 SAN MIGUEL DE ALLENDE", "SILAO DE LA VICTORIA", "400", 60000, 100000),
  ].join("\n"),
};

vi.mock("@/lib/firebase-admin", () => ({ adminApp: {} }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      getFiles: async ({ prefix }: { prefix: string }) => [Object.keys(CSVS).filter((n) => n.startsWith(prefix)).map((name) => ({ name }))],
      file: (path: string) => ({ createReadStream: () => Readable.from([CSVS[path] ?? ""]) }),
    }),
  }),
}));

import { getResultadosFiltered } from "@/lib/sefix/storage";

const votos = async (estadoInput: string, anioInput: number, municipio: string) =>
  (await getResultadosFiltered({ estadoInput, cargoInput: "diputados", anioInput, municipio }))?.totalVotos;

describe("resultados federales: el municipio se compara por clave canónica (alias, acentos, cambio de nombre entre años)", () => {
  it("nombre OFICIAL actual contra un año con nombre CORTO: 'San Pedro Tlaquepaque' en 2009 (antes: 0)", async () => {
    expect(await votos("JALISCO", 2009, "San Pedro Tlaquepaque")).toBe(130000);
  });

  it("nombre corto/alias contra un año con nombre LARGO: 'Tlaquepaque' en 2024 (antes: 0)", async () => {
    expect(await votos("JALISCO", 2024, "Tlaquepaque")).toBe(284031);
  });

  it("la misma cadena sirve para toda la serie histórica (lo que hace allYears)", async () => {
    expect(await votos("JALISCO", 2009, "Tlaquepaque")).toBe(130000);
    expect(await votos("JALISCO", 2024, "Tlaquepaque")).toBe(284031);
  });

  it("Ñ/acento en un año y sin ella en otro: 'Acambay de Ruiz Castañeda' en 2009 y 2024 (antes: 0 en 2009)", async () => {
    expect(await votos("MEXICO", 2009, "Acambay de Ruiz Castañeda")).toBe(20000);
    expect(await votos("MEXICO", 2024, "Acambay de Ruiz Castaneda")).toBe(30000);
  });

  it("'Silao de la Victoria' en 2009, cuando el CSV dice SILAO (antes: 0)", async () => {
    expect(await votos("GUANAJUATO", 2009, "Silao de la Victoria")).toBe(45000);
  });

  it("variante de mayúsculas: 'zapopan' en 2009 (antes: 0, la igualdad era sensible a mayúsculas)", async () => {
    expect(await votos("JALISCO", 2009, "zapopan")).toBe(500000);
  });

  it("controles (pasaban antes y siguen pasando): nombre idéntico y municipio inexistente", async () => {
    expect(await votos("JALISCO", 2024, "ZAPOPAN")).toBe(700000);
    expect(await votos("JALISCO", 2024, "Municipio Inexistente")).toBe(0);
  });

  it("con filtro de distrito + municipio: 'Tlaquepaque' dentro de 1416 (2009) marca el distrito como encontrado", async () => {
    const r = await getResultadosFiltered({
      estadoInput: "JALISCO", cargoInput: "diputados", anioInput: 2009,
      cabecera: "1416 TLAQUEPAQUE", municipio: "San Pedro Tlaquepaque",
    });
    expect(r?.totalVotos).toBe(130000);
    expect(r?.distritoRedistritado).toBeUndefined();
  });
});
