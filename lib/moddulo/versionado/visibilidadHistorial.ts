// lib/moddulo/versionado/visibilidadHistorial.ts
// C4a-1 — QUIÉN VE el historial. Dos funciones, un solo lugar (decisión de Raúl): endurecer la visibilidad de un rol
// (p. ej. `client`) es cambiar UNA línea aquí; nada más del lector ni del panel decide por su cuenta.
//
//   · puedeVerPanelHistorial: ¿ve el botón/panel y las filas (qué pasó y cuándo)?
//   · puedeVerDetalleHistorial: ¿ve además los NOMBRES de quienes actuaron y el detalle de cada acción?
//     Si no, el lector responde «Alguien del equipo» y omite el detalle.
//
// Hoy: todos los colaboradores ven todo (incluido `client`). Quién puede VOLVER a una versión es otra decisión (C4b)
// y no vive aquí.

import type { CollaboratorRole } from "@/types/moddulo.types";

export const puedeVerPanelHistorial = (_rol: CollaboratorRole): boolean => true;

export const puedeVerDetalleHistorial = (_rol: CollaboratorRole): boolean => true;
