import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { adminDb } = await import("../lib/firebase-admin");
  const snap = await adminDb.collection("fontana_sesiones").get();
  console.log(`Total sesiones de Fontana: ${snap.size}`);

  let desincronizadas = 0;
  let sinTerritorioProyecto = 0;
  for (const doc of snap.docs) {
    const sesion = doc.data();
    const projSnap = await adminDb.collection("moddulo_projects").doc(sesion.modduloProjectId).get();
    if (!projSnap.exists) continue;
    const project = projSnap.data()!;
    if (!project.territorio) { sinTerritorioProyecto++; continue; }
    if (JSON.stringify(sesion.territorio) !== JSON.stringify(project.territorio)) {
      desincronizadas++;
      console.log(`  DESINCRONIZADA: sesión ${doc.id} (proyecto ${sesion.modduloProjectId}, "${project.name}")`);
      console.log(`    sesión.territorio.nombre: "${sesion.territorio?.nombre}"`);
      console.log(`    proyecto.territorio.nombre: "${project.territorio?.nombre}"`);
    }
  }
  console.log(`\nDesincronizadas: ${desincronizadas} / ${snap.size}`);
  console.log(`Proyecto sin territorio (no comparable): ${sinTerritorioProyecto}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
