// lib/moddulo/versionado/textosHistorial.ts
// C4a-1 — ÚNICA fuente de los textos del historial (módulo PURO, importable desde el cliente). Español cotidiano, sin
// siglas que el usuario no conozca, y con el criterio de terminología: «Centinela» es el HUB que alberga varias apps;
// PESTEL es UNA de ellas. Un valor desconocido NUNCA muestra su código interno: cae en TEXTO_RESPALDO.
//
// Los valores conocidos de `tipoCambio` y de `motivo` se recorren en una prueba contra el código (`textosHistorial.test.ts`):
// agregar uno nuevo sin su texto rompe esa prueba.

import type { TipoCambio } from "@/lib/versionado/tipos";

export const TEXTO_RESPALDO = "Hizo un cambio";
export const TEXTO_SIN_AUTORIA = "Sin autoría registrada";
export const TEXTO_SIN_FECHA = "Fecha desconocida";
export const TEXTO_ALGUIEN_DEL_EQUIPO = "Alguien del equipo";

/** `tipoCambio` → texto (cuando no hay un `motivo` más específico). */
export const TEXTO_POR_TIPO: Record<TipoCambio, string> = {
  ajuste_manual: "Hizo un ajuste",
  regeneracion_ia: "Se generó de nuevo con inteligencia artificial",
  reentrega: "Actualizó un resultado de investigación",
  entrega: "Recibió un resultado de investigación",
  reapertura: "Volvió a abrir algo para revisarlo",
  restauracion: "Volvió a una versión anterior",
  previo_sin_historial: "Estado anterior al historial",
};

/** `motivo` (código interno que escriben las rutas) → texto. Tiene prioridad sobre el tipo. */
export const TEXTO_POR_MOTIVO: Record<string, string> = {
  aprobacion: "Aprobó el análisis o el resultado",
  aprobacion_retirada: "Retiró la aprobación de un resultado de investigación",
  resultado_rechazado: "Marcó un resultado de investigación como no aprobado",
  desvinculacion: "Desvinculó el análisis de PESTEL, la app del Hub Centinela",
  reapertura: "Volvió a abrir el análisis de la Fase 2 para revisarlo",
  cierre_fase: "Cerró la fase",
  reapertura_fase: "Volvió a abrir la fase",
  restauracion: "Volvió a una versión anterior",
};

export function etiquetaArtefacto(nombre: string): string {
  if (nombre === "f2M1") return "Análisis de la Fase 2";
  if (nombre.startsWith("cierre:")) return "Cierre de la fase";
  if (nombre.startsWith("f3Resultado:")) return "Resultado de investigación";
  if (nombre.startsWith("f3Asignacion:")) return "Tarea de investigación";
  return "Elemento del proyecto";
}

/** Título de la fila. El motivo manda; si es el de una aprobación se afina con el artefacto que cambió. */
export function tituloAccion(e: { tipo?: unknown; motivo?: unknown; artefactos?: readonly string[] }): string {
  const motivo = typeof e.motivo === "string" ? e.motivo : null;
  if (motivo === "aprobacion") {
    const a = e.artefactos ?? [];
    if (a.includes("f2M1")) return "Aprobó el análisis de la Fase 2";
    if (a.some((x) => x.startsWith("f3Resultado:"))) return "Aprobó un resultado de investigación";
  }
  if (motivo && Object.prototype.hasOwnProperty.call(TEXTO_POR_MOTIVO, motivo)) return TEXTO_POR_MOTIVO[motivo];
  const tipo = typeof e.tipo === "string" ? e.tipo : null;
  if (tipo && Object.prototype.hasOwnProperty.call(TEXTO_POR_TIPO, tipo)) return TEXTO_POR_TIPO[tipo as TipoCambio];
  return TEXTO_RESPALDO;
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/**
 * Frases a partir del `detalle` de AUDITORÍA del evento (solo nombres y banderas). Una clave desconocida se ignora;
 * nunca se muestra su nombre. Devuelve null si no hay nada que decir.
 */
export function detalleEnTexto(detalle: unknown): string | null {
  if (detalle === null || typeof detalle !== "object" || Array.isArray(detalle)) return null;
  const d = detalle as Record<string, unknown>;
  const frases: string[] = [];

  const motores = Array.isArray(d.motoresAprobadosDescartados) ? d.motoresAprobadosDescartados.length : 0;
  const borrador = d.borradorDescartado === true;
  if (borrador && motores > 0) {
    frases.push(`Se descartaron el borrador de los motores y ${motores} ${plural(motores, "motor aprobado", "motores aprobados")}.`);
  } else if (borrador) {
    frases.push("Se descartó el borrador de los motores.");
  } else if (motores > 0) {
    frases.push(`Se descartaron ${motores} ${plural(motores, "motor aprobado", "motores aprobados")}.`);
  }
  if (d.teniaAprobacion === true) frases.push("El análisis estaba aprobado.");
  if (d.reporteF2Conservado === true) frases.push("El reporte de la Fase 2 se conservó.");
  if (d.reporteSustituido === true) frases.push("El reporte guardado de la fase se reemplazó.");
  if (d.proyectoCompletado === true) frases.push("Con esto el proyecto quedó completo.");
  return frases.length > 0 ? frases.join(" ") : null;
}

export const TEXTO_AVISO: Record<string, string> = {
  eventos_incompletos: "Algunos cambios antiguos no se pueden mostrar.",
  historial_sin_puntero: "Algunos cambios antiguos no se pueden mostrar.",
  retencion_parcial:
    "De algunas fechas anteriores ya no se conservan todas las partes (se borraron las más antiguas para no llenar el espacio).",
  cambio_durante_lectura: "Hubo un cambio mientras se cargaba el historial. Vuelve a abrirlo para verlo al día.",
};

/**
 * Quién hizo el cambio (C4a-2a). Regla única:
 *   · `por` ausente (null) → «Sin autoría registrada». Es el caso de la versión previa al historial (`por: null`,
 *     H-V43): no hay nadie a quien atribuirla, y ocurre aunque el rol no vea nombres.
 *   · `por` presente pero el rol no ve nombres, o ese uid ya no es colaborador, o su colaborador no tiene nombre
 *     → «Alguien del equipo» (hay autor, pero no se puede decir quién).
 *   · si no, el nombre del colaborador.
 */
export function textoQuien(a: { por: string | null; nombreColaborador?: unknown; verDetalle: boolean }): string {
  if (a.por === null) return TEXTO_SIN_AUTORIA;
  if (!a.verDetalle) return TEXTO_ALGUIEN_DEL_EQUIPO;
  const nombre = typeof a.nombreColaborador === "string" ? a.nombreColaborador.trim() : "";
  return nombre.length > 0 ? nombre : TEXTO_ALGUIEN_DEL_EQUIPO;
}

/**
 * Fecha ABSOLUTA de una fila en es-MX (p. ej. «10 de noviembre de 2026, 9:00 a.m.») en la zona horaria del navegador
 * (`timeZone` ausente = la del entorno; las pruebas pasan una explícita). Ausente, null o ilegible →
 * «Fecha desconocida». Nunca lanza.
 */
export function formatearFechaFila(iso: string | null | undefined, opciones: { timeZone?: string } = {}): string {
  if (typeof iso !== "string" || iso.length === 0) return TEXTO_SIN_FECHA;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return TEXTO_SIN_FECHA;
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "long",
      timeStyle: "short",
      ...(opciones.timeZone ? { timeZone: opciones.timeZone } : {}),
    }).format(new Date(t));
  } catch {
    return TEXTO_SIN_FECHA; // zona horaria inválida
  }
}

export const TEXTO_FASE_SIN_HISTORIAL = "Aún no hay cambios registrados en esta fase. El historial empieza con el próximo cambio.";
