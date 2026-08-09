/**
 * scripts/verify-fontana-familia2-candado.ts
 * Verificación en vivo: candado real de Familia 2 sobre un proyecto
 * production real (Senaduría Oaxaca - Morena) — confirma que la pregunta/
 * justificación real del PIP deriva F2-3/F2-4 vía derivarMinimosPorFamilia,
 * y que el dispatcher resuelve F2-4 (conector real) y F2-3 (diferido,
 * "Conector pendiente...") correctamente. No escribe nada en Firestore.
 *
 * Usage: npx tsx scripts/verify-fontana-familia2-candado.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const { adminDb } = await import("../lib/firebase-admin");
  const { derivarMinimosPorFamilia } = await import("../lib/fontana/pipMinimos");
  const { resolverIndicadorFontana } = await import("../lib/fontana/ingesta");
  const { esValorDisponible } = await import("../lib/fontana/ingesta/types");

  const projectId = "eyfCmaaPlSPjhV8cmpTe";
  const pSnap = await adminDb.collection("moddulo_projects").doc(projectId).get();
  const project = pSnap.data()!;
  const pip = project.phases?.investigacion?.pip ?? project.phases?.exploracion?.dvs?.pip ?? [];
  const f3Tareas = project.phases?.investigacion?.f3TareasPIP ?? [];
  const item = pip.find((p: any) => p.pipItemId === "legacy-2");
  const tarea = f3Tareas.find((t: any) => t.pipItemId === "legacy-2");
  const asig = tarea?.asignaciones?.find((a: any) => a.canal === "canal1" && a.tecnicaId === "T10");
  console.log("Pregunta real del PIP:", item.pregunta);
  console.log("Justificación real de la asignación T10:", asig?.justificacion);

  const minimosF2 = derivarMinimosPorFamilia(item.pregunta, asig?.justificacion, "F2-");
  console.log("\nMínimos F2 derivados:", minimosF2);

  const territorio = project.territorio;
  console.log("Territorio real del proyecto:", territorio);

  for (const id of minimosF2) {
    const celdas = await resolverIndicadorFontana(id, territorio);
    const partes = celdas.map((c: any) =>
      esValorDisponible(c) ? `${c.nivel}=${c.valor}${c.unidad ? " " + c.unidad : ""} [${c.naturaleza}]` : `${c.nivel}=SIN DATO (${c.motivo})`
    );
    console.log(`  ${id}: ${partes.join(" | ")}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
