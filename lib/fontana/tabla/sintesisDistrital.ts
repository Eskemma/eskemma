// lib/fontana/tabla/sintesisDistrital.ts
//
// Fallback de granularidad para la integración PESTEL↔Fontana (26-09-13):
// cuando el territorio PROPIO de un proyecto es un distrito (federal o
// local) y el indicador no tiene mecanismo distrital, pero SÍ resuelve a
// nivel municipal, este módulo resuelve el valor de cada municipio que
// compone ESE distrito (no una selección plural del usuario — la
// composición geográfica real del distrito, vía la misma bodega ECEG que
// ya usa `contarMunicipiosEnDistrito`) para que la integración con PESTEL
// pueda construir un bloque de síntesis narrativa en vez de una tabla 1x1
// por municipio.
//
// Reutiliza, sin duplicar: `resolverIndicadorFontana` (puro, ya usado en
// todo Fontana), `getMunicipiosOptions` (cve→nombre, ya usado en
// construirCeldasTabla.ts), y el mismo storage de composición distrito→
// municipios que `contarMunicipiosEnDistrito` (solo contaba; aquí también
// se usa para nombrar cada municipio).

import { resolverIndicadorFontana } from "@/lib/fontana/ingesta";
import { buildEcegStoragePath, fetchEcegFromStorage } from "@/lib/sefix/ecegStorage";
import { getMunicipiosOptions } from "@/lib/geo/municipios";
import { extraerNumeroDistrito } from "@/lib/moddulo/distritoElectoral";
import { resolverEstadoCve } from "@/lib/geo/estados";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export interface ValorMunicipioDelDistrito {
  nombre: string;
  celda: CeldaFontana;
}

/**
 * Resuelve el valor de `indicadorId` para cada municipio que compone el
 * distrito propio de `territorio` (nivel distrito_federal/distrito_local).
 * Devuelve `null` si el territorio no es un distrito o no se pudo
 * determinar su composición municipal.
 */
export async function resolverValoresMunicipiosDelDistrito(
  indicadorId: string,
  territorio: Territorio,
  opts?: { timeoutMs?: number }
): Promise<ValorMunicipioDelDistrito[] | null> {
  if (territorio.nivel !== "distrito_federal" && territorio.nivel !== "distrito_local") return null;
  if (!territorio.estado) return null;

  const estadoCve = resolverEstadoCve(territorio.estado);
  if (!estadoCve) return null;

  const numeroDistrito = extraerNumeroDistrito(territorio.municipio ?? territorio.nombre, territorio.cve_distrito);
  if (!numeroDistrito) return null;

  const nivelStorage = territorio.nivel === "distrito_federal" ? "distritos_municipios" : "distritos_locales_municipios";
  let composicion: Record<string, number> | undefined;
  try {
    const path = buildEcegStoragePath(nivelStorage, estadoCve)!;
    const data = await fetchEcegFromStorage<{ composicion: Record<string, Record<string, number>> }>(path);
    composicion = data.composicion[numeroDistrito];
  } catch {
    return null;
  }
  if (!composicion) return null;

  const municipiosCves = Object.keys(composicion);
  if (municipiosCves.length === 0) return null;

  let opciones: { cve: string; nombre: string }[];
  try {
    opciones = await getMunicipiosOptions(estadoCve);
  } catch {
    return null;
  }
  const cveANombre = new Map(opciones.map((o) => [o.cve, o.nombre]));

  // Lotes de 8 (26-09-13) — un distrito real puede tener 40-70 municipios
  // (Yucatán/Oaxaca) y las fuentes externas (SESNSP/CONAPO) degradan bajo
  // demasiada concurrencia simultánea (verificado en vivo: 48 llamadas en
  // paralelo devolvían "Error de conexión" para TODAS, incluida PROGRESO,
  // que en solitario responde con dato real — no es un límite de la
  // fuente por municipio, es volumen de conexiones concurrentes).
  // `timeoutMs` (26-09-13, corrección post-verificación): un distrito
  // real puede tener 40-70 municipios (Yucatán/Oaxaca) resueltos en
  // lotes SECUENCIALES de 8 (arriba) — sin un límite por llamada, un
  // solo municipio lento en un lote basta para colgar TODO el resto de
  // lotes detrás de él, ya que son secuenciales por diseño (evitar el
  // límite de concurrencia externo). Mismo guard que ya usa
  // `construirCeldasTabla.ts` (`Promise.race` + `Symbol` de timeout).
  const timeoutMs = opts?.timeoutMs ?? 0;
  const TIMEOUT = Symbol("timeout");
  const resolverConTimeout = async (id: string, t: Territorio) => {
    if (timeoutMs <= 0) return resolverIndicadorFontana(id, t);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const r = await Promise.race([
        resolverIndicadorFontana(id, t),
        new Promise<typeof TIMEOUT>((res) => {
          timer = setTimeout(() => res(TIMEOUT), timeoutMs);
        }),
      ]);
      if (r === TIMEOUT) {
        console.warn(`[fontana/sintesisDistrital] timeout (${timeoutMs}ms) resolviendo ${id} en ${t.municipio}`);
        return [];
      }
      return r;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const TAMANO_LOTE = 8;
  const resultados: (ValorMunicipioDelDistrito | null)[] = [];
  for (let i = 0; i < municipiosCves.length; i += TAMANO_LOTE) {
    const lote = municipiosCves.slice(i, i + TAMANO_LOTE);
    const resueltosLote = await Promise.all(
      lote.map(async (cve) => {
        const nombre = cveANombre.get(cve) ?? cve;
        const territorioMunicipal: Territorio = { ...territorio, nivel: "municipal", municipio: nombre };
        const celdas = await resolverConTimeout(indicadorId, territorioMunicipal);
        const celdaMunicipal = celdas.find((c) => c.nivel === "municipal");
        if (!celdaMunicipal) return null;
        return { nombre, celda: celdaMunicipal };
      })
    );
    resultados.push(...resueltosLote);
  }

  return resultados.filter((r): r is ValorMunicipioDelDistrito => r !== null);
}
