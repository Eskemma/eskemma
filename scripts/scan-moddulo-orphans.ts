/**
 * scripts/scan-moddulo-orphans.ts
 * Papelera de proyectos de Moddulo — fase (a), §5 del plan (26-09-28).
 * Escaneo de SOLO LECTURA — no borra ni escribe nada. Dimensiona lo que ya quedó
 * huérfano por el borrado físico actual de deleteProject (antes de que exista
 * `deletedAt`/papelera), para saber si el caso conocido
 * (fontana_sesiones/1g2BpNMF5PqZq6sSTZkP → moddulo_projects/dFUSiVXEvRIan54C6x2A)
 * sigue siendo el único, o si hace falta un script puntual más grande (§11.3 del plan).
 *
 * Reporta:
 *   1. fontana_sesiones con modduloProjectId apuntando a un doc que no existe.
 *   2. pestel_projects con modduloProjectId apuntando a un doc que no existe.
 *   3. Archivos en Storage bajo moddulo/{uid}/{projectId}/... cuyo projectId no
 *      corresponde a ningún moddulo_projects existente.
 *   4. Cruce del punto 3 contra Firestore para estimar subcolecciones f3Resultados
 *      sin padre, sin necesitar un índice collectionGroup nuevo.
 *
 * Uso: npx tsx scripts/scan-moddulo-orphans.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { adminDb, adminStorage } = await import("../lib/firebase-admin");

  const proyectosSnap = await adminDb.collection("moddulo_projects").get();
  const idsExistentes = new Set(proyectosSnap.docs.map((d) => d.id));
  console.log(`moddulo_projects existentes: ${idsExistentes.size}`);

  // 1) Sesiones de Fontana huérfanas.
  const sesionesSnap = await adminDb.collection("fontana_sesiones").get();
  const sesionesHuerfanas: { id: string; modduloProjectId: string; tareaPipIds: string[] }[] = [];
  for (const doc of sesionesSnap.docs) {
    const s = doc.data();
    const mpid = s.modduloProjectId as string | undefined;
    if (mpid && !idsExistentes.has(mpid)) {
      sesionesHuerfanas.push({ id: doc.id, modduloProjectId: mpid, tareaPipIds: s.tareaPipIds ?? [] });
    }
  }
  console.log(`\n=== 1) fontana_sesiones huérfanas (modduloProjectId inexistente): ${sesionesHuerfanas.length} ===`);
  for (const s of sesionesHuerfanas) {
    console.log(`  ${s.id} → ${s.modduloProjectId} (tareaPipIds: ${JSON.stringify(s.tareaPipIds)})`);
  }

  // 2) Proyectos PESTEL huérfanos.
  const pestelSnap = await adminDb.collection("pestel_projects").get();
  const pestelHuerfanos: { id: string; modduloProjectId: string }[] = [];
  for (const doc of pestelSnap.docs) {
    const p = doc.data();
    const mpid = p.modduloProjectId as string | undefined;
    if (mpid && !idsExistentes.has(mpid)) {
      pestelHuerfanos.push({ id: doc.id, modduloProjectId: mpid });
    }
  }
  console.log(`\n=== 2) pestel_projects huérfanos (modduloProjectId inexistente): ${pestelHuerfanos.length} ===`);
  for (const p of pestelHuerfanos) console.log(`  ${p.id} → ${p.modduloProjectId}`);

  // 3) Archivos de Storage bajo moddulo/ sin proyecto correspondiente.
  const [files] = await adminStorage.bucket().getFiles({ prefix: "moddulo/" });
  const projectIdsEnStorage = new Set<string>();
  for (const f of files) {
    // moddulo/{uid}/{projectId}/...
    const partes = f.name.split("/");
    if (partes.length >= 3) projectIdsEnStorage.add(partes[2]);
  }
  const projectIdsHuerfanosStorage = [...projectIdsEnStorage].filter((id) => !idsExistentes.has(id));
  console.log(`\n=== 3) Archivos en Storage bajo moddulo/ con projectId inexistente ===`);
  console.log(`  Total archivos bajo moddulo/: ${files.length}`);
  console.log(`  projectId distintos en Storage: ${projectIdsEnStorage.size}`);
  console.log(`  projectId huérfanos (sin doc en Firestore): ${projectIdsHuerfanosStorage.length}`);
  for (const id of projectIdsHuerfanosStorage) {
    const archivosDeEse = files.filter((f) => f.name.split("/")[2] === id).length;
    console.log(`    ${id} (${archivosDeEse} archivo(s))`);
  }

  // 4) f3Resultados huérfanos — usando el mismo conjunto de projectId huérfanos de
  // Storage (evita el índice COLLECTION_GROUP nuevo: no se hace una query
  // collectionGroup, solo se intenta leer f3Resultados bajo cada id huérfano conocido).
  console.log(`\n=== 4) Subcolección f3Resultados bajo esos projectId huérfanos (si Storage no tenía nada, este cruce no añade cobertura extra) ===`);
  for (const id of projectIdsHuerfanosStorage) {
    const f3Snap = await adminDb.collection("moddulo_projects").doc(id).collection("f3Resultados").get();
    if (f3Snap.size > 0) console.log(`    ${id}: ${f3Snap.size} documento(s) en f3Resultados`);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Sesiones de Fontana huérfanas: ${sesionesHuerfanas.length}`);
  console.log(`Proyectos PESTEL huérfanos: ${pestelHuerfanos.length}`);
  console.log(`projectId huérfanos con archivos en Storage: ${projectIdsHuerfanosStorage.length}`);
  console.log(`\nNo se borró ni se escribió nada — este script es de solo lectura.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
