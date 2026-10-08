// lib/auth/cargadorSesion.ts
// Orchestrates the auth load WITHOUT touching React or Firebase: every effect
// is injected, so the rules (single timer, load-id guard, backoff cap, retry
// of the READ phase only) are testable in node.
//
// Phases:
//   leer        READ phase (reload, forced token refresh, profile read and the
//               idempotent create-if-absent). Safe to repeat; the only thing
//               that is ever retried.
//   alVerificar WRITE phase (arms the user, then role/claim/cookie/modals).
//               Runs at most once per load, only after `leer` succeeded; it
//               never schedules a retry.

import {
  decidirSesionTrasError,
  esCargaVigente,
  esperaReintentoMs,
} from "./decidirSesionTrasError";

export interface UsuarioMin {
  uid: string;
}

export interface DepsCargador<U extends UsuarioMin, T> {
  /** READ phase. Resolve `null` when there is no signed-in user anymore. */
  leer: (usuario: U) => Promise<T | null>;
  /** WRITE phase. Receives a predicate to stop touching state when stale. */
  alVerificar: (datos: T, usuario: U, vigente: () => boolean) => Promise<void>;
  /** Invalid session (disabled, expired token...): sign out + clear state. */
  alCerrar: () => Promise<void>;
  alUsuarioAusente: () => void;
  /** Transient failure, retries scheduled: keep the app on the spinner. */
  alPendiente: () => void;
  /** Retries exhausted: unverified session, app renders with user = null. */
  alAgotar: () => void;
  /** Unknown, non-transient failure: behaves as before (loading = false). */
  alErrorDesconocido: (error: unknown) => void;
  obtenerUsuarioActual: () => U | null;
  programar: (fn: () => void, ms: number) => unknown;
  cancelarTimer: (handle: unknown) => void;
  log: {
    info: (...a: unknown[]) => void;
    warn: (...a: unknown[]) => void;
    error: (...a: unknown[]) => void;
  };
}

export interface CargadorSesion<U extends UsuarioMin> {
  /** New load (onAuthStateChanged with a user): invalidates any older one. */
  cargar: (usuario: U) => Promise<void>;
  /** Manual "Reintentar" / `online` event; no-op unless pending or exhausted. */
  reintentarAhora: () => Promise<void>;
  /** Sign-out / unmount: cancels the timer and invalidates in-flight loads. */
  cancelar: () => void;
  estado: () => "idle" | "pendiente" | "agotada";
}

export function crearCargadorSesion<U extends UsuarioMin, T>(
  deps: DepsCargador<U, T>
): CargadorSesion<U> {
  let idCarga = 0;
  let intentos = 0;
  let timer: unknown = null;
  let verificadoUid: string | null = null;
  let estado: "idle" | "pendiente" | "agotada" = "idle";

  const vigente = (id: number) => esCargaVigente(id, idCarga);

  function limpiarTimer() {
    if (timer !== null) {
      deps.cancelarTimer(timer);
      timer = null;
    }
  }

  async function ejecutar(usuario: U, id: number): Promise<void> {
    let datos: T | null;
    try {
      datos = await deps.leer(usuario);
    } catch (error) {
      if (!vigente(id)) return;
      await manejarFallo(error, usuario, id);
      return;
    }
    if (!vigente(id)) return;
    if (datos === null) {
      estado = "idle";
      deps.alUsuarioAusente();
      return;
    }
    estado = "idle";
    intentos = 0;
    // Armed from here on: a later failure must never schedule a retry.
    verificadoUid = usuario.uid;
    try {
      await deps.alVerificar(datos, usuario, () => vigente(id));
    } catch (error) {
      if (!vigente(id)) return;
      deps.log.error("Error al completar la carga de la sesión:", error);
      deps.alErrorDesconocido(error);
    }
  }

  async function manejarFallo(error: unknown, usuario: U, id: number): Promise<void> {
    const d = decidirSesionTrasError(error);
    if (d.accion === "cerrar") {
      limpiarTimer();
      estado = "idle";
      verificadoUid = null;
      deps.log.info("Sesión inválida, se cierra:", error);
      await deps.alCerrar();
      return;
    }
    if (!d.reintentar) {
      estado = "idle";
      deps.log.error("Error al verificar el estado del usuario:", error);
      deps.alErrorDesconocido(error);
      return;
    }
    deps.log.warn("No se pudo verificar la sesión (error transitorio):", error);
    if (verificadoUid === usuario.uid) return; // already verified: nothing pending
    intentos += 1;
    const espera = esperaReintentoMs(intentos, d.espera);
    if (espera === null) {
      limpiarTimer();
      estado = "agotada";
      deps.alAgotar();
      return;
    }
    estado = "pendiente";
    deps.alPendiente();
    limpiarTimer(); // a single scheduled retry at any time
    timer = deps.programar(() => {
      timer = null;
      if (!vigente(id)) return;
      const actual = deps.obtenerUsuarioActual();
      if (!actual || actual.uid !== usuario.uid) {
        estado = "idle";
        return;
      }
      void ejecutar(actual, id);
    }, espera);
  }

  return {
    cargar(usuario) {
      idCarga += 1;
      limpiarTimer();
      intentos = 0;
      estado = "idle";
      if (verificadoUid !== usuario.uid) verificadoUid = null;
      return ejecutar(usuario, idCarga);
    },
    async reintentarAhora() {
      if (estado === "idle") return;
      const actual = deps.obtenerUsuarioActual();
      if (!actual) return;
      idCarga += 1;
      limpiarTimer();
      intentos = 0;
      const eraAgotada = estado === "agotada";
      estado = "pendiente";
      if (eraAgotada) deps.alPendiente();
      await ejecutar(actual, idCarga);
    },
    cancelar() {
      idCarga += 1;
      limpiarTimer();
      intentos = 0;
      estado = "idle";
      verificadoUid = null;
    },
    estado: () => estado,
  };
}
