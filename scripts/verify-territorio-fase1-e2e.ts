/**
 * scripts/verify-territorio-fase1-e2e.ts
 * Verificación en vivo de extremo a extremo del proyecto real que originó
 * el rediseño de territorio: nZvpYu4nnZrsw5hoGcVP (CDMX, Distrito Local 27
 * / Iztapalapa). Mismo patrón que scripts/verify-fontana-ui-fixes.ts
 * (sesión real vía custom token — no puedo autenticar como Raúl con su
 * password) contra un servidor dev real corriendo en localhost:3000.
 *
 * Pasos, todos contra la superficie real (HTTP), no funciones importadas
 * aisladamente:
 * 1. GET /api/geo/options?tipo=distritos_loc&estado_id=09 — el mismo
 *    endpoint que TerritorySelector.tsx llama — confirmar que el
 *    Distrito Local 27 trae cabecera "IZTAPALAPA".
 * 2. PATCH /api/moddulo/projects/{id} con el payload EXACTO que
 *    TerritorySelector.onChange produciría al seleccionar esa opción
 *    (mismo shape, no simplificado).
 * 3. GET /api/moddulo/projects/{id} — confirmar que Firestore persistió
 *    cve_distrito, municipio y distritosSeleccionados correctamente.
 * 4. Confirmar con el código real de Fontana (extraerCiudadCabecera) que
 *    el municipio persistido resuelve a "Iztapalapa" — la función que
 *    consumen los 9 archivos de ingesta de Fontana, sin reimplementarla.
 *
 * Usage: (con `npm run dev` corriendo en otra terminal / background)
 *   npx tsx scripts/verify-territorio-fase1-e2e.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:3000";
const PROJECT_ID = "nZvpYu4nnZrsw5hoGcVP";

async function main() {
  const { adminDb, adminAuth } = await import("../lib/firebase-admin");

  const projSnap = await adminDb.collection("moddulo_projects").doc(PROJECT_ID).get();
  if (!projSnap.exists) throw new Error(`Proyecto real ${PROJECT_ID} no encontrado`);
  const project = projSnap.data()!;
  const uid = project.userId as string;
  console.log(`Proyecto real: "${project.name}" (userId=${uid})`);
  console.log(`Territorio ANTES:`, JSON.stringify(project.territorio, null, 2));

  // --- Sesión real vía Identity Toolkit REST ---
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
  if (!sessionRes.ok) throw new Error(`No se pudo crear sesión: HTTP ${sessionRes.status}`);
  const cookie = sessionRes.headers.get("set-cookie")!.split(";")[0];
  console.log("✅ Cookie de sesión real (uid del proyecto) obtenida");

  // --- 1. GET /api/geo/options — mismo endpoint que TerritorySelector.tsx ---
  const geoRes = await fetch(`${BASE_URL}/api/geo/options?tipo=distritos_loc&estado_id=09`, { headers: { Cookie: cookie } });
  if (!geoRes.ok) throw new Error(`/api/geo/options falló: HTTP ${geoRes.status}`);
  const distritos = await geoRes.json() as { cve: string; nombre: string; cabecera?: string }[];
  const distrito27 = distritos.find((d) => d.cve === "027");
  if (!distrito27) throw new Error("Distrito 027 no encontrado en la respuesta real del endpoint");
  console.log(`\n=== 1. GET /api/geo/options (real, tipo=distritos_loc, estado_id=09) ===`);
  console.log(`Distrito 027:`, JSON.stringify(distrito27));
  if (distrito27.cabecera?.toUpperCase() !== "IZTAPALAPA") {
    throw new Error(`Cabecera esperada "IZTAPALAPA", trajo "${distrito27.cabecera}"`);
  }
  console.log("✅ El endpoint real confirma cabecera=IZTAPALAPA para el Distrito Local 27");

  // --- 2. PATCH con el payload exacto que produciría TerritorySelector ---
  const nuevoTerritorio = {
    nivel: "distrito_local",
    nombre: `Ciudad de México › ${distrito27.nombre}`,
    pais: "México",
    estado: "Ciudad de México",
    municipio: distrito27.cabecera,
    cve_distrito: distrito27.cve,
    distritosSeleccionados: [{ cve: distrito27.cve, nombre: distrito27.cabecera }],
  };
  console.log(`\n=== 2. PATCH /api/moddulo/projects/${PROJECT_ID} ===`);
  console.log(`Payload:`, JSON.stringify(nuevoTerritorio, null, 2));
  const patchRes = await fetch(`${BASE_URL}/api/moddulo/projects/${PROJECT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ territorio: nuevoTerritorio }),
  });
  if (!patchRes.ok) throw new Error(`PATCH falló: HTTP ${patchRes.status} — ${await patchRes.text()}`);
  console.log("✅ PATCH exitoso (HTTP 200)");

  // --- 3. GET para confirmar persistencia real en Firestore ---
  const getRes = await fetch(`${BASE_URL}/api/moddulo/projects/${PROJECT_ID}`, { headers: { Cookie: cookie } });
  if (!getRes.ok) throw new Error(`GET falló: HTTP ${getRes.status}`);
  const { project: reloaded } = await getRes.json();
  console.log(`\n=== 3. GET /api/moddulo/projects/${PROJECT_ID} (territorio DESPUÉS) ===`);
  console.log(JSON.stringify(reloaded.territorio, null, 2));

  if (reloaded.territorio?.cve_distrito !== "027") {
    throw new Error(`cve_distrito esperado "027", persistió "${reloaded.territorio?.cve_distrito}"`);
  }
  if (reloaded.territorio?.municipio !== "IZTAPALAPA") {
    throw new Error(`municipio esperado "IZTAPALAPA", persistió "${reloaded.territorio?.municipio}"`);
  }
  if (reloaded.territorio?.distritosSeleccionados?.[0]?.nombre !== "IZTAPALAPA") {
    throw new Error(`distritosSeleccionados[0].nombre esperado "IZTAPALAPA", persistió "${JSON.stringify(reloaded.territorio?.distritosSeleccionados)}"`);
  }
  console.log("✅ Firestore persistió cve_distrito, municipio y distritosSeleccionados correctamente");

  // --- 4. Confirmar con el código REAL de Fontana (no reimplementado, ni
  // bypaseado) — la llamada EXACTA que hacen los 9 archivos de ingesta:
  // extraerCiudadCabecera(territorio.municipio ?? territorio.nombre)
  const { extraerCiudadCabecera } = await import("../lib/moddulo/territorioLabel");
  const inputFontana = reloaded.territorio.municipio ?? reloaded.territorio.nombre;
  const resuelto = extraerCiudadCabecera(inputFontana);
  console.log(`\n=== 4. extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) — llamada real de los 9 archivos de ingesta de Fontana ===`);
  console.log(`Input: "${inputFontana}"`);
  console.log(`Resuelto: ${JSON.stringify(resuelto)}`);
  if (resuelto?.toUpperCase() !== "IZTAPALAPA") {
    throw new Error(`Fontana resolvería ${JSON.stringify(resuelto)}, se esperaba "IZTAPALAPA"`);
  }
  console.log("\n✅ CÍRCULO CERRADO: Fontana resuelve la alcaldía (Iztapalapa) para este proyecto real, vía la función real que consume, sin bypasear nada.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ VERIFICACIÓN FALLÓ:", err);
    process.exit(1);
  });
