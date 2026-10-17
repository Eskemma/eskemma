// lib/moddulo/esperaMotores.ts
// How long the screen waits for the generation of M2–M5 (POST generate-dvs, one request that runs M2‖M3 →
// M4 → M5 on the server). Budget measured at ≈16.5 ms per output token: ≈165 s normal, ≈247 s when M5
// retries; the platform (Vercel Hobby with Fluid) kills the request at 300 s. The screen never waits without
// end: after LIMITE_ABORTAR_S the client aborts its own wait. An abort says nothing about the server (it may
// have finished), so the message never claims that nothing was saved.

export const LIMITE_NORMAL_S = 240;
export const LIMITE_ABORTAR_S = 310;

export type EstadoEsperaMotores = "normal" | "lenta" | "excedida";

export function estadoEsperaMotores(segundos: number): EstadoEsperaMotores {
  if (segundos > LIMITE_ABORTAR_S) return "excedida";
  if (segundos > LIMITE_NORMAL_S) return "lenta";
  return "normal";
}

export const TEXTO_PROCESANDO_MOTORES = "Generando análisis por motores…";
export const TEXTO_ESPERA_LENTA = "Está tardando más de lo esperado. Sigue en curso; no cierres la página.";
export const MENSAJE_ESPERA_EXCEDIDA = "Está tardando más de lo esperado. No se pudo CONFIRMAR que haya terminado. Usa «Revisar estado» para ver si ya se generó, o «Reintentar generación».";
