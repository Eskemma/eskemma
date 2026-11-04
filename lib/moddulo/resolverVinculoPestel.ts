// lib/moddulo/resolverVinculoPestel.ts
// T5: ¿en qué estado está el vínculo de este proyecto Moddulo con Centinela PESTEL? Decisión pura de F2.
//
//  - vinculado: `linkedSource` T22 con `sourceId` Y `sourceAnalysisId` (hay un análisis importado).
//  - pendiente: hay un proyecto PESTEL en preparación que aún no se importó:
//      · forma antigua: `linkedSource` T22 con `sourceId` pero SIN `sourceAnalysisId` (la ventana N6 de antes de T5,
//        o `createProject` sin análisis); el id es el `sourceId`;
//      · forma nueva: el back-link `pestel_projects.modduloProjectId` (`backlinkId`), sin vínculo T22.
//  - sin_pestel: lo demás (ningún vínculo, o un M1 express).
// No lee ni escribe nada; el back-link lo trae `find-linked-pestel` (modo 1).

export type EstadoVinculoPestel = "sin_pestel" | "pendiente" | "vinculado";

export interface VinculoPestel {
  estado: EstadoVinculoPestel;
  /** PESTEL con un análisis importado (solo en `vinculado`). */
  pestProjectId: string | null;
  /** PESTEL en preparación, aún sin importar (solo en `pendiente`). */
  pestPendienteId: string | null;
  /** El pendiente está en la forma antigua (vive en el `linkedSource`, no solo en el back-link). */
  formaAntigua: boolean;
}

export function resolverVinculoPestel(i: {
  linkedSource: { kind?: string; sourceId?: string; sourceAnalysisId?: string } | null | undefined;
  /** Id del PESTEL del usuario cuyo back-link apunta a este Moddulo, si ya se consultó. */
  backlinkId: string | null | undefined;
}): VinculoPestel {
  const ls = i.linkedSource;
  if (ls?.kind === "T22" && ls.sourceId) {
    if (ls.sourceAnalysisId) return { estado: "vinculado", pestProjectId: ls.sourceId, pestPendienteId: null, formaAntigua: false };
    return { estado: "pendiente", pestProjectId: null, pestPendienteId: ls.sourceId, formaAntigua: true };
  }
  if (i.backlinkId) return { estado: "pendiente", pestProjectId: null, pestPendienteId: i.backlinkId, formaAntigua: false };
  return { estado: "sin_pestel", pestProjectId: null, pestPendienteId: null, formaAntigua: false };
}
