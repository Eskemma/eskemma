// lib/sefix/resultadosLocalesMunicipio.test.ts
// Punto 4 — comparación de municipio en resultados LOCALES (getResultadosLocalesFiltered).
// Casos REALES verificados contra Storage (2026-09-19, dip_loc 2024):
//   · "Tlaquepaque" → 0 votos (el CSV dice "SAN PEDRO TLAQUEPAQUE": 284,031 votos)
//   · "General Escobedo" → 0 votos (el CSV dice "GRAL. ESCOBEDO": 168,321)
//   · "Tlajomulco de Zúñiga" → 0 votos: el CSV de Jalisco trae la Ñ DOBLEMENTE
//     CODIFICADA (bytes UTF-8 de "Ñ" leídos como latin1: "Ã" + U+0091), así que ni
//     siquiera el nombre oficial con Ñ coincidía. Los fixtures reproducen ese contenido.

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const MOJIBAKE_ZUNIGA = "TLAJOMULCO DE ZUÃIGA"; // tal como está en el CSV real

const cabecera = "estado,cve_estado,cabecera,municipio,seccion,tipo,principio,total_votos,lne,vot_nul,PAN,PRI";
const CSVS: Record<string, string> = {
  "sefix/results/locals/jal_pel_dip_loc_2024.csv": [
    cabecera,
    "JALISCO,14,1 UNO,SAN PEDRO TLAQUEPAQUE,100,ORDINARIA,MR,284031,521997,1000,150000,90000",
    "JALISCO,14,1 UNO,ZAPOPAN,200,ORDINARIA,MR,500000,900000,2000,250000,150000",
    `JALISCO,14,2 DOS,${MOJIBAKE_ZUNIGA},300,ORDINARIA,MR,220000,480000,900,110000,80000`,
  ].join("\n"),
  "sefix/results/locals/nl_pel_dip_loc_2024.csv": [
    cabecera,
    "NUEVO LEON,19,1 UNO,GRAL. ESCOBEDO,100,ORDINARIA,MR,168321,345349,800,90000,50000",
    "NUEVO LEON,19,1 UNO,MONTERREY,200,ORDINARIA,MR,575097,963309,3000,300000,200000",
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

import { getResultadosLocalesFiltered } from "@/lib/sefix/storage";

const votos = async (estadoNombre: string, municipio: string) =>
  (await getResultadosLocalesFiltered({ estadoNombre, cargoKey: "dip_loc", anioInput: 2024, municipio }))?.totalVotos;

describe("resultados locales: el municipio se compara por clave canónica (alias, acentos, mojibake)", () => {
  it("'Tlaquepaque' → votos de SAN PEDRO TLAQUEPAQUE (antes: 0)", async () => {
    expect(await votos("JALISCO", "Tlaquepaque")).toBe(284031);
  });

  it("'General Escobedo' → votos de GRAL. ESCOBEDO (antes: 0)", async () => {
    expect(await votos("NUEVO LEON", "General Escobedo")).toBe(168321);
  });

  it("'Tlajomulco de Zúñiga' y 'Zuñiga' → el municipio, aunque el CSV traiga la Ñ mal codificada (antes: 0)", async () => {
    expect(await votos("JALISCO", "Tlajomulco de Zúñiga")).toBe(220000);
    expect(await votos("JALISCO", "Tlajomulco de Zuñiga")).toBe(220000);
    expect(await votos("JALISCO", "Tlajomulco de Zuniga")).toBe(220000);
  });

  it("control: los nombres oficiales y las variantes de mayúsculas siguen funcionando", async () => {
    expect(await votos("JALISCO", "San Pedro Tlaquepaque")).toBe(284031);
    expect(await votos("JALISCO", "zapopan")).toBe(500000);
    expect(await votos("NUEVO LEON", "Gral. Escobedo")).toBe(168321);
    expect(await votos("NUEVO LEON", "Monterrey")).toBe(575097);
  });

  it("un municipio inexistente sigue dando 0 (no coincide con nada)", async () => {
    expect(await votos("JALISCO", "Municipio Inexistente")).toBe(0);
  });
});
