// lib/fontana/ingesta/ensu.ts
// F3-4 (Percepción de inseguridad, ENSU) — INEGI, Encuesta Nacional de
// Seguridad Pública Urbana.
//
// Fuente: microdatos ENSU 2026-T2, descarga directa pública sin registro
// (inegi.org.mx/programas/ensu/?ps=microdatos#datos_abiertos) — la vía
// NADA/RNM investigada primero era el portal equivocado para esta
// encuesta de hogares (esa sí requiere flujo de acceso, esta no).
// Indicador (`BP1_1`, "Percepción de seguridad en la ciudad": 1=Seguro,
// 2=Inseguro, 9=No sabe/no responde) calculado por Fontana desde el
// cuestionario básico (`conjunto_de_datos_ensu_cb_0626.csv`), ponderado
// por `FAC_SEL` (factor de expansión por persona), excluyendo 9 — NO es
// descarga directa de un tabulado publicado (los tabulados básicos de
// ENSU están detrás de un portal sin descarga simple). Validado en vivo
// 2026-08-27 contra la Presentación Ejecutiva oficial de ENSU 2026-T2:
// 5/6 ciudades de control coinciden casi exactas (≤0.5pp) — ver notas del
// registry para el detalle completo, incluida la única no resuelta
// (Ciudad Nezahualcóyotl, ~2pp, gráfica fuente sin valor impreso en ese
// punto). Catálogo de las 90 áreas: lib/fontana/ensuCatalogo.ts.
//
// Nivel: SOLO municipal y distrital (áreas urbanas de interés, no
// estados/país completos) — nacional/estatal sin mecanismo de agregación
// real desde 90 áreas dispersas.
//
// Nivel Distrital (mecanismo real, no motivo genérico — decisión
// explícita de Raúl 2026-08-27: el insumo YA existe en
// distritos_municipios/{estado}.json, mismo mecanismo que
// contarMunicipiosEnDistrito en app/api/fontana/familia/[familiaId]/route.ts,
// construirlo aquí en vez de duplicar el gap que otros indicadores sí
// tienen por falta genuina de fuente):
//   1. Resolver los municipios que componen el distrito (misma bodega que
//      ECEG usa para "Ver municipios" de un distrito).
//   2. Si TODOS pertenecen a la misma área ENSU → valor del área + chip
//      "area_ensu" (con prorrateo si el área cruza estado).
//   3. Si cruzan más de un área, o mezclan municipios dentro y fuera de
//      alguna → MOTIVO_ENSU_CRUZA_AREAS, nunca un valor combinado.

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, getMunicipiosOptions } from "@/lib/geo/municipios";
import { buildEcegStoragePath, fetchEcegFromStorage } from "@/lib/sefix/ecegStorage";
import { extraerNumeroDistrito } from "@/lib/moddulo/distritoElectoral";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import { resolverAreaDeMunicipio, areaEsMultiMunicipio, resolverProrrateoEstado, type AreaEnsu } from "@/lib/fontana/ensuCatalogo";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";
import percepcionData from "@/data/fontana/ensu_percepcion_2026t2.json";
import { MOTIVO_ENSU_CRUZA_AREAS } from "@/lib/fontana/ingesta/types";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_ENSU = "INEGI (ENSU 2026-T2, cálculo propio validado contra Presentación Ejecutiva oficial)";

const PORCENTAJES = (percepcionData as { porcentajes: Record<string, number> }).porcentajes;

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

// Exportado para reutilizar en index.ts (resolverAgregacionPlural, F3-4
// plural) — evita duplicar la construcción de la celda del área.
export function celdaDesdeArea(nivel: CeldaFontana["nivel"], area: AreaEnsu, estadoCve: string): CeldaFontana {
  const valor = PORCENTAJES[area.cd];
  if (valor == null) {
    return { nivel, motivo: `ENSU no reportó percepción de inseguridad para el área "${area.nombre}"` };
  }
  const prorrateo = areaEsMultiMunicipio(area) ? (resolverProrrateoEstado(area.cd, estadoCve) ?? undefined) : undefined;
  return {
    nivel,
    valor,
    unidad: "% que percibe inseguridad en su ciudad",
    naturaleza: "estimacion_modelada",
    fuenteEtiqueta: FUENTE_ETIQUETA_ENSU,
    ...(areaEsMultiMunicipio(area) ? { areaEnsu: { nombre: area.nombre, numMunicipios: area.municipios.length, prorrateo } } : {}),
  };
}

async function resolverMunicipiosDelDistrito(estadoCve: string, tipoDistrito: "federal" | "local", numeroDistrito: string): Promise<string[] | null> {
  const nivelStorage = tipoDistrito === "federal" ? "distritos_municipios" : "distritos_locales_municipios";
  try {
    const path = buildEcegStoragePath(nivelStorage, estadoCve)!;
    const data = await fetchEcegFromStorage<{ composicion: Record<string, Record<string, number>> }>(path);
    const composicion = data.composicion[numeroDistrito];
    if (!composicion) return null;
    const municipioCves = Object.keys(composicion);
    // municipioCve aquí es numeración INE (misma bodega/origen que
    // getMunicipiosOptions) — join consistente dentro de la misma
    // familia, mismo criterio ya documentado como seguro para eceg.ts.
    const opciones = await getMunicipiosOptions(estadoCve);
    const porCve = new Map(opciones.map((o) => [o.cve, o.nombre]));
    return municipioCves.map((cve) => porCve.get(cve)).filter((n): n is string => !!n);
  } catch {
    return null;
  }
}

function resolverCeldaDistrital(estadoCve: string, nombresMunicipio: string[]): CeldaFontana {
  const areasEncontradas = nombresMunicipio.map((nombre) => resolverAreaDeMunicipio(estadoCve, nombre));
  if (areasEncontradas.some((a) => a === null)) {
    // Al menos un municipio del distrito no pertenece a ninguna de las 90
    // áreas — si TODOS son null, el distrito está simplemente fuera de
    // cobertura ENSU (motivo distinto, no es un "cruce"); si es una
    // mezcla, sí es cruce (dentro/fuera a la vez).
    if (areasEncontradas.every((a) => a === null)) {
      return { nivel: "distrital", motivo: "Ninguno de los municipios de este distrito está dentro de las 90 áreas urbanas de interés de la ENSU" };
    }
    return { nivel: "distrital", motivo: MOTIVO_ENSU_CRUZA_AREAS };
  }
  const cds = new Set(areasEncontradas.map((a) => a!.cd));
  if (cds.size > 1) {
    return { nivel: "distrital", motivo: MOTIVO_ENSU_CRUZA_AREAS };
  }
  return celdaDesdeArea("distrital", areasEncontradas[0]!, estadoCve);
}

export async function resolverPercepcionInseguridadEnsu(territorio: Territorio): Promise<CeldaFontana[]> {
  const nacional: CeldaFontana = { nivel: "nacional", motivo: "La ENSU no tiene cobertura nacional agregable — solo 90 áreas urbanas de interés, no todo el territorio" };
  const estatal: CeldaFontana = { nivel: "estatal", motivo: "La ENSU no tiene cobertura estatal completa — solo las áreas urbanas de interés dentro de cada estado" };

  let distrital: CeldaFontana;
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    const estadoCve = territorio.estado ? ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)] : undefined;
    const numeroDistrito = extraerNumeroDistrito(territorio.municipio ?? territorio.nombre, territorio.cve_distrito);
    const tipoDistrito = territorio.nivel === "distrito_federal" ? "federal" : "local";
    if (!estadoCve || !numeroDistrito) {
      distrital = { nivel: "distrital", motivo: "No se pudo determinar el estado o el número de distrito de este proyecto" };
    } else {
      const municipios = await resolverMunicipiosDelDistrito(estadoCve, tipoDistrito, numeroDistrito);
      distrital = !municipios || municipios.length === 0
        ? { nivel: "distrital", motivo: "No se pudo obtener la composición municipio↔distrito para este territorio" }
        : resolverCeldaDistrital(estadoCve, municipios);
    }
  } else {
    distrital = { nivel: "distrital", motivo: "Disponible solo cuando el proyecto es de nivel Distrital (Federal o Local)" };
  }

  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!territorio.estado || !municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un estado o municipio definido en su territorio" };
  } else {
    const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
    if (!estadoCve) {
      municipal = { nivel: "municipal", motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` };
    } else {
      const area = resolverAreaDeMunicipio(estadoCve, municipioNombre);
      municipal = area
        ? celdaDesdeArea("municipal", area, estadoCve)
        : { nivel: "municipal", motivo: "Este municipio no forma parte de ninguna de las 90 áreas urbanas de interés de la ENSU" };
    }
  }

  return [nacional, estatal, distrital, municipal];
}

// --- Agregación plural (2026-08-27, Gap B) ---
// Bulk resolver para "Ver municipios"/desglose plural — cada municipio
// recibe el % de SU PROPIA área (nunca un promedio entre áreas). La
// consistencia del conjunto completo (¿todos en la misma área o cruzan?)
// se resuelve aparte, en resolverAgregacionPlural (index.ts), reutilizando
// resolverAreaDeMunicipio directamente — ver comentario ahí.
export async function resolverMunicipiosEstadoEnsu(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const opciones = await getMunicipiosOptions(estadoCve);
  const filtradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;
  return filtradas.map(({ cve, nombre }): ElementoDeEstado => {
    const area = resolverAreaDeMunicipio(estadoCve, nombre);
    return {
      cve, nombre,
      celda: area
        ? celdaDesdeArea("municipal", area, estadoCve)
        : { nivel: "municipal", motivo: "Este municipio no forma parte de ninguna de las 90 áreas urbanas de interés de la ENSU" },
    };
  });
}
