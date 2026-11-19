// C1b-3b — siembra de proyectos para probar el CIERRE de fase con historial (no es una prueba). Los campos de marca de
// tiempo son `Timestamp` REALES de Firestore (como los devuelve el Admin SDK), no textos: úsalo con
// `siembraHistorialF2.clonar` (nunca `structuredClone`, que convierte un `Timestamp` en un objeto plano) y verifica
// `instanceof Timestamp` antes de ejecutar la ruta.
import { Timestamp } from "firebase-admin/firestore";
import type { PhaseId } from "@/types/moddulo.types";
import { docProyectoT22 } from "./m1SiembraT22";

export const RUTA_P = "moddulo_projects/p1";
export const BORRADOR = "# Borrador del reporte\n\nTexto guardado con savePhaseReportDraft.";
export const REPORTE = "# Reporte final\n\nTexto con el que se cierra la fase.";

interface Opciones {
  /** `phases.<fase>.reportText` ya guardado (borrador). */
  reportText?: unknown;
  /** Puntero/otros campos extra de la fase. */
  extraFase?: Record<string, unknown>;
  status?: "in-progress" | "completed";
  rolAnalyst?: boolean;
}

/** Documento `moddulo_projects/p1` listo para cerrar `fase` (F2: T22 aprobado con Reporte F2 de ese M1). */
export function docCerrable(fase: PhaseId, o: Opciones = {}) {
  const marcas = {
    createdAt: Timestamp.fromDate(new Date("2026-11-01T10:00:00.000Z")),
    updatedAt: Timestamp.fromDate(new Date("2026-11-09T10:00:00.000Z")),
    lastAccessedAt: Timestamp.fromDate(new Date("2026-11-09T10:30:00.000Z")),
  };
  const colaboradores = [{ uid: "u1", role: o.rolAnalyst ? "analyst" : "owner" }];
  if (fase === "exploracion") {
    const d = docProyectoT22({ dvs: { final: 1 }, status: o.status ?? "in-progress" });
    return {
      ...d,
      ...marcas,
      status: "active",
      currentPhase: "exploracion",
      collaborators: colaboradores,
      phases: {
        exploracion: {
          ...d.phases.exploracion,
          ...(o.reportText !== undefined ? { reportText: o.reportText } : {}),
          ...(o.extraFase ?? {}),
        },
      },
    };
  }
  return {
    name: "Proyecto", type: "electoral", status: "active", currentPhase: fase, collaborators: colaboradores, ...marcas,
    phases: {
      [fase]: {
        status: o.status ?? "in-progress",
        ...(o.reportText !== undefined ? { reportText: o.reportText } : {}),
        ...(o.extraFase ?? {}),
      },
    },
  };
}
