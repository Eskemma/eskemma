/**
 * scripts/upload-contenido-curado.ts
 * Sube data/fontana/contenido_curado/historia_personajes.json a la
 * bodega de Firebase Storage (fontana/bodega/contenido_curado/historia_personajes.json)
 * — Familia 5, F5-3/F5-4, Grupo C. Re-ejecutar cada vez que Raúl agregue
 * contenido curado nuevo.
 *
 * Usage: npx tsx scripts/upload-contenido-curado.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { adminApp } = await import("../lib/firebase-admin");
  const { getStorage } = await import("firebase-admin/storage");

  const localPath = path.resolve(__dirname, "../data/fontana/contenido_curado/historia_personajes.json");
  const content = fs.readFileSync(localPath, "utf-8");
  const parsed = JSON.parse(content); // valida que sea JSON bien formado antes de subir

  const bucket = getStorage(adminApp).bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!);
  const storagePath = "fontana/bodega/contenido_curado/historia_personajes.json";
  await bucket.file(storagePath).save(JSON.stringify(parsed, null, 2), {
    contentType: "application/json",
  });

  console.log(`✅ Subido: gs://${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/${storagePath}`);
  console.log(`   ${parsed.length} entradas.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
