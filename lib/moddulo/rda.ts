// lib/moddulo/rda.ts
// Capa de escritura del RDA acumulativo (F1→F2→...). Combina las
// evaluaciones puras y efímeras de cada fase (evaluarCriterios,
// evaluarCriteriosDVS) con el estado ya persistido en project.rda para
// decidir qué RDAItems crear y cuáles auto-resolver. No escribe en
// Firestore — devuelve un plan que el caller (complete-phase) aplica.

import { evaluarCriterios, criterioToRDAItem, getCriterioF1 } from "@/lib/moddulo/criterios";
import {
  evaluarCriteriosDVS,
  criterioDVSToRDAItem,
  getCriterioDVSDescripcion,
  getRecomendacionDVS,
} from "@/lib/moddulo/dvs-criteria";
import type { PhaseId, ModduloProject, RDAItem } from "@/types/moddulo.types";

// Fases con evaluador de criterios implementado. F3+ no tiene evaluador
// todavía — se agregan aquí cuando exista, sin tocar el resto de este
// archivo.
const FASES_CON_EVALUADOR: PhaseId[] = ["proposito", "exploracion"];

type ProjectForRDA = Pick<ModduloProject, "xpcto" | "phases" | "type" | "rda">;

/**
 * Evalúa los criterios de una fase y los convierte a RDAItem (sin
 * fechaCreacion). Devuelve `null` si la fase no tiene datos suficientes
 * para evaluarse todavía (ej. exploracion sin DVS generado) — distinto de
 * `[]`, que significa "evaluada, todo satisfecho". La distinción importa
 * para la reconciliación: no se debe auto-resolver un ítem existente solo
 * porque los datos de origen desaparecieron o aún no existen.
 */
function computeRDAItemsParaFase(
  phaseId: PhaseId,
  project: ProjectForRDA
): Omit<RDAItem, "fechaCreacion">[] | null {
  if (phaseId === "proposito") {
    const criterios = evaluarCriterios(project.xpcto, project.phases?.proposito?.dictamen, true);
    return criterios.filter((c) => c.estado === "pendiente").map(criterioToRDAItem);
  }
  if (phaseId === "exploracion") {
    const dvs = project.phases?.exploracion?.dvs;
    if (!dvs) return null;
    const mapaPESTEL = project.phases?.exploracion?.mapaPESTEL;
    const criterios = evaluarCriteriosDVS(dvs, mapaPESTEL, project.type);
    return criterios.filter((c) => !c.satisfecho).map(criterioDVSToRDAItem);
  }
  return null;
}

export interface RDAUpdatePlan {
  // Ítems nuevos a crear (no existen aún en project.rda).
  nuevos: Omit<RDAItem, "fechaCreacion">[];
  // Ids de RDAItem existentes que pasan de "activo" a "resuelto" (sistema).
  resueltos: string[];
}

/**
 * Calcula el plan de actualización del RDA barriendo TODAS las fases con
 * evaluador disponible (reconciliación extendida) — no solo la fase que se
 * está cerrando. Pura: no escribe nada, no llama a Claude.
 */
export function planRDAUpdate(project: ProjectForRDA): RDAUpdatePlan {
  const existentes = project.rda ?? {};
  const nuevos: Omit<RDAItem, "fechaCreacion">[] = [];
  const resueltos: string[] = [];

  for (const fase of FASES_CON_EVALUADOR) {
    const vigentes = computeRDAItemsParaFase(fase, project);
    if (vigentes === null) continue; // fase sin datos suficientes — no reconciliar

    const idsVigentes = new Set(vigentes.map((i) => i.id));

    for (const item of vigentes) {
      if (!existentes[item.id]) nuevos.push(item);
    }

    for (const [id, existing] of Object.entries(existentes)) {
      if (existing.faseOrigen === fase && existing.estado === "activo" && !idsVigentes.has(id)) {
        resueltos.push(id);
      }
    }
  }

  return { nuevos, resueltos };
}

/**
 * Resuelve el texto a mostrar de un RDAItem contra el diccionario canónico
 * VIGENTE por criterioId, en vez del snapshot congelado al momento de
 * crearlo — así una corrección de redacción en criterios.ts/dvs-criteria.ts
 * se refleja en todos los proyectos sin migrar Firestore ni regenerar
 * nada. Si el criterioId ya no existe en el diccionario (renombrado,
 * eliminado, o fase sin catálogo todavía), cae al valor persistido en el
 * propio RDAItem — nunca revienta el render ni muestra un vacío.
 */
export function getDisplayTextForRDAItem(
  item: RDAItem
): { nombre: string; descripcion: string; recomendacion: string } {
  if (item.origenMecanismo === "criterio_suficiencia" && item.criterioId) {
    if (item.faseOrigen === "proposito") {
      const live = getCriterioF1(Number(item.criterioId));
      if (live) {
        return { nombre: live.nombre, descripcion: live.descripcion, recomendacion: live.rutaResolucion };
      }
    }
    if (item.faseOrigen === "exploracion") {
      const descripcion = getCriterioDVSDescripcion(item.criterioId);
      if (descripcion) {
        return {
          nombre: item.criterioId,
          descripcion,
          recomendacion: getRecomendacionDVS(item.criterioId) ?? item.recomendacion,
        };
      }
    }
  }
  return { nombre: item.nombre, descripcion: item.descripcion, recomendacion: item.recomendacion };
}
