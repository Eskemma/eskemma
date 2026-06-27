/**
 * scripts/migrate-centinela-to-pestel.ts
 *
 * Copies all documents from centinela_* Firestore collections to pestel_*.
 * Also handles subcollections recursively.
 * Does NOT delete old collections — run cleanup separately after validating.
 *
 * Usage:
 *   npx ts-node scripts/migrate-centinela-to-pestel.ts             # live run
 *   npx ts-node scripts/migrate-centinela-to-pestel.ts --dry-run   # preview only
 */

import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ─── Firebase Admin ───────────────────────────────────────────────────────────

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

// ─── Collection map ───────────────────────────────────────────────────────────

const COLLECTION_MAP: Record<string, string> = {
  centinela_configs:          "pestel_configs",
  centinela_feeds:            "pestel_feeds",
  centinela_projects:         "pestel_projects",
  centinela_variable_configs: "pestel_variable_configs",
  centinela_analyses:         "pestel_analyses",
  centinela_data_sources:     "pestel_data_sources",
  centinela_jobs:             "pestel_jobs",
  centinela_raw_articles:     "pestel_raw_articles",
  centinela_alerts:           "pestel_alerts",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isDryRun = process.argv.includes("--dry-run");
const BATCH_SIZE = 10; // Small batches to stay under the 10MB gRPC payload limit

let totalCopied = 0;
let totalSkipped = 0;

/**
 * Copies all documents from srcRef to dstRef in batches.
 * Recurses into subcollections.
 */
async function copyCollection(
  srcRef: admin.firestore.CollectionReference,
  dstRef: admin.firestore.CollectionReference,
  indent = ""
): Promise<void> {
  const snapshot = await srcRef.get();

  if (snapshot.empty) {
    console.log(`${indent}  (empty)`);
    return;
  }

  console.log(`${indent}  ${snapshot.size} documents to copy`);

  // Process in batches to respect Firestore 500-op limit
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const doc of chunk) {
      const dstDoc = dstRef.doc(doc.id);
      if (isDryRun) {
        console.log(`${indent}    [DRY-RUN] would copy → ${dstRef.path}/${doc.id}`);
      } else {
        batch.set(dstDoc, doc.data());
      }
      totalCopied++;
    }

    if (!isDryRun) {
      await batch.commit();
      console.log(`${indent}    ✓ batch committed (${chunk.length} docs)`);
    }

    // Recurse into subcollections of each document
    for (const doc of chunk) {
      const srcDocRef = srcRef.doc(doc.id);
      const dstDocRef = dstRef.doc(doc.id);
      const subcollections = await srcDocRef.listCollections();

      for (const sub of subcollections) {
        const subDst = dstDocRef.collection(sub.id);
        console.log(`${indent}    subcollection: ${sub.id}`);
        await copyCollection(sub, subDst, indent + "    ");
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  Firestore migration: centinela_* → pestel_*");
  if (isDryRun) console.log("  MODE: DRY-RUN (no data will be written)");
  else console.log("  MODE: LIVE (data will be written to Firestore)");
  console.log("=".repeat(60));

  for (const [src, dst] of Object.entries(COLLECTION_MAP)) {
    console.log(`\n▶ ${src} → ${dst}`);

    const srcCol = db.collection(src);
    const dstCol = db.collection(dst);

    // Check if destination already has documents
    const dstSnap = await dstCol.limit(1).get();
    if (!dstSnap.empty) {
      console.log(`  ⚠️  Destination '${dst}' is not empty — skipping to avoid duplicates`);
      console.log(`     Delete the destination collection first if you want to re-run.`);
      totalSkipped++;
      continue;
    }

    await copyCollection(srcCol, dstCol, "");
    console.log(`  ✅ Done: ${src}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`  Documents copied : ${totalCopied}`);
  console.log(`  Collections skipped (non-empty dst): ${totalSkipped}`);
  if (isDryRun) {
    console.log("  DRY-RUN complete — nothing was written.");
  } else {
    console.log("  Migration complete.");
    console.log("  ⚠️  Old centinela_* collections still exist in Firestore.");
    console.log("     Validate the new pestel_* data before deleting them.");
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
