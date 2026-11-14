// lib/pestel/informesSync.ts
// Lógica PURA de persistencia de los informes de E7 (sin firebase, sin red,
// sin localStorage: el llamador inyecta los datos). Antes de 26-10-03 las
// ediciones de un informe vivían solo en localStorage y el servidor solo
// guardaba la generación cruda, que la UI nunca leía.
//
// ALCANCE — qué es y qué NO es esto:
//   · Se conserva la generación original (`contenidoTexto`) junto con la
//     ÚLTIMA edición del usuario (`contenidoEditado`).
//   · NO es un historial de versiones: cada guardado sobrescribe la edición
//     anterior. El versionado completo es del principio 7 (Persistencia) y
//     se resuelve con lib/moddulo/changelog.ts en el Grupo 2 de la auditoría
//     de principios. No confundir esta solución parcial con aquella.

import type { ReportFormat } from "@/lib/pestel/reportPrompts";
import { buildScorecard } from "@/lib/pestel/matrizUtils";
import {
  DIMENSION_META,
  type DimensionAnalysis,
  type DimensionCode,
  type InformeGenerado,
  type PestlAnalysisV2,
  type PestlDimensionConfig,
} from "@/types/pestel.types";

// ─────────────────────────────────────────────────────────────
// Mapeo formato de la UI ↔ formato guardado (única definición)
// ─────────────────────────────────────────────────────────────

export const FORMATO_POR_REPORT_FORMAT: Record<
  ReportFormat,
  InformeGenerado["formato"]
> = {
  executive: "ejecutivo",
  technical: "tecnico",
  foda: "foda_lista",
  scenarios: "escenarios",
  insights_por_tipo: "insights_por_tipo",
};

export const REPORT_FORMAT_POR_FORMATO = Object.fromEntries(
  Object.entries(FORMATO_POR_REPORT_FORMAT).map(([rf, f]) => [f, rf])
) as Record<InformeGenerado["formato"], ReportFormat>;

export const REPORT_FORMATS = Object.keys(
  FORMATO_POR_REPORT_FORMAT
) as ReportFormat[];

/**
 * Marca que el servidor agrega AL FINAL del stream de generate-report cuando el informe se
 * generó pero NO se pudo guardar (el stream ya envió sus headers, así que no hay otra vía).
 * Es una sola cadena, con caracteres de control que el modelo no produce.
 */
export const MARCA_INFORME_NO_GUARDADO = "\n\u001EINFORME_NO_GUARDADO\u001E";

/** Separa el texto del informe de la marca de "no guardado" (si viene). */
export function extraerEstadoGuardado(acumulado: string): { texto: string; guardado: boolean } {
  const i = acumulado.indexOf(MARCA_INFORME_NO_GUARDADO);
  if (i === -1) return { texto: acumulado, guardado: true };
  return { texto: acumulado.slice(0, i), guardado: false };
}

/**
 * Marcas de ESTADO que generate-report agrega al final del stream (H75). Todas empiezan por "\n\u001E", que el
 * modelo no produce. Protocolo: el servidor termina SIEMPRE con MARCA_INFORME_FIN; si el cliente recibe el fin
 * del stream sin ella (la plataforma cortó la función, la red se rompió), el informe se trata como
 * INTERRUMPIDO: el texto puede estar incompleto y no se sabe si se guardó.
 *   · MARCA_INFORME_CORTADO: el modelo se detuvo por longitud (max_tokens): el texto puede estar incompleto.
 *   · MARCA_INFORME_NO_GUARDADO: (arriba) se generó pero no se pudo guardar. Puede combinarse con CORTADO.
 */
export const MARCA_INFORME_CORTADO = "\n\u001EINFORME_CORTADO\u001E";
export const MARCA_INFORME_FIN = "\n\u001EINFORME_FIN\u001E";
const INICIO_MARCA = "\n\u001E";

export interface EstadoInforme {
  /** Texto sin marcas (también recorta una marca a medio llegar, partida entre chunks). */
  texto: string;
  guardado: boolean;
  cortado: boolean;
  /** Llegó MARCA_INFORME_FIN: el servidor terminó su protocolo. Falso = interrumpido. */
  finalizado: boolean;
}

/** Lee el texto acumulado del stream y separa texto y estado. Las banderas solo cuentan con la marca COMPLETA. */
export function extraerEstadoInforme(acumulado: string): EstadoInforme {
  const i = acumulado.indexOf(INICIO_MARCA);
  return {
    texto: i === -1 ? acumulado : acumulado.slice(0, i),
    guardado: !acumulado.includes(MARCA_INFORME_NO_GUARDADO),
    cortado: acumulado.includes(MARCA_INFORME_CORTADO),
    finalizado: acumulado.includes(MARCA_INFORME_FIN),
  };
}

export type CorteInforme = "completo" | "cortado" | "desconocido";

/**
 * Qué dice el `stop_reason` del modelo sobre si el texto se cortó por LONGITUD.
 *   · "cortado": max_tokens, o model_context_window_exceeded (está en BetaStopReason del SDK 0.78.0 pero NO en
 *     el StopReason no-beta; se compara como texto por si la API lo devuelve).
 *   · "completo": end_turn o stop_sequence (el modelo decidió parar).
 *   · "desconocido": todo lo demás (null, refusal, tool_use, pause_turn, valores nuevos): NO afirma corte.
 */
export function clasificarCortePorLongitud(stopReason: string | null | undefined): CorteInforme {
  if (stopReason === "max_tokens" || stopReason === "model_context_window_exceeded") return "cortado";
  if (stopReason === "end_turn" || stopReason === "stop_sequence") return "completo";
  return "desconocido";
}

/** Tope de caracteres aceptado por las rutas (generaciones reales: < 30 000). */
export const MAX_CONTENIDO_INFORME = 200_000;

// ─────────────────────────────────────────────────────────────
// Lectura: qué informe y qué texto se muestran
// ─────────────────────────────────────────────────────────────

/** Texto vigente de un informe: la edición del usuario si existe, si no la generación. */
export function textoVigente(informe: InformeGenerado): string {
  return informe.contenidoEditado ?? informe.contenidoTexto;
}

/** Último informe (por `generadoEn`) de cada formato. */
export function informeVigentePorFormato(
  informes: InformeGenerado[] | undefined
): Partial<Record<ReportFormat, InformeGenerado>> {
  const out: Partial<Record<ReportFormat, InformeGenerado>> = {};
  for (const inf of informes ?? []) {
    const rf = REPORT_FORMAT_POR_FORMATO[inf.formato];
    if (!rf) continue;
    const actual = out[rf];
    if (!actual || Date.parse(inf.generadoEn) >= Date.parse(actual.generadoEn)) {
      out[rf] = inf;
    }
  }
  return out;
}

/**
 * H80 — qué formato muestra la página de informes al cargar.
 *   · Un formato «tiene informe» si su informe vigente tiene texto (la misma condición que decide qué se pinta).
 *   · `preferido` (p. ej. el `?formato=` de la URL, que es entrada NO confiable) solo se honra si es un formato válido de
 *     REPORT_FORMATS Y tiene informe; nunca devuelve un formato sin informe, así que nunca puede disparar una generación.
 *   · Si no hay preferido válido: el formato con mayor `generadoEn`; en empate, el primero en el orden de REPORT_FORMATS
 *     (la regla que la página tenía en línea desde 9484a0f, fijada por el oráculo de informesSync.formatoInicial.caracterizacion.test.ts).
 *   · Sin ningún informe: null.
 */
export function elegirFormatoInicial(
  vigentes: Partial<Record<ReportFormat, InformeGenerado>>,
  preferido?: unknown
): ReportFormat | null {
  const conInforme = REPORT_FORMATS.filter((rf) => {
    const inf = vigentes[rf];
    return !!inf && !!textoVigente(inf);
  });
  if (conInforme.length === 0) return null;
  if (typeof preferido === "string") {
    const valido = conInforme.find((rf) => rf === preferido);
    if (valido) return valido;
  }
  return conInforme.reduce((a, b) =>
    Date.parse(vigentes[a]!.generadoEn) >= Date.parse(vigentes[b]!.generadoEn) ? a : b
  );
}

/**
 * H80 — misma URL con `?formato=<formato>` (reemplaza el valor si ya estaba y conserva el resto de parámetros y el hash).
 * Devuelve ruta + búsqueda + hash (lo que espera history.replaceState), sin dominio.
 */
export function urlConFormato(href: string, formato: ReportFormat): string {
  const u = new URL(href, "http://localhost");
  u.searchParams.set("formato", formato);
  return `${u.pathname}${u.search}${u.hash}`;
}

// ─────────────────────────────────────────────────────────────
// Caché local legada (antes: única copia de las ediciones)
// ─────────────────────────────────────────────────────────────

export type TextosPorFormato = Partial<Record<ReportFormat, string>>;

/** Parsea el valor legado de localStorage; ignora entradas corruptas o de otro tipo. */
export function parsearCacheLocalLegada(raw: string | null): TextosPorFormato {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: TextosPorFormato = {};
    for (const rf of REPORT_FORMATS) {
      const v = (parsed as Record<string, unknown>)[rf];
      if (typeof v === "string" && v.trim() !== "") out[rf] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export type AccionMigracion =
  | { tipo: "crear"; formato: ReportFormat; contenido: string }
  | { tipo: "editar"; formato: ReportFormat; informeId: string; contenido: string }
  | { tipo: "conservar_local"; formato: ReportFormat; motivo: string };

/**
 * Qué hacer con cada texto de la caché local legada frente a lo que ya hay en
 * el servidor. Política de conflicto (aprobada 26-10-03):
 *   · Formato sin informe en servidor → se SUBE el texto local como informe nuevo.
 *   · Texto local igual al vigente → nada que hacer (no aparece en el resultado).
 *   · Servidor solo con la generación y local distinto → el local se sube como
 *     edición del mismo informe (la generación original se conserva).
 *   · Servidor YA tiene una edición distinta → el servidor gana (es más
 *     reciente que cualquier cosa que haya quedado en esta caché); el texto
 *     local no se pierde: "conservar_local".
 * La clave de localStorage no se borra nunca (decisión del llamador).
 */
export function planMigracionLocal(
  local: TextosPorFormato,
  vigentes: Partial<Record<ReportFormat, InformeGenerado>>
): AccionMigracion[] {
  const acciones: AccionMigracion[] = [];
  for (const rf of REPORT_FORMATS) {
    const texto = local[rf];
    if (!texto) continue;
    const informe = vigentes[rf];
    if (!informe) {
      acciones.push({ tipo: "crear", formato: rf, contenido: texto });
      continue;
    }
    if (texto === textoVigente(informe)) continue;
    if (informe.contenidoEditado !== undefined) {
      acciones.push({
        tipo: "conservar_local",
        formato: rf,
        motivo: "El servidor ya tiene una edición posterior de este informe.",
      });
      continue;
    }
    acciones.push({
      tipo: "editar",
      formato: rf,
      informeId: informe.id,
      contenido: texto,
    });
  }
  return acciones;
}

// ─────────────────────────────────────────────────────────────
// Ediciones pendientes de sincronizar (red caída o pestaña cerrada)
// ─────────────────────────────────────────────────────────────

export interface EdicionPendiente {
  informeId: string;
  contenido: string;
  /** Date.now() al momento de la edición. */
  ts: number;
}
export type PendientesPorFormato = Partial<Record<ReportFormat, EdicionPendiente>>;

export function parsearPendientes(raw: string | null): PendientesPorFormato {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: PendientesPorFormato = {};
    for (const rf of REPORT_FORMATS) {
      const v = (parsed as Record<string, unknown>)[rf] as
        | Partial<EdicionPendiente>
        | undefined;
      if (
        v &&
        typeof v.informeId === "string" &&
        typeof v.contenido === "string" &&
        typeof v.ts === "number"
      ) {
        out[rf] = { informeId: v.informeId, contenido: v.contenido, ts: v.ts };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export type AccionPendiente =
  | { tipo: "reenviar"; formato: ReportFormat; informeId: string; contenido: string }
  | { tipo: "descartar"; formato: ReportFormat };

/**
 * Una edición pendiente se reenvía solo si sigue apuntando al informe vigente
 * y es más reciente que lo guardado en servidor. Si el informe fue sustituido
 * por una regeneración, o el servidor ya tiene algo igual o posterior, se
 * descarta (el servidor es la fuente de verdad).
 */
export function reconciliarPendientes(
  pendientes: PendientesPorFormato,
  vigentes: Partial<Record<ReportFormat, InformeGenerado>>
): AccionPendiente[] {
  const acciones: AccionPendiente[] = [];
  for (const rf of REPORT_FORMATS) {
    const p = pendientes[rf];
    if (!p) continue;
    const informe = vigentes[rf];
    if (!informe || informe.id !== p.informeId) {
      acciones.push({ tipo: "descartar", formato: rf });
      continue;
    }
    const tsServidor = Date.parse(informe.editadoEn ?? informe.generadoEn);
    if (p.ts > tsServidor && p.contenido !== textoVigente(informe)) {
      acciones.push({
        tipo: "reenviar",
        formato: rf,
        informeId: informe.id,
        contenido: p.contenido,
      });
    } else {
      acciones.push({ tipo: "descartar", formato: rf });
    }
  }
  return acciones;
}

// ─────────────────────────────────────────────────────────────
// Construcción del informe a persistir (servidor)
// ─────────────────────────────────────────────────────────────

export function construirInforme(args: {
  id: string;
  format: ReportFormat;
  texto: string;
  analysis: Pick<PestlAnalysisV2, "dimensions">;
  variableConfigs: PestlDimensionConfig[];
  origen?: InformeGenerado["origen"];
  generadoEn?: string;
  /** `stop_reason` del modelo (H75). Sin él (migración desde localStorage) no se escribe ningún campo de corte. */
  stopReason?: string | null;
}): InformeGenerado {
  const { analysis, variableConfigs } = args;
  const scorecard = buildScorecard(analysis.dimensions, variableConfigs);
  const scorecardItems = scorecard.dimensions.map((ds) => ({
    code: ds.code,
    label: DIMENSION_META[ds.code]?.label ?? ds.code,
    confidence: ds.confidence,
    classification:
      analysis.dimensions.find((d) => d.code === ds.code)?.classification ??
      "NEUTRAL",
    dimWeight: ds.dimWeight,
    score: ds.score,
  }));
  const mapaPESTEL: Partial<Record<DimensionCode, Partial<DimensionAnalysis>>> = {};
  for (const dim of analysis.dimensions) {
    mapaPESTEL[dim.code] = {
      code: dim.code,
      mainSignal: dim.mainSignal,
      classification: dim.classification,
      confidence: dim.confidence,
    };
  }
  return {
    id: args.id,
    formato: FORMATO_POR_REPORT_FORMAT[args.format],
    contenidoTexto: args.texto,
    datosEstructurados: { scorecard: scorecardItems, mapaPESTEL },
    generadoEn: args.generadoEn ?? new Date().toISOString(),
    ...(args.origen ? { origen: args.origen } : {}),
    ...(args.stopReason ? { stopReason: args.stopReason } : {}),
    ...(clasificarCortePorLongitud(args.stopReason) === "cortado" ? { truncado: true } : {}),
  };
}
