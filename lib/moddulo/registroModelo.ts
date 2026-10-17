// lib/moddulo/registroModelo.ts
// One log line per model call (same format as generate-m1-express: key=value, figures only — never the
// prompt, the answer or any data of the user) plus a final «total» line. It exists to measure the real
// margin against the 300 s of the platform (Vercel Hobby with Fluid) in generate-dvs / regenerate-m5.
//
// Codes of the routes' own 500s, by motor: respuesta_truncada (stop_reason max_tokens), respuesta_invalida
// (the answer did not parse or came empty) and fallo_modelo (the call itself failed).

export type CodigoModelo = "respuesta_truncada" | "respuesta_invalida" | "fallo_modelo";

export interface MetaLlamada {
  /** M2, M3, M4, M5 or legacy. */
  motor: string;
  intento: number;
  /** Date.now() when the route started (for desde_inicio_ms). */
  t0: number;
}

interface RespuestaMedible {
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function codigoDeParseo(stopReason: string | null | undefined): CodigoModelo {
  return stopReason === "max_tokens" ? "respuesta_truncada" : "respuesta_invalida";
}

export function lineaLlamada(tag: string, m: MetaLlamada, r: RespuestaMedible, duracionMs: number, ahora: number): string {
  return (
    `[${tag}] motor=${m.motor} intento=${m.intento} stop_reason=${r.stop_reason ?? "n/a"} ` +
    `input_tokens=${r.usage?.input_tokens ?? "n/a"} output_tokens=${r.usage?.output_tokens ?? "n/a"} ` +
    `duracion_ms=${duracionMs} desde_inicio_ms=${ahora - m.t0}`
  );
}

export function lineaFallo(tag: string, m: MetaLlamada, err: unknown, duracionMs: number, ahora: number): string {
  const e = err as { name?: unknown; status?: unknown };
  const name = typeof e?.name === "string" ? e.name : "Error";
  const status = typeof e?.status === "number" ? e.status : "n/a";
  return `[${tag}] motor=${m.motor} intento=${m.intento} codigo=fallo_modelo name=${name} status=${status} duracion_ms=${duracionMs} desde_inicio_ms=${ahora - m.t0}`;
}

export function lineaTotal(tag: string, resultado: string, t0: number, ahora: number): string {
  return `[${tag}] total resultado=${resultado} duracion_ms=${ahora - t0}`;
}

/** Runs one model call and logs it (also when it fails). Rethrows the original error. */
export async function medirLlamada<T extends RespuestaMedible>(tag: string, meta: MetaLlamada, llamar: () => Promise<T>): Promise<T> {
  const inicio = Date.now();
  try {
    const r = await llamar();
    console.log(lineaLlamada(tag, meta, r, Date.now() - inicio, Date.now()));
    return r;
  } catch (err) {
    console.error(lineaFallo(tag, meta, err, Date.now() - inicio, Date.now()));
    throw err;
  }
}

export function registrarTotal(tag: string, resultado: string, t0: number): void {
  console.log(lineaTotal(tag, resultado, t0, Date.now()));
}
