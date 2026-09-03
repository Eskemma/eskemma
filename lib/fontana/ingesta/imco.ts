// lib/fontana/ingesta/imco.ts
// Adaptador de F2-17 (Competitividad Estatal, IMCO) — único adaptador
// de Fontana sin fetch externo: los datos ya viven precomputados en la
// bodega (fontana/bodega/imco_ice/2025.json, subido por
// scripts/upload-fontana-imco-ice.ts).
//
// Fuente primaria: IMCO, Índice de Competitividad Estatal (ICE) 2025
// (imco.org.mx/indice-de-competitividad-estatal-2025/). Canal real de
// descarga: Alphacast (dataset id 46612), un tercero que republica el
// dato de IMCO — no la fuente institucional directa (IMCO regresó a
// exigir contacto/tablero cerrado para su propia herramienta
// interactiva; los PDFs de la página —Boletas, Anexo metodológico— son
// ilegibles, imagen/vector sin capa de texto, mismo bloqueo que los
// boletines de ENOE). La URL de Alphacast usada era una firma temporal
// (CloudFront, expiración codificada) que YA CADUCÓ — verificado en
// vivo: expiraba 2026-08-10 21:17:20 UTC, un intento posterior (21:33
// UTC) devolvió 403 AccessDenied real. Por eso el dato se procesó una
// sola vez y se guardó en la bodega — no hay URL viva que reintentar.
//
// Archivo real usado: "Posiciones generales del ICE.csv" (no el
// dataset de 48 indicadores componentes de Alphacast, que no trae el
// puntaje compuesto) — columnas Año, Entidad, Valor, Nivel de
// Competitividad, Ranking, Cambio de posición. Verificado completo:
// 32 entidades × 10 años (2016-2025), sin huecos ni duplicados.
//
// Nacional: el ICE es un ranking relativo entre entidades — no existe
// (ni tendría sentido calcular) un valor "nacional" para un índice de
// posición relativa. Sin municipal/distrital — el ICE es
// explícitamente estatal.
//
// naturaleza: dato_directo — IMCO publica el puntaje final ya
// calculado, sin coeficiente de variación ni error estándar
// acompañando el valor (mismo criterio que CONAPO/CONEVAL, distinto de
// ICMM que sí publica CV%).
//
// Mantenimiento futuro: la próxima edición del ICE requiere buscar el
// dataset de nuevo en Alphacast (o directamente en imco.org.mx si en
// algún momento vuelve a publicar descarga estructurada) — la URL de
// esta edición no es reutilizable, ver nota en el manifest de la
// bodega (fontana/bodega/imco_ice/_manifest.json).

import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import { readFromBodega } from "@/lib/fontana/bodegaStorage";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_IMCO_ICE = "IMCO (Índice de Competitividad Estatal 2025)";

const ANO_VIGENTE = "2025";

interface FilaIce {
  valor: number;
  nivelCompetitividad: string;
  ranking: number;
  cambioPosicion: number;
}

interface BodegaImcoIce {
  porEstado: Record<string, Record<string, FilaIce>>;
}

const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

function celdaDesdeFila(fila: FilaIce | undefined, motivoVacio: string): CeldaFontana {
  if (!fila) return { nivel: "estatal", motivo: motivoVacio };
  return {
    nivel: "estatal",
    valor: Math.round(fila.valor * 100) / 100,
    unidad: "puntos (escala 0-100)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_IMCO_ICE,
  };
}

export async function resolverCompetitividadEstatal(territorio: Territorio): Promise<CeldaFontana[]> {
  const nacional: CeldaFontana = {
    nivel: "nacional",
    motivo: "El ICE es un ranking relativo entre entidades — no aplica un valor nacional",
  };

  if (!territorio.estado) {
    const motivo = "El proyecto no tiene un estado definido en su territorio";
    return [nacional, { nivel: "estatal", motivo }];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, { nivel: "estatal", motivo }];
  }

  let datos: BodegaImcoIce | null;
  try {
    datos = await readFromBodega<BodegaImcoIce>("imco_ice/2025.json");
  } catch {
    const motivo = "Error de conexión con la bodega de Fontana (ICE)";
    return [nacional, { nivel: "estatal", motivo }];
  }
  if (!datos) {
    return [nacional, { nivel: "estatal", motivo: "ICE no disponible en la bodega de Fontana" }];
  }

  const estatal = celdaDesdeFila(
    datos.porEstado[estadoCve]?.[ANO_VIGENTE],
    "IMCO no reportó ICE para este territorio"
  );

  return [nacional, estatal];
}

// ==========================================
// SERIE TEMPORAL (T10, piloto 2026-09-01) — la bodega ya trae los 10 años
// (2016-2025) por estado; resolverCompetitividadEstatal solo lee ANO_VIGENTE.
// Esta función expone la serie completa de UN estado. El chequeo de
// proyecto plural multi-estado NO vive aquí (vive en la ruta
// app/api/fontana/serie-temporal, que tiene la sesión) — aquí siempre es
// un estado a la vez.
// ==========================================

export interface PuntoSerieIce {
  periodo: string; // año, ej. "2025"
  valor: number | null;
  ranking: number | null;
  nivelCompetitividad?: string;
}

export type SerieCompetitividadEstatal =
  | {
      ok: true;
      estadoCve: string;
      estadoNombre: string;
      alcance: "estatal";
      unidad: string;
      naturaleza: "dato_directo";
      fuenteEtiqueta: string;
      formato: "indice";
      puntos: PuntoSerieIce[];
    }
  | { ok: false; motivo: string };

export async function resolverSerieCompetitividadEstatal(
  territorio: Territorio
): Promise<SerieCompetitividadEstatal> {
  if (!territorio.estado) {
    return { ok: false, motivo: "El proyecto no tiene un estado definido en su territorio" };
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    return { ok: false, motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` };
  }

  let datos: BodegaImcoIce | null;
  try {
    datos = await readFromBodega<BodegaImcoIce>("imco_ice/2025.json");
  } catch {
    return { ok: false, motivo: "Error de conexión con la bodega de Fontana (ICE)" };
  }
  if (!datos) {
    return { ok: false, motivo: "ICE no disponible en la bodega de Fontana" };
  }

  const porAno = datos.porEstado[estadoCve];
  if (!porAno || Object.keys(porAno).length === 0) {
    return { ok: false, motivo: "IMCO no reportó ICE para este estado" };
  }

  const puntos: PuntoSerieIce[] = Object.keys(porAno)
    .sort()
    .map((ano) => {
      const fila = porAno[ano];
      return {
        periodo: ano,
        valor: typeof fila.valor === "number" ? Math.round(fila.valor * 100) / 100 : null,
        ranking: typeof fila.ranking === "number" ? fila.ranking : null,
        nivelCompetitividad: fila.nivelCompetitividad,
      };
    });

  return {
    ok: true,
    estadoCve,
    estadoNombre: CVE_ESTADO_NOMBRE[estadoCve] ?? territorio.estado,
    alcance: "estatal",
    unidad: "puntos (escala 0-100)",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_IMCO_ICE,
    formato: "indice",
    puntos,
  };
}

// Desglose "Ver estados" en proyectos nivel "nacional" — mismo patrón
// que el resto de Fontana. La bodega ya trae los 32 estados completos
// — sin llamada nueva.
export async function resolverEstadosImcoIce(): Promise<ElementoDeEstado[]> {
  const datos = await readFromBodega<BodegaImcoIce>("imco_ice/2025.json");
  if (!datos) return [];
  return Object.entries(datos.porEstado).map(([cve, porAno]): ElementoDeEstado => ({
    cve,
    nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
    celda: celdaDesdeFila(porAno[ANO_VIGENTE], "IMCO no reportó ICE para este estado"),
  }));
}
