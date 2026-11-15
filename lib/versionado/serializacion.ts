// lib/versionado/serializacion.ts
// Una sola fuente de la serialización estable (independiente del orden de claves): se reexporta de
// lib/moddulo/serializacionEstable.ts. Acoplamiento SOLO de importación y declarado; mover la función a
// lib/shared/ queda para un corte posterior (decisión de Raúl).
export { serializacionEstable, sonIgualesEstable } from "@/lib/moddulo/serializacionEstable";
