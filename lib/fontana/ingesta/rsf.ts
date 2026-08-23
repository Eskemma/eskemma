// lib/fontana/ingesta/rsf.ts
// Adaptador de F4-8 (Libertad de Prensa, Reporteros Sin Fronteras) —
// Familia 4.
//
// Verificado 2026-08-21: CSV directo sin token,
// https://rsf.org/sites/default/files/import_classement/2026.csv
// (RSF ya publica la edición 2026, adelantada al calendario). Confirmado
// "sin fricción" tal como decía el catálogo. Detalles reales de
// implementación:
//   - Separador `;`, NO coma.
//   - Codificación Latin-1 (ISO-8859-1), NO UTF-8 — nombres de país con
//     acentos vienen corruptos si se decodifica como UTF-8 (confirmado
//     en la descarga de verificación).
//   - Columna 1 = ISO (código de 3 letras), columna 2 = "Score 2026",
//     columna 3 = "Rank", columna "Country_ES" = nombre en español.
// Valores reales confirmados: México (MEX) score 45.23, rank 122;
// Colombia (COL) score 51.66, rank 102.
//
// Sin caché en Storage — CSV completo cacheado en memoria de proceso
// (TTL 24h, single-flight), mismo patrón que pnudHdr.ts.

import type { CeldaComparativaPais, PaisComparativoCompleto } from "@/lib/fontana/tablaComparativaInternacional";

const RSF_CSV_URL = "https://rsf.org/sites/default/files/import_classement/2026.csv";

interface FilaRsf {
  iso3: string;
  nombre: string;
  score: number;
  rank: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: { filas: Map<string, FilaRsf>; expira: number } | null = null;
let enVuelo: Promise<Map<string, FilaRsf>> | null = null;

// RSF usa coma decimal ("86,22") — se normaliza a punto antes de Number().
function parseNumeroRsf(campo: string): number | null {
  const normalizado = campo.trim().replace(",", ".");
  const n = Number(normalizado);
  return Number.isNaN(n) ? null : n;
}

function parsearCsv(buffer: ArrayBuffer): Map<string, FilaRsf> {
  const texto = new TextDecoder("iso-8859-1").decode(buffer);
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const encabezados = lineas[0].split(";");
  const idxIso = encabezados.indexOf("ISO");
  const idxNombre = encabezados.indexOf("Country_ES");
  const idxScore = encabezados.findIndex((h) => h.startsWith("Score"));
  const idxRank = encabezados.indexOf("Rank");

  const porPais = new Map<string, FilaRsf>();
  for (let i = 1; i < lineas.length; i++) {
    const campos = lineas[i].split(";");
    const iso3 = campos[idxIso]?.trim();
    if (!iso3 || iso3.length !== 3) continue;
    const score = parseNumeroRsf(campos[idxScore] ?? "");
    const rank = parseNumeroRsf(campos[idxRank] ?? "");
    if (score === null || rank === null) continue;
    porPais.set(iso3, { iso3, nombre: campos[idxNombre]?.trim() || iso3, score, rank });
  }
  return porPais;
}

async function fetchTablaRsf(): Promise<Map<string, FilaRsf>> {
  if (cache && cache.expira > Date.now()) return cache.filas;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const res = await fetch(RSF_CSV_URL);
    if (!res.ok) throw new Error(`RSF respondió ${res.status}`);
    const buffer = await res.arrayBuffer();
    return parsearCsv(buffer);
  })();
  try {
    const filas = await enVuelo;
    cache = { filas, expira: Date.now() + CACHE_TTL_MS };
    return filas;
  } finally {
    enVuelo = null;
  }
}

function celdaDesdeFila(iso3: string, fila: FilaRsf | undefined): CeldaComparativaPais {
  if (!fila) return { iso3, estadoConsulta: "sin_datos_confirmado", motivo: "RSF no tiene dato para este país" };
  return {
    iso3,
    valor: fila.score,
    unidad: "índice (0-100)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: `RSF 2026 (rank global ${fila.rank})`,
    estadoConsulta: "ok",
    rankOficial: fila.rank,
  };
}

export async function resolverRsf(isos3: string[]): Promise<Map<string, CeldaComparativaPais>> {
  const porPais = new Map<string, CeldaComparativaPais>();

  let tabla: Map<string, FilaRsf>;
  try {
    tabla = await fetchTablaRsf();
  } catch {
    for (const iso3 of isos3) {
      porPais.set(iso3, { iso3, estadoConsulta: "error_conexion", motivo: "Error de conexión con RSF" });
    }
    return porPais;
  }

  for (const iso3 of isos3) {
    porPais.set(iso3, celdaDesdeFila(iso3, tabla.get(iso3)));
  }
  return porPais;
}

// Todos los países con dato — para el modal "Ver resto de países".
export async function resolverRsfTodos(): Promise<PaisComparativoCompleto[]> {
  const tabla = await fetchTablaRsf();
  return [...tabla.entries()].map(([iso3, fila]) => ({ iso3, nombre: fila.nombre, celda: celdaDesdeFila(iso3, fila) }));
}
