/**
 * scripts/verify-fontana-sesion-stale-territorio.ts
 * Prueba decisiva pedida por Raúl: diagnostica si el label "Municipal"
 * incorrecto que sigue apareciendo en la tabla de Fontana para el proyecto
 * real nZvpYu4nnZrsw5hoGcVP es (a) dato/territorio congelado en
 * fontana_sesiones (snapshot tomado al crear la sesión, nunca
 * re-sincronizado), o (b) una segunda ruta de código que todavía no
 * resuelve la cabecera. Contra la superficie real (HTTP, servidor dev
 * corriendo), no funciones aisladas.
 *
 * Usage: (con `npm run dev` corriendo)
 *   npx tsx scripts/verify-fontana-sesion-stale-territorio.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:3000";
const PROJECT_ID = "nZvpYu4nnZrsw5hoGcVP";

async function main() {
  const { adminDb, adminAuth } = await import("../lib/firebase-admin");

  // --- Estado real de fontana_sesiones para este proyecto ---
  const sesSnap = await adminDb.collection("fontana_sesiones").where("modduloProjectId", "==", PROJECT_ID).limit(1).get();
  if (sesSnap.empty) throw new Error("No existe sesión de Fontana para este proyecto");
  const sesionDoc = sesSnap.docs[0];
  const sesion = sesionDoc.data();
  console.log("=== 1. Territorio guardado en fontana_sesiones (snapshot) ===");
  console.log(JSON.stringify(sesion.territorio, null, 2));

  const projSnap = await adminDb.collection("moddulo_projects").doc(PROJECT_ID).get();
  const project = projSnap.data()!;
  console.log("\n=== Territorio actual en moddulo_projects (ya corregido en la ronda anterior) ===");
  console.log(JSON.stringify(project.territorio, null, 2));

  const esIgual = JSON.stringify(sesion.territorio) === JSON.stringify(project.territorio);
  console.log(`\n¿fontana_sesiones.territorio === moddulo_projects.territorio? ${esIgual ? "SÍ" : "NO — DESINCRONIZADO"}`);

  // --- Sesión HTTP real ---
  const uid = project.userId as string;
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

  // --- 2. Prueba decisiva: añadir un indicador NUEVO que no esté ya en la sesión ---
  const familiaActual = sesion.indicadoresPorFamilia.F2;
  const yaEnSesion = new Set([...familiaActual.minimos, ...familiaActual.seleccionUsuario]);
  const { FAMILIA2_ORDEN } = await import("../lib/fontana/familia2Catalogo");
  const candidato = FAMILIA2_ORDEN.find((id) => !yaEnSesion.has(id));
  if (!candidato) throw new Error("No hay indicador F2 disponible para añadir como prueba (todos ya están en la sesión)");

  console.log(`\n=== 2. PRUEBA DECISIVA: añadiendo indicador NUEVO "${candidato}" (nunca antes en esta sesión) ===`);
  const addRes = await fetch(`${BASE_URL}/api/fontana/sesion/${sesionDoc.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ accion: "agregar", familiaId: "F2", indicadorId: candidato }),
  });
  if (!addRes.ok) throw new Error(`PATCH sesión falló: HTTP ${addRes.status} — ${await addRes.text()}`);
  console.log("✅ Indicador añadido a la sesión");

  const famRes = await fetch(`${BASE_URL}/api/fontana/familia/F2?sesionId=${sesionDoc.id}`, { headers: { Cookie: cookie } });
  const famData = await famRes.json();
  const indicadorNuevo = famData.indicadores.find((i: { id: string }) => i.id === candidato);
  const celdaMunicipal = indicadorNuevo?.celdas?.find((c: { nivel: string }) => c.nivel === "municipal");
  console.log(`\nCelda "municipal" del indicador NUEVO "${candidato}":`);
  console.log(JSON.stringify(celdaMunicipal, null, 2));

  const mencionaTextoViejo = JSON.stringify(celdaMunicipal ?? {}).includes("Distrito Electoral Local 27 en la CDMX");
  const mencionaIztapalapa = JSON.stringify(celdaMunicipal ?? {}).toUpperCase().includes("IZTAPALAPA");

  console.log(`\n¿El indicador NUEVO sigue mostrando el texto legado? ${mencionaTextoViejo ? "SÍ (confirma dato/territorio congelado)" : "NO"}`);
  console.log(`¿El indicador NUEVO ya resuelve "Iztapalapa"? ${mencionaIztapalapa ? "SÍ" : "NO"}`);

  if (mencionaTextoViejo && !esIgual) {
    console.log("\n🔎 DIAGNÓSTICO CONFIRMADO: fontana_sesiones.territorio es un snapshot tomado al crear la sesión, nunca re-sincronizado con moddulo_projects.territorio. Todos los indicadores (viejos Y nuevos) se calculan en vivo en cada request, pero SIEMPRE contra ese snapshot congelado — por eso el indicador nuevo también sale mal. No es caché de valores por indicador, es el territorio de la sesión el que está obsoleto.");
  } else if (!mencionaTextoViejo && mencionaIztapalapa) {
    console.log("\n🔎 El indicador nuevo SÍ resolvió correctamente — el problema sería específico de los indicadores ya existentes (caché por indicador), no del territorio de la sesión. (No es el resultado esperado según el diagnóstico de código.)");
  } else {
    console.log("\n🔎 Resultado inesperado — revisar celda completa arriba.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ VERIFICACIÓN FALLÓ:", err);
    process.exit(1);
  });
