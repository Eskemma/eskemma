// lib/moddulo/leerRespuestaGuardado.ts
// Turns a `fetch` into the `RespuestaGuardado` that guardadoHonesto decides on.
// A thrown fetch (network down) is `error_red`; a body that is not JSON (a route
// that throws answers a bare 500 from Next) is read as an empty body, never
// thrown. Shared by the screens fixed in H25 so none of them re-implements it.

import type { RespuestaGuardado } from "./guardadoHonesto";

export async function leerRespuestaGuardado(
  pedir: () => Promise<Response>,
  cuerpoEsValido?: (datos: Record<string, unknown>) => boolean
): Promise<{ resp: RespuestaGuardado; datos: Record<string, unknown> }> {
  let r: Response;
  try {
    r = await pedir();
  } catch {
    return { resp: { tipo: "error_red" }, datos: {} };
  }
  let datos: Record<string, unknown> = {};
  try {
    const crudo = await r.json();
    if (crudo && typeof crudo === "object") datos = crudo as Record<string, unknown>;
  } catch {
    datos = {};
  }
  return {
    resp: {
      tipo: "respuesta",
      ok: r.ok,
      status: r.status,
      ...(cuerpoEsValido ? { cuerpoValido: r.ok ? cuerpoEsValido(datos) : undefined } : {}),
      // A route may send its own `codigo` next to a readable `error`; the older routes use `error` as the code.
      codigo: typeof datos.codigo === "string" ? datos.codigo : typeof datos.error === "string" ? datos.error : undefined,
      motor: typeof datos.motor === "string" ? datos.motor : undefined,
      mensaje: typeof datos.mensaje === "string" ? datos.mensaje : undefined,
      // A short list like "T, Ec y L"; anything else is ignored (it is shown to the user).
      ...(typeof datos.dimensiones === "string" && /^[A-Za-z, ]{1,30}$/.test(datos.dimensiones) ? { dimensiones: datos.dimensiones } : {}),
    },
    datos,
  };
}
