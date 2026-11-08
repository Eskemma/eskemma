// lib/centinela/pestel/avisoNotaCentinela.ts
// T7 C3b: el aviso «Moddulo F2 todavía no incluye la nota de aprobación…» junto al botón «Regresar a Moddulo F2 con
// resultados» (Análisis y Monitoreo de Centinela). Lógica pura + una carga que NUNCA lanza: si el GET falla, el aviso
// simplemente no sale y el botón sigue funcionando.

import { notaDeAprobacion, notaSinReflejarEnF2, type AnalisisConNota, type NotaImportadaResumen } from "./notaAprobacion";

/** ¿Vale la pena preguntar? Solo con proyecto vinculado a Moddulo y un análisis que tenga nota (aprobado con confianza < 50). */
export function debePedirNotaImportada(i: { moddulo?: string | null; analysis?: (AnalisisConNota & { id?: string }) | null }): boolean {
  return !!i.moddulo && !!i.analysis?.id && !!notaDeAprobacion(i.analysis);
}

/**
 * Lee `notaImportada` de `GET /api/centinela/pestel/project/[id]?ajustesImportados=1` (la ruta ya existente; misma lectura
 * del Moddulo que usa Interpretación). Cualquier fallo (red, no-OK, cuerpo ilegible, forma inesperada) devuelve null.
 */
export async function cargarNotaImportada(
  projectId: string,
  fetchFn: (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }> = (u) => fetch(u)
): Promise<NotaImportadaResumen | null> {
  try {
    const r = await fetchFn(`/api/centinela/pestel/project/${projectId}?ajustesImportados=1`);
    if (!r.ok) return null;
    const d = (await r.json()) as { notaImportada?: Partial<NotaImportadaResumen> | null } | null;
    const n = d?.notaImportada;
    if (!n || typeof n !== "object") return null;
    return {
      v: typeof n.v === "number" ? n.v : null,
      nota: n.nota ?? null,
      sourceAnalysisId: typeof n.sourceAnalysisId === "string" ? n.sourceAnalysisId : null,
    };
  } catch {
    return null;
  }
}

/** ¿Se muestra el aviso? Solo si es accionable (ver `notaSinReflejarEnF2`); sin dato cargado, no. */
export function mostrarAvisoNotaCentinela(
  analysis: (AnalisisConNota & { id?: string }) | null | undefined,
  importada: NotaImportadaResumen | null | undefined
): boolean {
  return notaSinReflejarEnF2(analysis?.id, notaDeAprobacion(analysis), importada);
}
