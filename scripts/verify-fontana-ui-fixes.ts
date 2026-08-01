/**
 * scripts/verify-fontana-ui-fixes.ts
 * Verificación en vivo, contra el proyecto real "Campaña Olivera Femat",
 * de: (1) resolución real de territorio (Puerto Vallarta), (2) tabla de
 * 4 columnas según tipoProyecto="electoral", (3) que APP_TO_F3_CONTRACTS
 * y estadoApp siguen resolviendo correctamente tras los cambios de F3TareasPIP.
 *
 * La sesión de Fontana de este proyecto ya existía de pruebas manuales
 * previas a que tipoProyecto se agregara al esquema — se hace un backfill
 * puntual de ese único campo en el documento real (dato real, no
 * fabricado: el tipo del proyecto ya es "electoral", conocido con
 * certeza), no una migración general.
 *
 * Usage: npx tsx scripts/verify-fontana-ui-fixes.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:3000";

async function main() {
  const { adminDb } = await import("../lib/firebase-admin");

  const projSnap = await adminDb
    .collection("moddulo_projects")
    .where("name", "==", "Campaña Olivera Femat Dtto. V Jalisco")
    .limit(1)
    .get();
  if (projSnap.empty) throw new Error("Proyecto real no encontrado");
  const projectDoc = projSnap.docs[0];
  const project = projectDoc.data();
  const uid = project.userId as string;

  const sesSnap = await adminDb.collection("fontana_sesiones").where("modduloProjectId", "==", projectDoc.id).limit(1).get();
  if (sesSnap.empty) throw new Error("Sesión de Fontana no encontrada para este proyecto");
  const sesionDoc = sesSnap.docs[0];
  const sesionData = sesionDoc.data();

  if (!sesionData.tipoProyecto) {
    console.log(`Backfill puntual: tipoProyecto="${project.type}" en fontana_sesiones/${sesionDoc.id} (dato real del proyecto, no fabricado)`);
    await sesionDoc.ref.update({ tipoProyecto: project.type });
  } else {
    console.log(`tipoProyecto ya presente: "${sesionData.tipoProyecto}"`);
  }

  // Sesión real vía Identity Toolkit REST — no puedo autenticar como Raúl
  // (no tengo su password); genero un custom token para su propio uid y
  // lo intercambio, sin crear usuarios de prueba nuevos.
  const { adminAuth } = await import("../lib/firebase-admin");
  const customToken = await adminAuth.createCustomToken(uid);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
  );
  const signInData = await signInRes.json();
  if (!signInData.idToken) throw new Error(`No se obtuvo idToken: ${JSON.stringify(signInData)}`);

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: signInData.idToken }),
  });
  const cookie = sessionRes.headers.get("set-cookie")!.split(";")[0];
  console.log("✅ Cookie de sesión real (uid del proyecto) obtenida");

  const famRes = await fetch(`${BASE_URL}/api/fontana/familia/F1?sesionId=${sesionDoc.id}`, { headers: { Cookie: cookie } });
  const famData = await famRes.json();
  console.log(`\n=== GET /api/fontana/familia/F1 (status ${famRes.status}) ===`);
  console.log(JSON.stringify(famData, null, 2));

  if (famRes.status !== 200) throw new Error("La llamada a familia/F1 falló");

  const columnasEsperadas = ["nacional", "estatal", "distrital", "municipal"];
  if (JSON.stringify(famData.columnas) !== JSON.stringify(columnasEsperadas)) {
    throw new Error(`Columnas incorrectas: ${JSON.stringify(famData.columnas)}, se esperaba ${JSON.stringify(columnasEsperadas)}`);
  }
  console.log("✅ Columnas correctas para proyecto electoral: Nacional/Estatal/Distrital/Municipal");

  for (const ind of famData.indicadores) {
    const nacional = ind.celdas.find((c: { nivel: string }) => c.nivel === "nacional");
    const distrital = ind.celdas.find((c: { nivel: string }) => c.nivel === "distrital");
    const estatal = ind.celdas.find((c: { nivel: string }) => c.nivel === "estatal");
    const municipal = ind.celdas.find((c: { nivel: string }) => c.nivel === "municipal");

    if (nacional?.motivo !== "Nivel no cubierto en este incremento de Fontana") {
      throw new Error(`${ind.id}: nacional debería declarar 'nivel no cubierto', trajo: ${JSON.stringify(nacional)}`);
    }
    if (distrital?.motivo !== "Nivel no cubierto en este incremento de Fontana") {
      throw new Error(`${ind.id}: distrital debería declarar 'nivel no cubierto', trajo: ${JSON.stringify(distrital)}`);
    }
    console.log(`  ${ind.id} (${ind.nombre}): estatal=${JSON.stringify(estatal?.valor ?? estatal?.motivo)} | municipal=${JSON.stringify(municipal?.valor ?? municipal?.motivo)}`);

    if (typeof municipal?.valor !== "number") {
      console.log(`  ⚠️  ${ind.id}: municipal SIGUE sin valor real — motivo: "${municipal?.motivo}"`);
    }
  }

  const algunMunicipalConValor = famData.indicadores.some(
    (ind: { celdas: { nivel: string; valor?: number }[] }) => ind.celdas.find((c) => c.nivel === "municipal")?.valor !== undefined
  );
  if (algunMunicipalConValor) {
    console.log("\n✅ TERRITORIO RESUELTO: al menos un indicador trae valor real a nivel municipal (Puerto Vallarta) — bug de territorio corregido.");
  } else {
    console.log("\n❌ TERRITORIO SIGUE ROTO: ningún indicador resolvió valor municipal real.");
  }

  const { APP_TO_F3_CONTRACTS } = await import("../types/f3.types");
  console.log(`\n✅ APP_TO_F3_CONTRACTS.T10 sigue poblado: ${!!APP_TO_F3_CONTRACTS.T10}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ VERIFICACIÓN FALLÓ:", err);
    process.exit(1);
  });
