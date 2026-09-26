// lib/fontana/agente/guardReuso.ts
// Guard de REUSO de respuestas viejas (26-09-26). El historial que recibe el modelo es solo texto
// (sin tool_result), así que puede "reciclar" una tabla o un "no hay dato" de un turno anterior sin
// consultar nada — incidente m4qUAX… (Yucatán D.F. 3102): el chat repitió "No existe dato directo a
// nivel distrital" mientras el panel mostraba 22.62 %. Misma clase de fallo que la pirámide de
// Tlaquepaque (respuesta con datos sin llamada a herramienta). Detección PURA; el cableado vive en
// chat/route.ts (mismo patrón que AFIRMA_RESULTADO).

/** ≥ 2 filas de tabla markdown con una celda numérica/porcentual (una tabla de VALORES). */
export function contieneTablaDeValores(texto: string): boolean {
  const filas = texto.split("\n").filter((l) => {
    const t = l.trim();
    if (!t.startsWith("|") || /^\|[\s:|-]+\|?$/.test(t)) return false;
    return t.split("|").some((c) => /^\s*[~≈]?\s*\$?\d[\d,.]*\s*(%|hab\.?|habitantes|años)?\s*$/.test(c));
  });
  return filas.length >= 2;
}

const NIVEL = "(?:nivel\\s+)?(?:distrital|distrito|municipal|municipio|estatal|estado|nacional)";
/** "no existe/hay/está disponible dato/valor … (a nivel) distrital", en ambos órdenes. */
const RE_AUSENCIA = [
  new RegExp(`\\bno\\s+(?:existe|hay|tiene|se\\s+tiene|est[aá]\\s+disponible|se\\s+publica)\\b[^.\\n]{0,60}\\b(?:dato|valor|cifra|informaci[oó]n)s?\\b[^.\\n]{0,60}\\b${NIVEL}\\b`, "i"),
  new RegExp(`\\b${NIVEL}\\b[^.\\n]{0,60}\\b(?:no\\s+(?:existe|hay|tiene|est[aá]\\s+disponible)|sin\\s+(?:dato|valor))\\b`, "i"),
  /\bno\s+existe\s+dato\s+directo\b/i,
];

export function afirmaAusenciaDeDato(texto: string): boolean {
  return RE_AUSENCIA.some((re) => re.test(texto));
}

/** ¿La respuesta trae datos o ausencia de datos que debieron salir de una consulta de ESTE turno? */
export function respuestaRequiereConsulta(texto: string): boolean {
  return contieneTablaDeValores(texto) || afirmaAusenciaDeDato(texto);
}

export const AVISO_REUSO =
  "[verificación del sistema] Tu respuesta presenta valores o afirma que no hay dato, pero en este turno no consultaste ninguna herramienta: " +
  "probablemente reutilizas un turno anterior, que pudo estar desactualizado o equivocado. Vuelve a consultar el indicador con " +
  "consultar_indicador (compararNiveles:true) y responde SOLO con lo que devuelva ahora, incluyendo el aviso de cobertura si lo trae. " +
  "No menciones esta verificación al usuario.";
