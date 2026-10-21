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

export type CausaFallo = "saldo" | "limite" | "sobrecarga" | "otro";
const CAUSAS: readonly CausaFallo[] = ["saldo", "limite", "sobrecarga", "otro"];

/** Any unknown or missing value falls to «otro» (it is shown to the user, so it is never trusted blindly). */
export function esCausa(x: unknown): x is CausaFallo {
  return typeof x === "string" && (CAUSAS as readonly string[]).includes(x);
}

/**
 * Why a model call failed, from the HTTP status and the error TYPE of the provider only. Never returns or logs
 * the message. The one text inspection is the fixed phrase the provider uses for an exhausted balance (400);
 * a status-less error counts too (it keeps the alert marker it always had); if the phrase changes, that case falls to «otro». 402 and the `billing_error` type are billing problems too
 * (the SDK types declare `billing_error`; 402 is the status the provider documents for it: not confirmed live).
 */
export function causaDeFalloModelo(err: unknown): CausaFallo {
  const e = err as { status?: unknown; message?: unknown; error?: { type?: unknown; error?: { type?: unknown } } } | null;
  const status = typeof e?.status === "number" ? e.status : null;
  const tipo = e?.error?.error?.type ?? e?.error?.type;
  if (status === 402 || tipo === "billing_error") return "saldo";
  if (status === 429) return "limite";
  if (status === 529 || status === 503) return "sobrecarga";
  if ((status === 400 || status === null) && typeof e?.message === "string" && e.message.includes("credit balance is too low")) return "saldo";
  return "otro";
}

/** The most serious cause among several failures: saldo > limite > sobrecarga > otro. */
export function causaMasGrave(causas: readonly CausaFallo[]): CausaFallo {
  return CAUSAS.find((c) => causas.includes(c)) ?? "otro";
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
  return `[${tag}] motor=${m.motor} intento=${m.intento} codigo=fallo_modelo causa=${causaDeFalloModelo(err)} name=${name} status=${status} duracion_ms=${duracionMs} desde_inicio_ms=${ahora - m.t0}`;
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

// ── Structural descriptions (G, paso 4) ───────────────────────────────────────
// The logs must never carry text of the project or of the model's answer (it is the user's analysis).
// What helps a diagnosis is the shape: length, kind of document, which keys are present, stop_reason,
// and for errors only the class and the HTTP status.

const MAX_CLAVES_DESCRIPCION = 12;

/** «longitud=812 forma=objeto claves=hei,pip» — never any of the text itself. */
export function descripcionEstructural(texto: string): string {
  const s0 = texto.trim();
  const fence = s0.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  const s = fence ? fence[1].trim() : s0;
  let forma: string;
  let claves: string[] | null = null;
  try {
    const parsed: unknown = JSON.parse(s);
    if (Array.isArray(parsed)) forma = "arreglo";
    else if (parsed && typeof parsed === "object") {
      forma = "objeto";
      // Keys come from the schema we asked for; anything that does not look like one is masked.
      claves = Object.keys(parsed as object)
        .slice(0, MAX_CLAVES_DESCRIPCION)
        .map((k) => (/^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(k) ? k : "?"));
    } else forma = typeof parsed;
  } catch {
    forma = s.startsWith("{") ? "objeto_incompleto" : s.startsWith("[") ? "arreglo_incompleto" : s.length === 0 ? "vacio" : "texto";
  }
  return `longitud=${texto.length} forma=${forma}${claves ? ` claves=${claves.join(",")}` : ""}`;
}

/** «clase=APIError status=529» from anything thrown or rejected; never the message or the cause. */
export function descripcionError(err: unknown): string {
  const e = err as { name?: unknown; status?: unknown } | null;
  const clase = typeof e?.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(e.name) ? e.name : "Error";
  const status = typeof e?.status === "number" ? e.status : "n/a";
  return `clase=${clase} status=${status}`;
}

/** console.error with class, status and cause only. The credit-exhausted marker is kept (it is a fixed text). */
export function registrarErrorEstructural(tag: string, contexto: string, err: unknown): void {
  const causa = causaDeFalloModelo(err);
  if (causa === "saldo") {
    console.error(`[ANTHROPIC_CREDIT_EXHAUSTED] ${tag} ${contexto} ${descripcionError(err)} causa=saldo`);
    return;
  }
  console.error(`[${tag}] ${contexto} ${descripcionError(err)} causa=${causa}`);
}
