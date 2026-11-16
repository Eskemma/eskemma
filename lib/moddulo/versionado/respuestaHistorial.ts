// lib/moddulo/versionado/respuestaHistorial.ts
// C3a — traducción de los errores del historial (`lib/versionado/`) a la respuesta JSON de una ruta. SOLO SERVIDOR.
//
// Un fallo del historial aborta la transacción completa: NO se guardó nada. La pantalla de Fontana hace
// `res.json()` primero y muestra `data.message ?? data.error`, así que el JSON llega al usuario.
//
// CONTRATO (lo fija `respuestaHistorial.test.ts`; C3b lo consume): el campo `error` es SIEMPRE
// «historial_no_confirmado», con `causa` = «colision» | «inconsistencia». La colisión (409) comparte status con
// el 409 `reemplazo_requiere_confirmacion`, así que el botón debe decidir por el código `error`, NUNCA por el status.

import { NextResponse } from "next/server";
import { traducirErrorHistorial } from "@/lib/versionado/registrar";
import { ColisionHistorialError, HistorialInconsistenteError } from "@/lib/versionado/tipos";

export const CODIGO_HISTORIAL_NO_CONFIRMADO = "historial_no_confirmado";
export const MENSAJE_HISTORIAL_COLISION =
  "No se pudo CONFIRMAR el registro del historial. No se guardó nada; vuelve a intentarlo.";
export const MENSAJE_HISTORIAL_INCONSISTENTE =
  "No se pudo CONFIRMAR el registro del historial. No se guardó nada. Si vuelve a pasar, no insistas: hay que revisarlo.";

export interface ContextoErrorHistorial {
  projectId: string;
  fase: string;
  ruta: string;
}

/**
 * Devuelve la respuesta de error del historial, o `null` si el error NO es del historial (la ruta decide:
 * normalmente lo relanza). Deja un log de servidor nivel error con el nombre del error, el proyecto, la fase y
 * la ruta; NUNCA contenido ni uids.
 */
export function respuestaDeErrorHistorial(err: unknown, ctx: ContextoErrorHistorial): NextResponse | null {
  const e = traducirErrorHistorial(err);
  if (e instanceof ColisionHistorialError) {
    console.error(`[historial][${ctx.ruta}] ${e.name} proyecto=${ctx.projectId} fase=${ctx.fase}`);
    return NextResponse.json(
      { error: CODIGO_HISTORIAL_NO_CONFIRMADO, causa: "colision", message: MENSAJE_HISTORIAL_COLISION },
      { status: 409 }
    );
  }
  if (e instanceof HistorialInconsistenteError) {
    console.error(`[historial][${ctx.ruta}] ${e.name} proyecto=${ctx.projectId} fase=${ctx.fase}`);
    return NextResponse.json(
      { error: CODIGO_HISTORIAL_NO_CONFIRMADO, causa: "inconsistencia", message: MENSAJE_HISTORIAL_INCONSISTENTE },
      { status: 500 }
    );
  }
  return null;
}
