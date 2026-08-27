/**
 * scripts/diff-fontana-registry.ts
 * Diff explícito entre data/fontana/INDICATOR_REGISTRY.json (local) y el
 * registry vigente en Firebase Storage — SOLO LECTURA, no sube nada.
 * Existe porque scripts/upload-fontana-registry.ts no hace ningún diff
 * por sí solo (confirmado leyendo su código) — este script cumple el
 * protocolo de CLAUDE.md ("diff explícito contra Storage... nunca subir
 * a ciegas") antes de correr el upload real.
 *
 * Usage: npx tsx scripts/diff-fontana-registry.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

interface IndicadorRegistro {
  id: string;
  [key: string]: unknown;
}

async function main() {
  const { adminApp } = await import("../lib/firebase-admin");
  const { getStorage } = await import("firebase-admin/storage");

  const localPath = path.resolve(__dirname, "../data/fontana/INDICATOR_REGISTRY.json");
  const local = JSON.parse(fs.readFileSync(localPath, "utf-8")) as IndicadorRegistro[];

  const bucket = getStorage(adminApp).bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!);
  const storagePath = "fontana/registry/INDICATOR_REGISTRY.json";
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  const remoto: IndicadorRegistro[] = exists ? JSON.parse((await file.download())[0].toString("utf-8")) : [];

  const localPorId = new Map(local.map((e) => [e.id, e]));
  const remotoPorId = new Map(remoto.map((e) => [e.id, e]));

  const nuevos = local.filter((e) => !remotoPorId.has(e.id)).map((e) => e.id);
  const eliminados = remoto.filter((e) => !localPorId.has(e.id)).map((e) => e.id);
  const cambiados: { id: string; campos: string[] }[] = [];

  for (const [id, entradaLocal] of localPorId) {
    const entradaRemota = remotoPorId.get(id);
    if (!entradaRemota) continue;
    const campos = new Set([...Object.keys(entradaLocal), ...Object.keys(entradaRemota)]);
    const camposDistintos: string[] = [];
    for (const campo of campos) {
      if (JSON.stringify(entradaLocal[campo]) !== JSON.stringify(entradaRemota[campo])) {
        camposDistintos.push(campo);
      }
    }
    if (camposDistintos.length > 0) cambiados.push({ id, campos: camposDistintos });
  }

  console.log(`Local:  ${local.length} indicadores`);
  console.log(`Storage: ${remoto.length} indicadores (${exists ? "archivo existe" : "⚠️ archivo NO existe en Storage todavía"})`);
  console.log("");
  console.log(`Nuevos en local (no están en Storage) — ${nuevos.length}:`);
  console.log(nuevos.length ? nuevos.join(", ") : "(ninguno)");
  console.log("");
  console.log(`Eliminados de local (están en Storage pero ya no en el JSON local) — ${eliminados.length}:`);
  console.log(eliminados.length ? eliminados.join(", ") : "(ninguno)");
  if (eliminados.length > 0) {
    console.log("⚠️  Revisar: subir borraría estos IDs del registry en Storage.");
  }
  console.log("");
  console.log(`Cambiados (mismo id, campos distintos) — ${cambiados.length}:`);
  for (const c of cambiados) {
    console.log(`  ${c.id}: ${c.campos.join(", ")}`);
  }
  console.log("");
  console.log("Nada se subió — este script es solo lectura.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
