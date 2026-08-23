// lib/fontana/ingesta/pnudHdr.ts
// Adaptador de F4-3 (IDH global) — Familia 4.
//
// Verificado 2026-08-21: CSV directo sin token,
// https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv
// (edición HDR 2025, serie 1990-2023). Columnas: iso3, country, hdicode,
// region, hdi_rank_2023, hdi_1990..hdi_2023. Valores reales confirmados:
// México HDI 2023=0.788 (rank 81), Colombia HDI 2023=0.777 (rank 83).
//
// Formato de columnas confirma que no hay ninguna superposición
// estructural con el IDH municipal de Familia 2 (F2-5, portal/dominio
// completamente distinto) — claramente distinguibles, mismo criterio ya
// documentado en el catálogo.
//
// Sin caché en Storage — el CSV completo (todos los países) se descarga
// una vez y se cachea en memoria de proceso (TTL 24h, single-flight),
// mismo patrón que coneval.ts/inegiPm.ts.

import type { CeldaComparativaPais, PaisComparativoCompleto } from "@/lib/fontana/tablaComparativaInternacional";

const HDR_CSV_URL = "https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv";

interface FilaHdr {
  iso3: string;
  nombre: string;
  hdiRank2023: string;
  hdiUltimoAno: number | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: { filas: Map<string, FilaHdr>; expira: number } | null = null;
let enVuelo: Promise<Map<string, FilaHdr>> | null = null;

// Parseo CSV simple — el archivo no tiene comas dentro de campos citados
// (confirmado en la descarga de verificación: nombres de país sin coma,
// valores numéricos puros), no hace falta un parser CSV completo.
function parsearCsv(texto: string): Map<string, FilaHdr> {
  const lineas = texto.split("\n").filter((l) => l.trim().length > 0);
  const encabezados = lineas[0].split(",");
  const idxIso3 = encabezados.indexOf("iso3");
  const idxNombre = encabezados.indexOf("country");
  const idxRank = encabezados.indexOf("hdi_rank_2023");
  // Última columna hdi_YYYY del encabezado — el año más reciente de la
  // serie (2023 en la edición 2025, pero se calcula en vez de
  // hardcodear el año para no romper si una edición futura extiende la
  // serie).
  const columnasHdi = encabezados
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /^hdi_\d{4}$/.test(h));
  const idxHdiUltimo = columnasHdi.length > 0 ? columnasHdi[columnasHdi.length - 1].i : -1;

  const porPais = new Map<string, FilaHdr>();
  for (let i = 1; i < lineas.length; i++) {
    const campos = lineas[i].split(",");
    const iso3 = campos[idxIso3]?.trim();
    if (!iso3 || iso3.length !== 3) continue;
    const valorCrudo = idxHdiUltimo >= 0 ? campos[idxHdiUltimo]?.trim() : "";
    const valor = valorCrudo && valorCrudo !== ".." ? Number(valorCrudo) : null;
    porPais.set(iso3, {
      iso3,
      nombre: campos[idxNombre]?.trim() ?? iso3,
      hdiRank2023: campos[idxRank]?.trim() ?? "",
      hdiUltimoAno: valor !== null && !Number.isNaN(valor) ? valor : null,
    });
  }
  return porPais;
}

async function fetchTablaHdr(): Promise<Map<string, FilaHdr>> {
  if (cache && cache.expira > Date.now()) return cache.filas;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const res = await fetch(HDR_CSV_URL);
    if (!res.ok) throw new Error(`PNUD HDR respondió ${res.status}`);
    const texto = await res.text();
    return parsearCsv(texto);
  })();
  try {
    const filas = await enVuelo;
    cache = { filas, expira: Date.now() + CACHE_TTL_MS };
    return filas;
  } finally {
    enVuelo = null;
  }
}

function celdaDesdeFila(iso3: string, fila: FilaHdr | undefined): CeldaComparativaPais {
  if (!fila || fila.hdiUltimoAno === null) {
    return { iso3, estadoConsulta: "sin_datos_confirmado", motivo: "PNUD HDR no tiene dato de IDH para este país" };
  }
  const rank = Number(fila.hdiRank2023);
  return {
    iso3,
    valor: fila.hdiUltimoAno,
    unidad: "índice (0-1)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: `PNUD HDR 2025 (rank global ${fila.hdiRank2023})`,
    estadoConsulta: "ok",
    rankOficial: Number.isNaN(rank) ? undefined : rank,
  };
}

export async function resolverPnudHdr(isos3: string[]): Promise<Map<string, CeldaComparativaPais>> {
  const porPais = new Map<string, CeldaComparativaPais>();

  let tabla: Map<string, FilaHdr>;
  try {
    tabla = await fetchTablaHdr();
  } catch {
    for (const iso3 of isos3) {
      porPais.set(iso3, { iso3, estadoConsulta: "error_conexion", motivo: "Error de conexión con PNUD HDR" });
    }
    return porPais;
  }

  for (const iso3 of isos3) {
    porPais.set(iso3, celdaDesdeFila(iso3, tabla.get(iso3)));
  }
  return porPais;
}

// Todos los países con dato — para el modal "Ver resto de países".
export async function resolverPnudHdrTodos(): Promise<PaisComparativoCompleto[]> {
  const tabla = await fetchTablaHdr();
  const resultado: PaisComparativoCompleto[] = [];
  for (const [iso3, fila] of tabla) {
    if (fila.hdiUltimoAno === null) continue;
    resultado.push({ iso3, nombre: fila.nombre, celda: celdaDesdeFila(iso3, fila) });
  }
  return resultado;
}
