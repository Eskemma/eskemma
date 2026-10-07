// lib/moddulo/projectPatch.ts
// Validación PURA (sin Firestore) de lo que acepta PATCH /api/moddulo/projects/[projectId]
// y de las escrituras con ruta de campo que salen del chat. Corrige H-M5 (26-10-07).
//
// Antes: `updateProject` hacía `update({...body})` — con un cuerpo `as UpdateProjectInput` que
// NO se validaba en ejecución — y Firestore interpreta las claves con punto como RUTAS de campo,
// así que un colaborador con rol de edición podía escribir `collaborators`, `userId`,
// `deletedAt`, `phases.exploracion.motorAprobaciones.M2`, `phases.exploracion.dvs`, etc.
// Además `phaseData` usaba `phaseId` sin validar y REEMPLAZABA `phases.X.data` completo:
// cerrar F2 enviaba `{aprobadoEn}` y borraba el formulario PESTL (10 de 10 proyectos con F2
// cerrada tenían `data = {aprobadoEn}`).
//
// Reglas (decisiones de Raúl): lista blanca; todo lo demás → error (falla cerrado, no se ignora
// en silencio); `settings` fuera; territorio con validación ligera; los errores NUNCA devuelven
// el contenido enviado, solo el nombre del campo y el motivo.

import { PHASE_ORDER, emptyExplorationForm, type PhaseId, type ProjectStatus } from "@/types/moddulo.types";
import type { NivelTerritorial } from "@/types/shared.types";

// ─────────────────────────────────────────────────────────────
// Topes. Medidos en los 14 proyectos reales (26-10-07); se fijan con holgura amplia para que
// el autoguardado actual nunca reciba un error por un dato que ya existe.
//   name         real máx 63    · la UI limita a 100  → tope 200
//   description  real máx 107   · la UI limita a 300  → tope 1,000
//   hoja xpcto   real máx 870   · la UI NO limita     → tope 20,000
//   fechaLimite  real máx 14                           → tope 64
//   territorio   real máx 1,065 bytes JSON             → tope 50,000
//   exploracion.data real máx 435 bytes JSON           → tope 200,000
//   reportText   real máx 12,097                       → tope 200,000
// ─────────────────────────────────────────────────────────────
export const LIMITES = {
  name: 200,
  description: 1_000,
  textoXpcto: 20_000,
  fechaLimite: 64,
  duracionMesesAbs: 12_000,
  territorioChars: 50_000,
  territorioNombre: 300,
  dataChars: 200_000,
  reportTextChars: 200_000,
  valorChatChars: 20_000,
  valorChatExploracionChars: 50_000,
} as const;

export type MotivoPatch =
  | "cuerpo_invalido"
  | "campo_no_permitido"
  | "tipo_invalido"
  | "valor_invalido"
  | "demasiado_largo"
  | "fase_invalida";

/**
 * Error de validación. `campo` es el NOMBRE del campo (truncado) y `motivo` un código fijo:
 * nunca incluye el valor enviado.
 */
export class PatchInvalidoError extends Error {
  readonly campo: string;
  readonly motivo: MotivoPatch;
  constructor(campo: string, motivo: MotivoPatch) {
    const seguro = String(campo).slice(0, 80);
    super(`Solicitud inválida (${motivo}): ${seguro}`);
    this.name = "PatchInvalidoError";
    this.campo = seguro;
    this.motivo = motivo;
  }
}

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────

export function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const CLAVES_PELIGROSAS = new Set(["__proto__", "constructor", "prototype"]);

function tamanoJson(v: unknown): number {
  try {
    return JSON.stringify(v)?.length ?? 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

const NIVELES_TERRITORIALES: readonly NivelTerritorial[] = [
  "nacional",
  "estatal",
  "municipal",
  "distrito",
  "distrito_federal",
  "distrito_local",
];
const ESTADOS_PROYECTO: readonly ProjectStatus[] = ["draft", "active", "paused", "completed", "archived"];
const RE_COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;
const RE_CLAVE_DATA = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

// ─────────────────────────────────────────────────────────────
// XPCTO: las 8 rutas válidas (verificadas contra el tipo, el prompt de F1 y los 14 proyectos)
// ─────────────────────────────────────────────────────────────

export const RUTAS_XPCTO = [
  "xpcto.hito",
  "xpcto.sujeto",
  "xpcto.capacidades.financiero",
  "xpcto.capacidades.humano",
  "xpcto.capacidades.logistico",
  "xpcto.tiempo.fechaLimite",
  "xpcto.tiempo.duracionMeses",
  "xpcto.justificacion",
] as const;
const SET_RUTAS_XPCTO: ReadonlySet<string> = new Set(RUTAS_XPCTO);

export function esRutaXpctoValida(ruta: string): boolean {
  return SET_RUTAS_XPCTO.has(ruta);
}

// ─────────────────────────────────────────────────────────────
// Rutas válidas de phases.exploracion.data (derivadas del formulario real de F2)
// ─────────────────────────────────────────────────────────────

function hojas(obj: unknown, prefijo: string, out: Set<string>): void {
  if (esObjetoPlano(obj) && Object.keys(obj).length > 0) {
    for (const [k, v] of Object.entries(obj)) hojas(v, prefijo ? `${prefijo}.${k}` : k, out);
  } else if (prefijo) {
    out.add(prefijo);
  }
}

/** pestl.<dim>.<campo>, semaforo.actores/resumen, hipotesis.* — salen de `emptyExplorationForm()`. */
export function rutasValidasExploracion(): ReadonlySet<string> {
  const out = new Set<string>();
  hojas(emptyExplorationForm(), "", out);
  return out;
}
const RUTAS_EXPLORACION = rutasValidasExploracion();

/** Claves de primer nivel que escriben los clientes reales hoy en phases.exploracion.data. */
export const CLAVES_DATA_EXPLORACION: ReadonlySet<string> = new Set([
  "pestl",
  "semaforo",
  "hipotesis",
  "aprobadoEn",
]);

// ─────────────────────────────────────────────────────────────
// PATCH de campos del proyecto
// ─────────────────────────────────────────────────────────────

export const CAMPOS_PROYECTO_PERMITIDOS = ["name", "description", "color", "status", "xpcto", "territorio"] as const;

export interface PatchProyectoValidado {
  /** Listo para `update()`: las hojas de xpcto van como rutas con punto (`xpcto.hito`). */
  update: Record<string, unknown>;
}

function textoAcotado(campo: string, v: unknown, max: number, opts?: { noVacio?: boolean }): string {
  if (typeof v !== "string") throw new PatchInvalidoError(campo, "tipo_invalido");
  if (v.length > max) throw new PatchInvalidoError(campo, "demasiado_largo");
  if (opts?.noVacio && v.trim().length === 0) throw new PatchInvalidoError(campo, "valor_invalido");
  return v;
}

function validarXpcto(raw: unknown, update: Record<string, unknown>): void {
  if (!esObjetoPlano(raw)) throw new PatchInvalidoError("xpcto", "tipo_invalido");
  let hojasEscritas = 0;
  const escribir = (ruta: string, valor: unknown) => {
    update[ruta] = valor;
    hojasEscritas++;
  };
  for (const [k, v] of Object.entries(raw)) {
    if (CLAVES_PELIGROSAS.has(k)) throw new PatchInvalidoError(`xpcto.${k}`, "campo_no_permitido");
    if (k === "hito" || k === "sujeto" || k === "justificacion") {
      escribir(`xpcto.${k}`, textoAcotado(`xpcto.${k}`, v, LIMITES.textoXpcto));
    } else if (k === "capacidades") {
      if (!esObjetoPlano(v)) throw new PatchInvalidoError("xpcto.capacidades", "tipo_invalido");
      for (const [kk, vv] of Object.entries(v)) {
        if (kk !== "financiero" && kk !== "humano" && kk !== "logistico") {
          throw new PatchInvalidoError(`xpcto.capacidades.${kk}`, "campo_no_permitido");
        }
        escribir(`xpcto.capacidades.${kk}`, textoAcotado(`xpcto.capacidades.${kk}`, vv, LIMITES.textoXpcto));
      }
    } else if (k === "tiempo") {
      if (!esObjetoPlano(v)) throw new PatchInvalidoError("xpcto.tiempo", "tipo_invalido");
      for (const [kk, vv] of Object.entries(v)) {
        if (kk === "fechaLimite") {
          escribir("xpcto.tiempo.fechaLimite", textoAcotado("xpcto.tiempo.fechaLimite", vv, LIMITES.fechaLimite));
        } else if (kk === "duracionMeses") {
          // El formulario de F1 lo calcula con una fecha: con una fecha inválida sale NaN y
          // JSON.stringify(NaN) === "null". Un proyecto real (ZMG) lo tiene en null.
          if (vv !== null && (typeof vv !== "number" || !Number.isFinite(vv))) {
            throw new PatchInvalidoError("xpcto.tiempo.duracionMeses", "tipo_invalido");
          }
          if (typeof vv === "number" && Math.abs(vv) > LIMITES.duracionMesesAbs) {
            throw new PatchInvalidoError("xpcto.tiempo.duracionMeses", "valor_invalido");
          }
          escribir("xpcto.tiempo.duracionMeses", vv);
        } else {
          throw new PatchInvalidoError(`xpcto.tiempo.${kk}`, "campo_no_permitido");
        }
      }
    } else {
      throw new PatchInvalidoError(`xpcto.${k}`, "campo_no_permitido");
    }
  }
  if (hojasEscritas === 0) throw new PatchInvalidoError("xpcto", "valor_invalido");
}

function validarTerritorio(raw: unknown): Record<string, unknown> {
  if (!esObjetoPlano(raw)) throw new PatchInvalidoError("territorio", "tipo_invalido");
  for (const k of Object.keys(raw)) {
    if (CLAVES_PELIGROSAS.has(k)) throw new PatchInvalidoError(`territorio.${k}`, "campo_no_permitido");
  }
  if (typeof raw.nivel !== "string" || !NIVELES_TERRITORIALES.includes(raw.nivel as NivelTerritorial)) {
    throw new PatchInvalidoError("territorio.nivel", "valor_invalido");
  }
  textoAcotado("territorio.nombre", raw.nombre, LIMITES.territorioNombre, { noVacio: true });
  if (tamanoJson(raw) > LIMITES.territorioChars) throw new PatchInvalidoError("territorio", "demasiado_largo");
  return raw;
}

/**
 * Valida un cuerpo de PATCH de campos del proyecto. Lanza `PatchInvalidoError` ante cualquier
 * campo fuera de la lista blanca, de tipo erróneo o fuera de tope. No altera los valores.
 */
export function validarPatchProyecto(input: unknown): PatchProyectoValidado {
  if (!esObjetoPlano(input)) throw new PatchInvalidoError("(cuerpo)", "cuerpo_invalido");
  const claves = Object.keys(input);
  if (claves.length === 0) throw new PatchInvalidoError("(cuerpo)", "cuerpo_invalido");
  const permitidos: ReadonlySet<string> = new Set(CAMPOS_PROYECTO_PERMITIDOS);
  for (const k of claves) {
    if (!permitidos.has(k)) throw new PatchInvalidoError(k, "campo_no_permitido");
  }

  const update: Record<string, unknown> = {};
  for (const k of claves) {
    const v = input[k];
    switch (k) {
      case "name":
        update.name = textoAcotado("name", v, LIMITES.name, { noVacio: true });
        break;
      case "description":
        update.description = textoAcotado("description", v, LIMITES.description);
        break;
      case "color":
        if (typeof v !== "string") throw new PatchInvalidoError("color", "tipo_invalido");
        if (!RE_COLOR_HEX.test(v)) throw new PatchInvalidoError("color", "valor_invalido");
        update.color = v;
        break;
      case "status":
        if (typeof v !== "string") throw new PatchInvalidoError("status", "tipo_invalido");
        if (!ESTADOS_PROYECTO.includes(v as ProjectStatus)) throw new PatchInvalidoError("status", "valor_invalido");
        update.status = v;
        break;
      case "xpcto":
        validarXpcto(v, update);
        break;
      case "territorio":
        update.territorio = validarTerritorio(v);
        break;
    }
  }
  return { update };
}

// ─────────────────────────────────────────────────────────────
// PATCH de fase (phaseData) y borrador de reporte
// ─────────────────────────────────────────────────────────────

export function esPhaseIdValido(v: unknown): v is PhaseId {
  return typeof v === "string" && (PHASE_ORDER as readonly string[]).includes(v);
}

export interface PhaseDataValidada {
  phaseId: PhaseId;
  /** `started:true` sin `data`: solo marca la fase como iniciada. */
  soloIniciar: boolean;
  data?: Record<string, unknown>;
}

export function validarPhaseData(raw: unknown): PhaseDataValidada {
  if (!esObjetoPlano(raw)) throw new PatchInvalidoError("phaseData", "tipo_invalido");
  for (const k of Object.keys(raw)) {
    if (k !== "phaseId" && k !== "data" && k !== "started") {
      throw new PatchInvalidoError(`phaseData.${k}`, "campo_no_permitido");
    }
  }
  if (!esPhaseIdValido(raw.phaseId)) throw new PatchInvalidoError("phaseData.phaseId", "fase_invalida");
  const phaseId = raw.phaseId;
  if (raw.started !== undefined && typeof raw.started !== "boolean") {
    throw new PatchInvalidoError("phaseData.started", "tipo_invalido");
  }

  if (raw.data === undefined) {
    if (raw.started === true) return { phaseId, soloIniciar: true };
    throw new PatchInvalidoError("phaseData", "cuerpo_invalido");
  }

  if (!esObjetoPlano(raw.data)) throw new PatchInvalidoError("phaseData.data", "tipo_invalido");
  const data = raw.data;
  if (tamanoJson(data) > LIMITES.dataChars) throw new PatchInvalidoError("phaseData.data", "demasiado_largo");
  for (const [k, v] of Object.entries(data)) {
    if (!RE_CLAVE_DATA.test(k) || CLAVES_PELIGROSAS.has(k)) {
      throw new PatchInvalidoError(`phaseData.data.${k}`, "campo_no_permitido");
    }
    if (phaseId === "exploracion") {
      if (!CLAVES_DATA_EXPLORACION.has(k)) throw new PatchInvalidoError(`phaseData.data.${k}`, "campo_no_permitido");
      if (k === "aprobadoEn") {
        textoAcotado("phaseData.data.aprobadoEn", v, LIMITES.fechaLimite);
      } else if (!esObjetoPlano(v)) {
        throw new PatchInvalidoError(`phaseData.data.${k}`, "tipo_invalido");
      }
    }
  }
  return { phaseId, soloIniciar: false, data };
}

export function validarReportDraft(raw: unknown): { phaseId: PhaseId; reportText: string } {
  if (!esObjetoPlano(raw)) throw new PatchInvalidoError("reportDraft", "tipo_invalido");
  if (!esPhaseIdValido(raw.phaseId)) throw new PatchInvalidoError("reportDraft.phaseId", "fase_invalida");
  const reportText = textoAcotado("reportDraft.reportText", raw.reportText, LIMITES.reportTextChars);
  return { phaseId: raw.phaseId, reportText };
}

// ─────────────────────────────────────────────────────────────
// Escrituras con ruta de campo que salen del MODELO (chat) o se reconstruyen de su historial
// ─────────────────────────────────────────────────────────────

function valorXpctoChatValido(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && v.length <= LIMITES.valorChatChars;
}

export interface ExtraccionFiltrada {
  /** `xpcto.hito` → valor (rutas válidas únicamente). */
  xpctoUpdates: Record<string, unknown>;
  /** `phases.<fase>.data.<ruta>` → valor (solo F2 y solo rutas del formulario). */
  phaseDataUpdates: Record<string, unknown>;
  /** Nombres (no valores) de las claves descartadas, para el log del servidor. */
  descartadas: string[];
}

/**
 * Filtra lo que el modelo extrajo antes de convertirlo en rutas de campo. El sufijo de la clave
 * lo controla el modelo (y, por inyección en el mensaje, el usuario): solo pasan las 8 rutas de
 * XPCTO y, en F2, las hojas de `emptyExplorationForm()`.
 */
export function filtrarExtraccionChat(extractedData: Record<string, unknown>, phaseId: PhaseId): ExtraccionFiltrada {
  const xpctoUpdates: Record<string, unknown> = {};
  const phaseDataUpdates: Record<string, unknown> = {};
  const descartadas: string[] = [];

  for (const [key, value] of Object.entries(extractedData)) {
    if (key.startsWith("xpcto.")) {
      if (esRutaXpctoValida(key) && valorXpctoChatValido(value)) xpctoUpdates[key] = value;
      else descartadas.push(key.slice(0, 80));
    } else if (key.startsWith("pestl.") || key.startsWith("semaforo.") || key.startsWith("hipotesis.")) {
      if (phaseId === "exploracion" && RUTAS_EXPLORACION.has(key) && tamanoJson(value) <= LIMITES.valorChatExploracionChars) {
        phaseDataUpdates[`phases.${phaseId}.data.${key}`] = value;
      } else {
        descartadas.push(key.slice(0, 80));
      }
    }
  }
  return { xpctoUpdates, phaseDataUpdates, descartadas };
}

/** Misma regla para la reconstrucción de xpcto desde el historial del chat (GET del proyecto). */
export function filtrarRecuperacionXpcto(recovered: Record<string, unknown>): {
  validas: Record<string, unknown>;
  descartadas: string[];
} {
  const { xpctoUpdates, descartadas } = filtrarExtraccionChat(recovered, "proposito");
  return { validas: xpctoUpdates, descartadas };
}
