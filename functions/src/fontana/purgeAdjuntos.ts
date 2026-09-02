// functions/src/fontana/purgeAdjuntos.ts
// Cloud Function programada: cada 24 horas borra los archivos adjuntos del
// chat de Fontana (T10) cuyo `cargadoEn` supere los 90 días, aunque la
// sesión siga activa. El texto extraído de un adjunto es dato político
// sensible y no debe acumularse indefinidamente.
//
// Itera sesión por sesión (sin collectionGroup) — suficiente para el
// volumen esperado de Fontana y evita introducir el primer índice
// COLLECTION_GROUP del repo. Si algún día el conteo de sesiones lo hace
// lento, migrar a db.collectionGroup("adjuntos").where("cargadoEn","<",...).
//
// La lógica de borrado vive en purgarAdjuntosVencidos() — separada del
// wrapper onSchedule para poder verificarla contra el emulador sin depender
// de Cloud Scheduler / Pub/Sub. Verificación y pasos de deploy en
// docs/ecosistema/T10-fontana/purga-adjuntos-runbook.md.

import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions";

const DIAS_RETENCION = 90;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MAX_OPS_BATCH = 400;

/**
 * Borra todos los adjuntos de todas las sesiones de Fontana cuyo
 * `cargadoEn` sea anterior a `cutoff`. Itera sesión por sesión.
 * @param {admin.firestore.Firestore} db instancia de Firestore.
 * @param {Date} cutoff fecha límite; se borra lo estrictamente anterior a
 *   ella. Firestore serializa el Date a Timestamp para comparar contra el
 *   campo `cargadoEn`.
 * @return {Promise<number>} cantidad de documentos de adjunto borrados.
 */
export async function purgarAdjuntosVencidos(
  db: admin.firestore.Firestore,
  cutoff: Date
): Promise<number> {
  const sesiones = await db.collection("fontana_sesiones").get();
  let borrados = 0;

  for (const sesion of sesiones.docs) {
    const viejos = await sesion.ref
      .collection("adjuntos")
      .where("cargadoEn", "<", cutoff)
      .get();
    if (viejos.empty) continue;

    for (let i = 0; i < viejos.docs.length; i += MAX_OPS_BATCH) {
      const batch = db.batch();
      viejos.docs
        .slice(i, i + MAX_OPS_BATCH)
        .forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    borrados += viejos.size;
  }

  return borrados;
}

/**
 * Calcula la fecha límite de retención a partir de DIAS_RETENCION.
 * @return {Date} instante antes del cual un adjunto se considera vencido.
 */
export function calcularCutoffRetencion(): Date {
  return new Date(Date.now() - DIAS_RETENCION * MS_POR_DIA);
}

/**
 * Cloud Function programada: dispara la purga una vez al día.
 * @return {Promise<void>} nada; registra el conteo borrado en los logs.
 */
export const purgeAdjuntos = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "America/Mexico_City",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const db = admin.firestore();
    const borrados = await purgarAdjuntosVencidos(
      db,
      calcularCutoffRetencion()
    );
    logger.info(
      `[purgeAdjuntos] ${borrados} adjunto(s) de Fontana vencidos purgados.`
    );
  }
);
