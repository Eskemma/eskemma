// lib/fontana/ingesta/compendio.ts
// Adaptador de F1-16 (Densidad de población) sobre el Compendio de
// Información Geográfica Municipal 2010 (INEGI) — bodega BAJO DEMANDA
// (a diferencia de ITER, que se precomputó completo). Motivo: el
// Compendio es un PDF por municipio (~2,469 en todo México); Fontana se
// consulta proyecto por proyecto con un puñado de territorios activos a
// la vez, así que precomputar todo el país de antemano sería trabajo
// desperdiciado. La primera vez que un municipio real se consulta, este
// adaptador descarga y parsea su PDF y lo guarda permanentemente en la
// bodega (fontana/bodega/compendio_2010/{estadoCve}{municipioCve}.json)
// — consultas siguientes al mismo municipio ya no vuelven a tocar INEGI.
//
// URL y regex verificados en vivo en esta sesión (2026-07-31) contra los
// 2 PDFs reales ya descargados en una ronda de investigación previa
// (info_geo_eske/familia5_verificaciones_ronda3.md):
//   GET https://www.inegi.org.mx/contenidos/app/mexicocifras/datos_geograficos/{estadoCve}/{estadoCve}{municipioCve}.pdf
//   → HTTP 200 (confirmado con curl -I, 2026-07-31)
//   Guadalajara (14039): "Ocupa el 0.19% de la superficie del estado"
//   Zapopan (14120): "Ocupa el 1.48% de la superficie del estado"
// pdf-parse v2.4.5 (API PDFParse.getText(), no la API v1 callable
// directa) inserta saltos de línea y, en algunos PDFs (ej. Monterrey,
// 19039), tabulaciones entre CADA palabra de la frase ("Ocupa \tel
// \t1.2% \tde \tla\nsuperficie del estado") — el regex usa \s+ entre
// todas las palabras, no solo alrededor de "del/estado", confirmado
// contra Guadalajara, Zapopan y Monterrey (2026-07-31).

import { readFromBodega, writeToBodega } from "@/lib/fontana/bodegaStorage";
import { resolverIndicadorIter, resolverNacionalIter } from "@/lib/fontana/ingesta/iter";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import { SUPERFICIE_ESTATAL_KM2 } from "@/lib/fontana/ingesta/superficieEstatal";
import { esValorDisponible } from "@/lib/fontana/ingesta/types";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_COMPENDIO = "INEGI (Compendio de Información Geográfica Municipal 2010)";

interface SuperficieRecord {
  porcentajeEstatal: number;
  superficieKm2: number;
}

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

function buildCompendioUrl(estadoCve: string, municipioCve: string): string {
  return `https://www.inegi.org.mx/contenidos/app/mexicocifras/datos_geograficos/${estadoCve}/${estadoCve}${municipioCve}.pdf`;
}

async function fetchYParsearCompendio(estadoCve: string, municipioCve: string): Promise<SuperficieRecord | null> {
  const url = buildCompendioUrl(estadoCve, municipioCve);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;

  const buf = Buffer.from(await response.arrayBuffer());
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();

  // Espacio opcional antes del "%" — verificado 2026-08-02 contra los
  // 125 PDFs de Jalisco: el PDF de Puerto Vallarta (14067) trae "0.86 %
  // de la superficie" (con espacio), a diferencia de los demás ("1.48%",
  // sin espacio). Regex tolerante corrige ese caso sin romper ninguno de
  // los otros 124 ya funcionando.
  const match = result.text.match(/Ocupa\s+el\s+([\d.]+)\s*%\s+de\s+la\s+superficie\s+del\s+estado/i);
  if (!match) return null;

  const porcentajeEstatal = parseFloat(match[1]);
  const superficieEstatal = SUPERFICIE_ESTATAL_KM2[estadoCve];
  if (isNaN(porcentajeEstatal) || !superficieEstatal) return null;

  return {
    porcentajeEstatal,
    superficieKm2: Math.round((porcentajeEstatal / 100) * superficieEstatal * 100) / 100,
  };
}

async function resolverSuperficieMunicipal(estadoCve: string, municipioCve: string): Promise<SuperficieRecord | null> {
  const path = `compendio_2010/${estadoCve}${municipioCve}.json`;
  const cached = await readFromBodega<SuperficieRecord>(path);
  if (cached) return cached;

  const fetched = await fetchYParsearCompendio(estadoCve, municipioCve);
  if (!fetched) return null;

  await writeToBodega(path, fetched);
  return fetched;
}

// F1-16 (Densidad de población). Municipal: POBTOT municipal (ITER) ÷
// superficie municipal (Compendio) — calculo_directo, división directa
// sobre 2 datos oficiales. Estatal: POBTOT estatal oficial (misma fila
// agregada de ITER que ya lee iter.ts para F1-2, sin volver a llamar a
// la fuente) ÷ SUPERFICIE_ESTATAL_KM2 — también calculo_directo, no
// depende de qué municipios se hayan consultado antes (ajuste acordado:
// ya no se agrega desde municipios parciales).
export async function resolverDensidad(territorio: Territorio): Promise<CeldaFontana[]> {
  const nacional = await resolverDensidadNacional();

  if (!territorio.estado) {
    return [
      nacional,
      { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" },
      { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" },
    ];
  }

  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const [estatal, municipal] = await Promise.all([
    resolverDensidadEstatal(estadoCve),
    resolverDensidadMunicipal(estadoCve, territorio),
  ]);
  return [nacional, estatal, municipal];
}

// Superficie nacional oficial: INEGI, Anuario estadístico y geográfico
// por entidad federativa 2020, Cuadro 1.1 ("Superficie territorial (km2)
// 1 964 375 / Continental 1 959 248 / Insular 5 127") — cifra más precisa
// ya documentada, preferida sobre sumar las 32 SUPERFICIE_ESTATAL_KM2
// (que difieren 0.07%, ver superficieEstatal.ts).
const SUPERFICIE_NACIONAL_KM2 = 1_964_375;

async function resolverDensidadNacional(): Promise<CeldaFontana> {
  const nacionalIter = await resolverNacionalIter("F1-2");
  if (!("valor" in nacionalIter)) {
    return { nivel: "nacional", motivo: "No fue posible resolver la población nacional (ITER) para calcular la densidad" };
  }
  const densidad = Math.round((nacionalIter.valor / SUPERFICIE_NACIONAL_KM2) * 100) / 100;
  return {
    nivel: "nacional",
    valor: densidad,
    unidad: "hab/km²",
    naturaleza: "calculo_directo",
    fuenteEtiqueta: `${FUENTE_ETIQUETA_COMPENDIO} + INEGI (ITER, Censo 2020)`,
  };
}

// POBTOT estatal vía la pirámide de ITER (misma fila agregada, no se
// reintroduce una segunda fuente de población) ÷ superficie estatal
// oficial — calculo_directo, no depende de municipios consultados.
async function resolverDensidadEstatal(estadoCve: string): Promise<CeldaFontana> {
  const superficie = SUPERFICIE_ESTATAL_KM2[estadoCve];
  if (!superficie) {
    return { nivel: "estatal", motivo: "No hay superficie oficial registrada para este estado" };
  }
  const estadoNombreInverso = Object.entries(ESTADO_CVE_MAP).find(([, cve]) => cve === estadoCve)?.[0];
  if (!estadoNombreInverso) {
    return { nivel: "estatal", motivo: "No fue posible resolver el nombre del estado para consultar POBTOT" };
  }

  const celdas = await resolverIndicadorIter("F1-2", { nivel: "estatal", estado: estadoNombreInverso, nombre: estadoNombreInverso } as Territorio);
  const celdaEstatal = celdas.find((c) => c.nivel === "estatal");
  if (!celdaEstatal || !esValorDisponible(celdaEstatal)) {
    return { nivel: "estatal", motivo: "No fue posible resolver la población estatal (ITER) para calcular la densidad" };
  }

  const densidad = Math.round((celdaEstatal.valor / superficie) * 100) / 100;
  return {
    nivel: "estatal",
    valor: densidad,
    unidad: "hab/km²",
    naturaleza: "calculo_directo",
    fuenteEtiqueta: `${FUENTE_ETIQUETA_COMPENDIO} + INEGI (ITER, Censo 2020)`,
  };
}

async function resolverDensidadMunicipal(estadoCve: string, territorio: Territorio): Promise<CeldaFontana> {
  const municipioNombre = resolverNombreMunicipio(territorio);
  if (!municipioNombre) {
    return { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  }

  const catalogo = await readFromBodega<Record<string, string>>(`iter_2020/catalogo_municipios/${estadoCve}.json`);
  const municipioCve = catalogo?.[normalizeGeoName(municipioNombre)];
  if (!municipioCve) {
    return { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo INEGI` };
  }

  let superficie: SuperficieRecord | null;
  try {
    superficie = await resolverSuperficieMunicipal(estadoCve, municipioCve);
  } catch {
    return { nivel: "municipal", motivo: "Error al descargar/parsear el Compendio de INEGI para este municipio" };
  }
  if (!superficie) {
    return { nivel: "municipal", motivo: "INEGI no reportó superficie para este municipio en el Compendio 2010" };
  }

  const piramideCeldas = await resolverIndicadorIter("F1-2", territorio);
  const celdaMunicipal = piramideCeldas.find((c) => c.nivel === "municipal");
  if (!celdaMunicipal || !esValorDisponible(celdaMunicipal)) {
    return { nivel: "municipal", motivo: "No fue posible resolver la población municipal (ITER) para calcular la densidad" };
  }

  const densidad = Math.round((celdaMunicipal.valor / superficie.superficieKm2) * 100) / 100;
  return {
    nivel: "municipal",
    valor: densidad,
    unidad: "hab/km²",
    naturaleza: "calculo_directo",
    fuenteEtiqueta: `${FUENTE_ETIQUETA_COMPENDIO} + INEGI (ITER, Censo 2020)`,
  };
}
