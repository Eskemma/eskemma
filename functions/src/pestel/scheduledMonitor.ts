// functions/src/pestel/scheduledMonitor.ts
// Cloud Function programada: cada 6 horas itera proyectos V2 activos y
// dispara scrapeAndAnalyze para cada uno.

import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions";

export const scheduledMonitor = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Mexico_City",
    secrets: ["INEGI_TOKEN", "BANXICO_TOKEN"],
  },
  async () => {
    const db = admin.firestore();

    const snapshot = await db
      .collection("pestel_projects")
      .where("isActive", "==", true)
      .where("autoMonitorEnabled", "==", true)
      .get();

    if (snapshot.empty) {
      logger.info(
        "[scheduledMonitor] No hay proyectos con monitoreo automático activo."
      );
      return;
    }

    logger.info(
      `[scheduledMonitor] Procesando ${snapshot.size} proyectos con ` +
      "monitoreo automático habilitado."
    );

    const firebaseConfig = process.env.FIREBASE_CONFIG ?
      JSON.parse(process.env.FIREBASE_CONFIG) :
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({} as any);
    const gcProjectId =
      process.env.GCLOUD_PROJECT ||
      firebaseConfig.projectId ||
      "eskemma-3c4c3";
    const cfUrl =
      `https://us-central1-${gcProjectId}.cloudfunctions.net` +
      "/scrapeAndAnalyze";

    const results = await Promise.allSettled(
      snapshot.docs.map(async (doc) => {
        const project = doc.data();
        const response = await fetch(cfUrl, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            projectId: doc.id,
            userId: project.userId,
          }),
          signal: AbortSignal.timeout(60000),
        });
        return {projectId: doc.id, httpStatus: response.status};
      })
    );

    results.forEach((result, i) => {
      const docId = snapshot.docs[i].id;
      if (result.status === "fulfilled") {
        logger.info(
          `[scheduledMonitor] ${docId}: HTTP ${result.value.httpStatus}`
        );
      } else {
        logger.error(
          `[scheduledMonitor] ${docId} falló:`,
          result.reason
        );
      }
    });
  }
);
