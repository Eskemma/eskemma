// lib/fontana/ingesta/denue.ts
// Adaptador de F5-6 (Zonas de actividad económica) — Familia 5.
//
// Verificado 2026-08-23: descarga masiva directa por estado, sin SPA ni
// token — mecanismo más simple que el reverse-engineering de la SPA
// documentado en la investigación original de Familia 2:
//   https://www.inegi.org.mx/contenidos/masiva/denue/denue_{cve_estado}_csv.zip
// Confirmado en vivo: Jalisco (14) 39.4 MB, Oaxaca (20) 24.9 MB, ambos
// `Last-Modified: 2026-05-20` (recientes). ZIP con 3 archivos —
// `conjunto_de_datos/denue_inegi_{cve}_.csv` es el real, con columnas
// `cve_mun`/`municipio`/`ageb`/`manzana` (confirmado con muestra real,
// registro id=8624390, Zapopan, AGEB 0034).
//
// Alcance de esta primera versión: conteo de unidades económicas por
// municipio/estado (censo de establecimientos activos) — no la
// zonificación completa por AGEB que el catálogo menciona como
// aspiración ("Fontana construye la agregación por zona/AGEB"). El
// conteo por AGEB SÍ queda disponible en `distribucion` (top AGEBs del
// municipio) para una fase posterior que agrupe AGEBs contiguos en
// "zonas" reales — no se inventa esa lógica de zonificación sin
// metodología real, mismo criterio de "nunca fabricar un cálculo sin
// respaldo" ya aplicado en el resto del proyecto.
//
// Sin caché en Storage — ZIP completo (por estado) cacheado en memoria
// de proceso (TTL 24h, single-flight). Archivo grande (24-39+ MB por
// estado observado) — aceptable para una descarga diaria por estado,
// no por request.

import JSZip from "jszip";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, claveCanonicaMunicipio, getMunicipiosOptions } from "@/lib/geo/municipios";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";
import type { Territorio } from "@/types/shared.types";

interface ConteoDenueEstado {
  totalEstado: number;
  porMunicipio: Map<string, number>; // clave: municipio normalizado
  porMunicipioAgeb: Map<string, Map<string, number>>;
  // Modo B (2026-08-24) — conteo por giro real (columna `nombre_act`,
  // ya categorizada por INEGI, no texto libre — confirmado en vivo:
  // Zapopan 676 giros distintos, Guadalajara 730). Base para el modal
  // de detalle "top de giros por municipio".
  porMunicipioGiro: Map<string, Map<string, number>>;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { conteo: ConteoDenueEstado; expira: number }>();
const enVuelo = new Map<string, Promise<ConteoDenueEstado>>();

// BUG REAL encontrado y corregido en esta ronda: no todos los campos
// vienen citados — los campos vacíos (ej. edificio_e, numero_int)
// aparecen como `,,` sin comillas entre comas reales, confirmado en la
// muestra real de un registro (Zapopan, id 8624390). Un split ingenuo
// por `","` desalinea las columnas en cuanto una fila tiene algún
// campo vacío — que es la mayoría de las filas reales — produciendo
// conteos muy por debajo de lo real y "AGEB" con basura (teléfonos,
// coordenadas, URLs) en vez del valor real. Parser carácter por
// carácter, respeta comillas, soporta campos vacíos sin comillas.
function partirFilaCsv(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let dentroComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      dentroComillas = !dentroComillas;
    } else if (c === "," && !dentroComillas) {
      campos.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos;
}

async function fetchConteoEstado(cve: string): Promise<ConteoDenueEstado> {
  const cacheado = cache.get(cve);
  if (cacheado && cacheado.expira > Date.now()) return cacheado.conteo;
  const enCurso = enVuelo.get(cve);
  if (enCurso) return enCurso;

  const promesa = (async (): Promise<ConteoDenueEstado> => {
    const res = await fetch(`https://www.inegi.org.mx/contenidos/masiva/denue/denue_${cve}_csv.zip`);
    if (!res.ok) throw new Error(`DENUE respondió ${res.status} para estado ${cve}`);
    const buffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const entrada = Object.values(zip.files).find((f) => !f.dir && /conjunto_de_datos\/.*\.csv$/i.test(f.name));
    if (!entrada) throw new Error(`ZIP de DENUE (estado ${cve}) sin archivo de conjunto_de_datos`);
    // BUG REAL encontrado y corregido (2026-08-24, durante Modo B) — el
    // CSV real de DENUE viene en Latin-1 (windows-1252), no UTF-8;
    // `entrada.async("string")` decodifica como UTF-8 por defecto y
    // corrompe cualquier acento a "�" — invisible mientras solo se leían
    // `municipio`/`ageb` (sin acentos reales en esos valores), pero
    // rompe `nombre_act` (giro), que sí los tiene ("miscel�neas",
    // "cl�nicas"). Mismo patrón de fix ya usado en sic.ts: leer el
    // buffer crudo y decodificar explícitamente como Latin-1.
    const bufferCsv = await entrada.async("nodebuffer");
    const texto = new TextDecoder("iso-8859-1").decode(bufferCsv);
    const lineas = texto.split("\n").filter((l) => l.trim().length > 0);
    const encabezados = partirFilaCsv(lineas[0]);
    const idxMun = encabezados.indexOf("municipio");
    const idxAgeb = encabezados.indexOf("ageb");
    const idxNombreAct = encabezados.indexOf("nombre_act");

    const porMunicipio = new Map<string, number>();
    const porMunicipioAgeb = new Map<string, Map<string, number>>();
    const porMunicipioGiro = new Map<string, Map<string, number>>();
    let totalEstado = 0;
    for (let i = 1; i < lineas.length; i++) {
      const campos = partirFilaCsv(lineas[i]);
      const municipio = campos[idxMun]?.trim();
      if (!municipio) continue;
      // Migrado a claveCanonicaMunicipio() (Incidente 2, alias table) —
      // mismo patrón ya usado en coneval.ts/conapoMarginacion.ts/
      // bienestar.ts/icmm.ts/iter.ts/pnud.ts/sic.ts/conagua.ts.
      const municipioNorm = claveCanonicaMunicipio(cve, municipio);
      totalEstado++;
      porMunicipio.set(municipioNorm, (porMunicipio.get(municipioNorm) ?? 0) + 1);
      const ageb = campos[idxAgeb]?.trim();
      if (ageb) {
        if (!porMunicipioAgeb.has(municipioNorm)) porMunicipioAgeb.set(municipioNorm, new Map());
        const mapaAgeb = porMunicipioAgeb.get(municipioNorm)!;
        mapaAgeb.set(ageb, (mapaAgeb.get(ageb) ?? 0) + 1);
      }
      const giro = campos[idxNombreAct]?.trim();
      if (giro) {
        if (!porMunicipioGiro.has(municipioNorm)) porMunicipioGiro.set(municipioNorm, new Map());
        const mapaGiro = porMunicipioGiro.get(municipioNorm)!;
        mapaGiro.set(giro, (mapaGiro.get(giro) ?? 0) + 1);
      }
    }
    return { totalEstado, porMunicipio, porMunicipioAgeb, porMunicipioGiro };
  })();
  enVuelo.set(cve, promesa);
  try {
    const conteo = await promesa;
    cache.set(cve, { conteo, expira: Date.now() + CACHE_TTL_MS });
    return conteo;
  } finally {
    enVuelo.delete(cve);
  }
}

export async function resolverActividadEconomica(territorio: Territorio): Promise<CeldaFontana[]> {
  if (!territorio.estado) return [];
  const cve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!cve) return [{ nivel: "estatal", motivo: "Estado no reconocido para DENUE" }];

  let conteo: ConteoDenueEstado;
  try {
    conteo = await fetchConteoEstado(cve);
  } catch {
    return [{ nivel: "estatal", motivo: "Error de conexión con INEGI DENUE" }];
  }

  const celdas: CeldaFontana[] = [{
    nivel: "estatal",
    valor: conteo.totalEstado,
    unidad: "unidades económicas registradas",
    naturaleza: "dato_directo",
    fuenteEtiqueta: "INEGI DENUE (descarga masiva)",
  }];

  if (territorio.municipio) {
    const municipioNorm = claveCanonicaMunicipio(cve, territorio.municipio);
    const totalMunicipal = conteo.porMunicipio.get(municipioNorm) ?? 0;
    const agebsMunicipio = conteo.porMunicipioAgeb.get(municipioNorm);
    const topAgebs = agebsMunicipio
      ? Object.fromEntries([...agebsMunicipio.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10))
      : undefined;
    celdas.push({
      nivel: "municipal",
      valor: totalMunicipal,
      unidad: "unidades económicas registradas",
      naturaleza: "dato_directo",
      fuenteEtiqueta: "INEGI DENUE (descarga masiva)",
      distribucion: topAgebs,
    });
  }

  return celdas;
}

// Capa 2 (2026-08-25) — bulk-resolver "aditivo" para territorio plural,
// mismo patrón exacto que los 6 de anvcc.ts (firma estándar
// `(estadoCve, soloCves?)` que espera `resolverDesgloseMunicipiosEstado()`,
// index.ts). F5-6 ya estaba clasificado `agregacionPlural: "aditivo"` en
// el registry desde Capa 1, pero esta pieza nunca se construyó — omisión
// real, no diseño (bug encontrado en verificación visual, caso
// Tlaquepaque/ZMG). Reutiliza `conteo.porMunicipio`, ya cacheado por
// `fetchConteoEstado` — sin descarga ni recorrido nuevo del CSV.
export async function resolverMunicipiosEstadoActividadEconomica(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const opciones = await getMunicipiosOptions(estadoCve);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  let conteo: ConteoDenueEstado;
  try {
    conteo = await fetchConteoEstado(estadoCve);
  } catch {
    return opcionesFiltradas.map(({ cve, nombre }) => ({
      cve, nombre, celda: { nivel: "municipal", motivo: "Error de conexión con INEGI DENUE" },
    }));
  }

  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => {
    const municipioNorm = claveCanonicaMunicipio(estadoCve, nombre);
    const valor = conteo.porMunicipio.get(municipioNorm) ?? 0;
    return {
      cve,
      nombre,
      celda: { nivel: "municipal", valor, unidad: "unidades económicas registradas", naturaleza: "dato_directo", fuenteEtiqueta: "INEGI DENUE (descarga masiva)" },
    };
  });
}

// Modo B (2026-08-24) — detalle paginado de giros para el modal "Ver
// detalle". Paginación SIEMPRE del lado del servidor — nunca se manda
// la lista completa al cliente (medido en vivo: 676-730 giros
// distintos por municipio en Zapopan/Guadalajara) para que el
// frontend la trunque visualmente; "Ver más" dispara una nueva
// llamada con `offset` incrementado, mismo tamaño de página que la
// carga inicial (PAGE_SIZE_GIROS, ver constante).
export const PAGE_SIZE_GIROS = 15;

export interface GiroDetalle {
  giro: string;
  conteo: number;
}

export interface DetalleGirosResultado {
  items: GiroDetalle[];
  total: number; // número de giros DISTINTOS del municipio (para saber si hay más)
  offset: number;
  hasMore: boolean;
}

export async function resolverDetalleGiros(
  territorio: Territorio,
  offset: number = 0,
  limit: number = PAGE_SIZE_GIROS
): Promise<DetalleGirosResultado> {
  if (!territorio.estado || !territorio.municipio) {
    return { items: [], total: 0, offset, hasMore: false };
  }
  const cve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!cve) return { items: [], total: 0, offset, hasMore: false };

  const conteo = await fetchConteoEstado(cve);
  const municipioNorm = claveCanonicaMunicipio(cve, territorio.municipio);
  const mapaGiro = conteo.porMunicipioGiro.get(municipioNorm);
  if (!mapaGiro) return { items: [], total: 0, offset, hasMore: false };

  // Orden: descendente por conteo de establecimientos (el giro más
  // frecuente primero) — confirmado con Raúl.
  const ordenados = [...mapaGiro.entries()].sort((a, b) => b[1] - a[1]);
  const pagina = ordenados.slice(offset, offset + limit);
  return {
    items: pagina.map(([giro, count]) => ({ giro, conteo: count })),
    total: ordenados.length,
    offset,
    hasMore: offset + limit < ordenados.length,
  };
}
