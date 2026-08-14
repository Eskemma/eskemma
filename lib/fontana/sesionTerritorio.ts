// lib/fontana/sesionTerritorio.ts
// Punto único de lectura de fontana_sesiones con territorio derivado
// (26-08-13, fix del bug de sesión desincronizada encontrado en
// verificación en vivo tras Fase 1 del rediseño de territorio).
//
// fontana_sesiones.territorio se copiaba UNA SOLA VEZ al crear la sesión
// (app/api/fontana/sesion/route.ts, POST) y nunca se re-sincronizaba — si
// el usuario editaba después el territorio del proyecto en Moddulo (ej.
// con el selector estructurado de Fase 1), Fontana seguía resolviendo
// contra el territorio viejo indefinidamente. Prueba decisiva confirmó que
// no era caché de valores por indicador: un indicador AÑADIDO POR PRIMERA
// VEZ a la sesión también salía mal, porque se calcula en vivo pero
// siempre contra el snapshot obsoleto.
//
// Este helper resuelve la dirección Moddulo→App (escenario (a): proyecto
// activo, territorio originado en Moddulo) — trata moddulo_projects.territorio
// como la fuente de verdad y el campo guardado en fontana_sesiones como un
// snapshot legado que ya no se confía como autoritativo. No resuelve la
// dirección inversa (App→Moddulo) — auditada por separado, no existe hoy
// ningún código de importación de territorio en esa dirección.
//
// Territorio derivado, NO persistido de vuelta a Firestore: se recalcula
// en cada lectura (evita escrituras innecesarias y condiciones de carrera
// entre requests concurrentes). Los 4 archivos que antes leían
// fontana_sesiones directo (sesion/route.ts, sesion/[sesionId]/route.ts,
// familia/[familiaId]/route.ts, familia/[familiaId]/municipios/route.ts)
// deben usar este helper en vez de `adminDb.collection("fontana_sesiones").doc(...).get()`
// + cast manual, para no repetir la lógica de resincronización 4 veces.

import { adminDb } from "@/lib/firebase-admin";
import { getProject } from "@/lib/moddulo/project";
import type { FontanaSesion } from "@/types/fontana.types";

export interface SesionConTerritorioActual {
  sesion: FontanaSesion;
  ref: FirebaseFirestore.DocumentReference;
}

/**
 * Muta `sesion.territorio` in-place con el valor actual de
 * moddulo_projects, si la sesión pertenece al escenario (a) (tiene
 * modduloProjectId) y el proyecto vinculado tiene territorio definido.
 * Extraída como pieza reutilizable porque hay 2 formas de llegar a una
 * sesión (por sesionId directo, o por búsqueda uid+modduloProjectId en
 * sesion/route.ts) — la resincronización es la misma en ambos casos.
 */
async function resincronizarTerritorio(sesion: FontanaSesion, uid: string): Promise<void> {
  if (!sesion.modduloProjectId) return; // escenarios (b)/(c), sin proyecto del que derivar
  const project = await getProject(sesion.modduloProjectId, uid);
  if (project?.territorio) {
    sesion.territorio = project.territorio;
  }
}

/**
 * Carga una sesión de Fontana por id, verificando propiedad (uid), con
 * `territorio` recalculado desde moddulo_projects. Devuelve null si la
 * sesión no existe o no pertenece al uid dado — mismo contrato que el
 * patrón anterior (`snap.exists` + `sesion.uid !== uid`) que este helper
 * reemplaza en los call sites.
 */
export async function cargarSesionConTerritorioActual(
  sesionId: string,
  uid: string
): Promise<SesionConTerritorioActual | null> {
  const ref = adminDb.collection("fontana_sesiones").doc(sesionId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const sesion = { sesionId, ...snap.data() } as FontanaSesion;
  if (sesion.uid !== uid) return null;

  await resincronizarTerritorio(sesion, uid);
  return { sesion, ref };
}

/**
 * Busca la sesión existente de un proyecto (uid + modduloProjectId) — usada
 * por sesion/route.ts (GET/POST), que no conoce el sesionId de antemano.
 * Mismo territorio derivado que cargarSesionConTerritorioActual.
 */
export async function buscarSesionPorProyectoConTerritorioActual(
  uid: string,
  modduloProjectId: string
): Promise<FontanaSesion | null> {
  const snap = await adminDb
    .collection("fontana_sesiones")
    .where("uid", "==", uid)
    .where("modduloProjectId", "==", modduloProjectId)
    .limit(1)
    .get();
  if (snap.empty) return null;

  const doc = snap.docs[0];
  const sesion = { sesionId: doc.id, ...doc.data() } as FontanaSesion;
  await resincronizarTerritorio(sesion, uid);
  return sesion;
}