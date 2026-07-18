// lib/ai/creditError.ts
// Detecta errores de crédito agotado de la API de Anthropic y los loguea
// con un prefijo distintivo, para que un incidente similar se diagnostique
// en segundos en vez de una ronda completa de debugging (ver outage 26-07-17,
// que se manifestó como fallos de M2/M3 en generate-dvs y de extracción en
// upload-source, aparentando bugs de datos cuando era agotamiento de crédito).

export function logAnthropicError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("credit balance is too low")) {
    console.error(`[ANTHROPIC_CREDIT_EXHAUSTED] ${context}:`, message);
  } else {
    console.error(`[${context}] Error:`, err);
  }
}
