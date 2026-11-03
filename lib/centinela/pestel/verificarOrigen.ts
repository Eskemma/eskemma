// lib/centinela/pestel/verificarOrigen.ts
// SERVER-ONLY. T4: junta los datos para `decidirEstadoOrigen` con el MÍNIMO de lecturas, sin ruta nueva (la usa
// `GET /api/moddulo/f2/find-linked-pestel?...&verificar=1`):
//   1. el Moddulo (`getAll` con máscara: colaboradores, papelera y los 3 campos de `linkedSource`),
//   2. el análisis importado (máscara: proyecto, dimensions, adjustments, version, analyzedAt — sin `informes`),
//   3. el análisis VIGENTE del proyecto PESTEL (consulta de dos igualdades, solo version y analyzedAt: un
//      documento por proyecto; NO se consulta por `projectId` solo, un proyecto real tiene 128 análisis).
// El proyecto PESTEL ya lo leyó la ruta; aquí solo se exige que sea del usuario. Cualquier cosa ajena, ilegible o
// de otro proyecto devuelve `no_verificable` SIN id, versión ni fecha.

import type { Firestore } from "firebase-admin/firestore";
import { huellaDeOrigen } from "./huellaOrigen";
import { decidirEstadoOrigen, type ResultadoOrigen } from "./estadoOrigen";

export async function verificarOrigen(
  db: Pick<Firestore, "getAll" | "collection">,
  p: { uid: string; pestelProjectId: string; pestelUserId: unknown; modduloProjectId: string }
): Promise<ResultadoOrigen> {
  if (p.pestelUserId !== p.uid) return { estado: "no_verificable", razon: "origen_ajeno" };

  const [modSnap] = await db.getAll(db.collection("moddulo_projects").doc(p.modduloProjectId), {
    fieldMask: ["collaborators", "deletedAt", "phases.exploracion.linkedSource.kind", "phases.exploracion.linkedSource.sourceId", "phases.exploracion.linkedSource.sourceAnalysisId", "phases.exploracion.linkedSource.huellaFuente"],
  });
  const mod = modSnap?.exists ? (modSnap.data() as Record<string, any> | undefined) : undefined;
  const colabora = !!mod?.collaborators?.some((c: { uid?: string }) => c.uid === p.uid);
  const ls = mod?.phases?.exploracion?.linkedSource as { kind?: string; sourceId?: string; sourceAnalysisId?: string; huellaFuente?: unknown } | undefined;
  if (!mod || mod.deletedAt || !colabora || ls?.kind !== "T22" || ls.sourceId !== p.pestelProjectId || !ls.sourceAnalysisId) {
    return { estado: "no_verificable", razon: "sin_vinculo" };
  }

  const [anSnap] = await db.getAll(db.collection("pestel_analyses").doc(ls.sourceAnalysisId), {
    fieldMask: ["projectId", "dimensions", "adjustments", "version", "analyzedAt"],
  });
  const an = anSnap?.exists ? (anSnap.data() as Record<string, any> | undefined) : undefined;
  if (!an) return { estado: "no_verificable", razon: "origen_no_disponible" };
  if (an.projectId !== p.pestelProjectId) return { estado: "no_verificable", razon: "origen_otro_proyecto" };

  const vigSnap = await db
    .collection("pestel_analyses")
    .where("projectId", "==", p.pestelProjectId)
    .where("vigente", "==", true)
    .select("version", "analyzedAt")
    .get();
  const v = vigSnap.docs[0];
  const vd = v?.data() as { version?: number; analyzedAt?: unknown } | undefined;

  return decidirEstadoOrigen({
    huellaGuardada: ls.huellaFuente as { v?: unknown; h?: unknown } | undefined,
    huellaActual: huellaDeOrigen(an.dimensions, an.adjustments),
    importado: { id: ls.sourceAnalysisId, version: an.version, analizadoEn: an.analyzedAt },
    vigente: v ? { id: v.id, version: vd?.version, analizadoEn: vd?.analyzedAt } : null,
  });
}
