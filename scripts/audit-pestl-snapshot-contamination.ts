/**
 * scripts/audit-pestl-snapshot-contamination.ts
 *
 * Read-only audit: finds moddulo_projects linked to Centinela PESTEL
 * (phases.exploracion.pestAnalysisId present) where mapaPESTEL was later
 * overwritten by the express flow — the exact bug generate-m1-express's
 * missing pestAnalysisId guard would have prevented.
 *
 * Correct contamination signal: "fuentesConsultadas" is written ONLY by
 * generate-m1-express (route.ts:283-288, alongside mapaPESTEL). It is NOT
 * written by generate-dvs's draft-save path, which unconditionally writes
 * xpctoSnapshotAtGeneration for both origins (Centinela and express) once
 * mapaPESTEL exists — so xpctoSnapshotAtGeneration presence alone is NOT
 * a valid contamination signal (initial version of this script used that
 * heuristic and produced false positives — corrected here).
 *
 * Usage:
 *   npx tsx scripts/audit-pestl-snapshot-contamination.ts
 */

import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    console.error(
      "❌ Missing env vars: FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID"
    );
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

async function main() {
  const snap = await db.collection("moddulo_projects").get();

  console.log(`Total proyectos Moddulo: ${snap.size}`);

  const linkedToCentinela: { id: string; nombre?: string }[] = [];
  const contaminated: {
    id: string;
    nombre?: string;
    pestAnalysisId: string;
    pestProjectId?: string;
  }[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const exploracion = data.phases?.exploracion;
    if (!exploracion?.pestAnalysisId) continue;

    linkedToCentinela.push({ id: doc.id, nombre: data.nombre });

    // fuentesConsultadas is only ever written by generate-m1-express.
    // If it's present on a project that also has pestAnalysisId, express
    // ran after the Centinela link existed and overwrote mapaPESTEL —
    // the pointer (pestAnalysisId/pestProjectId) is now stale/orphaned.
    const expressRanAfterLink = typeof exploracion.fuentesConsultadas !== "undefined";

    if (expressRanAfterLink) {
      contaminated.push({
        id: doc.id,
        nombre: data.nombre,
        pestAnalysisId: exploracion.pestAnalysisId,
        pestProjectId: exploracion.pestProjectId,
      });
    }
  }

  console.log(`\nProyectos vinculados a Centinela PESTEL (pestAnalysisId presente): ${linkedToCentinela.length}`);
  for (const p of linkedToCentinela) {
    console.log(`  - ${p.id} (${p.nombre ?? "sin nombre"})`);
  }

  console.log(`\n⚠️  Proyectos CONTAMINADOS (pestAnalysisId presente + fuentesConsultadas presente → express corrió y sobrescribió mapaPESTEL de Centinela): ${contaminated.length}`);
  for (const p of contaminated) {
    console.log(`  - ${p.id} (${p.nombre ?? "sin nombre"}) | pestAnalysisId=${p.pestAnalysisId} | pestProjectId=${p.pestProjectId ?? "N/A"}`);
  }

  if (contaminated.length === 0) {
    console.log("\n✅ No se detectaron proyectos contaminados. El guard duro (Cambio C) puede aplicarse sin excepciones.");
  } else {
    console.log("\n🔎 Estos proyectos necesitan tratamiento antes de aplicar el guard duro (Cambio C) — limpiar pestAnalysisId/pestProjectId automáticamente vs. revisión manual.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
