// lib/moddulo/guardadoHonesto.ts
// Pure decision logic for "what should the screen say after a save-like request".
// Pages only perform effects (fetch, setState); every decision lives here so it
// can be tested without a DOM. Principle: the UI never claims a success the
// server did not confirm (bitácora H17).
//
// Extensible by design: add a new `AccionGuardado` and its label in ETIQUETAS.
// Out of scope on purpose: authorship, dates, roles (Grupo 2 / H03 / H-M7).

import { motivoBloqueoF3, type VerboF3 } from "./impactoReemplazoDVS";

export type AccionGuardado =
  | "aprobar_motor"
  | "guardar_borrador"
  | "finalizar_analisis"
  | "cerrar_fase"
  | "registrar_aprobacion"
  | "actualizar_proyecto"
  | "eliminar_proyecto"
  | "importar_adjuntos_moddulo"
  | "reemplazar_analisis"
  | "generar_analisis"
  | "guardar_analisis"
  | "generar_sintesis"
  | "generar_veredicto"
  | "generar_tablero"
  | "sincronizar_tablero";

/** F3 generators (H-M3): they write only when nothing was there; no confirmation exists. */
const ACCIONES_F3: readonly AccionGuardado[] = [
  "generar_sintesis",
  "generar_veredicto",
  "generar_tablero",
  "sincronizar_tablero",
];
const esAccionF3 = (a: AccionGuardado) => ACCIONES_F3.includes(a);

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
      /** `error` field of the JSON body (e.g. "reemplazo_bloqueado"), when present. */
      codigo?: string;
      /** `motor` field of the JSON body (the Claude motor that failed), when present. */
      motor?: string;
      /** `mensaje` field of the JSON body (e.g. the block reason), when present. */
      mensaje?: string;
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
  /** For reemplazar_analisis: whether the request carried the user's confirmation. */
  confirmado?: boolean;
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
    case "eliminar_proyecto":
      return "la eliminación del proyecto";
    case "reemplazar_analisis":
      return "el reemplazo del análisis finalizado";
    case "generar_analisis":
      return "la generación del análisis";
    case "guardar_analisis":
      return "el guardado de los cambios del análisis";
    case "generar_sintesis":
      return "la generación de la síntesis";
    case "generar_veredicto":
      return "la generación del veredicto";
    case "generar_tablero":
      return "la generación del tablero";
    case "sincronizar_tablero":
      return "la sincronización del tablero";
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
    case "eliminar_proyecto":
      return "El proyecto sigue en tu lista; inténtalo de nuevo.";
    case "reemplazar_analisis":
      return "El análisis anterior sigue vigente; inténtalo de nuevo.";
    case "generar_analisis":
      return "Los cambios del formulario sí se guardaron; vuelve a intentarlo.";
    case "guardar_analisis":
      return "Sigues en modo edición y tus cambios siguen en pantalla; el análisis anterior sigue vigente. Inténtalo de nuevo.";
    case "generar_sintesis":
    case "generar_veredicto":
    case "generar_tablero":
    case "sincronizar_tablero":
      return "No se guardó nada; la Fase 3 sigue como estaba. Inténtalo de nuevo.";
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
    if (accion === "reemplazar_analisis") {
      // Without the user's confirmation the server never writes, so "nothing was
      // replaced" is true by construction; with it, the request may have landed.
      if (ctx.confirmado === false) {
        return "No se pudo verificar el impacto del reemplazo: sin conexión con el servidor. No se reemplazó nada, porque aún no habías confirmado.";
      }
      return "No se pudo CONFIRMAR el reemplazo del análisis finalizado: sin conexión con el servidor. Puede que sí se haya reemplazado; recarga la página para verificar el estado.";
    }
    if (accion === "generar_analisis") {
      return "No se pudo CONFIRMAR la generación del análisis: sin conexión con el servidor. Los cambios del formulario sí se guardaron; puede que el análisis sí se haya generado, recarga la página para verificar el estado.";
    }
    if (accion === "guardar_analisis") {
      // finalize-dvs writes WITHOUT asking when the edit has no impact on F3, so
      // (unlike the replacement in generate-dvs) an unconfirmed request may have
      // written: always ambiguous.
      return "No se pudo CONFIRMAR el guardado de los cambios del análisis: sin conexión con el servidor. Puede que sí se hayan guardado; tus cambios siguen en pantalla, pero recarga la página para verificar el estado antes de volver a editar.";
    }
    return `No se pudo CONFIRMAR ${que}: sin conexión con el servidor. Puede que sí se haya registrado; recarga la página para verificar el estado.`;
  }
  // A gateway timeout (or the server's own "write outcome unknown" code) does not
  // prove the replacement did not happen: same ambiguity as a network failure.
  if (
    (accion === "reemplazar_analisis" || accion === "generar_analisis" || accion === "guardar_analisis" || accion === "finalizar_analisis") &&
    resp.tipo === "respuesta" &&
    (resp.status === 502 || resp.status === 503 || resp.status === 504 || resp.codigo === "reemplazo_escritura_incierta") &&
    (ctx.confirmado !== false || accion === "guardar_analisis" || accion === "finalizar_analisis")
  ) {
    if (accion === "reemplazar_analisis") {
      return "No se pudo CONFIRMAR el reemplazo del análisis finalizado: el servidor no respondió a tiempo. Puede que sí se haya reemplazado; recarga la página para verificar el estado.";
    }
    if (accion === "guardar_analisis") {
      return "No se pudo CONFIRMAR el guardado de los cambios del análisis: el servidor no respondió a tiempo. Puede que sí se hayan guardado; tus cambios siguen en pantalla, pero recarga la página para verificar el estado antes de volver a editar.";
    }
    if (accion === "finalizar_analisis") {
      return "No se pudo CONFIRMAR la finalización del análisis: el servidor no respondió a tiempo. Puede que sí se haya finalizado; recarga la página para verificar el estado.";
    }
    return "No se pudo CONFIRMAR la generación del análisis: el servidor no respondió a tiempo. Los cambios del formulario sí se guardaron; puede que el análisis sí se haya generado, recarga la página para verificar el estado.";
  }
  // F3 generators: a 500 that names a Claude motor failed BEFORE any write (certain);
  // any other 5xx / gateway timeout / "uncertain write" code may have written.
  if (
    esAccionF3(accion) &&
    resp.tipo === "respuesta" &&
    !resp.motor &&
    (resp.status >= 500 || resp.codigo === "reemplazo_escritura_incierta")
  ) {
    return `No se pudo CONFIRMAR ${que}: el servidor no respondió como se esperaba. Puede que sí se haya registrado; recarga la página para verificar el estado.`;
  }
  if (accion === "registrar_aprobacion") {
    return "La fase se cerró, pero no se pudo registrar la fecha de aprobación.";
  }
  if (accion === "importar_adjuntos_moddulo") {
    return `No se pudieron importar automáticamente los documentos de Moddulo F2. ${motivo(resp)} Puedes cargarlos manualmente.`;
  }
  // A 404 on DELETE after an ambiguous network failure usually means the first
  // request DID delete it: never claim "the project is still in your list".
  if (accion === "eliminar_proyecto" && resp.tipo === "respuesta" && resp.status === 404) {
    return "No se encontró el proyecto; puede que ya se haya eliminado. Recarga la lista para verificar.";
  }
  const queConMotor =
    resp.tipo === "respuesta" && resp.motor && (accion === "reemplazar_analisis" || accion === "generar_analisis" || accion === "guardar_analisis" || esAccionF3(accion))
      ? `${que} (falló ${resp.motor})`
      : que;
  return `No se pudo registrar ${queConMotor}. ${motivo(resp)} ${consecuencia(accion)}`;
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

/**
 * M8 "Reemplazar análisis finalizado…": the server answers 409 with one of three
 * codes (needs confirmation / blocked / fingerprint expired) that are NOT
 * failures, plus real failures. Any other 409 is a real failure.
 */
export type DecisionReemplazoUI =
  | ({ tipo: "exito" } & ReversionAprobacion)
  | ({ tipo: "requiere_confirmacion" } & ReversionAprobacion)
  | ({ tipo: "bloqueado" } & ReversionAprobacion)
  | ({ tipo: "huella_vencida" } & ReversionAprobacion)
  | ({ tipo: "error"; mensajeError: string } & ReversionAprobacion);

/**
 * "Finalizar análisis" approves M5 optimistically. If the request does not end
 * in a finalized analysis — including the 409s that open the confirmation modal —
 * the approval goes back to its previous value, so Cancel (or a failure) leaves
 * the screen exactly as it was before the click: nothing finalized, nothing
 * approved by that click. Other actions carry no approval to revert.
 */
interface ReversionAprobacion {
  revertirAprobacion?: boolean;
  valorRestaurado?: boolean;
}

export type AccionConConfirmacion = "reemplazar_analisis" | "guardar_analisis" | "finalizar_analisis";

export function decidirReemplazoAnalisis(
  resp: RespuestaGuardado,
  ctx: ContextoGuardado = {},
  accion: AccionConConfirmacion = "reemplazar_analisis"
): DecisionReemplazoUI {
  const revert: ReversionAprobacion =
    accion === "finalizar_analisis"
      ? { revertirAprobacion: true, valorRestaurado: ctx.aprobadoPrevio ?? false }
      : {};
  if (resp.tipo === "respuesta" && resp.status === 409) {
    if (resp.codigo === "reemplazo_requiere_confirmacion") return { tipo: "requiere_confirmacion", ...revert };
    if (resp.codigo === "reemplazo_bloqueado") return { tipo: "bloqueado", ...revert };
    if (resp.codigo === "reemplazo_huella_vencida") return { tipo: "huella_vencida", ...revert };
  }
  const d = decidirResultadoGuardado(accion, resp, ctx);
  if (d.exito) return { tipo: "exito" };
  return { tipo: "error", mensajeError: d.mensajeError ?? "", ...revert };
}

/**
 * H-M3: the answer of the F3 generators. Two 409s that are NOT failures: "ya existe"
 * (the screen is stale: what it offered to generate already exists) and "bloqueado"
 * (the Reporte F3 / approved verdict exists; PROVISIONAL). Neither offers to confirm
 * or retry: there is no regenerate function. Any other answer is a failure or success.
 */
export type DecisionGeneracionF3UI =
  | { tipo: "exito" }
  | { tipo: "ya_existe"; mensajeError: string }
  | { tipo: "bloqueado"; mensajeError: string }
  | { tipo: "error"; mensajeError: string };

const VERBO_F3: Partial<Record<AccionGuardado, VerboF3>> = {
  generar_sintesis: "generar_sintesis",
  generar_veredicto: "generar_veredicto",
  generar_tablero: "generar_tablero",
  sincronizar_tablero: "sincronizar_tablero",
};

export function decidirGeneracionF3UI(accion: AccionGuardado, resp: RespuestaGuardado): DecisionGeneracionF3UI {
  if (resp.tipo === "respuesta" && resp.status === 409) {
    if (resp.codigo === "f3_ya_existe" && (accion === "generar_sintesis" || accion === "generar_veredicto")) {
      const que = accion === "generar_sintesis" ? "la síntesis" : "el veredicto";
      return {
        tipo: "ya_existe",
        mensajeError: `Esta pantalla está desactualizada: ${que} ya existe. No se generó nada; recarga la página.`,
      };
    }
    if (resp.codigo === "reemplazo_bloqueado") {
      const verbo = VERBO_F3[accion];
      return {
        tipo: "bloqueado",
        mensajeError: resp.mensaje ?? (verbo ? motivoBloqueoF3(verbo) : "La Fase 3 está cerrada."),
      };
    }
  }
  const d = decidirResultadoGuardado(accion, resp);
  if (d.exito) return { tipo: "exito" };
  return { tipo: "error", mensajeError: d.mensajeError ?? "" };
}

/**
 * Form branch of "Guardar cambios" (camino #8): after saving the form data the
 * page asks for a first generation. If the generation does not succeed the page
 * must not run the back-propagation check, switch to "completed" or open the
 * report. A 409 here means the screen is stale (a finalized analysis already
 * exists on the server): never offer to confirm from this branch.
 */
export interface DecisionGeneracionF2 {
  exito: boolean;
  mensajeError: string | null;
  propagar: boolean;
  pasarACompleted: boolean;
  abrirReporte: boolean;
}

export function decidirResultadoGeneracionF2(resp: RespuestaGuardado): DecisionGeneracionF2 {
  const ok = resp.tipo === "respuesta" && resp.ok && resp.cuerpoValido !== false;
  if (ok) {
    return { exito: true, mensajeError: null, propagar: true, pasarACompleted: true, abrirReporte: true };
  }
  const desactualizada = resp.tipo === "respuesta" && resp.status === 409;
  const mensajeError = desactualizada
    ? "Ya existe un análisis finalizado en el servidor; esta pantalla está desactualizada. Los cambios del formulario sí se guardaron. No se reemplazó nada: recarga la página."
    : (decidirResultadoGuardado("generar_analisis", resp).mensajeError ?? "");
  return { exito: false, mensajeError, propagar: false, pasarACompleted: false, abrirReporte: false };
}
