// upload-pel-2024.mjs
// Sube todos los CSVs de PEL 2024 a Firebase Storage.
// Credenciales leídas de .env — no se imprimen sus valores.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
dotenv.config();

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!privateKey || !clientEmail || !storageBucket) {
  console.error("ERROR: faltan variables FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL o NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET en .env");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ privateKey, clientEmail, projectId: process.env.FIREBASE_PROJECT_ID }), storageBucket });
}
const bucket = getStorage().bucket();
const dir = "data/results/locals/procesados/pel_2024";
const files = readdirSync(dir).filter(f => f.endsWith(".csv"));

console.log(`Subiendo ${files.length} archivos a sefix/results/locals/ ...`);
let ok = 0;
let fail = 0;
for (const file of files) {
  try {
    await bucket.upload(join(dir, file), { destination: `sefix/results/locals/${file}` });
    console.log(`  ✓ ${file}`);
    ok++;
  } catch (err) {
    console.error(`  ✗ ${file}: ${err.message}`);
    fail++;
  }
}
console.log(`\nCompletado: ${ok} subidos, ${fail} fallidos.`);
