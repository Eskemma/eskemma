// lib/fontana/agente/canvasBuilder.ts
// Construye FontanaCanvasItem a partir de la respuesta de
// GET /api/fontana/familia/[familiaId] (mismo cómputo de celdas que la
// tabla comparativa) — el agente "Fontana" (T10) nunca recalcula datos.
// Funciones puras: reciben la respuesta ya parseada + metadatos del turno.

import type { CeldaTablaFontana, IndicadorFilaFontana, NivelTablaFontana } from "@/lib/fontana/tablaColumnas";
import { NOMBRE_NIVEL_TABLA } from "@/lib/fontana/tablaColumnas";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { FamiliaFontanaId } from "@/types/fontana.types";
import type { NaturalezaDato } from "@/lib/fontana/indicatorRegistry";
import type {
  FontanaCanvasDesglose,
  FontanaCanvasDistribucion,
  FontanaCanvasGrafica,
  FontanaCanvasResumen,
  FontanaCanvasSerieTemporal,
  FontanaCanvasTabla,
} from "@/types/fontana.types";

// Forma (parcial) de la respuesta del endpoint de familia para F1/F2/F3/F5.
export interface RespuestaFamilia {
  familiaId: string;
  columnas: NivelTablaFontana[];
  indicadores: IndicadorFilaFontana[];
}

interface MetaTurno {
  mensajeId: string;
  familiaId: FamiliaFontanaId;
  familiaEtiqueta: string; // "Sociodemográficos", etc.
  territorioLabel: string;
}

const nowIso = () => new Date().toISOString();
const nuevoId = () => `cv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Firestore Admin rechaza valores `undefined` (lib/firebase-admin.ts no
// activa ignoreUndefinedProperties, por decisión: es un cambio de
// comportamiento global). Los builders de abajo dejan claves `undefined`
// en las celdas sin unidad/naturaleza/motivo; esto las elimina (recursivo,
// conserva `null`, arrays y objetos planos) antes de persistir. Mismo
// criterio que el resto del repo (ver comentario en
// app/api/moddulo/chat/[phaseId]/route.ts).
export function limpiarUndefined<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map((v) => limpiarUndefined(v)) as unknown as T;
  }
  if (valor && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v === undefined) continue;
      salida[k] = limpiarUndefined(v);
    }
    return salida as T;
  }
  return valor;
}

/** number → string es-MX; null/undefined → null. */
function fmt(valor: number | undefined, unidad?: string): string | null {
  if (valor === undefined || valor === null) return null;
  const n = Number.isInteger(valor) ? valor.toLocaleString("es-MX") : valor.toLocaleString("es-MX", { maximumFractionDigits: 3 });
  return unidad ? `${n} ${unidad}` : n;
}

export function construirCanvasResumen(
  resp: RespuestaFamilia,
  nivel: NivelTablaFontana,
  meta: MetaTurno
): FontanaCanvasResumen {
  return limpiarUndefined<FontanaCanvasResumen>({
    id: nuevoId(),
    tipo: "resumen",
    titulo: `Resumen — ${meta.familiaEtiqueta} en ${meta.territorioLabel} (${NOMBRE_NIVEL_TABLA[nivel]})`,
    familiaId: meta.familiaId,
    creadoEn: nowIso(),
    mensajeId: meta.mensajeId,
    nivel,
    filas: resp.indicadores.map((ind) => {
      const celda = ind.celdas.find((c) => c.nivel === nivel);
      return {
        indicadorId: ind.id,
        nombre: ind.nombre,
        valor: fmt(celda?.valor, celda?.unidad),
        unidad: celda?.unidad,
        naturaleza: celda?.naturaleza,
        motivo: celda?.valor === undefined ? celda?.motivo : undefined,
        fuenteEtiqueta: celda?.fuenteEtiqueta ?? ind.fuenteEtiqueta,
      };
    }),
  });
}

export function construirCanvasGrafica(
  resp: RespuestaFamilia,
  indicador: IndicadorFilaFontana,
  meta: MetaTurno
): FontanaCanvasGrafica {
  const celdaConValor = indicador.celdas.find((c) => c.valor !== undefined);
  const unidad = celdaConValor?.unidad;
  const fuenteEtiqueta = celdaConValor?.fuenteEtiqueta ?? indicador.fuenteEtiqueta;
  return limpiarUndefined<FontanaCanvasGrafica>({
    id: nuevoId(),
    tipo: "grafica",
    titulo: indicador.nombre,
    familiaId: meta.familiaId,
    creadoEn: nowIso(),
    mensajeId: meta.mensajeId,
    indicadorId: indicador.id,
    indicadorNombre: indicador.nombre,
    unidad,
    fuenteEtiqueta,
    barras: resp.columnas.map((nivel) => {
      const celda = indicador.celdas.find((c) => c.nivel === nivel);
      return {
        nivel,
        etiquetaNivel: NOMBRE_NIVEL_TABLA[nivel],
        valor: celda?.valor ?? null,
        naturaleza: celda?.naturaleza,
        motivo: celda?.valor === undefined ? celda?.motivo : undefined,
      };
    }),
  });
}

export function construirCanvasTabla(resp: RespuestaFamilia, meta: MetaTurno): FontanaCanvasTabla {
  return limpiarUndefined<FontanaCanvasTabla>({
    id: nuevoId(),
    tipo: "tabla",
    titulo: `Tabla comparativa — ${meta.familiaEtiqueta} en ${meta.territorioLabel}`,
    familiaId: meta.familiaId,
    creadoEn: nowIso(),
    mensajeId: meta.mensajeId,
    columnas: resp.columnas,
    indicadores: resp.indicadores,
  });
}

// ==========================================
// DISTRIBUCIÓN — desglose de categorías dentro de un nivel (T10, 2026-08-31)
// Solo F1-2 / F1-11 / F1-12 / F2-12. Las claves crudas del resolver se
// traducen a etiquetas legibles AQUÍ, nunca se le pide al modelo.
// ==========================================

export const INDICADORES_CON_DISTRIBUCION = new Set(["F1-2", "F1-11", "F1-12", "F2-12"]);

const NOTA_F1_2 =
  "Este histograma muestra población total por grupo de edad. No está separado por sexo — la fuente de datos que usa Fontana en esta versión no distingue esa columna, así que no es una pirámide de edades tradicional (hombres/mujeres reflejados).";

function etiquetaEdad(clave: string): string {
  if (clave === "P_85YMAS") return "85+ años";
  const m = clave.match(/^P_(\d+)A(\d+)$/);
  return m ? `${m[1]}-${m[2]} años` : clave;
}

const ETIQUETA_F1_12: Record<string, string> = {
  P12YM_SOLT: "Soltera(o)",
  P12YM_CASA: "Casada(o) o unión libre",
  P12YM_SEPA: "Separada(o), divorciada(o) o viuda(o)",
};
const ETIQUETA_F1_11: Record<string, string> = { urbano: "Urbano", rural: "Rural" };
const DECIL_ROMANO_A_NUM: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
};

interface DistribConfig {
  ejeTipo: "categorico" | "escala_ordinal";
  formato: "conteo" | "moneda" | "porcentaje";
  nota?: string;
  etiqueta: (clave: string) => string;
}

const CONFIG_DISTRIBUCION: Record<string, DistribConfig> = {
  "F1-2": { ejeTipo: "categorico", formato: "conteo", nota: NOTA_F1_2, etiqueta: etiquetaEdad },
  "F1-11": { ejeTipo: "categorico", formato: "conteo", etiqueta: (k) => ETIQUETA_F1_11[k] ?? k },
  "F1-12": { ejeTipo: "categorico", formato: "conteo", etiqueta: (k) => ETIQUETA_F1_12[k] ?? k },
  "F2-12": {
    ejeTipo: "escala_ordinal",
    formato: "moneda",
    etiqueta: (k) => {
      const n = DECIL_ROMANO_A_NUM[k];
      if (!n) return k;
      const sufijo = n === 1 ? " (más bajo)" : n === 10 ? " (más alto)" : "";
      return `Decil ${n}${sufijo}`;
    },
  },
};

export function construirCanvasDistribucion(
  indicadorId: string,
  indicadorNombre: string,
  nivel: NivelTablaFontana,
  distribucionCruda: Record<string, number>,
  fuenteEtiqueta: string | undefined,
  meta: MetaTurno
): FontanaCanvasDistribucion {
  const cfg = CONFIG_DISTRIBUCION[indicadorId];
  const categorias = Object.entries(distribucionCruda).map(([clave, valor]) => ({
    etiqueta: cfg.etiqueta(clave),
    valor,
  }));
  return limpiarUndefined<FontanaCanvasDistribucion>({
    id: nuevoId(),
    tipo: "distribucion",
    titulo: `${indicadorNombre} — ${meta.territorioLabel} (${NOMBRE_NIVEL_TABLA[nivel]})`,
    familiaId: meta.familiaId,
    creadoEn: nowIso(),
    mensajeId: meta.mensajeId,
    indicadorId,
    indicadorNombre,
    nivel,
    ejeTipo: cfg.ejeTipo,
    formato: cfg.formato,
    nota: cfg.nota,
    fuenteEtiqueta,
    categorias,
  });
}

// Sustituye a "grafica" cuando el indicador es no_agregable en sesión
// plural (C3): en vez de un número combinado inventado, una tabla
// unidad→valor desde agregacionPlural.desglosePorUnidad.
export function construirCanvasDesglose(
  indicador: IndicadorFilaFontana,
  celdaProyecto: CeldaTablaFontana,
  motivoNoAgregable: string,
  meta: MetaTurno
): FontanaCanvasDesglose {
  const desglose = celdaProyecto.agregacionPlural?.desglosePorUnidad ?? [];
  const filaDeCelda = (celda: CeldaFontana) =>
    "valor" in celda
      ? { valor: celda.valor as number, naturaleza: celda.naturaleza, motivo: undefined }
      : { valor: null, naturaleza: undefined, motivo: celda.motivo };
  return limpiarUndefined<FontanaCanvasDesglose>({
    id: nuevoId(),
    tipo: "desglose",
    titulo: `${indicador.nombre} — desglose por unidad`,
    familiaId: meta.familiaId,
    creadoEn: nowIso(),
    mensajeId: meta.mensajeId,
    indicadorId: indicador.id,
    indicadorNombre: indicador.nombre,
    motivoNoAgregable,
    fuenteEtiqueta: celdaProyecto.fuenteEtiqueta ?? indicador.fuenteEtiqueta,
    filas: desglose.map((u) => ({ unidad: u.nombre, ...filaDeCelda(u.celda) })),
  });
}

// ==========================================
// SERIE TEMPORAL (T10, 1ª ola 2026-09-01) — evolución de un indicador en el
// tiempo para UN territorio. Indicadores con serie: ver
// lib/fontana/series/seriesDisponibles.ts. Los datos ya vienen resueltos
// de GET /api/fontana/serie-temporal; esta función solo arma el item.
// ==========================================

interface SerieCanvasInput {
  unidad?: string;
  naturaleza?: NaturalezaDato;
  fuenteEtiqueta: string;
  formato: "conteo" | "moneda" | "porcentaje" | "indice" | "coeficiente" | "puntaje";
  nivel: NivelTablaFontana; // nivel geográfico real de la serie
  puntos: {
    periodo: string;
    valor: number | null;
    ranking?: number | null;
    nivelCompetitividad?: string;
    nota?: string;
  }[];
}

export function construirCanvasSerieTemporal(
  indicadorId: string,
  indicadorNombre: string,
  serie: SerieCanvasInput,
  territorioLabel: string,
  origen: { esTerritorioExterno: boolean; esTerritorioDelProyecto?: boolean },
  meta: MetaTurno
): FontanaCanvasSerieTemporal {
  const periodoInicio = serie.puntos[0]?.periodo ?? "";
  const periodoFin = serie.puntos[serie.puntos.length - 1]?.periodo ?? "";
  return limpiarUndefined<FontanaCanvasSerieTemporal>({
    id: nuevoId(),
    tipo: "serie_temporal",
    titulo: `${indicadorNombre} — ${territorioLabel} (${periodoInicio}-${periodoFin})`,
    familiaId: meta.familiaId,
    creadoEn: nowIso(),
    mensajeId: meta.mensajeId,
    indicadorId,
    indicadorNombre,
    unidad: serie.unidad,
    formato: serie.formato,
    nivel: serie.nivel,
    naturaleza: serie.naturaleza,
    fuenteEtiqueta: serie.fuenteEtiqueta,
    territorioLabel,
    esTerritorioExterno: origen.esTerritorioExterno,
    esTerritorioDelProyecto: origen.esTerritorioDelProyecto,
    periodoInicio,
    periodoFin,
    puntos: serie.puntos.map((p) => ({
      periodo: p.periodo,
      valor: p.valor,
      ranking: p.ranking,
      nivelCompetitividad: p.nivelCompetitividad,
      nota: p.nota,
    })),
  });
}
