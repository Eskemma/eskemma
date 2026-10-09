// lib/moddulo/impactoReemplazoServidor.ts
// SERVER-ONLY glue between Firestore data and the pure impact calculation. It
// reads the RAW document (never getProject(), which backfills legacy ids and
// attaches `numero`) so that the pre-check and the in-transaction lock compute
// the fingerprint from exactly the same shape. Legacy single-channel tareas are
// normalized with the same function getProject() uses, so their progress counts.

import type { Firestore } from "firebase-admin/firestore";
import type { TareaPIP } from "@/types/moddulo.types";
import { normalizeTareaPIP, type LegacyTareaPIP } from "./project";
import type { EstadoParaImpacto, ResultadoMin } from "./impactoReemplazoDVS";

export function estadoParaImpactoDesdeProyecto(
  proyecto: Record<string, unknown> | undefined,
  resultados: { id: string; data: Record<string, unknown> }[]
): EstadoParaImpacto {
  const phases = (proyecto?.phases ?? {}) as {
    exploracion?: { dvs?: EstadoParaImpacto["dvs"] };
    investigacion?: {
      f3TareasPIP?: unknown;
      f3Sintesis?: EstadoParaImpacto["sintesis"];
      f3Veredicto?: unknown;
      f3DIE?: unknown;
    };
  };
  const crudas = phases.investigacion?.f3TareasPIP;
  const tareas: TareaPIP[] = Array.isArray(crudas)
    ? (crudas as LegacyTareaPIP[]).map(normalizeTareaPIP)
    : [];
  const res: ResultadoMin[] = resultados.map((r) => ({
    resultadoId: r.id,
    aprobado: r.data.aprobado === true,
  }));
  return {
    dvs: phases.exploracion?.dvs ?? null,
    tareas,
    resultados: res,
    sintesis: phases.investigacion?.f3Sintesis ?? null,
    veredicto: phases.investigacion?.f3Veredicto,
    die: phases.investigacion?.f3DIE,
  };
}

/** Non-transactional read used by the pre-check (before calling Claude). */
export async function leerEstadoParaImpacto(db: Firestore, projectId: string): Promise<EstadoParaImpacto> {
  const ref = db.collection("moddulo_projects").doc(projectId);
  const [snap, resSnap] = await Promise.all([ref.get(), ref.collection("f3Resultados").get()]);
  return estadoParaImpactoDesdeProyecto(
    snap.data() as Record<string, unknown> | undefined,
    resSnap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
  );
}
