// lib/moddulo/m1Huella.ts
// Fingerprint of an M1 (MapaPESTEL). SERVER-ONLY: it uses node:crypto, so the
// client never computes it (the server is the only authority on whether an
// approval still matches the content). The pure state logic lives in
// m1Aprobacion.ts and receives the fingerprint as an argument.

// RULE: the fingerprint hashes the stored OBJECT (key-order independent). It must NEVER depend on the text that
// the motors' prompts receive (serializeMapaPESTEL in lib/ai/phases/prompts.ts): changing that format must not
// change any fingerprint, or every approved analysis would stop matching its approval. This file does not import
// prompts.ts (a test reads the source to keep it so).

import { createHash } from "node:crypto";
import type { MapaPESTEL } from "@/types/moddulo.types";
import { serializacionEstable } from "./serializacionEstable";

/** sha-256 (hex) of the key-order-independent serialization of the mapa. */
export function huellaMapaPESTEL(mapa: MapaPESTEL | Record<string, unknown>): string {
  return createHash("sha256").update(serializacionEstable(mapa)).digest("hex");
}

/** sha-256 (hex) of a plain string (used for the impact fingerprint of a confirmation). */
export function huellaTexto(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}
