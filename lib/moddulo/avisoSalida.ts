// lib/moddulo/avisoSalida.ts
// PURE. T5b — el aviso al SALIR de F2 hacia Centinela (pendiente o sin PESTEL): decisiones y textos. La pantalla
// solo ejecuta efectos. Es una cortesía: la protección real es el candado H15 del import (el servidor siempre pide
// confirmar al reemplazar); por eso un fallo o un tiempo agotado NUNCA bloquea la salida.

/** Tiempo máximo de la consulta antes de tratarla como «no verificable». */
export const TIEMPO_MAXIMO_SALIDA_MS = 8000;
// Por qué 8 s: la consulta es 1 consulta + 1 documento (~30-100 KB) y responde en menos de 1 s en condiciones
// normales; el sondeo de «Nuevo análisis» tolera una espera comparable. Más de 8 s ya es una conexión mala y el
// usuario prefiere decidir (con el aviso «no se pudo verificar») a seguir esperando un enlace.

export const TEXTO_VERIFICANDO_SALIDA = "Verificando el estado del proyecto…";
export const TITULO_AVISO_SALIDA = "Antes de ir a Centinela";
export const INTRO_AVISO_SALIDA = "Si al volver importas un análisis, esto se reemplazaría:";
export const TEXTO_SALIDA_NO_VERIFICABLE =
  "No se pudo verificar el estado actual del proyecto, así que no sabemos si al volver con un análisis se reemplazaría algo. Puedes continuar: al importar, se te pedirá confirmar cualquier reemplazo.";

export type RespuestaSalida =
  | { tipo: "respuesta"; ok: boolean; cuerpo: unknown }
  | { tipo: "error" }
  | { tipo: "tiempo_agotado" };

export type DecisionSalida =
  | { tipo: "navegar" }
  | { tipo: "avisar"; lineas: string[] }
  | { tipo: "no_verificable" };

/** What to do after the check. Nothing to lose (or F2 closed) → straight to Centinela; failure → warn but let continue. */
export function decidirAvisoSalida(resp: RespuestaSalida, f2Cerrada: boolean): DecisionSalida {
  if (f2Cerrada) return { tipo: "navegar" };
  if (resp.tipo !== "respuesta" || !resp.ok) return { tipo: "no_verificable" };
  const salida = (resp.cuerpo as { salida?: { estado?: unknown; lineas?: unknown } } | null)?.salida;
  if (!salida || typeof salida !== "object") return { tipo: "no_verificable" };
  if (salida.estado === "sin_lineas") return { tipo: "navegar" };
  if (salida.estado === "con_lineas" && Array.isArray(salida.lineas) && salida.lineas.length > 0 && salida.lineas.every((x) => typeof x === "string")) {
    return { tipo: "avisar", lineas: salida.lineas as string[] };
  }
  return { tipo: "no_verificable" };
}

/** ¿Debe la pantalla verificar antes de salir? Solo con la fase abierta y sin análisis importado (pendiente o sin PESTEL). */
export function requiereAvisoSalida(o: { f2Cerrada: boolean; tieneAnalisisImportado: boolean }): boolean {
  return !o.f2Cerrada && !o.tieneAnalisisImportado;
}

/**
 * Clic en el `<Link>` de la franja: se intercepta SOLO el clic primario sin Ctrl/Cmd/Shift/Alt (y sin que otro
 * manejador lo haya cancelado). Con modificadores o botón central se deja el comportamiento nativo (abrir en pestaña).
 */
export function debeInterceptarClic(e: { button: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented?: boolean }): boolean {
  return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

/** URL de la consulta (opt-in `salida=1`; sin ruta nueva). */
export function urlConsultaSalida(modduloProjectId: string): string {
  return `/api/moddulo/f2/find-linked-pestel?moddulo_project_id=${encodeURIComponent(modduloProjectId)}&salida=1`;
}

export interface TextoModalSalida {
  titulo: string;
  intro: string[];
  lineas: string[];
  cierre: null;
  confirmar: string;
  cancelar: string;
}

export function textoModalSalida(d: Extract<DecisionSalida, { tipo: "avisar" | "no_verificable" }>): TextoModalSalida {
  return d.tipo === "avisar"
    ? { titulo: TITULO_AVISO_SALIDA, intro: [INTRO_AVISO_SALIDA], lineas: d.lineas, cierre: null, confirmar: "Continuar a Centinela", cancelar: "Cancelar" }
    : { titulo: TITULO_AVISO_SALIDA, intro: [TEXTO_SALIDA_NO_VERIFICABLE], lineas: [], cierre: null, confirmar: "Continuar a Centinela", cancelar: "Cancelar" };
}
