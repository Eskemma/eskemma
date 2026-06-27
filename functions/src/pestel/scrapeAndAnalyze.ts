// functions/src/pestel/scrapeAndAnalyze.ts
// Cloud Function HTTP: receives { projectId, userId } (V2)
// or { configId, userId } (V1 legacy), runs scrapers in parallel,
// saves raw data, then runs classification in the background.

import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {fetchGoogleNewsRSS} from "./scrapers/googleNewsRSS";
import {fetchDOFRSS} from "./scrapers/dof";
import {
  fetchInegiIndicators,
  INEGI_DEFAULT_SERIES,
} from "./scrapers/inegi";
import {
  fetchBanxicoSeries,
  BANXICO_DEFAULT_SERIES,
} from "./scrapers/banxico";
import {generateAnalysisV2, generateFeedFromRawData} from "./generateFeed";

export const scrapeAndAnalyze = onRequest(
  {
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: ["INEGI_TOKEN", "BANXICO_TOKEN", "ANTHROPIC_API_KEY"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Método no permitido"});
      return;
    }

    const body = req.body as {
      projectId?: string;
      configId?: string;
      userId?: string;
      jobId?: string;
      sefixData?: unknown;
    };

    const {
      projectId, configId, userId,
      jobId: providedJobId,
    } = body;
    const sefixData = (body.sefixData ?? null) as
      Parameters<typeof generateAnalysisV2>[0]["sefixData"];

    if (!userId) {
      res.status(400).json({error: "userId es requerido"});
      return;
    }

    // V2 path requires projectId; V1 legacy requires configId
    const isV2 = Boolean(projectId);
    const isV1 = Boolean(configId);

    if (!isV2 && !isV1) {
      res.status(400).json({
        error: "projectId o configId es requerido",
      });
      return;
    }

    const db = admin.firestore();

    // ----- Resolve territory and data for scraping -----
    let territorioNombre = "México";
    let projectData: Record<string, unknown> | null = null;

    if (isV2) {
      const projectSnap = await db
        .collection("pestel_projects")
        .doc(projectId as string)
        .get();

      if (!projectSnap.exists || projectSnap.data()?.userId !== userId) {
        res.status(403).json({error: "Proyecto no encontrado o sin permisos"});
        return;
      }
      projectData = projectSnap.data() as Record<string, unknown>;
      const territorio =
        projectData.territorio as {nombre?: string} | undefined;
      territorioNombre = territorio?.nombre ?? "México";
    } else {
      const configSnap = await db
        .collection("pestel_configs")
        .doc(configId as string)
        .get();

      if (!configSnap.exists || configSnap.data()?.userId !== userId) {
        res.status(403).json({
          error: "Configuración no encontrada o sin permisos",
        });
        return;
      }
      const configData = configSnap.data() as Record<string, unknown>;
      const territorio =
        configData.territorio as {nombre?: string} | undefined;
      territorioNombre = territorio?.nombre ?? "México";
    }

    // ----- Job document -----
    const jobRef = providedJobId ?
      db.collection("pestel_jobs").doc(providedJobId) :
      db.collection("pestel_jobs").doc();
    const jobId = jobRef.id;

    if (providedJobId) {
      await jobRef.update({
        status: "running",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await jobRef.set({
        ...(isV2 ? {projectId} : {configId}),
        userId,
        status: "running",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    try {
      // ----- Scrapers in parallel -----
      const [newsResult, dofResult, inegiResult, banxicoResult] =
        await Promise.allSettled([
          fetchGoogleNewsRSS(territorioNombre),
          fetchDOFRSS(),
          fetchInegiIndicators(INEGI_DEFAULT_SERIES),
          Promise.all(
            BANXICO_DEFAULT_SERIES.map((s) => fetchBanxicoSeries(s))
          ),
        ]);

      const articles = [
        ...(newsResult.status === "fulfilled" ? newsResult.value : []),
        ...(dofResult.status === "fulfilled" ? dofResult.value : []),
      ];

      const inegiData =
        inegiResult.status === "fulfilled" ? inegiResult.value : [];
      const banxicoData =
        banxicoResult.status === "fulfilled" ?
          banxicoResult.value.flat() :
          [];

      if (newsResult.status === "rejected") {
        console.error("[scrapeAndAnalyze] Google News:", newsResult.reason);
      }
      if (dofResult.status === "rejected") {
        console.error("[scrapeAndAnalyze] DOF:", dofResult.reason);
      }
      if (inegiResult.status === "rejected") {
        console.error("[scrapeAndAnalyze] INEGI:", inegiResult.reason);
      }
      if (banxicoResult.status === "rejected") {
        console.error("[scrapeAndAnalyze] Banxico:", banxicoResult.reason);
      }

      // ----- Save raw articles -----
      await db.collection("pestel_raw_articles").doc(jobId).set({
        jobId,
        ...(isV2 ? {projectId} : {configId}),
        userId,
        territorio: territorioNombre,
        generadoEn: admin.firestore.FieldValue.serverTimestamp(),
        articles,
        economicData: {inegi: inegiData, banxico: banxicoData},
        articlesCount: articles.length,
      });

      // ----- Respond immediately (fire-and-forget background) -----
      res.status(200).json({
        success: true,
        jobId,
        articlesCount: articles.length,
      });

      // ----- Background: analysis -----
      const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";

      try {
        if (isV2 && projectData) {
          // V2: 5 parallel dimension calls
          const varConfigSnap = await db
            .collection("pestel_variable_configs")
            .doc(projectId as string)
            .get();

          const variableConfigs = varConfigSnap.exists ?
            (varConfigSnap.data()?.dimensions ?? []) :
            [];

          const analysisId = await generateAnalysisV2({
            jobId,
            projectId: projectId as string,
            userId,
            tipo: projectData.tipo as string ?? "ciudadano",
            territorio: territorioNombre,
            horizonte: projectData.horizonte as number ?? 6,
            variableConfigs,
            sefixData: sefixData ?? null,
            anthropicKey,
            db,
          });

          await jobRef.update({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            rawDataId: jobId,
            analysisId,
          });
        } else {
          // V1 legacy: batch classification
          const configSnap = await db
            .collection("pestel_configs")
            .doc(configId as string)
            .get();
          const configData = configSnap.data() as Record<string, unknown>;

          const feedId = await generateFeedFromRawData({
            jobId,
            configId: configId as string,
            userId,
            modo: configData?.modo as "ciudadano" | "gubernamental" ??
              "ciudadano",
            anthropicKey,
            db,
          });

          await jobRef.update({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            rawDataId: jobId,
            feedId,
          });
        }
      } catch (bgError) {
        const message =
          bgError instanceof Error ? bgError.message : "Error desconocido";
        console.error(
          "[scrapeAndAnalyze] Background analysis failed:", bgError
        );
        await jobRef.update({
          status: "failed",
          error: message,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("[scrapeAndAnalyze] Fatal scraping error:", error);
      await jobRef.update({
        status: "failed",
        error: message,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.status(500).json({success: false, error: message});
    }
  }
);
