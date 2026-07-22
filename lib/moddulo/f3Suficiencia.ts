// lib/moddulo/f3Suficiencia.ts
// Regla de suficiencia compartida entre el endpoint /veredicto/generar y
// la UI (botón "Generar veredicto" + contador "N de M tareas cubiertas") —
// una sola implementación, no una versión en el servidor y otra en el cliente.

import type { TareaPIP } from "@/types/moddulo.types";

// Una tarea está "cubierta" si al menos una de sus asignaciones ACTIVAS
// recibió un resultado real (estado "recibido" o "derivado"). Las
// asignaciones desactivadas nunca cuentan, aunque su `estado` interno siga
// en "recibido" — desactivar es una decisión del usuario de no usar esa
// vía para la suficiencia, no un borrado del resultado que ya llegó.
export function tareaCubierta(tarea: TareaPIP): boolean {
  // Defensivo: proyectos con datos del esquema anterior a asignaciones[]
  // (normalizados en lib/moddulo/project.ts al leer, pero esta función es
  // compartida y puede recibir datos de otras fuentes) no deben tronar la
  // UI — simplemente se tratan como sin cobertura.
  const asignaciones = tarea.asignaciones ?? [];
  return asignaciones.some((a) => a.activada && (a.estado === "recibido" || a.estado === "derivado"));
}

export function tareasSinCubrir(tareas: TareaPIP[]): TareaPIP[] {
  return tareas.filter((t) => !tareaCubierta(t));
}

export function contarTareasCubiertas(
  tareas: TareaPIP[]
): { cubiertas: number; total: number } {
  return { cubiertas: tareas.filter((t) => tareaCubierta(t)).length, total: tareas.length };
}
