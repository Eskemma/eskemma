// lib/moddulo/textosAcceso.ts
// PURE. One place that classifies HOW a request failed before any text says WHY. The classes are different
// facts and must never share a message:
//   · sin_conexion          — the request threw (network down, DNS, blocked, offline): nothing is known of the server;
//   · sin_respuesta_valida  — a «response» with an impossible status (0, NaN…): also nothing known;
//   · sesion                — the server answered 401: the session cookie is invalid or expired (NOT a permission);
//   · permiso               — the server answered 403: the user may not do this.
// Only 401/403 are statements by the server; the first two are ambiguous («No se pudo CONFIRMAR…»).

import type { RespuestaGuardado } from "./guardadoHonesto";

export type ClaseFallo = "sin_conexion" | "sin_respuesta_valida" | "sesion" | "permiso";

export const TEXTO_SESION = "Tu sesión no es válida o expiró. Vuelve a iniciar sesión.";

export const estadoHttpValido = (s: unknown): boolean => typeof s === "number" && Number.isInteger(s) && s >= 100 && s <= 599;

/** null = not one of these four (a 2xx, a 5xx, another 4xx…): the caller's own rules apply. */
export function clasificarFallo(resp: RespuestaGuardado): ClaseFallo | null {
  if (resp.tipo === "error_red") return "sin_conexion";
  if (!estadoHttpValido(resp.status)) return "sin_respuesta_valida";
  if (resp.status === 401) return "sesion";
  if (resp.status === 403) return "permiso";
  return null;
}

/**
 * Should the request be sent? With the browser reporting offline it is not: the screen says «No se pudo
 * CONFIRMAR…» without claiming anything about the server. `undefined` (no navigator, e.g. tests/SSR) sends.
 */
export const debeEnviar = (navigatorOnLine: boolean | undefined): boolean => navigatorOnLine !== false;
