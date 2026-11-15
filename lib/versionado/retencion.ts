// lib/versionado/retencion.ts
// Poda por artefacto y revisiones «parciales». Módulo puro (sin Firestore ni crypto): importable desde cliente.
//
// Regla (decisión de Raúl): por artefacto se conservan las últimas TOPE_VERSIONES, TODAS las aprobadas, las
// protegidas (citadas por un `dependeDe` vigente o por un cierre) y la vigente. Lo demás se poda, de la más
// antigua, hasta MAX_BORRADOS_POR_ESCRITURA por escritura.
// NO se protegen las revisiones antiguas: una revisión cuyo manifiesto cita una versión ya podada es PARCIAL;
// eso se calcula AL LEER (artefactosNoRecuperables), sin escrituras extra. Las colecciones `revisiones/` y
// `eventos/` NO se podan (documentos pequeños, ≈ 1 por acción).

import { MAX_BORRADOS_POR_ESCRITURA, TOPE_VERSIONES, type EntradaManifiesto, type RetenidaRef } from "./tipos";

export interface OpcionesPoda {
  tope?: number;
  maxBorrados?: number;
  /** id de la versión vigente (nunca se poda). */
  vigenteId: string;
}

/** Ids a borrar de la lista de retenidas de UN artefacto. Determinista: la más antigua primero. */
export function decidirPoda(retenidas: RetenidaRef[], opciones: OpcionesPoda): string[] {
  const tope = opciones.tope ?? TOPE_VERSIONES;
  const maxBorrados = opciones.maxBorrados ?? MAX_BORRADOS_POR_ESCRITURA;
  if (retenidas.length <= tope) return [];
  const intocables = (r: RetenidaRef) => r.aprobada || r.protegida || r.id === opciones.vigenteId;
  // Las últimas `tope` por n (de la más nueva a la más antigua) se conservan siempre.
  const porNuevas = [...retenidas].sort((a, b) => b.n - a.n || (a.id < b.id ? 1 : -1));
  const conservadasPorTope = new Set(porNuevas.slice(0, tope).map((r) => r.id));
  const candidatas = porNuevas
    .filter((r) => !conservadasPorTope.has(r.id) && !intocables(r))
    .sort((a, b) => a.n - b.n || (a.id < b.id ? -1 : 1));
  return candidatas.slice(0, maxBorrados).map((r) => r.id);
}

export interface ArtefactoNoRecuperable {
  artefacto: string;
  versionId: string;
}

/**
 * Qué artefactos de una revisión ya NO se pueden recuperar porque su versión fue podada. Se calcula al leer,
 * contra el conjunto de ids de versión que existen. Una revisión con alguno es «parcial». REQUISITO de C4:
 * «volver» debe decir cuáles no se pueden recuperar.
 */
export function artefactosNoRecuperables(
  manifiestoArtefactos: Record<string, Pick<EntradaManifiesto, "versionId">>,
  idsExistentes: ReadonlySet<string>
): ArtefactoNoRecuperable[] {
  return Object.entries(manifiestoArtefactos)
    .filter(([, e]) => !idsExistentes.has(e.versionId))
    .map(([artefacto, e]) => ({ artefacto, versionId: e.versionId }))
    .sort((a, b) => (a.artefacto < b.artefacto ? -1 : 1));
}

export function revisionEsParcial(
  manifiestoArtefactos: Record<string, Pick<EntradaManifiesto, "versionId">>,
  idsExistentes: ReadonlySet<string>
): boolean {
  return artefactosNoRecuperables(manifiestoArtefactos, idsExistentes).length > 0;
}
