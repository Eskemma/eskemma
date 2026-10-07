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
  | "cerrar_fase";

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
    };
  }
  const revierte =
    accion === "aprobar_motor" || accion === "finalizar_analisis";
  return {
    exito: false,
    mensajeError: `No se pudo registrar ${sujeto(accion, ctx)}. ${motivo(resp)} ${consecuencia(accion)}`,
    revertirAprobacion: revierte,
    valorRestaurado: revierte ? (ctx.aprobadoPrevio ?? false) : undefined,
    marcarGuardado: false,
    continuar: false,
  };
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
