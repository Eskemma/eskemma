/**
 * scripts/agregar-municipios-zmg.ts
 * Un solo uso (26-09-27, decisión de Raúl): el proyecto Moddulo `O2RBnCPiyGJ6u6kyk1rS` (ZMG) tenía
 * 8 de los 10 municipios reales de la Zona Metropolitana de Guadalajara — faltaban Ixtlahuacán de
 * los Membrillos y Acatlán de Juárez, ya presentes (con `clave`) en la sesión de Fontana vinculada
 * `vO9JFif6W3UQc7DlyqPq`, que sirve de fuente de verdad (evidencia de fuentes oficiales reunida en
 * el Paso 2a: decretos del Congreso de Jalisco 23021/2009 y 25400/LX/15).
 *
 * Copia LITERALMENTE los 2 objetos {nombre, estado, clave} de la sesión de Fontana (nunca se
 * re-teclean a mano) y los agrega con `agregarMunicipioSeleccionado` (lib/geo/municipioSeleccionado.ts,
 * sin tocarla). Solo escribe `territorio.municipiosSeleccionados` y `territorio.municipiosPorEstado`
 * — nada más del documento (ni el resto de `territorio`, ni `name`/`xpcto`/`phases`/`rda`).
 *
 * DRY-RUN POR DEFECTO:
 *   npx tsx scripts/agregar-municipios-zmg.ts             (imprime el antes/después, no escribe)
 *   npx tsx scripts/agregar-municipios-zmg.ts --simular    (igual, con más detalle del payload)
 *   npx tsx scripts/agregar-municipios-zmg.ts --apply      (escribe, con respaldo y relectura de concurrencia)
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { agregarMunicipioSeleccionado } from "../lib/geo/municipioSeleccionado";
import { compararTerritorios } from "../lib/moddulo/linkCompatibility";
import type { MunicipioSeleccionado, Territorio } from "../types/shared.types";

const PROJECT_ID = "O2RBnCPiyGJ6u6kyk1rS";
const SESION_ID = "vO9JFif6W3UQc7DlyqPq";

// Copiados literalmente de fontana_sesiones/vO9JFif6W3UQc7DlyqPq.territorio.municipiosPorEstado
// (verificado en vivo el 26-09-27) — no se re-teclean a mano.
const NUEVOS: MunicipioSeleccionado[] = [
  { nombre: "Ixtlahuacan de los Membrillos", estado: "Jalisco", clave: "14:IXTLAHUACAN DE LOS MEMBRILLOS" },
  { nombre: "Acatlán", estado: "Jalisco", clave: "14:ACATLAN DE JUAREZ" },
];

const apply = process.argv.includes("--apply");
const simular = process.argv.includes("--simular");

function initFirebase() {
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
}

async function main() {
  const app = initFirebase();
  const db = getFirestore(app);

  const ref = db.collection("moddulo_projects").doc(PROJECT_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`No existe moddulo_projects/${PROJECT_ID}`);
    process.exit(1);
  }
  const data = snap.data()!;
  const territorioAntes = data.territorio as Territorio;

  console.log("=== ANTES ===");
  console.log("municipiosSeleccionados:", JSON.stringify(territorioAntes.municipiosSeleccionados));
  console.log("municipiosPorEstado:", JSON.stringify(territorioAntes.municipiosPorEstado, null, 2));

  let municipiosPorEstadoDespues = territorioAntes.municipiosPorEstado ?? [];
  for (const nuevo of NUEVOS) {
    municipiosPorEstadoDespues = agregarMunicipioSeleccionado(municipiosPorEstadoDespues, nuevo);
  }
  const nombresYaPresentes = new Set((territorioAntes.municipiosSeleccionados ?? []).map((n) => n));
  const municipiosSeleccionadosDespues = [
    ...(territorioAntes.municipiosSeleccionados ?? []),
    ...NUEVOS.map((n) => n.nombre).filter((n) => !nombresYaPresentes.has(n)),
  ];

  console.log("\n=== DESPUÉS (calculado) ===");
  console.log("municipiosSeleccionados:", JSON.stringify(municipiosSeleccionadosDespues));
  console.log("municipiosPorEstado:", JSON.stringify(municipiosPorEstadoDespues, null, 2));
  console.log(`\nTotal municipios: ${territorioAntes.municipiosPorEstado?.length ?? 0} → ${municipiosPorEstadoDespues.length}`);

  const territorioDespues: Territorio = {
    ...territorioAntes,
    municipiosSeleccionados: municipiosSeleccionadosDespues,
    municipiosPorEstado: municipiosPorEstadoDespues,
  };

  // Efecto de segundo orden: checkTerritoryMatch contra la sesión de Fontana vinculada, con el
  // módulo real de producción (no reimplementado).
  const sesionSnap = await db.collection("fontana_sesiones").doc(SESION_ID).get();
  const territorioSesion = sesionSnap.data()!.territorio as Territorio;
  const comparacionAntes = compararTerritorios(territorioAntes, territorioSesion);
  const comparacionDespues = compararTerritorios(territorioDespues, territorioSesion);
  console.log("\n=== compararTerritorios vs. sesión de Fontana (módulo real) ===");
  console.log("Antes:   ", JSON.stringify(comparacionAntes));
  console.log("Después: ", JSON.stringify(comparacionDespues));

  if (!apply) {
    console.log(simular ? "\n[--simular] Payload arriba. Nada escrito." : "\n[dry-run] Nada escrito. Usa --apply para escribir.");
    process.exit(0);
  }

  // Respaldo del documento completo tal como estaba, en el scratchpad de la sesión.
  const backupDir = "/private/tmp/claude-501/-Users-raul-Documents-development-eskemma/8976233e-6ca2-4332-9e6d-388b0d2a5fff/scratchpad";
  const backupPath = path.join(backupDir, `zmg-backup-${Date.now()}.json`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`\nRespaldo escrito en ${backupPath}`);

  // Relectura de concurrencia: aborta si el documento cambió desde que lo leímos arriba.
  const snapReread = await ref.get();
  const territorioReread = snapReread.data()!.territorio as Territorio;
  if (JSON.stringify(territorioReread) !== JSON.stringify(territorioAntes)) {
    console.error("El documento cambió desde la lectura inicial. Abortado sin escribir — vuelve a correr el script.");
    process.exit(1);
  }

  await ref.update({
    "territorio.municipiosSeleccionados": municipiosSeleccionadosDespues,
    "territorio.municipiosPorEstado": municipiosPorEstadoDespues,
  });
  console.log("\n✓ Escrito. Verificando por relectura...");

  const snapFinal = await ref.get();
  const territorioFinal = snapFinal.data()!.territorio as Territorio;
  console.log("municipiosSeleccionados (final):", JSON.stringify(territorioFinal.municipiosSeleccionados));
  console.log("municipiosPorEstado (final):", JSON.stringify(territorioFinal.municipiosPorEstado, null, 2));

  const comparacionFinal = compararTerritorios(territorioFinal, territorioSesion);
  console.log("\ncompararTerritorios (final, real):", JSON.stringify(comparacionFinal));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
