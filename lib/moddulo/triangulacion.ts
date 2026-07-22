// lib/moddulo/triangulacion.ts
// Triangulación informativa de M3: identifica qué tareas del PIP tienen
// TODA su evidencia aprobada respaldada por una sola familia metodológica
// (sin variedad de evidencia) — puramente informativo para el usuario, no
// bloquea ni condiciona el veredicto de M4 de ninguna forma.

import type { TareaPIP } from "@/types/moddulo.types";
import { FAMILIA_METODOLOGICA_POR_TECNICA, type FamiliaMetodologica } from "@/types/f3.types";
import type { TecnicaId } from "@/types/shared.types";

interface ResultadoParaTriangulacion {
  resultadoId: string;
  metadatosCarga?: { familiaMetodologica: FamiliaMetodologica };
  metadatosFuente?: { familiaMetodologica: FamiliaMetodologica };
}

/**
 * Números de tarea (PIPItem.numero) cuyos resultados aprobados y vinculados
 * (≥2) son todos de la misma familia metodológica.
 *
 * No filtra por `AsignacionCanal.activada` — desactivar una asignación solo
 * gatea la suficiencia de M4 (tareaCubierta), nunca qué evidencia usa M2/M3
 * para sintetizar: una asignación desactivada con resultado aprobado sigue
 * contando aquí igual que una activada.
 */
export function tareasConSustentoUnico(
  tareas: TareaPIP[],
  resultadosAprobados: ResultadoParaTriangulacion[]
): number[] {
  const resultadosPorId = new Map(resultadosAprobados.map((r) => [r.resultadoId, r]));
  const out: number[] = [];

  for (const tarea of tareas) {
    const familias = new Set<FamiliaMetodologica>();
    let conteo = 0;
    for (const a of tarea.asignaciones ?? []) {
      if (!a.resultadoId) continue;
      const resultado = resultadosPorId.get(a.resultadoId);
      if (!resultado) continue;
      conteo++;

      const familia: FamiliaMetodologica | undefined =
        a.canal === "canal1" && a.tecnicaId ? FAMILIA_METODOLOGICA_POR_TECNICA[a.tecnicaId as TecnicaId]
        : a.canal === "canal2" ? resultado.metadatosCarga?.familiaMetodologica
        : a.canal === "canal3" ? resultado.metadatosFuente?.familiaMetodologica
        : undefined;
      if (familia) familias.add(familia);
    }
    if (conteo > 1 && familias.size === 1) out.push(tarea.numero);
  }

  return out;
}
