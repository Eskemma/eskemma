// lib/versionado/huella.ts
// Huellas y diff por ítem. SOLO SERVIDOR (usa node:crypto, igual que lib/moddulo/m1Huella.ts): el cliente
// nunca calcula una huella; el servidor es la única autoridad sobre si algo cambió.
//
// Dos usos distintos, compatibles:
//   · huella de la TUPLA completa de un artefacto → deduplicar versiones (no crear una versión idéntica).
//   · huella POR ÍTEM (id estable) → DETECTAR qué ítems cambiaron dentro de una versión (aviso y diff mínimo).

import { createHash } from "node:crypto";
import { serializacionEstable } from "./serializacion";
import type { EstadoArtefacto } from "./tipos";

/** sha-256 (hex) de la serialización estable (no depende del orden de claves; ignora `undefined`). */
export function huellaContenido(valor: unknown): string {
  return createHash("sha256").update(serializacionEstable(valor) ?? "null").digest("hex");
}

/**
 * Huella de la TUPLA completa de un artefacto: contenido + aprobación + insumos/dependeDe + estado.
 * Dos versiones con el mismo contenido pero distinta aprobación (p. ej. la aprobación se retiró) son DISTINTAS.
 */
export function huellaTupla(e: EstadoArtefacto): string {
  return huellaContenido({
    contenido: e.contenido,
    aprobacion: e.aprobacion ?? null,
    insumos: e.insumos ?? null,
    estado: e.estado ?? "vigente",
  });
}

export interface ItemConId {
  id: string;
  valor: unknown;
}

/** id → huella del valor. Un id repetido se conserva el último (el módulo no inventa ids). */
export function huellasPorItem(items: ItemConId[]): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const it of items) salida[it.id] = huellaContenido(it.valor);
  return salida;
}

export interface DiffItems {
  agregados: string[];
  eliminados: string[];
  cambiados: string[];
  iguales: string[];
}

/** Compara dos mapas id → huella. Orden determinista (alfabético dentro de cada grupo). */
export function diffItems(antes: Record<string, string>, despues: Record<string, string>): DiffItems {
  const agregados: string[] = [];
  const eliminados: string[] = [];
  const cambiados: string[] = [];
  const iguales: string[] = [];
  for (const id of Object.keys(despues)) {
    if (!(id in antes)) agregados.push(id);
    else if (antes[id] !== despues[id]) cambiados.push(id);
    else iguales.push(id);
  }
  for (const id of Object.keys(antes)) if (!(id in despues)) eliminados.push(id);
  return {
    agregados: agregados.sort(),
    eliminados: eliminados.sort(),
    cambiados: cambiados.sort(),
    iguales: iguales.sort(),
  };
}
