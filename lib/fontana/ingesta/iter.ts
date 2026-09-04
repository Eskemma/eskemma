// lib/fontana/ingesta/iter.ts
// Adaptador de F1-2 (pirámide de edades) y F1-11 (% urbana/rural) sobre la
// bodega ITER 2020 precomputada por scripts/fontana-iter-pipeline.ts.
// Mismo contrato que lib/fontana/ingesta/eceg.ts — resuelve territorio del
// proyecto (nombres) a los códigos INEGI que la bodega usa como llave.
//
// Mecanismo de parseo/derivación ya verificado en vivo en
// lib/dev/fontanaIterSandbox.ts: la pirámide es la fila ya agregada por
// INEGI (dato_directo); urbano/rural es una suma de localidades reales
// agrupadas por TAMLOC >= 5 (calculo_directo) — ver comentarios de
// scripts/fontana-iter-pipeline.ts para el detalle de la agregación.
//
// Resolución de municipio: usa el catálogo propio de ITER
// (fontana/bodega/iter_2020/catalogo_municipios/{estadoCve}.json,
// construido por el pipeline desde NOM_MUN del propio censo), NO
// resolveMunicipioCve de lib/geo/municipios.ts. Verificado en vivo
// (2026-07-31): ese catálogo geo (topojson de INE, usado también por
// ECEG) asigna una numeración de CVE_MUN que diverge de la oficial de
// INEGI en 1,550 de ~2,469 municipios (63%) — ej. Nuevo León: geo dice
// CVE "040" = Monterrey, pero en ITER (fuente oficial) "040" es Parás
// y "039" es Monterrey. Cruzar ambos catálogos produciría valores
// sistemáticamente incorrectos, así que este adaptador nunca combina el
// CVE de un catálogo con datos indexados por el CVE del otro.

import { readFromBodega } from "@/lib/fontana/bodegaStorage";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, claveCanonicaMunicipio } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import { sumarConteo } from "@/lib/fontana/ingesta/nacionalAgregado";
import type { Territorio } from "@/types/shared.types";
import type { NivelFontanaF1, ValorIndicadorFontana, CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_ITER = "INEGI (ITER, Censo 2020)";

const QUINQUENAL_GROUPS = [
  "P_0A4", "P_5A9", "P_10A14", "P_15A19", "P_20A24", "P_25A29",
  "P_30A34", "P_35A39", "P_40A44", "P_45A49", "P_50A54", "P_55A59",
  "P_60A64", "P_65A69", "P_70A74", "P_75A79", "P_80A84", "P_85YMAS",
] as const;

// Desglose por sexo del mismo grupo (ITER 2020: P_<grupo>_F / _M). El
// pipeline los guarda junto a los totales; hasta que la bodega se re-suba
// con estas columnas, `rec[...]` es undefined → 0 (pirámide de un lado).
function distribucionSexoDesde(
  lee: (grupoSexo: string) => number
): Record<string, { hombres: number; mujeres: number }> {
  const out: Record<string, { hombres: number; mujeres: number }> = {};
  for (const g of QUINQUENAL_GROUPS) {
    out[g] = { hombres: lee(`${g}_M`), mujeres: lee(`${g}_F`) };
  }
  return out;
}

interface PiramideRecord {
  POBTOT: number;
  [grupo: string]: number;
}

interface UrbanoRuralRecord {
  urbano: number;
  rural: number;
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

// Resuelve el CVE_MUN oficial (según el propio ITER, no el catálogo geo
// de INE) para un nombre de municipio dentro de un estado — o null si no
// se reconoce o hay error de red, sin distinguir (el llamador construye
// el motivo específico).
async function resolverMunicipioCveIter(estadoCve: string, municipioNombre: string): Promise<string | null> {
  const catalogo = await readFromBodega<Record<string, string>>(`iter_2020/catalogo_municipios/${estadoCve}.json`);
  if (!catalogo) return null;
  // Desde 2026-09-03 el catálogo se KEYEA en el pipeline con la MISMA
  // `claveCanonicaMunicipio()` que se usa aquí (y con lectura UTF-8 del
  // CSV) — antes divergían: normalize local + lectura latin1 →
  // nombres acentuados nunca calzaban. El `?? normalizeGeoName` queda
  // como red por si se consulta un catálogo viejo aún no re-subido.
  const claveConAlias = claveCanonicaMunicipio(estadoCve, municipioNombre);
  return catalogo[claveConAlias] ?? catalogo[normalizeGeoName(municipioNombre)] ?? null;
}

export async function resolverIndicadorIter(
  indicadorId: "F1-2" | "F1-11",
  territorio: Territorio
): Promise<CeldaFontana[]> {
  const nacional = await resolverNacionalIter(indicadorId);

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

  const celdas = indicadorId === "F1-2"
    ? await resolverPiramide(estadoCve, territorio)
    : await resolverUrbanoRural(estadoCve, territorio);
  return [nacional, ...celdas];
}

// Nacional — ni ITER expone una fila agregada de país (32 archivos por
// estado, verificado en vivo) — Fontana suma los 32 registros ya en
// Storage (mismos archivos *_estatal.json que ya lee resolverPiramide/
// resolverUrbanoRural, sin nueva descarga). estimacion_agregada.
export async function resolverNacionalIter(indicadorId: "F1-2" | "F1-11"): Promise<CeldaFontana> {
  try {
    if (indicadorId === "F1-2") {
      const estatal = await readFromBodega<Record<string, PiramideRecord>>("iter_2020/piramide/estatal.json");
      if (!estatal) return { nivel: "nacional", motivo: "Error de conexión con la bodega de datos" };
      const distribucion: Record<string, number> = {};
      for (const g of QUINQUENAL_GROUPS) distribucion[g] = sumarConteo(estatal, g);
      return {
        nivel: "nacional",
        valor: sumarConteo(estatal, "POBTOT"),
        distribucion,
        distribucionSexo: distribucionSexoDesde((gs) => sumarConteo(estatal, gs)),
        unidad: "habitantes",
        naturaleza: "estimacion_agregada",
        fuenteEtiqueta: FUENTE_ETIQUETA_ITER,
      };
    }

    const estatal = await readFromBodega<Record<string, UrbanoRuralRecord>>("iter_2020/urbano_rural/estatal.json");
    if (!estatal) return { nivel: "nacional", motivo: "Error de conexión con la bodega de datos" };
    const registros = Object.values(estatal);
    const urbano = registros.reduce((acc, r) => acc + r.urbano, 0);
    const rural = registros.reduce((acc, r) => acc + r.rural, 0);
    const total = urbano + rural;
    if (total === 0) return { nivel: "nacional", motivo: "INEGI no reportó clasificación urbano/rural" };
    return {
      nivel: "nacional",
      valor: Math.round((urbano / total) * 10000) / 100,
      distribucion: { urbano, rural },
      unidad: "% urbano",
      naturaleza: "estimacion_agregada",
      fuenteEtiqueta: FUENTE_ETIQUETA_ITER,
    };
  } catch {
    return { nivel: "nacional", motivo: "Error de conexión con la bodega de datos" };
  }
}

async function resolverPiramide(estadoCve: string, territorio: Territorio): Promise<CeldaFontana[]> {
  const celdas: CeldaFontana[] = [];

  try {
    const estatal = await readFromBodega<Record<string, PiramideRecord>>("iter_2020/piramide/estatal.json");
    const rec = estatal?.[estadoCve];
    celdas.push(rec ? toPiramideCelda("estatal", rec) : { nivel: "estatal", motivo: "INEGI no reportó pirámide para este territorio" });
  } catch {
    celdas.push({ nivel: "estatal", motivo: "Error de conexión con la bodega de datos" });
  }

  celdas.push(await resolverPiramideMunicipal(estadoCve, territorio));
  return celdas;
}

async function resolverPiramideMunicipal(estadoCve: string, territorio: Territorio): Promise<CeldaFontana> {
  const municipioNombre = resolverNombreMunicipio(territorio);
  if (!municipioNombre) {
    return { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  }

  let municipioCve: string | null;
  try {
    municipioCve = await resolverMunicipioCveIter(estadoCve, municipioNombre);
  } catch {
    return { nivel: "municipal", motivo: "Error de conexión con el catálogo geográfico" };
  }
  if (!municipioCve) {
    return { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo INEGI` };
  }

  try {
    const data = await readFromBodega<Record<string, PiramideRecord>>(`iter_2020/piramide/municipios/${estadoCve}.json`);
    const rec = data?.[`${estadoCve}${municipioCve}`];
    if (!rec) return { nivel: "municipal", motivo: "INEGI no reportó pirámide para este territorio" };
    return toPiramideCelda("municipal", rec);
  } catch {
    return { nivel: "municipal", motivo: "Error de conexión con la bodega de datos" };
  }
}

function toPiramideCelda(nivel: NivelFontanaF1, rec: PiramideRecord): ValorIndicadorFontana {
  const distribucion: Record<string, number> = {};
  for (const g of QUINQUENAL_GROUPS) distribucion[g] = rec[g] ?? 0;
  return {
    nivel,
    valor: rec.POBTOT,
    distribucion,
    distribucionSexo: distribucionSexoDesde((gs) => rec[gs] ?? 0),
    unidad: "habitantes",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_ITER,
  };
}

async function resolverUrbanoRural(estadoCve: string, territorio: Territorio): Promise<CeldaFontana[]> {
  const celdas: CeldaFontana[] = [];

  try {
    const estatal = await readFromBodega<Record<string, UrbanoRuralRecord>>("iter_2020/urbano_rural/estatal.json");
    const rec = estatal?.[estadoCve];
    celdas.push(rec ? toUrbanoRuralCelda("estatal", rec) : { nivel: "estatal", motivo: "INEGI no reportó clasificación urbano/rural para este territorio" });
  } catch {
    celdas.push({ nivel: "estatal", motivo: "Error de conexión con la bodega de datos" });
  }

  celdas.push(await resolverUrbanoRuralMunicipal(estadoCve, territorio));
  return celdas;
}

async function resolverUrbanoRuralMunicipal(estadoCve: string, territorio: Territorio): Promise<CeldaFontana> {
  const municipioNombre = resolverNombreMunicipio(territorio);
  if (!municipioNombre) {
    return { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  }

  let municipioCve: string | null;
  try {
    municipioCve = await resolverMunicipioCveIter(estadoCve, municipioNombre);
  } catch {
    return { nivel: "municipal", motivo: "Error de conexión con el catálogo geográfico" };
  }
  if (!municipioCve) {
    return { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo INEGI` };
  }

  try {
    const data = await readFromBodega<Record<string, UrbanoRuralRecord>>(`iter_2020/urbano_rural/municipios/${estadoCve}.json`);
    const rec = data?.[`${estadoCve}${municipioCve}`];
    if (!rec) return { nivel: "municipal", motivo: "INEGI no reportó clasificación urbano/rural para este territorio" };
    return toUrbanoRuralCelda("municipal", rec);
  } catch {
    return { nivel: "municipal", motivo: "Error de conexión con la bodega de datos" };
  }
}

function toUrbanoRuralCelda(nivel: NivelFontanaF1, rec: UrbanoRuralRecord): ValorIndicadorFontana {
  const total = rec.urbano + rec.rural;
  const pctUrbano = total > 0 ? Math.round((rec.urbano / total) * 10000) / 100 : 0;
  return {
    nivel,
    valor: pctUrbano,
    distribucion: { urbano: rec.urbano, rural: rec.rural },
    unidad: "% urbano",
    naturaleza: "calculo_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_ITER,
  };
}