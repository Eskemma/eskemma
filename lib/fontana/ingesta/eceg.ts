// lib/fontana/ingesta/eceg.ts
// Adaptador de Familia 1 (Sociodemográficos) sobre la bodega ECEG 2020 que
// ya vive en Sefix — no es un pipeline nuevo, no vuelve a descargar ni
// parsear nada. Solo mapea IDs de indicador de Fontana a claves ECEG ya
// curadas y resuelve el territorio del proyecto (nombres) a los códigos
// INEGI que la bodega usa como llave.
//
// Alcance: 12 de los 19 indicadores de Familia 1 — los que sí viven en
// ECEG. F1-2, F1-11, F1-16, F1-17, F1-18 se resuelven en otros
// adaptadores (lib/fontana/ingesta/{iter,compendio,banxico,conapo}.ts,
// cierre 2026-07-31) y se enrutan desde lib/fontana/ingesta/index.ts, no
// desde este archivo. F1-10 y F1-12 siguen diferidos porque sus claves
// ECEG (VPH_C_SERV, P12YM_SOLT/CASA/SEPA) nunca se extrajeron del ECEG
// crudo — no están en CURATED_COLUMNS de scripts/eceg-data-pipeline.ts
// ni en ningún JSON ya subido a Storage (verificado en vivo, no asumido).

import { ECEG_INDICATOR_MAP } from "@/lib/sefix/ecegConstants";
import { buildEcegStoragePath, fetchEcegFromStorage } from "@/lib/sefix/ecegStorage";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { resolveMunicipioCve, normalizeGeoName } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { NivelFontanaF1, ValorIndicadorFontana, CeldaFontana } from "@/lib/fontana/ingesta/types";
import { esValorDisponible } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_ECEG = "INEGI (Censo 2020, vía ECEG)";

// Los 12 indicadores de Familia 1 con dato real disponible vía ECEG.
// F1-2, F1-11, F1-16, F1-17, F1-18 (otros adaptadores) y F1-10, F1-12
// (aún bloqueados) están deliberadamente ausentes de este mapa.
export const FONTANA_F1_ECEG_MAP: Record<string, string> = {
  "F1-1": "POBTOT",
  "F1-3": "P3YM_HLI",
  "F1-4": "HOGJEF_F",
  "F1-5": "GRAPROES",
  "F1-6": "PNACOE",
  "F1-7": "POB65_MAS",
  "F1-8": "VPH_PISOTI",
  "F1-9": "PRO_OCUP_C",
  "F1-13": "P15YM_SE",
  "F1-14": "P18YM_PB",
  "F1-15": "PCON_DISC",
  "F1-19": "P3HLINHE",
};


const MOTIVO_CONECTOR_PENDIENTE =
  "Conector pendiente — disponible en el siguiente incremento de Fontana";

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

// Regresa siempre 2 celdas (estatal + municipal) — nunca una celda vacía
// sin motivo, mismo criterio ya fijado en la arquitectura de Fontana
// (Paso 3, §4, patrón de estado de consulta).
export async function resolverIndicadorF1(
  indicadorId: string,
  territorio: Territorio
): Promise<CeldaFontana[]> {
  const ecegKey = FONTANA_F1_ECEG_MAP[indicadorId];
  if (!ecegKey) {
    return [
      { nivel: "estatal", motivo: MOTIVO_CONECTOR_PENDIENTE },
      { nivel: "municipal", motivo: MOTIVO_CONECTOR_PENDIENTE },
    ];
  }

  if (!territorio.estado) {
    return [
      { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" },
      { nivel: "municipal", motivo: "El proyecto no tiene un estado definido en su territorio" },
    ];
  }

  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [
      { nivel: "estatal", motivo },
      { nivel: "municipal", motivo },
    ];
  }

  const indicator = ECEG_INDICATOR_MAP[ecegKey];
  const unidad = indicator?.unit;
  const celdas: CeldaFontana[] = [];

  celdas.push(await resolverEstatal(ecegKey, estadoCve, unidad));
  celdas.push(await resolverMunicipal(ecegKey, estadoCve, resolverNombreMunicipio(territorio), unidad));

  return celdas;
}

// territorio.municipio guarda un nombre limpio SOLO cuando nivel es
// "municipal". Para distrito_federal/distrito_local, el wizard de
// territorio (por diseño, ya usado por Sefix y PESTEL — ver
// lib/moddulo/territorioLabel.ts) guarda una descripción larga tipo
// "Distrito Electoral Federal V con cabecera en Puerto Vallarta, ..." —
// hay que extraer la ciudad cabecera antes de buscarla en el catálogo
// INEGI de municipios, o la búsqueda nunca encuentra coincidencia.
function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

async function resolverEstatal(
  ecegKey: string,
  estadoCve: string,
  unidad?: string
): Promise<CeldaFontana> {
  try {
    const path = buildEcegStoragePath("nacional")!;
    const data = await fetchEcegFromStorage(path);
    const val = data[estadoCve]?.[ecegKey];
    if (typeof val !== "number") {
      return { nivel: "estatal", motivo: "INEGI no reportó valor para este territorio" };
    }
    return { nivel: "estatal", valor: val, unidad, naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_ECEG };
  } catch {
    return { nivel: "estatal", motivo: "Error de conexión con la bodega de datos" };
  }
}

async function resolverMunicipal(
  ecegKey: string,
  estadoCve: string,
  municipioNombre: string | undefined,
  unidad?: string
): Promise<CeldaFontana> {
  if (!municipioNombre) {
    return { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  }

  let municipioCve: string | null;
  try {
    municipioCve = await resolveMunicipioCve(estadoCve, municipioNombre);
  } catch {
    return { nivel: "municipal", motivo: "Error de conexión con el catálogo geográfico" };
  }
  if (!municipioCve) {
    return { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo INEGI` };
  }

  try {
    const path = buildEcegStoragePath("municipios", estadoCve)!;
    const data = await fetchEcegFromStorage(path);
    const featureKey = `${estadoCve}${municipioCve}`;
    const val = data[featureKey]?.[ecegKey];
    if (typeof val !== "number") {
      return { nivel: "municipal", motivo: "INEGI no reportó valor para este territorio" };
    }
    return { nivel: "municipal", valor: val, unidad, naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_ECEG };
  } catch {
    return { nivel: "municipal", motivo: "Error de conexión con la bodega de datos" };
  }
}
