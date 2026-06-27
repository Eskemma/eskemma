/**
 * scripts/cleanup-centinela-collections.ts
 *
 * Deletes all centinela_* Firestore collections after migration to pestel_*.
 * Run ONLY after confirming pestel_* data is correct and the app works.
 *
 * Usage:
 *   npx tsx scripts/cleanup-centinela-collections.ts --dry-run   # preview
 *   npx tsx scripts/cleanup-centinela-collections.ts             # live delete
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

const COLLECTIONS_TO_DELETE = [
  "centinela_configs",
  "centinela_feeds",
  "centinela_projects",
  "centinela_variable_configs",
  "centinela_analyses",
  "centinela_data_sources",
  "centinela_jobs",
  "centinela_raw_articles",
  "centinela_alerts",
];

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  console.log("=".repeat(60));
  console.log("  Firestore cleanup: deleting centinela_* collections");
  if (isDryRun) console.log("  MODE: DRY-RUN (nothing will be deleted)");
  else console.log("  MODE: LIVE — documents will be permanently deleted");
  console.log("=".repeat(60));

  let totalDocs = 0;
  let totalDeleted = 0;

  for (const colName of COLLECTIONS_TO_DELETE) {
    const snap = await db.collection(colName).get();
    console.log(`\n▶ ${colName}: ${snap.size} documents`);
    totalDocs += snap.size;

    if (snap.empty) {
      console.log("  (already empty — nothing to do)");
      continue;
    }

    if (isDryRun) {
      snap.docs.forEach((d) => console.log(`  [DRY-RUN] would delete: ${colName}/${d.id}`));
    } else {
      // recursiveDelete handles subcollections automatically
      await db.recursiveDelete(db.collection(colName));
      totalDeleted += snap.size;
      console.log(`  ✅ Deleted ${snap.size} documents (+ any subcollections)`);
    }
  }

  console.log("\n" + "=".repeat(60));
  if (isDryRun) {
    console.log(`  Would delete: ${totalDocs} documents across ${COLLECTIONS_TO_DELETE.length} collections`);
    console.log("  DRY-RUN complete — nothing was deleted.");
  } else {
    console.log(`  Deleted: ${totalDeleted} documents`);
    console.log("  ✅ Cleanup complete. centinela_* collections removed.");
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
