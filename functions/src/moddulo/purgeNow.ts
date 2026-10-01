// functions/src/moddulo/purgeNow.ts
// "Eliminar definitivamente ahora" — Cloud Function HTTP invocada por
// DELETE /api/moddulo/projects/[projectId]/purge-now (Next.js). La ruta de
// Next ya exige sesión + owner + confirmación por nombre tecleado antes de
// llamar aquí (defensa en profundidad §3.1 del plan): esta función VUELVE a
// verificar ownership y que el proyecto esté en papelera, sin confiar en lo
// que el caller ya validó — mismo criterio que scrapeAndAnalyze re-verifica
// projectSnap.data()?.userId del lado de la Cloud Function.
//
// Autenticación de servicio: header x-moddulo-purge-token contra el secreto
// MODDULO_PURGE_TOKEN (Firebase Secret Manager) — mismo patrón que
// FONTANA_INTERNAL_TOKEN, en la dirección inversa (Next → CF).

import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions";
import {purgarUnProyecto} from "./purgeModduloProjects";

export const purgeModduloProjectNow = onRequest(
  {
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: ["MODDULO_PURGE_TOKEN"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Método no permitido"});
      return;
    }

    const tokenEsperado = process.env.MODDULO_PURGE_TOKEN;
    if (!tokenEsperado) {
      logger.error("[purgeModduloProjectNow] MODDULO_PURGE_TOKEN no config.");
      res.status(503).json({error: "servicio_no_configurado"});
      return;
    }
    const tokenRecibido = req.headers["x-moddulo-purge-token"];
    if (tokenRecibido !== tokenEsperado) {
      res.status(401).json({error: "no_autorizado"});
      return;
    }

    const body = req.body as {projectId?: string; userId?: string};
    const {projectId, userId} = body;
    if (!projectId || !userId) {
      res.status(400).json({error: "projectId y userId son requeridos"});
      return;
    }

    const db = admin.firestore();
    const snap = await db.collection("moddulo_projects").doc(projectId).get();
    if (!snap.exists) {
      res.status(404).json({error: "proyecto_no_encontrado"});
      return;
    }
    const data = snap.data() ?? {};
    if (!data.deletedAt) {
      res.status(409).json({error: "no_esta_en_papelera"});
      return;
    }
    const collaborators = (data.collaborators ?? []) as
      {uid: string; role: string}[];
    const esOwner = collaborators.some(
      (c) => c.uid === userId && c.role === "owner"
    );
    if (!esOwner) {
      res.status(403).json({error: "solo_el_dueno"});
      return;
    }

    const modoReal = process.env.MODDULO_PURGE_MODO_REAL === "true";
    const bucket = admin.storage().bucket();
    const resultado = await purgarUnProyecto(db, bucket, projectId, {
      modoReal,
    });
    logger.info(
      `[purgeModduloProjectNow] ${projectId} → ${resultado.estado} ` +
      `(modoReal:${modoReal}, por uid:${userId})`
    );

    res.status(200).json(resultado);
  }
);
