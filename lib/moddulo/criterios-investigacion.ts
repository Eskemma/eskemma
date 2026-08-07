// lib/moddulo/criterios-investigacion.ts
// Evaluación pura de F3 para el RDA: convierte los vacíos residuales de
// SintesisF3 con destino "RDA" en RDAItems, y (por separado) cada
// asignación desactivada por el usuario en un RDAItem de trazabilidad.
// Mismo patrón que lib/moddulo/dvs-criteria.ts (F2) — evaluación efímera,
// sin escritura ni persistencia propia.

import type { SintesisF3, VacioResidual, RDAItem, TareaPIP } from "@/types/moddulo.types";
import { asignacionNombreCorto } from "@/lib/moddulo/asignacionLabel";

export function evaluarCriteriosInvestigacion(
  sintesis: SintesisF3 | undefined
): VacioResidual[] | null {
  if (!sintesis) return null; // sin síntesis todavía — no evaluable
  return sintesis.vaciosResiduales.filter((v) => v.destino === "RDA");
}

export function vacioResidualToRDAItem(v: VacioResidual): Omit<RDAItem, "fechaCreacion"> {
  // El id se construye con pipItemId (identidad estable), NUNCA con numero
  // (número de despliegue, puede cambiar si el PIP se reindexa) — de lo
  // contrario, dos evaluaciones del mismo vacío tras una reindexación
  // producirían ids distintos y el RDA duplicaría/huerfanaría el ítem.
  const etiquetaNumero = v.numero ?? "?";
  return {
    id: `investigacion:vacio-${v.pipItemId}`,
    faseOrigen: "investigacion",
    origenMecanismo: "vacio_residual",
    nombre: `Vacío residual — módulo PIP ${etiquetaNumero}`,
    descripcion: v.pregunta,
    nivelImpacto: v.urgencia === "alta" ? "prioritario" : "advertencia",
    recomendacion: "Retomar esta necesidad de información en una fase posterior o mediante el Sistema de Investigación Permanente.",
    estado: "activo",
  };
}

interface AsignacionDesactivada {
  numero?: number; // solo display — ver comentario de VacioResidual.numero
  asignacionId: string;
  label: string;
}

// Recalculado en cada evaluación (nunca persistido aparte): una por cada
// asignación con activada === false en este momento. Al reactivarla, deja
// de aparecer aquí y el motor de reconciliación de rda.ts la auto-resuelve
// (ver planRDAUpdate) — no requiere ningún borrado explícito.
export function evaluarDesactivaciones(
  tareas: TareaPIP[] | undefined
): AsignacionDesactivada[] | null {
  if (!tareas) return null;
  const out: AsignacionDesactivada[] = [];
  for (const t of tareas) {
    for (const a of t.asignaciones ?? []) {
      if (!a.activada) {
        out.push({ numero: t.numero, asignacionId: a.asignacionId, label: asignacionNombreCorto(a) });
      }
    }
  }
  return out;
}

export function asignacionDesactivadaToRDAItem(d: AsignacionDesactivada): Omit<RDAItem, "fechaCreacion"> {
  // El id ya usaba asignacionId (no numero) — asignacionId se deriva de
  // pipItemId desde f3TareasGenerator.ts, así que ya es estable frente a
  // una reindexación del PIP. Sin cambios necesarios aquí más allá del tipo.
  const etiquetaNumero = d.numero ?? "?";
  return {
    id: `investigacion:desactivada-${d.asignacionId}`,
    faseOrigen: "investigacion",
    origenMecanismo: "asignacion_desactivada",
    nombre: `Vía desactivada — módulo PIP ${etiquetaNumero}`,
    descripcion: `El usuario decidió no usar ${d.label} para responder P${etiquetaNumero}.`,
    nivelImpacto: "advertencia",
    recomendacion: "Reactivar esta vía si más adelante se decide retomarla.",
    estado: "activo",
    aceptadoAutomaticamente: true,
  };
}

/**
 * Trazabilidad de pregunta eliminada del PIP — NO se genera vía el patrón
 * de recomputación en vivo (a diferencia de evaluarDesactivaciones): una vez
 * aplicado el diff, el PIPItem ya no existe en ningún lado, así que no hay
 * "vigentes" que recalcular. Se llama una sola vez, en el momento en que
 * tareas/sincronizar detecta la eliminación, con el texto ya congelado
 * (mismo principio que xpctoSnapshotAtGeneration: congelar en el momento).
 */
export function preguntaEliminadaToRDAItem(cambio: {
  pipItemId: string;
  preguntaAnterior: string;
}): Omit<RDAItem, "fechaCreacion"> {
  return {
    id: `investigacion:pregunta-eliminada-${cambio.pipItemId}`,
    faseOrigen: "investigacion",
    origenMecanismo: "pregunta_pip_eliminada",
    nombre: "Pregunta eliminada del PIP",
    descripcion: `Se eliminó del PIP la pregunta: "${cambio.preguntaAnterior}". El tablero de investigación ya no incluye ninguna tarea para ella.`,
    nivelImpacto: "advertencia",
    recomendacion: "Sin acción requerida — registro histórico de una decisión ya tomada al editar el PIP.",
    estado: "activo",
    aceptadoAutomaticamente: true,
  };
}
