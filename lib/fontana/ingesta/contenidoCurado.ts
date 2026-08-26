// lib/fontana/ingesta/contenidoCurado.ts
// Adaptador de F5-3 (Historia del territorio) y F5-4 (Personajes
// célebres) — Familia 5, Grupo C. A diferencia del resto de Fontana, no
// es una fuente que se consulta en vivo: es contenido curado por el
// propio equipo de Eskemma (Raúl como curador), mismo mecanismo ya
// aprobado para INDICATOR_REGISTRY.json — archivo JSON versionado
// localmente en `data/fontana/contenido_curado/historia_personajes.json`
// (gitignored, igual que el registry), subido a Firebase Storage vía
// `scripts/upload-contenido-curado.ts`, leído en runtime con
// readFromBodega() (mismo patrón que el resto de Fontana).
//
// Contenido real cargado 2026-08-23 (Guadalajara/Zapopan, formato
// aprobado con Raúl como curador — campo `legado` por personaje incluido
// desde esta primera entrega, fuentes institucionales/prensa/académicas,
// deliberadamente sin Wikipedia).
//
// Join por NOMBRE (estado + municipio), no por cve_mun crudo — mismo
// criterio que el resto de Fontana desde el Incidente 1/2 (Ronda 9-10,
// 2026-08-23): el campo `cve_mun` de cada entrada es solo documentación
// para el curador (cve oficial INEGI, para que humanamente identifique
// el municipio sin ambigüedad al escribir la entrada) — la resolución
// real usa estado+municipio (derivados de `territorio`, ver
// parsearTerritorio) vía claveCanonicaMunicipio(), consistente con
// coneval.ts/conapoMarginacion.ts/bienestar.ts/icmm.ts/anvcc.ts.

import { readFromBodega } from "@/lib/fontana/bodegaStorage";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, claveCanonicaMunicipio } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_CONTENIDO_CURADO = "Eskemma (contenido curado)";

// reseña/legado opcionales — un curador puede agregar un personaje con
// nombre confirmado antes de terminar de investigar el resto (2026-08-23,
// requisito de "contenido curado nunca bloqueante" a nivel de campo).
export interface PersonajeCelebreCurado {
  nombre: string;
  reseña?: string;
  legado?: string;
}

// Shape real del JSON en disco (data/fontana/contenido_curado/historia_personajes.json)
// tal como lo entrega el curador — snake_case, `territorio` combinado
// ("Municipio, Estado"), personajes como objetos. Se parsea a
// EntradaContenidoCurado (abajo) al cargar, sin alterar el archivo
// fuente.
//
// `nivel` (2026-08-24, Modo C) — discriminador explícito entre entrada
// Municipal (`cve_mun`+`territorio`, shape original) y Estatal
// (`cve_ent`+`estado`, sin municipio). Default `"municipal"` si el campo
// no existe — las entradas ya cargadas (Guadalajara/Zapopan) no lo
// tienen y deben seguir interpretándose exactamente igual, sin
// re-curarlas. Los campos de un nivel nunca se leen para el otro (una
// entrada "estatal" con `cve_mun` presente por error lo ignora).
interface EntradaContenidoCuradoCruda {
  nivel?: "estatal" | "municipal";
  cve_mun?: string;
  territorio?: string;
  cve_ent?: string;
  estado?: string;
  historia: string;
  personajes_celebres: PersonajeCelebreCurado[];
  atractivos_turisticos?: string;
  problematicas_ecologicas?: string;
  // F5-1/F5-2/F5-5 (2026-08-24) — F5-1 y F5-5 van directo a curado/vacío
  // (sin Opción A: geo/shapes no tiene campo narrable, SIC no tiene
  // campo de descripción en ninguna de sus 3 tablas, solo listado de
  // nombres). F5-2 SÍ tiene Opción A real (CONAGUA) — este campo es solo
  // el fallback cuando CONAGUA no tiene estación climatológica para el
  // municipio, nunca sobreescribe un dato real de CONAGUA.
  factores_geograficos?: string;
  factores_climaticos?: string;
  tradiciones_fiestas?: string;
  fuentes_consultadas: string[];
}

export interface EntradaContenidoCurado {
  // Documentación para el curador — nunca se usa para resolver el join.
  cveMun?: string;
  cveEnt?: string;
  estado: string;
  municipio?: string;
  historia: string;
  personajesCelebres: PersonajeCelebreCurado[];
  atractivosTuristicos: string;
  problematicasEcologicas: string;
  factoresGeograficos: string;
  factoresClimaticos: string;
  tradicionesFiestas: string;
  fuentesConsultadas: string[];
}

// `territorio` llega como "Municipio, Estado" (ej. "Guadalajara,
// Jalisco") — se separa por la ÚLTIMA coma para tolerar municipios cuyo
// propio nombre incluya una coma (ninguno hoy, pero evita asumir "sin
// comas" como regla permanente).
function parsearTerritorio(territorio: string): { municipio: string; estado: string } | null {
  const idx = territorio.lastIndexOf(",");
  if (idx === -1) return null;
  return {
    municipio: territorio.slice(0, idx).trim(),
    estado: territorio.slice(idx + 1).trim(),
  };
}

interface CacheContenidoCurado {
  porMunicipioPorNombre: Map<string, EntradaContenidoCurado>;
  porEstadoPorNombre: Map<string, EntradaContenidoCurado>;
  ts: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: CacheContenidoCurado | null = null;
let enVuelo: Promise<CacheContenidoCurado> | null = null;

async function cargarContenidoCurado(): Promise<CacheContenidoCurado> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const crudas = (await readFromBodega<EntradaContenidoCuradoCruda[]>("contenido_curado/historia_personajes.json")) ?? [];
    const porMunicipioPorNombre = new Map<string, EntradaContenidoCurado>();
    const porEstadoPorNombre = new Map<string, EntradaContenidoCurado>();
    for (const cruda of crudas) {
      const nivel = cruda.nivel ?? "municipal";
      // Contenido curado nunca bloqueante (2026-08-23) — un municipio/
      // estado puede tener historia sin personajes, o viceversa; ninguno
      // de los campos es obligatorio para que el resto se muestre.
      // Defaults explícitos en vez de dejar `undefined` viajar más allá
      // de este punto.
      const base = {
        historia: cruda.historia ?? "",
        personajesCelebres: cruda.personajes_celebres ?? [],
        atractivosTuristicos: cruda.atractivos_turisticos ?? "",
        problematicasEcologicas: cruda.problematicas_ecologicas ?? "",
        factoresGeograficos: cruda.factores_geograficos ?? "",
        factoresClimaticos: cruda.factores_climaticos ?? "",
        tradicionesFiestas: cruda.tradiciones_fiestas ?? "",
        fuentesConsultadas: cruda.fuentes_consultadas ?? [],
      };

      if (nivel === "estatal") {
        if (!cruda.estado) continue;
        const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(cruda.estado)];
        if (!estadoCve) continue;
        const entrada: EntradaContenidoCurado = { ...base, cveEnt: cruda.cve_ent, estado: cruda.estado };
        porEstadoPorNombre.set(estadoCve, entrada);
        continue;
      }

      // Municipal (default) — campos `cve_mun`/`territorio`, nunca los
      // de nivel Estatal.
      if (!cruda.territorio) continue;
      const partes = parsearTerritorio(cruda.territorio);
      if (!partes) continue;
      const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(partes.estado)];
      if (!estadoCve) continue;
      const entrada: EntradaContenidoCurado = { ...base, cveMun: cruda.cve_mun, estado: partes.estado, municipio: partes.municipio };
      porMunicipioPorNombre.set(`${estadoCve}|${claveCanonicaMunicipio(estadoCve, partes.municipio)}`, entrada);
    }
    const resultado: CacheContenidoCurado = { porMunicipioPorNombre, porEstadoPorNombre, ts: Date.now() };
    cache = resultado;
    return resultado;
  })();

  try {
    return await enVuelo;
  } finally {
    enVuelo = null;
  }
}

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

// Nivel real de la entrada a resolver — Estatal cuando el territorio del
// proyecto en sí es de nivel estatal (sin municipio), Municipal en
// cualquier otro caso (municipal/distrital, mismo criterio ya usado por
// resolverNombreMunicipio para distrito_federal/distrito_local).
async function resolverEntrada(territorio: Territorio): Promise<{ entrada: EntradaContenidoCurado | null; nivel: "estatal" | "municipal"; motivo: string | null }> {
  if (!territorio.estado) return { entrada: null, nivel: "municipal", motivo: "El proyecto no tiene un estado definido en su territorio" };
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) return { entrada: null, nivel: "municipal", motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` };

  if (territorio.nivel === "estatal") {
    const { porEstadoPorNombre } = await cargarContenidoCurado();
    const entrada = porEstadoPorNombre.get(estadoCve);
    if (!entrada) {
      return { entrada: null, nivel: "estatal", motivo: "Fontana aún no tiene contenido curado para este estado" };
    }
    return { entrada, nivel: "estatal", motivo: null };
  }

  const municipioNombre = resolverNombreMunicipio(territorio);
  if (!municipioNombre) return { entrada: null, nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };

  const { porMunicipioPorNombre } = await cargarContenidoCurado();
  const entrada = porMunicipioPorNombre.get(`${estadoCve}|${claveCanonicaMunicipio(estadoCve, municipioNombre)}`);
  if (!entrada) {
    // Estado vacío explícito de curación editorial — nunca "fuente
    // caída" ni "no reconocido en el catálogo" (esos son motivos de
    // fuentes externas; este es un proceso editorial interno).
    return { entrada: null, nivel: "municipal", motivo: "Fontana aún no tiene contenido curado para este municipio" };
  }
  return { entrada, nivel: "municipal", motivo: null };
}

export async function resolverHistoriaTerritorio(territorio: Territorio): Promise<CeldaFontana[]> {
  const { entrada, nivel, motivo } = await resolverEntrada(territorio);
  if (!entrada) return [{ nivel, motivo: motivo! }];
  // Contenido curado nunca bloqueante (2026-08-23) — el municipio puede
  // tener la entrada creada (ej. para F5-4/personajes) sin que
  // `historia` esté redactada todavía. Nunca reportar valor:1 (que
  // implicaría "sí hay historia") cuando el campo está vacío.
  if (!entrada.historia) {
    return [{ nivel, motivo: nivel === "estatal" ? "Fontana aún no tiene la reseña histórica curada para este estado" : "Fontana aún no tiene la reseña histórica curada para este municipio" }];
  }
  return [{
    nivel,
    valor: 1, // Texto largo — no es un valor numérico comparable; ver `distribucion`/consumidor de texto en la UI (F5-3/F5-4, no siguen el patrón numérico del resto de Fontana).
    unidad: "texto",
    naturaleza: "dato_directo",
    fuenteEtiqueta: entrada.fuentesConsultadas.length > 0 ? entrada.fuentesConsultadas.join("; ") : FUENTE_ETIQUETA_CONTENIDO_CURADO,
  }];
}

export async function resolverPersonajesCelebres(territorio: Territorio): Promise<CeldaFontana[]> {
  const { entrada, nivel, motivo } = await resolverEntrada(territorio);
  if (!entrada) return [{ nivel, motivo: motivo! }];
  // Mismo criterio que resolverHistoriaTerritorio — un conteo de 0 se
  // leería como "confirmado: cero personajes célebres", que no es lo
  // mismo que "todavía no curado". Se distingue explícitamente.
  if (entrada.personajesCelebres.length === 0) {
    return [{ nivel, motivo: nivel === "estatal" ? "Fontana aún no tiene personajes célebres curados para este estado" : "Fontana aún no tiene personajes célebres curados para este municipio" }];
  }
  return [{
    nivel,
    valor: entrada.personajesCelebres.length,
    unidad: "personajes",
    naturaleza: "dato_directo",
    fuenteEtiqueta: entrada.fuentesConsultadas.length > 0 ? entrada.fuentesConsultadas.join("; ") : FUENTE_ETIQUETA_CONTENIDO_CURADO,
  }];
}

// F5-9 (Atractivos turísticos) / F5-10 (Problemáticas ecológicas) —
// contenido curado puro (2026-08-24), mismo mecanismo que F5-3/F5-4:
// IIEG (fuente original de F5-9) sigue caído y ANVCC no tiene ninguna
// columna real que represente "problemáticas ecológicas" (Ronda 9/
// investigación de agosto) — en vez de quedar diferidos indefinidamente,
// se editorializan igual que historia/personajes.
export async function resolverAtractivosTuristicos(territorio: Territorio): Promise<CeldaFontana[]> {
  const { entrada, nivel, motivo } = await resolverEntrada(territorio);
  if (!entrada) return [{ nivel, motivo: motivo! }];
  if (!entrada.atractivosTuristicos) {
    return [{ nivel, motivo: nivel === "estatal" ? "Fontana aún no tiene atractivos turísticos curados para este estado" : "Fontana aún no tiene atractivos turísticos curados para este municipio" }];
  }
  return [{
    nivel,
    valor: 1, // Texto largo — mismo criterio que resolverHistoriaTerritorio.
    unidad: "texto",
    naturaleza: "dato_directo",
    fuenteEtiqueta: entrada.fuentesConsultadas.length > 0 ? entrada.fuentesConsultadas.join("; ") : FUENTE_ETIQUETA_CONTENIDO_CURADO,
  }];
}

export async function resolverProblematicasEcologicas(territorio: Territorio): Promise<CeldaFontana[]> {
  const { entrada, nivel, motivo } = await resolverEntrada(territorio);
  if (!entrada) return [{ nivel, motivo: motivo! }];
  if (!entrada.problematicasEcologicas) {
    return [{ nivel, motivo: nivel === "estatal" ? "Fontana aún no tiene problemáticas ecológicas curadas para este estado" : "Fontana aún no tiene problemáticas ecológicas curadas para este municipio" }];
  }
  return [{
    nivel,
    valor: 1, // Texto largo — mismo criterio que resolverHistoriaTerritorio.
    unidad: "texto",
    naturaleza: "dato_directo",
    fuenteEtiqueta: entrada.fuentesConsultadas.length > 0 ? entrada.fuentesConsultadas.join("; ") : FUENTE_ETIQUETA_CONTENIDO_CURADO,
  }];
}

// F5-1 (Factores geográficos) — directo a curado/vacío, sin Opción A:
// app/api/geo/shapes/route.ts (fuente original) solo trae CVE_ENT/
// CVE_MUN/NOMGEO, sin ningún campo narrable (confirmado 2026-08-24) —
// no hay fuente real que intentar antes del curado.
export async function resolverFactoresGeograficos(territorio: Territorio): Promise<CeldaFontana[]> {
  const { entrada, nivel, motivo } = await resolverEntrada(territorio);
  if (!entrada) return [{ nivel, motivo: motivo! }];
  if (!entrada.factoresGeograficos) {
    return [{ nivel, motivo: nivel === "estatal" ? "Fontana aún no tiene factores geográficos curados para este estado" : "Fontana aún no tiene factores geográficos curados para este municipio" }];
  }
  return [{
    nivel,
    valor: 1, // Texto largo — mismo criterio que resolverHistoriaTerritorio.
    unidad: "texto",
    naturaleza: "dato_directo",
    fuenteEtiqueta: entrada.fuentesConsultadas.length > 0 ? entrada.fuentesConsultadas.join("; ") : FUENTE_ETIQUETA_CONTENIDO_CURADO,
  }];
}

// F5-5 (Tradiciones y fiestas) — directo a curado/vacío, sin Opción A:
// mismo criterio que F5-1, decisión de Raúl (2026-08-24) — SIC no tiene
// campo de descripción en ninguna de sus 3 tablas (solo nombre+
// ubicación+contacto), así que su conteo numérico (sic.ts,
// resolverTradicionesFiestas) NO se usa como fuente para F5-5 — el
// indicador es contenido curado puro, igual que F5-1.
export async function resolverTradicionesCuradas(territorio: Territorio): Promise<CeldaFontana[]> {
  const { entrada, nivel, motivo } = await resolverEntrada(territorio);
  if (!entrada) return [{ nivel, motivo: motivo! }];
  if (!entrada.tradicionesFiestas) {
    return [{ nivel, motivo: nivel === "estatal" ? "Fontana aún no tiene tradiciones y fiestas curadas para este estado" : "Fontana aún no tiene tradiciones y fiestas curadas para este municipio" }];
  }
  return [{
    nivel,
    valor: 1, // Texto largo — mismo criterio que resolverHistoriaTerritorio.
    unidad: "texto",
    naturaleza: "dato_directo",
    fuenteEtiqueta: entrada.fuentesConsultadas.length > 0 ? entrada.fuentesConsultadas.join("; ") : FUENTE_ETIQUETA_CONTENIDO_CURADO,
  }];
}

// F5-2 (Factores climáticos) — fallback de curado SOLO cuando CONAGUA
// (conagua.ts, Opción A real) no tiene estación climatológica para el
// municipio. Este resolver nunca se llama si CONAGUA ya respondió con
// dato real — la prioridad de Opción A sobre curado vive en el
// dispatcher (index.ts), no aquí.
export async function resolverClimaCurado(territorio: Territorio): Promise<CeldaFontana[]> {
  const { entrada, nivel, motivo } = await resolverEntrada(territorio);
  if (!entrada) return [{ nivel, motivo: motivo! }];
  if (!entrada.factoresClimaticos) {
    return [{ nivel, motivo: nivel === "estatal" ? "Fontana aún no tiene factores climáticos curados para este estado" : "Fontana aún no tiene factores climáticos curados para este municipio" }];
  }
  return [{
    nivel,
    valor: 1, // Texto largo — mismo criterio que resolverHistoriaTerritorio.
    unidad: "texto",
    naturaleza: "dato_directo",
    fuenteEtiqueta: entrada.fuentesConsultadas.length > 0 ? entrada.fuentesConsultadas.join("; ") : FUENTE_ETIQUETA_CONTENIDO_CURADO,
  }];
}

// Acceso directo al texto completo (historia, lista de personajes) para
// consumidores de UI que necesiten el contenido real, no solo la celda
// numérica de la tabla comparativa — mismo criterio que otros
// indicadores "de texto" no fungibles con el resto de Fontana.
export async function resolverEntradaCompleta(territorio: Territorio): Promise<EntradaContenidoCurado | null> {
  const { entrada } = await resolverEntrada(territorio);
  return entrada;
}
