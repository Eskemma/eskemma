// lib/fontana/agente/guardHermano.ts
// Frente B de la ronda del "distrito hermano" (26-09-27). Hallazgo del Paso 3: en 2 de 2 pruebas
// reales, el modelo respondió el caso "hermano" (pedir el OTRO tipo de distrito del que ya está
// activo — federal↔local) en PROSA, sin llamar ninguna herramienta — así que el rechazo determinista
// que `decidirContexto` ya hace (vía `resolverReferenciaTerritorio`) nunca llegó a ejecutarse: la
// protección existe solo DENTRO de la herramienta, y el modelo no siempre la usa.
//
// Mismo patrón que guardReuso.ts: detección PURA + un aviso; el cableado (text_suppress + re-consulta
// forzada) vive en chat/route.ts.

import { mencionaOtroTipoDeDistrito } from "@/lib/geo/referenciaContextual";
import type { NivelTerritorial } from "@/types/shared.types";

/**
 * ¿Este turno pedía el "hermano" (el otro tipo de distrito) y el modelo respondió sin que NINGÚN
 * resultado real de herramienta de este turno lo haya resuelto (ni con el rechazo honesto de
 * `hermano`, ni — cuando exista el Frente A — con una correspondencia real)? No exige que el turno
 * tenga CERO llamadas: solo que ninguna haya tocado este territorio.
 */
export function turnoRequiereConsultaHermano(
  mensajeUsuario: string | null | undefined,
  nivelActivo: NivelTerritorial | null | undefined,
  toolResultTextsAcum: readonly string[]
): boolean {
  if (!mencionaOtroTipoDeDistrito(mensajeUsuario, nivelActivo)) return false;
  return !toolResultTextsAcum.some(
    (t) => t.includes('"referencia":"hermano"') || t.includes('"referencia":"correspondencia"')
  );
}

export const AVISO_HERMANO =
  "[verificación del sistema] Preguntaste por el OTRO tipo de distrito (federal↔local) del que ya está activo en esta sesión, pero " +
  "en este turno no consultaste ninguna herramienta sobre ese territorio: no puedes responder eso de memoria. Vuelve a llamar la " +
  "herramienta correspondiente (o consultar_indicador con el territorio activo) para que el servidor determine honestamente si hay o " +
  "no una equivalencia — y responde SOLO con lo que devuelva. No menciones esta verificación al usuario.";
