// functions/src/moddulo/scheduled.ts
// Purga programada de proyectos de Moddulo en papelera — dispara
// purgarUnProyecto() para cada proyecto cuyo deletedAt supere
// DIAS_RETENCION_PROYECTOS. Mismo patrón que purgeAdjuntos.ts (wrapper
// delgado onSchedule + función pura testeable aparte).
//
// Modo simulación por defecto (MODDULO_PURGE_MODO_REAL sin "true"): recorre
// los mismos proyectos, pero purgarUnProyecto no ejecuta nada destructivo —
// solo registra en logs qué se habría borrado. Pasar a modo real es un
// cambio de variable de entorno + `firebase deploy --only functions`,
// acción que ejecuta Raúl, nunca automática.

import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import type {Bucket} from "@google-cloud/storage";
import {logger} from "firebase-functions";
import {purgarUnProyecto} from "./purgeModduloProjects";
import {DIAS_RETENCION_PROYECTOS} from "./papeleraConfig";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Corre la purga sobre todos los proyectos vencidos — extraída del wrapper
 * onSchedule para poder probarla/invocarla fuera del scheduler.
 * @param {admin.firestore.Firestore} db instancia de Firestore.
 * @param {Function} bucketFn fábrica del bucket de Storage (permite
 *   inyectar un bucket de prueba).
 * @param {boolean} modoReal true = borra de verdad; false = simulación.
 * @return {Promise<number>} cantidad de proyectos procesados.
 */
export async function purgarProyectosVencidos(
  db: admin.firestore.Firestore,
  bucketFn: () => Bucket,
  modoReal: boolean
): Promise<number> {
  const cutoff = new Date(Date.now() - DIAS_RETENCION_PROYECTOS * MS_POR_DIA);
  const vencidosSnap = await db
    .collection("moddulo_projects")
    .where("deletedAt", "<", cutoff)
    .get();

  const bucket = bucketFn();
  let procesados = 0;
  for (const doc of vencidosSnap.docs) {
    const resultado = await purgarUnProyecto(db, bucket, doc.id, {modoReal});
    logger.info(
      `[purgeModduloProjects][scheduled] ${doc.id} → ${resultado.estado}` +
      ` (modoReal:${modoReal})`
    );
    procesados++;
  }
  return procesados;
}

export const purgeModduloProjectsScheduled = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "America/Mexico_City",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const db = admin.firestore();
    const modoReal = process.env.MODDULO_PURGE_MODO_REAL === "true";
    const procesados = await purgarProyectosVencidos(
      db,
      () => admin.storage().bucket(),
      modoReal
    );
    logger.info(
      `[purgeModduloProjects][scheduled] ${procesados} proyecto(s) ` +
      `vencido(s) procesados (modoReal:${modoReal}).`
    );
  }
);
