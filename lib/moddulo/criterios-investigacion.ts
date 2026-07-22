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
  return {
    id: `investigacion:vacio-${v.numero}`,
    faseOrigen: "investigacion",
    origenMecanismo: "vacio_residual",
    nombre: `Vacío residual — módulo PIP ${v.numero}`,
    descripcion: v.pregunta,
    nivelImpacto: v.urgencia === "alta" ? "prioritario" : "advertencia",
    recomendacion: "Retomar esta necesidad de información en una fase posterior o mediante el Sistema de Investigación Permanente.",
    estado: "activo",
  };
}

interface AsignacionDesactivada {
  numero: number;
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
  return {
    id: `investigacion:desactivada-${d.asignacionId}`,
    faseOrigen: "investigacion",
    origenMecanismo: "asignacion_desactivada",
    nombre: `Vía desactivada — módulo PIP ${d.numero}`,
    descripcion: `El usuario decidió no usar ${d.label} para responder P${d.numero}.`,
    nivelImpacto: "advertencia",
    recomendacion: "Reactivar esta vía si más adelante se decide retomarla.",
    estado: "activo",
    aceptadoAutomaticamente: true,
  };
}
