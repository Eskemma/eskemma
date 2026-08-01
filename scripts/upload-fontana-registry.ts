/**
 * scripts/upload-fontana-registry.ts
 * Sube data/fontana/INDICATOR_REGISTRY.json a la bodega de Firebase
 * Storage (fontana/registry/INDICATOR_REGISTRY.json) — Paso 5, Fontana T10.
 * Re-ejecutar cada vez que se agreguen/actualicen entradas del registro.
 *
 * Usage: npx tsx scripts/upload-fontana-registry.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { adminApp } = await import("../lib/firebase-admin");
  const { getStorage } = await import("firebase-admin/storage");

  const localPath = path.resolve(__dirname, "../data/fontana/INDICATOR_REGISTRY.json");
  const content = fs.readFileSync(localPath, "utf-8");
  const parsed = JSON.parse(content); // valida que sea JSON bien formado antes de subir

  const bucket = getStorage(adminApp).bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!);
  const storagePath = "fontana/registry/INDICATOR_REGISTRY.json";
  await bucket.file(storagePath).save(JSON.stringify(parsed, null, 2), {
    contentType: "application/json",
  });

  console.log(`✅ Subido: gs://${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/${storagePath}`);
  console.log(`   ${parsed.length} indicadores.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
