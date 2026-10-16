// Helpers de prueba para generate-m1-express: el modelo se llama una vez por mitad (P·E·S y T·Ec·L).
import { vi } from "vitest";

export type Mitad = "PES" | "TEcL";
export const DIMS: Record<Mitad, string[]> = { PES: ["P", "E", "S"], TEcL: ["T", "Ec", "L"] };

export const dimension = (k: string) => ({
  code: k, label: k, clasificacion: "NEUTRAL", narrativa: "x", confidence: 65, senalesFavorables: [], senalesAdversas: [], senalesInciertas: [],
});
export const mapaMitad = (m: Mitad) => Object.fromEntries(DIMS[m].map((k) => [k, dimension(k)]));

export const respuestaModelo = (text: string, stop_reason = "end_turn", usage = { input_tokens: 1200, output_tokens: 3400 }) => ({
  content: [{ type: "text", text }],
  stop_reason,
  usage,
});
export const respuestaValida = (m: Mitad) => respuestaModelo(JSON.stringify(mapaMitad(m)));

/** Qué mitad pide la llamada, leyéndolo del prompt (cada mitad dice «tú escribes solo P, E, S»). */
export function mitadDeLlamada(args: unknown): Mitad {
  const user = (args as { messages: Array<{ content: string }> }).messages[0].content;
  if (user.includes("tú escribes solo P, E, S")) return "PES";
  if (user.includes("tú escribes solo T, Ec, L")) return "TEcL";
  throw new Error("la llamada no es de ninguna mitad");
}

/**
 * Hace que `create` responda según la mitad y el número de intento de ESA mitad.
 * `fn` devuelve una respuesta (o una Promise) o lanza para simular una excepción del SDK.
 */
export function responderPorMitad(
  create: unknown,
  fn: (mitad: Mitad, intento: number) => unknown
) {
  const intentos: Record<Mitad, number> = { PES: 0, TEcL: 0 };
  (create as { mockImplementation: (f: never) => unknown }).mockImplementation(((args: unknown) => {
    const m = mitadDeLlamada(args);
    intentos[m] += 1;
    try {
      return Promise.resolve(fn(m, intentos[m]));
    } catch (e) {
      return Promise.reject(e);
    }
  }) as never);
  return intentos;
}
export { vi };
