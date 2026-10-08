// lib/moddulo/guardadoHonesto.ts
// Pure decision logic for "what should the screen say after a save-like request".
// Pages only perform effects (fetch, setState); every decision lives here so it
// can be tested without a DOM. Principle: the UI never claims a success the
// server did not confirm (bitácora H17).
//
// Extensible by design: add a new `AccionGuardado` and its label in ETIQUETAS.
// Out of scope on purpose: authorship, dates, roles (Grupo 2 / H03 / H-M7).

export type AccionGuardado =
  | "aprobar_motor"
  | "guardar_borrador"
  | "finalizar_analisis"
  | "cerrar_fase"
  | "registrar_aprobacion"
  | "actualizar_proyecto"
  | "importar_adjuntos_moddulo";

/** Actions whose failure must NOT stop the flow: show a notice only. */
const ACCIONES_NO_BLOQUEANTES: readonly AccionGuardado[] = [
  "registrar_aprobacion",
  "importar_adjuntos_moddulo",
];

export type RespuestaGuardado =
  | {
      tipo: "respuesta";
      ok: boolean;
      status: number;
      /** Only for requests whose success body is read (finalizar_analisis). */
      cuerpoValido?: boolean;
    }
  | { tipo: "error_red" };

export interface ContextoGuardado {
  /** M2..M5 for motor actions. */
  motor?: string;
  /** "Fase 1" / "Fase 2" / "Fase 3" for cerrar_fase. */
  fase?: string;
  /** Approval value before the optimistic update (edit mode starts approved). */
  aprobadoPrevio?: boolean;
  /** For actualizar_proyecto: what changed ("el cambio de estado del proyecto"). */
  cambio?: string;
}

export interface DecisionGuardado {
  exito: boolean;
  /** Message to show; null on success. */
  mensajeError: string | null;
  /** Undo the optimistic approval. */
  revertirAprobacion: boolean;
  /** Value to restore when `revertirAprobacion` (previous value, not blindly false). */
  valorRestaurado: boolean | undefined;
  /** Whether the UI may stamp "guardado ✓ hora". */
  marcarGuardado: boolean;
  /** Whether a page may continue (navigate / next step). Equals `exito`. */
  continuar: boolean;
  /**
   * false when the failure must NOT stop the flow (e.g. the second step of a
   * phase close, once the phase is already closed): show a notice only.
   */
  bloqueante: boolean;
}

function sujeto(accion: AccionGuardado, ctx: ContextoGuardado): string {
  switch (accion) {
    case "aprobar_motor":
      return `la aprobación de ${ctx.motor ?? "este motor"}`;
    case "guardar_borrador":
      return "tu edición del borrador";
    case "finalizar_analisis":
      return "la finalización del análisis";
    case "cerrar_fase":
      return `el cierre de ${ctx.fase ?? "la fase"}`;
    case "registrar_aprobacion":
      return "la fecha de aprobación";
    case "actualizar_proyecto":
      return ctx.cambio ?? "el cambio en el proyecto";
    case "importar_adjuntos_moddulo":
      return "la importación automática de los documentos de Moddulo F2";
  }
}

function consecuencia(accion: AccionGuardado): string {
  switch (accion) {
    case "aprobar_motor":
      return "Se revirtió la aprobación; inténtalo de nuevo.";
    case "guardar_borrador":
      return "Tus cambios siguen en pantalla pero NO se guardaron; vuelve a guardar.";
    case "finalizar_analisis":
      return "El análisis no se finalizó; inténtalo de nuevo.";
    case "cerrar_fase":
      return "La fase sigue abierta; inténtalo de nuevo.";
    case "registrar_aprobacion":
    case "importar_adjuntos_moddulo":
      return "";
    case "actualizar_proyecto":
      return "Se conserva el valor anterior; inténtalo de nuevo.";
  }
}

function motivo(resp: RespuestaGuardado): string {
  if (resp.tipo === "error_red") return "Sin conexión con el servidor.";
  if (resp.ok) return "El servidor respondió algo inesperado.";
  if (resp.status === 401 || resp.status === 403) {
    return "No tienes permiso para guardar en este proyecto.";
  }
  if (resp.status === 404) return "El proyecto ya no existe o no tienes acceso.";
  if (resp.status === 400) return "El servidor no aceptó el cambio.";
  return "El servidor no pudo completar la operación.";
}

/**
 * A network failure does not prove the server never received the request, so
 * the message must not claim "it was not registered": it says it could not be
 * CONFIRMED. The exception is the draft, whose unsaved edits live only on
 * screen — reloading would lose them, so it says to save again first.
 */
function mensajeDeFallo(
  accion: AccionGuardado,
  resp: RespuestaGuardado,
  ctx: ContextoGuardado
): string {
  const que = sujeto(accion, ctx);
  if (resp.tipo === "error_red") {
    if (accion === "guardar_borrador") {
      return `No se pudo CONFIRMAR ${que}: sin conexión con el servidor. Tus cambios siguen en pantalla; vuelve a intentar guardar antes de recargar, porque si recargas ahora podrías perderlos.`;
    }
    if (accion === "registrar_aprobacion") {
      return "La fase se cerró, pero no se pudo confirmar el registro de la fecha de aprobación.";
    }
    if (accion === "importar_adjuntos_moddulo") {
      return "No se pudo CONFIRMAR la importación automática de los documentos de Moddulo F2: sin conexión con el servidor. Puede que sí se hayan importado; recarga la página para verificar.";
    }
    return `No se pudo CONFIRMAR ${que}: sin conexión con el servidor. Puede que sí se haya registrado; recarga la página para verificar el estado.`;
  }
  if (accion === "registrar_aprobacion") {
    return "La fase se cerró, pero no se pudo registrar la fecha de aprobación.";
  }
  if (accion === "importar_adjuntos_moddulo") {
    return `No se pudieron importar automáticamente los documentos de Moddulo F2. ${motivo(resp)} Puedes cargarlos manualmente.`;
  }
  return `No se pudo registrar ${que}. ${motivo(resp)} ${consecuencia(accion)}`;
}

export function decidirResultadoGuardado(
  accion: AccionGuardado,
  resp: RespuestaGuardado,
  ctx: ContextoGuardado = {}
): DecisionGuardado {
  const exito =
    resp.tipo === "respuesta" && resp.ok && resp.cuerpoValido !== false;
  if (exito) {
    return {
      exito: true,
      mensajeError: null,
      revertirAprobacion: false,
      valorRestaurado: undefined,
      marcarGuardado: true,
      continuar: true,
      bloqueante: false,
    };
  }
  const revierte =
    accion === "aprobar_motor" || accion === "finalizar_analisis";
  return {
    exito: false,
    mensajeError: mensajeDeFallo(accion, resp, ctx),
    revertirAprobacion: revierte,
    valorRestaurado: revierte ? (ctx.aprobadoPrevio ?? false) : undefined,
    marcarGuardado: false,
    continuar: ACCIONES_NO_BLOQUEANTES.includes(accion),
    bloqueante: !ACCIONES_NO_BLOQUEANTES.includes(accion),
  };
}

/**
 * Closing a phase: step 1 is `complete-phase`; step 2 (only F2) is the PATCH
 * that stamps `aprobadoEn`. Step 1 failing blocks everything (and step 2 must
 * not run). Step 1 OK + step 2 failing does NOT block: the phase is already
 * closed, so we navigate and carry a notice. Authorship / role / closing rules
 * are out of scope (Grupo 2).
 */
export interface DecisionCierre {
  navegar: boolean;
  /** Blocking error (stay on the page); null when the close succeeded. */
  mensajeBloqueante: string | null;
  /** Code from AVISOS_CIERRE to show after navigating; null if none. */
  avisoNoBloqueante: CodigoAvisoCierre | null;
}

export function decidirCierreDeFase(
  paso1: RespuestaGuardado,
  paso2: RespuestaGuardado | null,
  ctx: { fase: string }
): DecisionCierre {
  const d1 = decidirResultadoGuardado("cerrar_fase", paso1, ctx);
  if (!d1.exito) {
    return { navegar: false, mensajeBloqueante: d1.mensajeError, avisoNoBloqueante: null };
  }
  if (paso2 === null) {
    return { navegar: true, mensajeBloqueante: null, avisoNoBloqueante: null };
  }
  const d2 = decidirResultadoGuardado("registrar_aprobacion", paso2, ctx);
  return {
    navegar: true,
    mensajeBloqueante: null,
    avisoNoBloqueante: d2.exito ? null : "aprobacion_no_registrada",
  };
}

/**
 * Notices carried to the destination page through `?aviso=<code>`. CLOSED list:
 * the page only renders the fixed text of a known code and NEVER the raw URL
 * value (an unknown / forged code yields no message at all).
 */
export const AVISOS_CIERRE = {
  aprobacion_no_registrada:
    "La fase anterior se cerró, pero no se pudo registrar la fecha de aprobación.",
} as const;
export type CodigoAvisoCierre = keyof typeof AVISOS_CIERRE;

export function mensajeDeAviso(codigo: string | null | undefined): string | null {
  if (typeof codigo !== "string") return null;
  return Object.prototype.hasOwnProperty.call(AVISOS_CIERRE, codigo)
    ? AVISOS_CIERRE[codigo as CodigoAvisoCierre]
    : null;
}

/**
 * URL to `router.replace` to AFTER reading the notice, so it does not reappear
 * on reload or when the link is shared. Keeps any other query params.
 */
export function urlSinAviso(pathname: string, search: string): string {
  const q = new URLSearchParams(search);
  q.delete("aviso");
  const resto = q.toString();
  return resto ? `${pathname}?${resto}` : pathname;
}

/** Destination URL for the phase-2 close, carrying the notice code if any. */
export function urlTrasCierre(base: string, aviso: CodigoAvisoCierre | null): string {
  return aviso ? `${base}?aviso=${aviso}` : base;
}

/**
 * List loading: "cargado" / "vacio" / "fallido". A failed load (HTTP error,
 * network error or a body that is not the expected JSON) is NEVER "vacio".
 * ("cargando" is page state, before any response.)
 */
export type EstadoLista = "cargado" | "vacio" | "fallido";

export interface DecisionLista {
  estado: EstadoLista;
  mensajeError: string | null;
}

export function decidirEstadoLista(
  resp: RespuestaGuardado,
  cantidad: number,
  ctx: { lista: string; plural?: boolean }
): DecisionLista {
  const ok = resp.tipo === "respuesta" && resp.ok && resp.cuerpoValido !== false;
  if (!ok) {
    const causa =
      resp.tipo === "error_red"
        ? "Revisa tu conexión."
        : resp.ok
          ? "La respuesta del servidor no es válida."
          : resp.status === 401 || resp.status === 403
            ? "Tu sesión no tiene acceso; vuelve a iniciar sesión."
            : "El servidor no pudo responder.";
    const verbo = ctx.plural ? "No se pudieron cargar" : "No se pudo cargar";
    return { estado: "fallido", mensajeError: `${verbo} ${ctx.lista}. ${causa}` };
  }
  return { estado: cantidad === 0 ? "vacio" : "cargado", mensajeError: null };
}

/**
 * Out-of-order guard: only the LATEST request of a given kind may update the
 * screen. A slow request that fails after a later one succeeded must not show
 * an error (nor clear a "saved" mark), and a slow success must not hide a
 * newer failure.
 */
export function esRespuestaVigente(
  secuenciaPeticion: number,
  secuenciaActual: number
): boolean {
  return secuenciaPeticion === secuenciaActual;
}
