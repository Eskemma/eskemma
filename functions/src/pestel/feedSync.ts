// functions/src/pestel/feedSync.ts
// Cloud Function Firestore trigger sobre `pestel_feeds/{feedId}` — la
// colección del camino V1 LEGACY (`generateFeedFromRawData`, ver
// generateFeed.ts), no del V2 activo (`generateAnalysisV2`, que escribe
// en `pestel_analyses`, otra colección).
//
// CORREGIDO 26-09-22 — investigación de E8 (CLAUDE.md, "PESTEL — Etapa
// 8"): este stub nació el 2026-03-25 (commit 922fe85, "Fase 1 de
// Monitor") con un `throw new Error("Not implemented — ver Fase 4")`
// permanente. El comentario "Fase 4" NO se refería a alertas — en el
// plan de ingeniería original (`_docs/pestel-engineering-plan.md`) Fase
// 4 es "Integración Moddulo" (feed → F2 Exploración), completada hace
// tiempo por un mecanismo totalmente distinto (Fontana +
// `generate-m1-express`). El stub quedó huérfano: nunca se reconectó
// tras el rediseño V2 (26-03-27), y el `throw` generaba un error de
// Cloud Functions en cada doc de `pestel_feeds` creado por el camino V1
// legacy, sin que nadie lo consumiera.
//
// La generación de alertas por umbral de riesgo YA está resuelta — pero
// para V2, no para este trigger: ver `calcularVectorRiesgoV2`
// (functions/src/pestel/risk/vectorRiesgoV2.ts), insertada directamente
// en `generateAnalysisV2` (mismo archivo que este, generateFeed.ts)
// justo después de guardar `pestel_analyses`. V1 no tiene una fórmula
// equivalente: `PESTLAnalysis` (el shape que guarda `pestel_feeds`) no
// trae `classification`/`intensity` por dimensión, así que la fórmula
// de V2 no es reusable aquí sin rediseñarla — fuera de alcance de esta
// ronda, y de bajo valor dado que V1 es legacy (`pestel_configs`/
// `pestel_feeds`: "solo lectura" en CLAUDE.md).
//
// Este trigger queda como no-op explícito: no rompe nada si el endpoint
// legacy de creación de config todavía se invoca, y documenta por qué
// no genera alertas.

import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions";

export const feedSync = onDocumentCreated(
  "pestel_feeds/{feedId}",
  async (event) => {
    logger.info(
      `[feedSync] pestel_feeds/${event.params.feedId} creado ` +
        "(camino V1 legacy) — sin alertas para V1, ver comentario de " +
        "cabecera del archivo."
    );
  }
);
