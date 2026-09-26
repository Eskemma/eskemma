// lib/territorio/origenTerritorio.ts
// Portabilidad por id (Paso 4b, 26-09-26): dado un proyecto/sesión de Moddulo, PESTEL o Fontana, devuelve
// su territorio ESTRUCTURADO (con listas plurales y claves) para prellenar el formulario de otra app.
// Sustituye al transporte por query params de texto, que perdía `cve_distrito` y todos los plurales.
//
// Seguridad (Reglas de Oro §3): el id viene del cliente; la propiedad se verifica con el helper de cada
// app y un origen inexistente o ajeno devuelve null SIN distinción (la ruta responde el mismo 404).
// Solo se devuelve lo necesario para prellenar — nunca el documento.

import { getProjectParaPrellenado } from "@/lib/moddulo/project";
import { getPestelProjectPropio } from "@/lib/centinela/pestel/projectPropio";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import type { Territorio } from "@/types/shared.types";

export const APPS_ORIGEN = ["moddulo", "pestel", "fontana"] as const;
export type AppOrigen = (typeof APPS_ORIGEN)[number];

export interface OrigenTerritorio {
  territorio: Territorio;
  /** Nombre del proyecto/sesión de origen (Fontana: nombre de la sesión si lo tiene). */
  nombre: string | null;
  /** Tipo de proyecto (electoral/gubernamental/legislativo/ciudadano). */
  tipo: string | null;
  color: string | null;
}

/** Ids de Firestore razonables; cualquier otra cosa se trata como "no encontrado". */
export const ID_ORIGEN_VALIDO = /^[A-Za-z0-9_-]{1,128}$/;

export function esAppOrigen(x: string | null): x is AppOrigen {
  return x !== null && (APPS_ORIGEN as readonly string[]).includes(x);
}

export async function resolverTerritorioOrigen(app: AppOrigen, id: string, uid: string): Promise<OrigenTerritorio | null> {
  if (!ID_ORIGEN_VALIDO.test(id)) return null;

  if (app === "moddulo") {
    const p = await getProjectParaPrellenado(id, uid);
    if (!p?.territorio) return null;
    return { territorio: p.territorio, nombre: p.name ?? null, tipo: p.type ?? null, color: p.color ?? null };
  }

  if (app === "pestel") {
    const p = await getPestelProjectPropio(id, uid);
    if (!p?.territorio) return null;
    return { territorio: p.territorio, nombre: p.nombre ?? null, tipo: p.tipo ?? null, color: p.color ?? null };
  }

  const cargada = await cargarSesionConTerritorioActual(id, uid);
  if (!cargada?.sesion.territorio) return null;
  const { sesion } = cargada;
  return {
    territorio: sesion.territorio,
    nombre: sesion.nombre ?? null,
    tipo: sesion.tipoProyecto ?? null,
    color: sesion.color ?? null,
  };
}
