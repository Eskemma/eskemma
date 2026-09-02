// lib/fontana/ingesta/zap.ts
// F3-8 (Zonas de Atención Prioritaria) — DOF, Anexo A del decreto vigente.
//
// Decisión de Raúl (2026-08-26): construir SOLO con Anexo A (ZAP rural,
// 1,575 municipios, ya a nivel municipal directo). Anexo B (ZAP urbana,
// 49,491 AGEBs) queda FUERA de alcance estructural de Fontana — AGEB
// nunca es nivel de trabajo en ningún indicador (decisión ya cerrada,
// lib/fontana/tablaColumnas.ts:22-24), no por limitación de esta ronda.
// No hay cruce de claves ni agregación AGEB→municipio que construir: el
// dato de Anexo A ya viene municipal.
//
// Fuente verificada en vivo 2026-08-26: DOF, "DECRETO por el que se
// formula la Declaratoria de las Zonas de Atención Prioritaria para el
// año 2026" (https://dof.gob.mx/nota_detalle.php?codigo=5773718&fecha=21/11/2025,
// 21-nov-2025). La página HTML del DOF pesa ~23.8MB (domina Anexo B, fuera
// de alcance) — se extrajo Anexo A una sola vez (1,575 filas, columnas
// CLAVE ENTIDAD/CLAVE MUNICIPIO/NOMBRE ENTIDAD/NOMBRE MUNICIPIO,
// confirmadas 32/32 entidades) y se guardó como catálogo estático en
// data/fontana/zap_rural_2026.json — NUNCA se reparsea la página del DOF
// en cada request (23.8MB, cambia solo 1 vez al año vía nuevo decreto).
// Actualizar ese archivo (y ULTIMA_VERIFICACION_ANEXO_A abajo) cuando se
// publique la declaratoria del año siguiente.
//
// Join: por NOMBRE (claveCanonicaMunicipio), nunca por el CVE_MUN oficial
// que el propio Anexo A incluye — mismo protocolo por defecto del
// proyecto (docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md),
// aplicado aquí aunque el CVE del DOF sea presumiblemente compatible con
// CONEVAL/CONAPO (misma familia "oficial INEGI"): no se verificó esa
// compatibilidad con muestra real en esta ronda, así que se usa el
// mecanismo que ya es seguro por defecto.
//
// Representación categórica: el contrato de celda (ValorIndicadorFontana)
// solo acepta `valor: number` — se usa 1 (Sí) / 0 (No) con `unidad`
// descriptivo, mismo mecanismo que la tabla ya usa para cualquier conteo
// (celda.valor + celda.unidad, FontanaComparativeTable.tsx:256-261). Sin
// componente de UI dedicado a boolean — evaluar si vale la pena uno en una
// ronda futura si el patrón se repite.

import zapData from "@/data/fontana/zap_rural_2026.json";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, claveCanonicaMunicipio, getMunicipiosOptions } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_ZAP = "DOF (Declaratoria de Zonas de Atención Prioritaria 2026, Anexo A)";
const ULTIMA_VERIFICACION_ANEXO_A = "2026-08-26";

interface MunicipioZap {
  cve_ent: string;
  cve_mun: string;
  nombre_ent: string;
  nombre_mun: string;
}

const DATA = zapData as { _totalMunicipios: number; municipios: MunicipioZap[] };

// Índice {estadoCve: Set<claveCanonicaMunicipio>} — construido una sola
// vez en memoria (1,575 filas, trivial), nunca por request.
let indicePorEstado: Map<string, Set<string>> | null = null;
function obtenerIndice(): Map<string, Set<string>> {
  if (indicePorEstado) return indicePorEstado;
  indicePorEstado = new Map();
  for (const m of DATA.municipios) {
    if (!indicePorEstado.has(m.cve_ent)) indicePorEstado.set(m.cve_ent, new Set());
    indicePorEstado.get(m.cve_ent)!.add(claveCanonicaMunicipio(m.cve_ent, m.nombre_mun));
  }
  return indicePorEstado;
}

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

export async function resolverZonaAtencionPrioritaria(territorio: Territorio): Promise<CeldaFontana[]> {
  const nacional: CeldaFontana = {
    nivel: "nacional",
    valor: DATA._totalMunicipios,
    unidad: `municipios en Zona de Atención Prioritaria rural (${ULTIMA_VERIFICACION_ANEXO_A.slice(0, 4)})`,
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_ZAP,
  };

  if (!territorio.estado) {
    const motivo = "El proyecto no tiene un estado definido en su territorio";
    return [nacional, { nivel: "estatal", motivo }, { nivel: "distrital", motivo: "DOF no publica Zonas de Atención Prioritaria por distrito electoral" }, { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" }];
  }

  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, { nivel: "estatal", motivo }, { nivel: "distrital", motivo: "DOF no publica Zonas de Atención Prioritaria por distrito electoral" }, { nivel: "municipal", motivo }];
  }

  const indice = obtenerIndice();
  const municipiosEstado = indice.get(estadoCve) ?? new Set<string>();
  const estatal: CeldaFontana = {
    nivel: "estatal",
    valor: municipiosEstado.size,
    unidad: `municipios en Zona de Atención Prioritaria rural (${ULTIMA_VERIFICACION_ANEXO_A.slice(0, 4)})`,
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_ZAP,
  };

  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const esZap = municipiosEstado.has(claveCanonicaMunicipio(estadoCve, municipioNombre));
    municipal = {
      nivel: "municipal",
      valor: esZap ? 1 : 0,
      unidad: esZap ? "Sí — Zona de Atención Prioritaria rural" : "No está en la Declaratoria ZAP rural vigente",
      naturaleza: "dato_directo",
      fuenteEtiqueta: FUENTE_ETIQUETA_ZAP,
    };
  }

  return [
    nacional,
    estatal,
    { nivel: "distrital", motivo: "DOF no publica Zonas de Atención Prioritaria por distrito electoral" },
    municipal,
  ];
}

// --- Agregación plural (2026-08-27, Gap B) ---
// Bulk resolver para el mecanismo genérico de conjuntos plurales
// (resolverAgregacionPlural, index.ts). `agregacionPlural.tipo` de F3-8
// se reclasifica a "aditivo" (decisión de Raúl, 2026-08-27): el valor
// combinado ES un conteo válido ("N de M municipios en ZAP rural"), sin
// promediar el Sí/No individual — cada celda ya trae `valor: 1|0`, mismo
// mecanismo de `celda.valor` que calcularAditivo ya suma para cualquier
// otro conteo. El texto Sí/No de `unidad` se conserva por celda (para el
// desglose por municipio, tal como pidió Raúl); la celda AGREGADA
// resultante de `calcularAditivo` recibe su propio `unidad` ("de N
// municipios en ZAP rural") sobrescrito en index.ts, no aquí — este
// resolver solo entrega el detalle por municipio.
export async function resolverMunicipiosEstadoZap(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const indice = obtenerIndice();
  const municipiosEstado = indice.get(estadoCve) ?? new Set<string>();
  const opciones = await getMunicipiosOptions(estadoCve);
  const filtradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;
  return filtradas.map(({ cve, nombre }): ElementoDeEstado => {
    const esZap = municipiosEstado.has(claveCanonicaMunicipio(estadoCve, nombre));
    return {
      cve, nombre,
      celda: {
        nivel: "municipal",
        valor: esZap ? 1 : 0,
        unidad: esZap ? "Sí — Zona de Atención Prioritaria rural" : "No está en la Declaratoria ZAP rural vigente",
        naturaleza: "dato_directo",
        fuenteEtiqueta: FUENTE_ETIQUETA_ZAP,
      },
    };
  });
}

// --- Detalle "Modo B" (2026-08-31) — lista de municipios ZAP del estado ---
// Reusa resolverMunicipiosEstadoZap() y filtra valor === 1 (los designados).
// Mismo shape { items, total, offset, hasMore } que denue/gacp para el
// endpoint .../detalle y la tool consultar_detalle_indicador del agente.
export const PAGE_SIZE_ZAP = 25;

export interface DetalleZapResultado {
  items: { nombre: string }[];
  total: number;
  offset: number;
  hasMore: boolean;
}

export async function resolverDetalleZapMunicipios(
  estado: string,
  offset = 0,
  limit = PAGE_SIZE_ZAP
): Promise<DetalleZapResultado> {
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(estado)];
  if (!estadoCve) return { items: [], total: 0, offset, hasMore: false };
  const todos = await resolverMunicipiosEstadoZap(estadoCve);
  const designados = todos
    .filter((e) => "valor" in e.celda && e.celda.valor === 1)
    .map((e) => e.nombre)
    .sort((a, b) => a.localeCompare(b, "es"));
  const pagina = designados.slice(offset, offset + limit);
  return {
    items: pagina.map((nombre) => ({ nombre })),
    total: designados.length,
    offset,
    hasMore: offset + limit < designados.length,
  };
}
