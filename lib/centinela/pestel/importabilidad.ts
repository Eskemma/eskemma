// lib/centinela/pestel/importabilidad.ts
// T7 C1 (sin cablear; el gate es C2): ¿qué hay que decirle a la persona antes de importar un análisis de
// Centinela a Moddulo F2? Decisión PURA y derivada de DATOS, no del `status` solo: `REVIEWED` no significa
// revisión humana (se asigna al crear con confianza ≥ 50, N1/H-X) y `PENDING_REVIEW` se pierde al reconocer
// los sesgos. El sistema NO bloquea ni decide por la persona: este módulo solo dice qué razones hay para
// pedir confirmación (`nivel: "aviso"`) y con qué datos reales redactarlas.
//
// Razones (orden fijo):
//  - no_aprobado         el estado no es APPROVED (incluye ausente o desconocido).
//  - sesgos_sin_revisar  hay alertas de sesgo sin `acknowledgedAt` (con su conteo).
//  - no_vigente          el análisis tiene `vigente === false`. Lleva las fechas que EXISTEN: la del propio
//                        análisis y, solo si se entregó el análisis vigente, la de este. Nunca se inventa una.
//  - confianza_baja      `confianzaInsuficiente(globalConfidence)`: informativa. Por sí sola NO pide
//                        confirmación (un análisis aprobado con confianza baja viaja con su nota, T7 C3).
//
// `razonesSinDuplicar` evita decir dos veces lo mismo cuando coincide con el aviso de origen de T4.

import { aMillis, confianzaInsuficiente } from "./aprobacion";
import type { EstadoOrigen } from "./estadoOrigen";

export interface AnalisisParaGate {
  id?: string;
  status?: unknown;
  vigente?: unknown;
  analyzedAt?: unknown;
  globalConfidence?: unknown;
  biasAlerts?: unknown;
}

/** El análisis vigente del proyecto, si se pudo consultar. Ausente/null = no existe o no se consultó. */
export interface VigenteParaGate {
  id?: string;
  analyzedAt?: unknown;
}

export type RazonImportabilidad =
  | { tipo: "no_aprobado"; status?: string }
  | { tipo: "sesgos_sin_revisar"; cantidad: number }
  | { tipo: "no_vigente"; fechaAnalisis?: string; fechaVigente?: string }
  | { tipo: "confianza_baja"; confianza: number };

export type TipoRazon = RazonImportabilidad["tipo"];

export interface Importabilidad {
  /** "aviso" = pedir confirmación antes de importar; "ok" = importar directo. */
  nivel: "ok" | "aviso";
  razones: RazonImportabilidad[];
}

const iso = (v: unknown): string | undefined => {
  const ms = aMillis(v);
  return ms !== null && Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
};

/** Qué razones piden confirmación: todas salvo la confianza baja, que es solo informativa. */
export function nivelDeRazones(razones: readonly RazonImportabilidad[]): "ok" | "aviso" {
  return razones.some((r) => r.tipo !== "confianza_baja") ? "aviso" : "ok";
}

export function decidirImportabilidad(analysis: AnalisisParaGate, vigente?: VigenteParaGate | null): Importabilidad {
  const razones: RazonImportabilidad[] = [];

  if (analysis.status !== "APPROVED") {
    razones.push({ tipo: "no_aprobado", ...(typeof analysis.status === "string" ? { status: analysis.status } : {}) });
  }

  const alertas = Array.isArray(analysis.biasAlerts) ? (analysis.biasAlerts as { acknowledgedAt?: unknown }[]) : [];
  const sinRevisar = alertas.filter((a) => !a?.acknowledgedAt).length;
  if (sinRevisar > 0) razones.push({ tipo: "sesgos_sin_revisar", cantidad: sinRevisar });

  if (analysis.vigente === false) {
    const fechaAnalisis = iso(analysis.analyzedAt);
    // La fecha del vigente solo cuenta si es OTRO documento (o si no se puede saber el id).
    const otroVigente = vigente && !(vigente.id && analysis.id && vigente.id === analysis.id) ? vigente : null;
    const fechaVigente = otroVigente ? iso(otroVigente.analyzedAt) : undefined;
    razones.push({
      tipo: "no_vigente",
      ...(fechaAnalisis ? { fechaAnalisis } : {}),
      ...(fechaVigente ? { fechaVigente } : {}),
    });
  }

  if (confianzaInsuficiente(analysis.globalConfidence)) {
    razones.push({ tipo: "confianza_baja", confianza: analysis.globalConfidence as number });
  }

  return { nivel: nivelDeRazones(razones), razones };
}

/**
 * Un solo mensaje por situación. Precedencia: cuando ya existe un vínculo y el aviso de origen de T4 dice
 * `version_nueva`, ese aviso GANA y la razón `no_vigente` del gate se omite (dicen lo mismo). Sin vínculo
 * (`estadoOrigen` ausente: primera importación) o con cualquier otro estado de origen, `no_vigente` se
 * conserva. Además ningún tipo de razón sale dos veces. El nivel se recalcula con lo que queda; `omitidas`
 * dice qué se quitó para que quien llama pueda explicarlo.
 */
export function razonesSinDuplicar(
  razones: readonly RazonImportabilidad[],
  estadoOrigen?: EstadoOrigen | null
): { razones: RazonImportabilidad[]; nivel: "ok" | "aviso"; omitidas: TipoRazon[] } {
  const vistas = new Set<TipoRazon>();
  const omitidas: TipoRazon[] = [];
  const resultado: RazonImportabilidad[] = [];
  for (const r of razones) {
    const cubiertaPorOrigen = r.tipo === "no_vigente" && estadoOrigen === "version_nueva";
    if (cubiertaPorOrigen || vistas.has(r.tipo)) {
      omitidas.push(r.tipo);
      continue;
    }
    vistas.add(r.tipo);
    resultado.push(r);
  }
  return { razones: resultado, nivel: nivelDeRazones(resultado), omitidas };
}
