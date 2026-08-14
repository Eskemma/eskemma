// lib/fontana/ingesta/enoeInformalidad.ts
// Adaptador de F2-9 (Tasa de Informalidad Laboral 1, TIL1) — INEGI,
// ENOE, vía Infolaboral. Sin fetch externo: los 32 valores ya viven
// precomputados en la bodega (fontana/bodega/enoe_til1/2026-08-10.json,
// subido por scripts/upload-fontana-enoe-til1.ts), mismo patrón que
// F2-17/IMCO.
//
// Fuente primaria: INEGI, ENOE — "10.9. Tasa de informalidad laboral
// (TIL 1)", indicador estratégico oficial (proporción de la población
// ocupada laboralmente vulnerable). Canal real: Infolaboral
// (inegi.org.mx/sistemas/Infoenoe), exportado manualmente, un archivo
// por entidad — verificado que NO existe una URL pública reproducible
// por fetch simple: el sistema es ASP.NET WebForms clásico
// (__VIEWSTATE/__EVENTVALIDATION, confirmado en el HTML), cualquier
// consulta real requiere simular una sesión de postback completa. Se
// intentó también un `pxq` de "tabulados interactivos" de una ronda de
// investigación anterior — resultó ser un tablero completamente
// distinto ("Simulador de trabajo voluntario"), no informalidad.
//
// Cada archivo original trae un solo valor (Primer trimestre de 2026,
// el más reciente al momento de la exportación) — sin serie histórica,
// consistente con el resto de Fontana (corte más reciente, no serie
// completa).
//
// naturaleza: dato_directo — INEGI publica la tasa ya calculada, sin
// coeficiente de variación ni error estándar acompañándola.
//
// Sin Nacional: ninguno de los 32 archivos trae valor país (agregar
// ponderando por PEA de cada estado añadiría una fuente de población
// nueva a verificar, fuera de alcance de este incremento). Sin
// municipal/distrital — Infolaboral no publica este indicador a ese
// nivel.
//
// Mantenimiento futuro: actualizar este indicador requiere repetir la
// navegación manual en Infolaboral (32 exportaciones, una por
// entidad) — no hay mecanismo automatizable, ver nota en el manifest
// de la bodega (fontana/bodega/enoe_til1/_manifest.json).

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import { readFromBodega } from "@/lib/fontana/bodegaStorage";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_ENOE_TIL1 = "INEGI (ENOE, Tasa de Informalidad Laboral 1 — Infolaboral)";

const RUTA_BODEGA = "enoe_til1/2026-08-10.json";

interface FilaTil1 {
  valor: number;
  entidadOrigen: string;
}

interface BodegaEnoeTil1 {
  porEstado: Record<string, FilaTil1>;
}

const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

function celdaDesdeFila(fila: FilaTil1 | undefined, motivoVacio: string): CeldaFontana {
  if (!fila) return { nivel: "estatal", motivo: motivoVacio };
  return {
    nivel: "estatal",
    valor: Math.round(fila.valor * 100) / 100,
    unidad: "%",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_ENOE_TIL1,
  };
}

export async function resolverInformalidadLaboral(territorio: Territorio): Promise<CeldaFontana[]> {
  const nacional: CeldaFontana = {
    nivel: "nacional",
    motivo: "Infolaboral no publica un valor nacional en esta exportación — sin mecanismo de agregación validado",
  };

  if (!territorio.estado) {
    return [nacional, { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" }];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    return [nacional, { nivel: "estatal", motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` }];
  }

  let datos: BodegaEnoeTil1 | null;
  try {
    datos = await readFromBodega<BodegaEnoeTil1>(RUTA_BODEGA);
  } catch {
    return [nacional, { nivel: "estatal", motivo: "Error de conexión con la bodega de Fontana (TIL1)" }];
  }
  if (!datos) {
    return [nacional, { nivel: "estatal", motivo: "TIL1 no disponible en la bodega de Fontana" }];
  }

  const estatal = celdaDesdeFila(datos.porEstado[estadoCve], "INEGI no reportó TIL1 para este territorio");
  return [nacional, estatal];
}

// Desglose "Ver estados" en proyectos nivel "nacional" — mismo patrón
// que el resto de Fontana. La bodega ya trae los 32 estados completos
// — sin llamada nueva.
export async function resolverEstadosInformalidadLaboral(): Promise<ElementoDeEstado[]> {
  const datos = await readFromBodega<BodegaEnoeTil1>(RUTA_BODEGA);
  if (!datos) return [];
  return Object.entries(datos.porEstado).map(([cve, fila]): ElementoDeEstado => ({
    cve,
    nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
    celda: celdaDesdeFila(fila, "INEGI no reportó TIL1 para este estado"),
  }));
}
