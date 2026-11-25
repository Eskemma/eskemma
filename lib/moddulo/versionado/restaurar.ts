// lib/moddulo/versionado/restaurar.ts
// SOLO SERVIDOR (usa `lib/versionado/huella`, que depende de node:crypto). C4b-1a — piezas REUTILIZABLES de «volver a una
// versión anterior» (C4b con `f3Resultado`, C4c con `f2M1`). Solo lo que no depende de qué artefacto sea:
//   · leerVersionObjetivo: lee la versión elegida DENTRO de la transacción y decide si se puede restaurar;
//   · huellaRestauracion: ata la confirmación del usuario al estado exacto que vio (sin uid ni contenido);
//   · armarCambioRestauracion: el `CambioArtefacto` de la versión nueva (tipo «restauracion», aprobación retirada).
// No hay una interfaz genérica de «artefacto»: lo propio de cada fase (qué más se ajusta, líneas de impacto, bloqueos)
// vive en su módulo (`restaurarF3.ts`).

import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { huellaContenido } from "@/lib/versionado/huella";
import type { CambioArtefacto } from "@/lib/versionado/registrar";
import type { AprobacionVersion, EstadoArtefacto } from "@/lib/versionado/tipos";

/** Por qué una versión elegida no se puede restaurar (el servidor decide; el lector no lo adelanta). */
export type RechazoVersion =
  /** No existe, fue podada o pertenece a OTRO artefacto: nunca se distingue hacia afuera. */
  | "version_no_encontrada"
  /** Existe, pero se guardó sin contenido (`contenidoOmitido`) o sin él: solo hay su huella. */
  | "version_no_restaurable";

export type ResultadoVersionObjetivo =
  | { ok: true; n: number; contenido: unknown; aprobacion?: AprobacionVersion }
  | { ok: false; codigo: RechazoVersion };

/** Un `versionId` válido es un texto no vacío sin «/» (nunca puede salir de la subcolección `versiones`). */
export function versionIdValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 200 && !v.includes("/");
}

/**
 * Lee `versiones/{versionId}` con `tx.get` (releída dentro de la transacción). La versión debe pertenecer a
 * `artefacto` (su campo `artefacto`, no solo el prefijo del id), existir (la poda borra el documento) y traer
 * contenido. Una versión con `contenidoOmitido: true` NO es restaurable: solo conserva la huella.
 */
export async function leerVersionObjetivo(
  tx: Transaction,
  raiz: DocumentReference,
  artefacto: string,
  versionId: string
): Promise<ResultadoVersionObjetivo> {
  if (!versionIdValido(versionId)) return { ok: false, codigo: "version_no_encontrada" };
  const snap = await tx.get(raiz.collection("versiones").doc(versionId));
  if (!snap.exists) return { ok: false, codigo: "version_no_encontrada" };
  const d = (snap.data() ?? {}) as Record<string, unknown>;
  if (d.artefacto !== artefacto) return { ok: false, codigo: "version_no_encontrada" };
  if (d.contenidoOmitido === true || d.contenido === undefined || d.contenido === null || typeof d.n !== "number") {
    return { ok: false, codigo: "version_no_restaurable" };
  }
  return {
    ok: true,
    n: d.n,
    contenido: d.contenido,
    ...(d.aprobacion && typeof d.aprobacion === "object" ? { aprobacion: d.aprobacion as AprobacionVersion } : {}),
  };
}

export interface EntradaHuellaRestauracion {
  /** `{n}` del puntero de la fase leído en la transacción (null/undefined = sin historial todavía → 0). */
  puntero: { n?: unknown } | null | undefined;
  /** `versionId` de la versión que se quiere restaurar. */
  objetivo: string;
  /** `versionId` vigente según el manifiesto (null = el artefacto aún no tiene versión). */
  vigente: string | null;
  /**
   * Lo propio de la fase que también cambiaría (hash del vivo, asignaciones afectadas, si está bloqueado…). El
   * llamador NO pasa uids, contenido, nombres de archivo ni el resultado de comprobaciones externas (Storage):
   * si entraran, la confirmación quedaría «vencida» por nada.
   */
  extras: unknown;
}

/** Huella de lo que el usuario vio al decidir. Sin uid ni contenido: solo ids de versión, el contador y las extras. */
export function huellaRestauracion(e: EntradaHuellaRestauracion): string {
  return huellaContenido({
    n: typeof e.puntero?.n === "number" ? e.puntero.n : 0,
    objetivo: e.objetivo,
    vigente: e.vigente,
    extras: e.extras,
  });
}

export interface EntradaCambioRestauracion {
  artefacto: string;
  /** Contenido de la versión restaurada (reemplaza al vivo). */
  contenido: unknown;
  /** Proyección viva del artefacto DESPUÉS de escribir lo restaurado (la misma función que arma el vivo al leer). */
  vivo: unknown;
  /** Estado y proyección viva ANTES (el documento vivo actual): permiten la versión previa y detectar deriva. */
  estadoPrevio?: EstadoArtefacto;
  vivoPrevio?: unknown;
  /** Constancia de que lo restaurado queda SIN aprobar: `en` es un ISO concreto (nunca un marcador de servidor). */
  aprobacion: { en: string; notas?: string };
  por: string;
}

/**
 * El `CambioArtefacto` de la versión nueva. La aprobación va siempre RETIRADA (`aprobado: false`, con quién y cuándo):
 * volver a una versión anterior nunca devuelve una aprobación vieja. La regla vive aquí (llamador), no en el núcleo.
 */
export function armarCambioRestauracion(e: EntradaCambioRestauracion): CambioArtefacto {
  return {
    artefacto: e.artefacto,
    contenido: e.contenido,
    aprobacion: { aprobado: false, por: e.por, en: e.aprobacion.en, ...(e.aprobacion.notas ? { notas: e.aprobacion.notas } : {}) },
    vivo: e.vivo,
    ...(e.estadoPrevio ? { estadoPrevio: e.estadoPrevio } : {}),
    ...(e.vivoPrevio !== undefined ? { vivoPrevio: e.vivoPrevio } : {}),
  };
}
