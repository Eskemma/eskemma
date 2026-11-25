// lib/moddulo/versionado/visibilidadHistorial.ts
// C4a-1 — QUIÉN VE el historial. Dos funciones, un solo lugar (decisión de Raúl): endurecer la visibilidad de un rol
// (p. ej. `client`) es cambiar UNA línea aquí; nada más del lector ni del panel decide por su cuenta.
//
//   · puedeVerPanelHistorial: ¿ve el botón/panel y las filas (qué pasó y cuándo)?
//   · puedeVerDetalleHistorial: ¿ve además los NOMBRES de quienes actuaron y el detalle de cada acción?
//     Si no, el lector responde «Alguien del equipo» y omite el detalle.
//
// Hoy: todos los colaboradores ven todo (incluido `client`).
//
// C4b-1a: quién puede VOLVER a una versión anterior (decisión D3 de Raúl): `owner` y `co-consultant`; `analyst` y
// `client` no. Vive aquí para que el lector (`puedeVolver`) y la ruta de «volver» (403 `sin_permiso`) usen LA MISMA
// regla. Las demás rutas de F3 no validan rol (H-V40) y no se tocan.

import type { CollaboratorRole } from "@/types/moddulo.types";

export const puedeVerPanelHistorial = (_rol: CollaboratorRole): boolean => true;

export const puedeVerDetalleHistorial = (_rol: CollaboratorRole): boolean => true;

export const puedeVolverAVersion = (rol: CollaboratorRole): boolean => rol === "owner" || rol === "co-consultant";
