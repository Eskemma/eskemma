// lib/auth/decidirSesionTrasError.ts
// Pure decisions for "what do we do with the session after the READ phase of
// the auth load failed". A network outage is NOT an invalid session (4b).
//
// Codes verified against @firebase/auth 1.10.8: the SDK itself signs the user
// out on `auth/user-disabled` and `auth/user-token-expired` (its USER_NOT_FOUND
// from the token endpoint maps to the latter, `INVALID_ID_TOKEN` to
// `auth/invalid-user-token`); its own startup policy keeps the session only on
// `auth/network-request-failed`. Firestore codes carry no prefix.

export type AccionSesion = "mantener" | "cerrar";
export type EsperaSesion = "normal" | "larga";

export interface DecisionSesion {
  accion: AccionSesion;
  /** Transient failure: keep the session pending and retry the READ phase. */
  reintentar: boolean;
  /** Longer waits for rate limiting. */
  espera: EsperaSesion;
}

const CODIGOS_CERRAR = new Set([
  "auth/user-token-expired",
  "auth/user-disabled",
  "auth/invalid-user-token",
  "auth/user-not-found",
]);

const CODIGOS_TRANSITORIOS = new Set([
  "auth/network-request-failed",
  "unavailable",
  "deadline-exceeded",
]);

const CODIGO_LIMITE = "auth/too-many-requests";

/** Extracts a string `code` from any object (FirebaseError or look-alike). */
export function codigoDeError(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return null;
  return code.replace(/^firestore\//, "");
}

export function decidirSesionTrasError(error: unknown): DecisionSesion {
  const code = codigoDeError(error);
  if (code !== null && CODIGOS_CERRAR.has(code)) {
    return { accion: "cerrar", reintentar: false, espera: "normal" };
  }
  if (code !== null && CODIGOS_TRANSITORIOS.has(code)) {
    return { accion: "mantener", reintentar: true, espera: "normal" };
  }
  if (code === CODIGO_LIMITE) {
    return { accion: "mantener", reintentar: true, espera: "larga" };
  }
  return { accion: "mantener", reintentar: false, espera: "normal" };
}

/** Max retries of the read phase before giving up (session stays unverified). */
export const TOPE_INTENTOS = 8;

const ESPERAS_NORMAL_MS = [2000, 5000, 10000, 20000, 30000, 30000, 30000, 30000];
const ESPERAS_LARGA_MS = [30000, 60000, 60000, 60000, 60000, 60000, 60000, 60000];

/** Wait before retry number `intento` (1-based); null once the cap is passed. */
export function esperaReintentoMs(intento: number, espera: EsperaSesion): number | null {
  if (!Number.isInteger(intento) || intento < 1 || intento > TOPE_INTENTOS) return null;
  const tabla = espera === "larga" ? ESPERAS_LARGA_MS : ESPERAS_NORMAL_MS;
  return tabla[intento - 1];
}

/**
 * Only the LATEST load may update the screen (same idea as
 * esRespuestaVigente in guardadoHonesto): a stale load that finishes late
 * must not overwrite a newer one, nor resurrect a closed session.
 */
export function esCargaVigente(idCarga: number, idActual: number): boolean {
  return idCarga === idActual;
}

/** Pending time after which the spinner explains the situation. */
export const MS_TEXTO_SIN_CONEXION = 10000;

/**
 * A Firestore write issued without network does NOT reject: it stays queued
 * and the awaiting promise hangs. This bounds any await so the session load
 * can never be blocked indefinitely; the underlying write stays queued in
 * the SDK and is applied when connectivity returns.
 */
export function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error("Tiempo de espera agotado"), { code: "deadline-exceeded" }));
    }, ms);
    promesa.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}
