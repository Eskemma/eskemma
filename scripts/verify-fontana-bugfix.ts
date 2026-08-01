/**
 * scripts/verify-fontana-bugfix.ts
 * Verificación de SOLO LECTURA contra el proyecto real "Campaña Olivera
 * Femat Dtto. V Jalisco" — confirma que getProject() recalcula estadoApp
 * en vivo para la asignación canal1+T10 real (tarea P4), sin modificar el
 * documento en Firestore.
 *
 * Usage: npx tsx scripts/verify-fontana-bugfix.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { adminDb } = await import("../lib/firebase-admin");
  const { getProject } = await import("../lib/moddulo/project");

  // 1) Confirmar valor CRUDO en Firestore (sin pasar por getProject) —
  //    debe seguir siendo "proximamente", tal como se generó.
  const snap = await adminDb
    .collection("moddulo_projects")
    .where("name", "==", "Campaña Olivera Femat Dtto. V Jalisco")
    .limit(1)
    .get();
  if (snap.empty) throw new Error("Proyecto real no encontrado");
  const doc = snap.docs[0];
  const raw = doc.data();
  const rawTareaP4 = raw.phases?.investigacion?.f3TareasPIP?.find((t: { numero: number }) => t.numero === 4);
  const rawAsigT10 = rawTareaP4?.asignaciones?.find((a: { tecnicaId?: string }) => a.tecnicaId === "T10");
  console.log("=== Valor CRUDO en Firestore (sin normalizar) ===");
  console.log(JSON.stringify(rawAsigT10, null, 2));
  if (rawAsigT10.estadoApp !== "proximamente") {
    console.log("⚠️  El valor crudo ya no es 'proximamente' — puede que el tablero se haya regenerado desde el diagnóstico. Continuando de todos modos.");
  }

  // 2) Leer vía getProject() (uid real del proyecto, no un fixture) —
  //    debe venir recalculado a "disponible" tras el fix.
  const userId = raw.userId as string;
  const project = await getProject(doc.id, userId);
  if (!project) throw new Error("getProject() no regresó el proyecto (revisar collaborators/userId)");
  const tareaP4 = project.phases?.investigacion?.f3TareasPIP?.find((t) => t.numero === 4);
  const asigT10 = tareaP4?.asignaciones.find((a) => a.tecnicaId === "T10");
  console.log("\n=== Valor recalculado vía getProject() ===");
  console.log(JSON.stringify(asigT10, null, 2));

  if (!asigT10) throw new Error("No se encontró la asignación T10 en tarea 4 vía getProject()");
  if (asigT10.estadoApp !== "disponible") {
    throw new Error(`FALLO: estadoApp sigue siendo "${asigT10.estadoApp}", se esperaba "disponible"`);
  }
  console.log("\n✅ getProject() recalcula estadoApp='disponible' en vivo para la asignación real P4/T10");
  console.log(`✅ Href esperado en ambos componentes: /centinela/fontana?moddulo_project_id=${doc.id}&tarea_pip=4`);

  // 3) Confirmar que NO se escribió nada de vuelta a Firestore (solo lectura)
  const snap2 = await adminDb.collection("moddulo_projects").doc(doc.id).get();
  const rawAfter = snap2.data();
  const tareaP4After = rawAfter?.phases?.investigacion?.f3TareasPIP?.find((t: { numero: number }) => t.numero === 4);
  const asigT10After = tareaP4After?.asignaciones?.find((a: { tecnicaId?: string }) => a.tecnicaId === "T10");
  if (asigT10After.estadoApp === rawAsigT10.estadoApp) {
    console.log("✅ Firestore NO fue modificado (el valor crudo persiste igual) — el recálculo es solo en lectura, como se diseñó.");
  } else {
    console.log(`⚠️  El valor crudo en Firestore cambió de '${rawAsigT10.estadoApp}' a '${asigT10After.estadoApp}' — investigar si algo más escribió.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ VERIFICACIÓN FALLÓ:", err);
    process.exit(1);
  });
