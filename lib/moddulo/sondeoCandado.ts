// lib/moddulo/sondeoCandado.ts
// PURE. The screen asks the server «what would be lost?» BEFORE opening the confirmation modal of
// «Nuevo análisis» / «Desvincular» (the request carries no confirmation, so the server never writes: it
// answers 409 with the real lines and the fingerprint to confirm against, or 200 when there is nothing to
// lose). This module turns that answer into what the screen does next. It never opens a modal on a
// failure: a network error or a 5xx is shown as «No se pudo CONFIRMAR…» with a retry, because a modal with
// the wrong lines (or none) would ask the user to confirm blind.
//
// Also the small pure decisions of the automatic import («pest_analysis_id» in the URL).

import { MENSAJE_FASE_CERRADA_REEMPLAZO, type RespuestaGuardado } from "./guardadoHonesto";

export type AccionSondeo = "nuevo_analisis" | "desvincular";

export type DecisionSondeo =
  /** Nothing to lose (clean project): the action goes ahead without a modal. */
  | { tipo: "continuar" }
  /** Open the modal with the server's lines and fingerprint. */
  | { tipo: "confirmar"; lineas: string[] | undefined; huella: string | null; aviso: string | null }
  /** Show the message (no modal); `reintentable` offers «Reintentar». */
  | { tipo: "error"; mensaje: string; reintentable: boolean };

const QUE: Record<AccionSondeo, string> = {
  nuevo_analisis: "generar un análisis nuevo",
  desvincular: "desvincular el análisis de Centinela",
};

function lineasDe(datos: Record<string, unknown>): string[] | undefined {
  const l = datos.lineas;
  return Array.isArray(l) && l.every((x) => typeof x === "string") ? (l as string[]) : undefined;
}

export function decidirSondeo(accion: AccionSondeo, resp: RespuestaGuardado, datos: Record<string, unknown> = {}): DecisionSondeo {
  const que = QUE[accion];
  // The probe carries no confirmation, so the server wrote nothing: «no se hizo ningún cambio» is true by construction.
  const reintentar = (porQue: string): DecisionSondeo => ({
    tipo: "error",
    mensaje: `No se pudo CONFIRMAR lo que se perdería al ${que}: ${porQue}. No se hizo ningún cambio; vuelve a intentarlo.`,
    reintentable: true,
  });
  if (resp.tipo === "error_red") return reintentar("sin conexión con el servidor");

  if (resp.ok) {
    // «Nuevo análisis» answers 200 {verificado} only for a clean project. «Desvincular» always asks, so a 200
    // is not the answer of the current server: do not pretend anything.
    if (accion === "nuevo_analisis" && resp.cuerpoValido !== false) return { tipo: "continuar" };
    return reintentar("el servidor respondió algo inesperado");
  }

  if (resp.status === 409) {
    if (resp.codigo === "reemplazo_requiere_confirmacion" || resp.codigo === "reemplazo_huella_vencida") {
      return {
        tipo: "confirmar",
        lineas: lineasDe(datos),
        huella: typeof datos.huella === "string" ? datos.huella : null,
        aviso: resp.codigo === "reemplazo_huella_vencida" ? "El estado del análisis cambió. Revisa lo que se perderá y confirma de nuevo." : null,
      };
    }
    if (resp.codigo === "fase_cerrada") {
      return {
        tipo: "error",
        mensaje: accion === "nuevo_analisis" ? MENSAJE_FASE_CERRADA_REEMPLAZO : "La Fase 2 está cerrada: no se puede desvincular el análisis. No se hizo ningún cambio.",
        reintentable: false,
      };
    }
    if (resp.codigo === "pestel_linked") {
      return {
        tipo: "error",
        mensaje: "Este proyecto tiene un análisis de Centinela vinculado; desvincúlalo antes de generar uno nuevo con Moddulo. No se generó nada.",
        reintentable: false,
      };
    }
  }
  if (resp.status === 400 && resp.codigo === "not_linked") {
    return {
      tipo: "error",
      mensaje: "Este proyecto ya no aparece vinculado a un análisis de Centinela PESTEL (puede que se haya desvinculado en otra pestaña). Recarga la página para ver el estado real.",
      reintentable: false,
    };
  }
  if (resp.status === 404) {
    return { tipo: "error", mensaje: "No se encontró el proyecto; puede que ya no exista o no tengas acceso. Recarga la página para verificar. No se hizo ningún cambio.", reintentable: false };
  }
  if (resp.status === 401 || resp.status === 403) {
    return { tipo: "error", mensaje: `No tienes permiso para ${que}. No se hizo ningún cambio.`, reintentable: false };
  }
  return reintentar("el servidor no respondió como se esperaba");
}

// ── Automatic import (pest_analysis_id in the URL) ────────────────────────────

export const PARAMETRO_IMPORT_PESTEL = "pest_analysis_id";

/**
 * The path+search to `router.replace` WITHOUT the parameter, or null when the URL does not carry it.
 * Keeps every other parameter and the hash.
 */
export function urlSinParametro(href: string, nombre: string = PARAMETRO_IMPORT_PESTEL): string | null {
  let u: URL;
  try {
    u = new URL(href, "http://local");
  } catch {
    return null;
  }
  if (!u.searchParams.has(nombre)) return null;
  u.searchParams.delete(nombre);
  return `${u.pathname}${u.search}${u.hash}`;
}

/**
 * Cancelling the confirmation of the AUTOMATIC import («sync», triggered by the parameter in the URL) must
 * remove the parameter, or F5 would ask again; the manual «relink» has no parameter to remove.
 */
export function urlAlCancelarImport(source: "relink" | "sync", href: string): string | null {
  return source === "sync" ? urlSinParametro(href) : null;
}

// ── Confirming the import (modal «vincular») ──────────────────────────────────

export type DecisionConfirmacionImport =
  /** The state changed since the user looked: keep the modal open with the fresh lines and fingerprint. */
  | { tipo: "reconfirmar"; lineas: string[] | undefined; huella: string | null; aviso: string }
  /** Keep the modal open and show the message; `reintentable` means «Confirmar» may be pressed again. */
  | { tipo: "error"; mensaje: string; reintentable: boolean };

/**
 * What the modal does when the CONFIRMED import request did not succeed. It never closes in silence. A lost
 * response (network, 5xx, gateway) says «No se pudo CONFIRMAR…» and claims neither that the import happened nor
 * that it did not; a 4xx wrote nothing by construction and shows the server's own text.
 */
export function decidirConfirmacionImport(resp: RespuestaGuardado, datos: Record<string, unknown> = {}): DecisionConfirmacionImport {
  const incierto = (porQue: string): DecisionConfirmacionImport => ({
    tipo: "error",
    mensaje: `No se pudo CONFIRMAR la importación del análisis de Centinela: ${porQue}. No se puede saber si se completó; puedes volver a intentarlo o recargar la página para verificar el estado.`,
    reintentable: true,
  });
  if (resp.tipo === "error_red") return incierto("sin conexión con el servidor");
  if (resp.ok || resp.status >= 500 || resp.codigo === "reemplazo_escritura_incierta") {
    return incierto("el servidor no respondió como se esperaba");
  }
  if (resp.status === 409) {
    if (resp.codigo === "conflict" || resp.codigo === "reemplazo_requiere_confirmacion" || resp.codigo === "reemplazo_huella_vencida") {
      return {
        tipo: "reconfirmar",
        lineas: lineasDe(datos),
        huella: typeof datos.huella === "string" ? datos.huella : null,
        aviso: "El estado del análisis cambió. No se importó nada: revisa lo que se perderá y confirma de nuevo.",
      };
    }
    if (resp.codigo === "fase_cerrada") return { tipo: "error", mensaje: MENSAJE_FASE_CERRADA_REEMPLAZO, reintentable: false };
  }
  // Any other 4xx: the server wrote nothing. Show its own readable text (never a bare code).
  const propio = [datos.message, datos.mensaje, datos.error].find((x): x is string => typeof x === "string" && /\s/.test(x.trim()));
  const base = propio
    ?? (resp.status === 401 || resp.status === 403
      ? "No tienes permiso para importar este análisis."
      : resp.status === 404
        ? "No se encontró el análisis o el proyecto; puede que ya no exista."
        : "El servidor rechazó la importación.");
  return { tipo: "error", mensaje: `${base} No se importó nada.`, reintentable: false };
}
