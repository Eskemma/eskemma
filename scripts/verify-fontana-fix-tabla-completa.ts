/**
 * scripts/verify-fontana-fix-tabla-completa.ts
 * Confirma contra la sesión real ya identificada como desincronizada que
 * los indicadores EXACTOS mostrados como rotos en las capturas de Raúl
 * (Familia 1: Pirámide de edades, % Jefatura femenina, Promedio de
 * ocupantes por cuarto, % Población con discapacidad; Familia 2: Gini de
 * ingreso, Competitividad Estatal IMCO, Ingreso corriente municipal ICMM,
 * IDG municipal PNUD, Sub-índice IDH Salud) ahora resuelven la columna
 * Municipal sin el texto legado "Distrito Electoral Local 27 en la CDMX".
 *
 * Usage: (con `npm run dev` corriendo)
 *   npx tsx scripts/verify-fontana-fix-tabla-completa.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:3000";
const PROJECT_ID = "nZvpYu4nnZrsw5hoGcVP";
const TEXTO_LEGADO = "Distrito Electoral Local 27 en la CDMX";

async function main() {
  const { adminDb, adminAuth } = await import("../lib/firebase-admin");

  const projSnap = await adminDb.collection("moddulo_projects").doc(PROJECT_ID).get();
  const project = projSnap.data()!;
  const uid = project.userId as string;

  const sesSnap = await adminDb.collection("fontana_sesiones").where("modduloProjectId", "==", PROJECT_ID).limit(1).get();
  const sesionDoc = sesSnap.docs[0];

  const customToken = await adminAuth.createCustomToken(uid);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
  );
  const signInData = await signInRes.json();
  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: signInData.idToken }),
  });
  const cookie = sessionRes.headers.get("set-cookie")!.split(";")[0];

  let huboTextoLegado = false;
  for (const familiaId of ["F1", "F2"]) {
    const famRes = await fetch(`${BASE_URL}/api/fontana/familia/${familiaId}?sesionId=${sesionDoc.id}`, { headers: { Cookie: cookie } });
    const famData = await famRes.json();
    console.log(`\n=== Familia ${familiaId} — columna Municipal por indicador ===`);
    for (const ind of famData.indicadores) {
      const municipal = ind.celdas.find((c: { nivel: string }) => c.nivel === "municipal");
      const texto = JSON.stringify(municipal ?? {});
      const rota = texto.includes(TEXTO_LEGADO);
      if (rota) huboTextoLegado = true;
      const resumen = municipal?.valor !== undefined
        ? `valor=${municipal.valor}${municipal.unidad ? " " + municipal.unidad : ""} (${municipal.naturaleza})`
        : (municipal?.motivo ?? "(sin celda)");
      console.log(`  ${rota ? "❌" : "✅"} ${ind.id} (${ind.nombre}): ${resumen}`);
    }
  }

  console.log(huboTextoLegado
    ? "\n❌ Algún indicador todavía muestra el texto legado."
    : "\n✅ NINGÚN indicador muestra ya el texto legado — fix confirmado contra la tabla completa real.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
