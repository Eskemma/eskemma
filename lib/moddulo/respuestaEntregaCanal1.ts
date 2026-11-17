// lib/moddulo/respuestaEntregaCanal1.ts
// C3b — qué hace el botón «Entregar / Actualizar entrega» de Fontana con la respuesta de `canal1/entregar`.
// Función PURA y client-safe (sin node, sin Firestore): entra {status, cuerpo}, sale la acción. No hay pruebas de
// DOM; esta función ES lo que se prueba.
//
// REGLA: se decide por el código `error` del CUERPO, nunca por el status. Dos respuestas distintas comparten el
// 409: «reemplazo_requiere_confirmacion» (el usuario debe decidir) y «historial_no_confirmado» con causa
// «colision» (no se guardó nada; reintentar).
//
// Relación con `guardadoHonesto`: esta función ENVUELVE `decidirResultadoGuardado("entregar_canal1", …)` para todo
// lo que no es uno de los dos casos especiales, de modo que el texto de un fallo genérico vive en UN solo sitio
// (el catálogo). No reutiliza `decidirReemplazoAnalisis`: esa es de la familia del análisis finalizado (3 códigos
// 409, reversión de aprobaciones optimistas, sin carga útil); aquí hay un solo 409 de confirmación y trae líneas y
// huella que el modal necesita, además del 409/500 del historial.

import { decidirResultadoGuardado, type RespuestaGuardado } from "./guardadoHonesto";

export const CODIGO_REEMPLAZO = "reemplazo_requiere_confirmacion";
export const CODIGO_HISTORIAL = "historial_no_confirmado";

/** Respaldo si el cuerpo del historial no trae `message` (el servidor siempre lo manda). */
const TEXTO_HISTORIAL_RESPALDO =
  "No se pudo CONFIRMAR el registro del historial. No se guardó nada; vuelve a intentarlo.";

export type AccionEntregaCanal1 =
  | { tipo: "exito" }
  | { tipo: "pedir_confirmacion"; lineas: string[]; huella: string; huellaVencida: boolean }
  | { tipo: "error_historial"; mensaje: string; causa: "colision" | "inconsistencia" | "desconocida" }
  | { tipo: "error"; mensaje: string };

export function decidirRespuestaEntregaCanal1(entrada: {
  status: number;
  cuerpo: unknown;
}): AccionEntregaCanal1 {
  const cuerpo =
    entrada.cuerpo && typeof entrada.cuerpo === "object" ? (entrada.cuerpo as Record<string, unknown>) : {};
  const codigo = typeof cuerpo.error === "string" ? cuerpo.error : undefined;

  if (codigo === CODIGO_REEMPLAZO) {
    const lineas = Array.isArray(cuerpo.lineas) ? cuerpo.lineas.filter((l): l is string => typeof l === "string") : [];
    // Sin huella o sin líneas no hay nada que confirmar de forma segura: se trata como respuesta inválida.
    if (typeof cuerpo.huella === "string" && cuerpo.huella && lineas.length > 0) {
      return { tipo: "pedir_confirmacion", lineas, huella: cuerpo.huella, huellaVencida: cuerpo.huellaVencida === true };
    }
    return {
      tipo: "error",
      mensaje: decidirResultadoGuardado("entregar_canal1", { tipo: "respuesta", ok: true, status: 200, cuerpoValido: false })
        .mensajeError ?? "",
    };
  }

  if (codigo === CODIGO_HISTORIAL) {
    const causa = cuerpo.causa === "colision" || cuerpo.causa === "inconsistencia" ? cuerpo.causa : "desconocida";
    const mensaje = typeof cuerpo.message === "string" && cuerpo.message ? cuerpo.message : TEXTO_HISTORIAL_RESPALDO;
    return { tipo: "error_historial", mensaje, causa };
  }

  const ok = entrada.status >= 200 && entrada.status < 300;
  const resp: RespuestaGuardado = {
    tipo: "respuesta",
    ok,
    status: entrada.status,
    cuerpoValido: ok ? typeof cuerpo.resultadoId === "string" && typeof cuerpo.fecha === "string" : undefined,
    codigo,
  };
  const d = decidirResultadoGuardado("entregar_canal1", resp);
  return d.exito ? { tipo: "exito" } : { tipo: "error", mensaje: d.mensajeError ?? "" };
}
