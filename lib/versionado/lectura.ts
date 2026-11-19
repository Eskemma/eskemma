// lib/versionado/lectura.ts
// C4a-1 — reglas PURAS de lectura del historial unificado (sin Firestore, sin `node:crypto`): importable desde un
// componente de CLIENTE (solo depende de `tipos.ts`; lo vigila `clienteSeguro.test.ts`).
//
// Qué resuelve:
//   · «vigente» sale SIEMPRE del manifiesto de la revisión vigente, nunca del campo `estado` de la versión (H-V35).
//   · qué versiones EXISTEN = las `retenidas` del manifiesto vigente (la poda las quita de esa lista): una revisión
//     antigua es «parcial» sin ninguna lectura extra.
//   · coherencia entre el contador del puntero (`totalCambios` = puntero.n) y los eventos leídos: las revisiones de una
//     fase son 1..n y hay UN evento por revisión, así que una página pegada debe ser contigua; cualquier hueco se
//     reporta (nunca «sin historial» ni omisión silenciosa).

import type { EntradaManifiesto } from "./tipos";

/** Fases que tienen historial hoy (las demás son marcadores vacíos). */
export const FASES_CON_HISTORIAL = ["proposito", "exploracion", "investigacion"] as const;
export type FaseConHistorial = (typeof FASES_CON_HISTORIAL)[number];
export const esFaseConHistorial = (f: unknown): f is FaseConHistorial =>
  typeof f === "string" && (FASES_CON_HISTORIAL as readonly string[]).includes(f);

export const LIMITE_POR_DEFECTO = 20;
export const LIMITE_MAXIMO = 50;
/** Máximo de revisiones faltantes que se listan en una respuesta (el conteo completo va en `faltantesTotal`). */
export const MAX_FALTANTES_LISTADOS = 50;

export type Recuperable = "completo" | "parcial" | "no";

export type CodigoAviso =
  | "eventos_incompletos" // hay cambios (según el contador de la fase) cuyo evento no se pudo leer o no es válido
  | "historial_sin_puntero" // hay eventos pero el proyecto no tiene puntero de revisión
  | "retencion_parcial" // algunas versiones ya no se conservan
  | "cambio_durante_lectura"; // un cambio ocurrió entre la lectura del proyecto y la de los eventos

export interface ArtefactoDeFila {
  nombre: string;
  etiqueta: string;
  versionId: string | null;
  /** Esta versión es hoy la vigente de ese artefacto (según el manifiesto vigente). */
  vigente: boolean;
  recuperable: Recuperable;
}

export interface FilaHistorial {
  revisionN: number;
  eventoId: string;
  /** ISO 8601 o null = «Fecha desconocida». */
  en: string | null;
  quien: string;
  tipo: string;
  titulo: string;
  detalleTexto: string | null;
  artefactos: ArtefactoDeFila[];
  /** Es la revisión que apunta el puntero (la versión actual de la fase). */
  esVigente: boolean;
  /** El estado vivo cambió sin dejar registro antes de este cambio (versión de deriva). */
  derivaAntes: boolean;
  /** Evento posterior al puntero leído (otro cambio ocurrió mientras se leía): nunca es «vigente». */
  posteriorALaLectura: boolean;
  recuperable: Recuperable;
}

export interface ArtefactoVigente {
  nombre: string;
  etiqueta: string;
  versionVigenteId: string;
  n: number;
  /** true/false si se comparó la proyección viva con la guardada; null = no se comprobó (F3 sin `deriva=1`) o no hay dato. */
  derivaDetectada: boolean | null;
}

export interface RespuestaHistorial {
  fase: FaseConHistorial;
  /** puntero.n (un evento por revisión). 0 = la fase no tiene historial todavía. */
  totalCambios: number;
  vigente: { revisionN: number; artefactos: ArtefactoVigente[] } | null;
  filas: FilaHistorial[];
  siguienteCursor: number | null;
  avisos: { codigo: CodigoAviso; texto: string }[];
  /** Revisiones que el contador dice que existen pero cuyo evento no apareció (recortado a MAX_FALTANTES_LISTADOS). */
  faltantes: number[];
  faltantesTotal: number;
}

// ---- vigente / existentes / recuperable ----

type Manifiesto = { artefactos?: Record<string, Pick<EntradaManifiesto, "versionId" | "n" | "retenidas">> } | undefined;

/** `versionId` vigente de un artefacto según el manifiesto (null si el manifiesto no lo trae). */
export function vigenteDeManifiesto(manifiesto: Manifiesto, artefacto: string): string | null {
  const id = manifiesto?.artefactos?.[artefacto]?.versionId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** ids de versión que EXISTEN: la lista autoritativa son las `retenidas` del manifiesto vigente (más la vigente de cada uno). */
export function versionesExistentes(manifiesto: Manifiesto): Set<string> {
  const ids = new Set<string>();
  for (const e of Object.values(manifiesto?.artefactos ?? {})) {
    if (typeof e.versionId === "string") ids.add(e.versionId);
    for (const r of e.retenidas ?? []) if (r && typeof r.id === "string") ids.add(r.id);
  }
  return ids;
}

/** completo = todas las versiones del evento existen; parcial = algunas; no = ninguna (o el evento no cita versiones). */
export function recuperabilidad(versionIds: readonly (string | null)[], existentes: ReadonlySet<string>): Recuperable {
  if (versionIds.length === 0) return "no";
  const vivas = versionIds.filter((v) => v !== null && existentes.has(v)).length;
  if (vivas === versionIds.length) return "completo";
  return vivas === 0 ? "no" : "parcial";
}

// ---- validación de un evento ----

export interface EventoCrudo {
  id: string;
  data: Record<string, unknown>;
}

/** Un evento válido para esta fase: `revisionN` entero >= 1 y `fase` igual. Cualquier otra cosa → null (se cuenta aparte). */
export function revisionDeEvento(ev: EventoCrudo, fase: string): number | null {
  const n = ev.data.revisionN;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) return null;
  if (ev.data.fase !== fase) return null;
  return n;
}

// ---- continuidad ----

export interface ResultadoContinuidad {
  /** Revisiones esperadas (techo, techo-1, …) que no aparecieron como evento. */
  faltantes: number[];
  faltantesTotal: number;
  /** Cursor de la página siguiente (el menor revisionN de esta página) o null si no hay más que pedir. */
  siguienteCursor: number | null;
}

/**
 * `revisiones` = revisionN válidos de esta página (descendentes, SIN los posteriores al puntero). `techo` = la
 * revisión que debería ser la primera (puntero.n en la 1.ª página; cursor-1 en las siguientes). `pedidos` = cuántos
 * documentos devolvió la consulta (los inválidos cuentan: la página estaba llena aunque no sirvan) y `limite` lo
 * pedido. Una página llena sigue; una página corta con revisiones por debajo es un hueco, no el final.
 */
export function analizarContinuidad(
  revisiones: readonly number[],
  opciones: { techo: number; pedidos: number; limite: number }
): ResultadoContinuidad {
  const { techo, pedidos, limite } = opciones;
  const faltantes: number[] = [];
  let total = 0;
  const anotar = (n: number) => {
    total++;
    if (faltantes.length < MAX_FALTANTES_LISTADOS) faltantes.push(n);
  };

  let esperado = techo;
  for (const r of revisiones) {
    if (r > esperado) continue; // duplicado o fuera de orden: no cuenta como hueco ni avanza
    while (esperado > r) {
      anotar(esperado);
      esperado--;
    }
    esperado = r - 1;
  }
  const paginaCompleta = pedidos >= limite;
  if (!paginaCompleta) {
    // La consulta se agotó: todo lo que quede por debajo de `esperado` (hasta 1) no tiene evento.
    for (let n = esperado; n >= 1; n--) anotar(n);
  }
  const ultimo = revisiones.length > 0 ? revisiones[revisiones.length - 1] : null;
  // Una página llena y con al menos un evento válido continúa desde su menor revisión (si es 1 no hay nada debajo).
  const siguienteCursor = paginaCompleta && ultimo !== null && ultimo > 1 ? ultimo : null;
  return { faltantes, faltantesTotal: total, siguienteCursor };
}
