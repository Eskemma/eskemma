/**
 * scripts/verify-territorio-legacy-shape.ts
 * Verificación de solo lectura: confirma el shape real de `territorio` en un
 * proyecto Moddulo ya existente (creado antes del campo aditivo
 * `distritosSeleccionados`), para validar que un adaptador de lectura tipo
 * `territorio.distritosSeleccionados?.[0] ?? legacyFallback` funciona sobre
 * datos reales, no solo sintéticos. Proyecto de referencia documentado en
 * CLAUDE.md (Deuda Técnica Conocida): nZvpYu4nnZrsw5hoGcVP (CDMX, Distrito
 * Local 27). Script de solo lectura — no escribe nada.
 *
 * Usage: npx tsx scripts/verify-territorio-legacy-shape.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PROJECT_ID = "nZvpYu4nnZrsw5hoGcVP";

async function main() {
  const { adminDb } = await import("../lib/firebase-admin");

  const snap = await adminDb.collection("moddulo_projects").doc(PROJECT_ID).get();
  if (!snap.exists) {
    console.log(`Proyecto ${PROJECT_ID} no existe en moddulo_projects.`);
    return;
  }

  const data = snap.data();
  console.log("Shape real de `territorio` en Firestore hoy:");
  console.log(JSON.stringify(data?.territorio, null, 2));
  console.log("\n¿Tiene la clave `distritosSeleccionados`?", Object.prototype.hasOwnProperty.call(data?.territorio ?? {}, "distritosSeleccionados"));

  // Simula el adaptador propuesto para Fase 0.
  const territorio = data?.territorio as Record<string, unknown> | undefined;
  const distritosSeleccionados = territorio?.distritosSeleccionados as { cve: string; nombre: string }[] | undefined;
  const legacyFallback = territorio?.municipio ?? territorio?.nombre;
  const primerDistrito = distritosSeleccionados?.[0]?.nombre ?? legacyFallback;
  console.log("\nResultado del adaptador `distritosSeleccionados?.[0] ?? legacyFallback`:", primerDistrito);

  // Confirma también algún otro proyecto reciente al azar para no depender
  // de un solo documento como muestra.
  const sample = await adminDb.collection("moddulo_projects").limit(5).get();
  console.log(`\n--- Muestra adicional de ${sample.size} proyectos (solo shape de territorio) ---`);
  sample.docs.forEach((d) => {
    const t = d.data()?.territorio;
    console.log(`${d.id}:`, t ? JSON.stringify(t) : "(sin territorio)");
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
