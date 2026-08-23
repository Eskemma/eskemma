// lib/fontana/ingesta/transparencyInternational.ts
// Adaptador de F4-7 (Índice de Percepción de Corrupción, Transparencia
// Internacional) — Familia 4.
//
// Verificado 2026-08-21: el catálogo original documentaba "descarga
// directa con parseo manual XML" — el mecanismo real disponible hoy es
// XLSX, no XML (drift confirmado en vivo, corregido aquí):
// https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx
// (307 redirect a files.transparencycdn.org, `fetch` lo sigue solo).
// Sigue siendo descarga directa reproducible, solo cambia el formato de
// parseo (xlsx, ya dependencia directa del proyecto — ver coneval.ts).
//
// Hoja "CPI 2024", encabezados en la fila 3 (índice 2, 0-based):
// "Country / Territory", "ISO3", "Region", "CPI 2024 score", "Rank", ...
// Datos desde la fila 4. Confirmado con descarga real (Dinamarca 90/1,
// Finlandia 88/2, Singapur 84/3).
//
// Sin caché en Storage — XLSX completo cacheado en memoria de proceso
// (TTL 24h, single-flight), mismo patrón que pnudHdr.ts/rsf.ts.

import * as XLSX from "xlsx";
import type { CeldaComparativaPais, PaisComparativoCompleto } from "@/lib/fontana/tablaComparativaInternacional";

const CPI_XLSX_URL = "https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx";
const HOJA = "CPI 2024";

interface FilaCpi {
  iso3: string;
  nombre: string;
  score: number;
  rank: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: { filas: Map<string, FilaCpi>; expira: number } | null = null;
let enVuelo: Promise<Map<string, FilaCpi>> | null = null;

function parsearXlsx(buffer: ArrayBuffer): Map<string, FilaCpi> {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[HOJA];
  if (!ws) throw new Error(`Hoja "${HOJA}" no encontrada en el XLSX de CPI`);
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  const encabezados = (filas[2] ?? []) as string[];
  const idxIso3 = encabezados.indexOf("ISO3");
  const idxNombre = encabezados.indexOf("Country / Territory");
  const idxScore = encabezados.findIndex((h) => typeof h === "string" && h.includes("CPI") && h.includes("score"));
  const idxRank = encabezados.indexOf("Rank");

  const porPais = new Map<string, FilaCpi>();
  for (let i = 3; i < filas.length; i++) {
    const fila = filas[i] as (string | number | null)[];
    const iso3 = fila[idxIso3];
    const nombre = fila[idxNombre];
    const score = fila[idxScore];
    const rank = fila[idxRank];
    if (typeof iso3 !== "string" || iso3.length !== 3) continue;
    if (typeof score !== "number" || typeof rank !== "number") continue;
    porPais.set(iso3, { iso3, nombre: typeof nombre === "string" ? nombre : iso3, score, rank });
  }
  return porPais;
}

async function fetchTablaCpi(): Promise<Map<string, FilaCpi>> {
  if (cache && cache.expira > Date.now()) return cache.filas;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const res = await fetch(CPI_XLSX_URL);
    if (!res.ok) throw new Error(`Transparencia Internacional respondió ${res.status}`);
    const buffer = await res.arrayBuffer();
    return parsearXlsx(buffer);
  })();
  try {
    const filas = await enVuelo;
    cache = { filas, expira: Date.now() + CACHE_TTL_MS };
    return filas;
  } finally {
    enVuelo = null;
  }
}

function celdaDesdeFila(iso3: string, fila: FilaCpi | undefined): CeldaComparativaPais {
  if (!fila) return { iso3, estadoConsulta: "sin_datos_confirmado", motivo: "Transparencia Internacional no tiene dato para este país" };
  return {
    iso3,
    valor: fila.score,
    unidad: "índice (0-100)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: `Transparencia Internacional, CPI 2024 (rank global ${fila.rank})`,
    estadoConsulta: "ok",
    rankOficial: fila.rank,
  };
}

export async function resolverTransparencyInternational(isos3: string[]): Promise<Map<string, CeldaComparativaPais>> {
  const porPais = new Map<string, CeldaComparativaPais>();

  let tabla: Map<string, FilaCpi>;
  try {
    tabla = await fetchTablaCpi();
  } catch {
    for (const iso3 of isos3) {
      porPais.set(iso3, { iso3, estadoConsulta: "error_conexion", motivo: "Error de conexión con Transparencia Internacional" });
    }
    return porPais;
  }

  for (const iso3 of isos3) {
    porPais.set(iso3, celdaDesdeFila(iso3, tabla.get(iso3)));
  }
  return porPais;
}

// Todos los países con dato — para el modal "Ver resto de países".
export async function resolverTransparencyInternationalTodos(): Promise<PaisComparativoCompleto[]> {
  const tabla = await fetchTablaCpi();
  return [...tabla.entries()].map(([iso3, fila]) => ({ iso3, nombre: fila.nombre, celda: celdaDesdeFila(iso3, fila) }));
}
