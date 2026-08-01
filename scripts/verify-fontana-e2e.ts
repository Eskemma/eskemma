/**
 * scripts/verify-fontana-e2e.ts
 * Verificación en vivo de punta a punta del incremento Fontana T10 —
 * escenario (a), Familia 1. Crea un usuario y proyecto de prueba
 * TEMPORALES, ejercita los endpoints reales contra el servidor de
 * desarrollo local, y limpia todo al final (o al fallar).
 *
 * Requiere: npm run dev corriendo en localhost:3000.
 * Usage: npx tsx scripts/verify-fontana-e2e.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:3000";

async function main() {
  const { adminAuth, adminDb } = await import("../lib/firebase-admin");
  const { FieldValue } = await import("firebase-admin/firestore");

  const testEmail = `fontana-verify-${Date.now()}@eskemma-test.local`;
  const testPassword = "Verificacion-Fontana-2026!";
  let uid: string | null = null;
  let projectId: string | null = null;
  let sesionId: string | null = null;
  let cookie: string | null = null;

  try {
    // 1) Usuario de prueba
    const userRecord = await adminAuth.createUser({ email: testEmail, password: testPassword });
    uid = userRecord.uid;
    console.log(`✅ Usuario de prueba creado: ${uid}`);

    // 2) Proyecto Moddulo de prueba con PIP + f3TareasPIP (canal1+T10)
    //    Pregunta elegida para hacer match con "escolaridad" → F1-5 (y
    //    cross-link F2-15/F2-20, inertes porque Familia 2 no existe aún).
    const projectRef = adminDb.collection("moddulo_projects").doc();
    projectId = projectRef.id;
    await projectRef.set({
      id: projectId,
      userId: uid,
      type: "gubernamental",
      name: "Proyecto de verificación Fontana",
      territorio: { nivel: "municipal", nombre: "Zapopan › Jalisco", estado: "Jalisco", municipio: "Zapopan" },
      xpcto: {},
      currentPhase: "investigacion",
      phases: {
        investigacion: {
          pip: [
            { numero: 1, pregunta: "¿Cuál es el nivel de escolaridad de la población del municipio?", metodo: "cuantitativo", vinculoHito: "X", orden: 1, profundidad: "descriptiva" },
          ],
          f3TareasPIP: [
            {
              numero: 1,
              asignaciones: [
                { asignacionId: "1_canal1_primaria_T10", tipo: "primaria", canal: "canal1", tecnicaId: "T10", estadoApp: "disponible", justificacion: "Fontana cubre indicadores educativos del censo.", estado: "pendiente", activada: true },
              ],
            },
          ],
        },
      },
      collaborators: [{ uid, role: "owner" }],
      status: "active",
      settings: { aiLevel: "estandar", language: "es" },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastAccessedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Proyecto de prueba creado: ${projectId}`);

    // 3) Sesión real vía Identity Toolkit REST (mismo mecanismo que usa el cliente)
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: testEmail, password: testPassword, returnSecureToken: true }) }
    );
    const signInData = await signInRes.json();
    if (!signInData.idToken) throw new Error(`No se obtuvo idToken: ${JSON.stringify(signInData)}`);
    console.log("✅ idToken obtenido (Identity Toolkit REST)");

    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: signInData.idToken }),
    });
    const setCookie = sessionRes.headers.get("set-cookie");
    if (!sessionRes.ok || !setCookie) throw new Error(`No se pudo crear la sesión de app: ${sessionRes.status}`);
    cookie = setCookie.split(";")[0];
    console.log("✅ Cookie de sesión de la app obtenida");

    // 4) GET /api/fontana/sesion — debe regresar wizard con minimosPreview incluyendo F1-5
    const getRes = await fetch(`${BASE_URL}/api/fontana/sesion?moddulo_project_id=${projectId}&tarea_pip=1`, {
      headers: { Cookie: cookie },
    });
    const getData = await getRes.json();
    console.log(`\n=== GET /api/fontana/sesion (status ${getRes.status}) ===`);
    console.log(JSON.stringify(getData, null, 2));
    if (getData.existe !== false) throw new Error("Se esperaba existe:false (primera vez)");
    if (!getData.minimosPreview.includes("F1-5")) throw new Error("Se esperaba F1-5 en minimosPreview (match 'escolaridad')");
    console.log("✅ Wizard: minimosPreview incluye F1-5 (match real por texto de pregunta)");

    // 5) POST /api/fontana/sesion — confirma wizard, crea sesión
    const postRes = await fetch(`${BASE_URL}/api/fontana/sesion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ modduloProjectId: projectId, tareaPip: 1 }),
    });
    const postData = await postRes.json();
    console.log(`\n=== POST /api/fontana/sesion (status ${postRes.status}) ===`);
    sesionId = postData.sesionId;
    if (!sesionId) throw new Error("No se creó sesionId");
    if (!postData.sesion.indicadoresPorFamilia.F1.minimos.includes("F1-5")) throw new Error("F1-5 no quedó en minimos de la sesión creada");
    console.log(`✅ Sesión creada: ${sesionId}, F1.minimos = ${JSON.stringify(postData.sesion.indicadoresPorFamilia.F1.minimos)}`);

    // 6) GET de nuevo — ahora debe regresar existe:true con la misma sesión (idempotencia)
    const getRes2 = await fetch(`${BASE_URL}/api/fontana/sesion?moddulo_project_id=${projectId}&tarea_pip=1`, { headers: { Cookie: cookie } });
    const getData2 = await getRes2.json();
    if (getData2.existe !== true || getData2.sesion.sesionId !== sesionId) throw new Error("Segunda apertura no regresó la sesión existente");
    console.log("✅ Segunda apertura del wizard omite el wizard (existe:true, misma sesión)");

    // 7) GET /api/fontana/familia/F1 — debe traer valor real para F1-5 (Zapopan)
    const famRes = await fetch(`${BASE_URL}/api/fontana/familia/F1?sesionId=${sesionId}`, { headers: { Cookie: cookie } });
    const famData = await famRes.json();
    console.log(`\n=== GET /api/fontana/familia/F1 (status ${famRes.status}) ===`);
    console.log(JSON.stringify(famData, null, 2));
    const f15 = famData.indicadores.find((i: { id: string }) => i.id === "F1-5");
    if (!f15) throw new Error("F1-5 no apareció en la respuesta de familia");
    if (!f15.esMinimo) throw new Error("F1-5 debería ser mínimo");
    const celdaMunicipal = f15.celdas.find((c: { nivel: string }) => c.nivel === "municipal");
    if (typeof celdaMunicipal?.valor !== "number") throw new Error("F1-5 no trajo valor real a nivel municipal");
    console.log(`✅ F1-5 (Escolaridad promedio) municipal = ${celdaMunicipal.valor} ${celdaMunicipal.unidad} — dato real, naturaleza=${celdaMunicipal.naturaleza}`);

    // 8) GET /api/fontana/familia/F2 — familia no disponible, debe ser 400 explícito
    const famResF2 = await fetch(`${BASE_URL}/api/fontana/familia/F2?sesionId=${sesionId}`, { headers: { Cookie: cookie } });
    const famDataF2 = await famResF2.json();
    if (famResF2.status !== 400 || famDataF2.error !== "familia_no_disponible") throw new Error("Familia 2 debería regresar 400 familia_no_disponible");
    console.log(`✅ GET familia/F2 → 400 familia_no_disponible (correcto, no simula datos que no existen)`);

    // 9) PATCH quitar sobre un MÍNIMO (F1-5) — debe rechazar con 409
    const patchMinRes = await fetch(`${BASE_URL}/api/fontana/sesion/${sesionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ accion: "quitar", familiaId: "F1", indicadorId: "F1-5" }),
    });
    const patchMinData = await patchMinRes.json();
    console.log(`\n=== PATCH quitar mínimo F1-5 (status ${patchMinRes.status}) ===`);
    console.log(JSON.stringify(patchMinData, null, 2));
    if (patchMinRes.status !== 409 || patchMinData.error !== "indicador_es_minimo") throw new Error("Debería rechazar con 409 indicador_es_minimo");
    console.log("✅ Candado de mínimos: PATCH quitar sobre F1-5 rechazado con 409 indicador_es_minimo");

    // 10) PATCH agregar F1-1 (selección libre) y luego quitarlo — debe permitir
    const patchAddRes = await fetch(`${BASE_URL}/api/fontana/sesion/${sesionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ accion: "agregar", familiaId: "F1", indicadorId: "F1-1" }),
    });
    const patchAddData = await patchAddRes.json();
    if (!patchAddData.sesion.indicadoresPorFamilia.F1.seleccionUsuario.includes("F1-1")) throw new Error("F1-1 no se agregó a seleccionUsuario");
    console.log("✅ PATCH agregar F1-1 (selección libre) — agregado correctamente");

    const patchRemRes = await fetch(`${BASE_URL}/api/fontana/sesion/${sesionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ accion: "quitar", familiaId: "F1", indicadorId: "F1-1" }),
    });
    const patchRemData = await patchRemRes.json();
    if (patchRemRes.status !== 200 || patchRemData.sesion.indicadoresPorFamilia.F1.seleccionUsuario.includes("F1-1")) throw new Error("F1-1 debería haberse podido quitar (no es mínimo)");
    console.log("✅ PATCH quitar F1-1 (no mínimo) — permitido correctamente");

    // 11) Aislamiento entre usuarios — otro usuario NO debe poder leer esta sesión
    const otroEmail = `fontana-verify-otro-${Date.now()}@eskemma-test.local`;
    const otroUser = await adminAuth.createUser({ email: otroEmail, password: testPassword });
    try {
      const otroSignIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: otroEmail, password: testPassword, returnSecureToken: true }),
      }).then((r) => r.json());
      const otroSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: otroSignIn.idToken }),
      });
      const otroCookie = otroSessionRes.headers.get("set-cookie")!.split(";")[0];
      const famAjenaRes = await fetch(`${BASE_URL}/api/fontana/familia/F1?sesionId=${sesionId}`, { headers: { Cookie: otroCookie } });
      if (famAjenaRes.status !== 404) throw new Error(`Otro usuario pudo acceder a la sesión ajena (status ${famAjenaRes.status}, esperado 404)`);
      console.log("✅ Aislamiento entre usuarios: otro uid no puede leer la sesión (404)");
    } finally {
      await adminAuth.deleteUser(otroUser.uid);
    }

    // 12) APP_TO_F3_CONTRACTS.T10 poblado (habilita el botón real en F3TareasPIP.tsx)
    const { APP_TO_F3_CONTRACTS } = await import("../types/f3.types");
    if (!APP_TO_F3_CONTRACTS.T10) throw new Error("APP_TO_F3_CONTRACTS.T10 no está poblado");
    console.log(`✅ APP_TO_F3_CONTRACTS.T10 poblado: ${JSON.stringify(APP_TO_F3_CONTRACTS.T10)}`);

    console.log("\n🎉 TODAS LAS VERIFICACIONES PASARON");
  } finally {
    // Limpieza — nunca dejar datos de prueba en Firestore/Auth real.
    if (sesionId) await adminDb.collection("fontana_sesiones").doc(sesionId).delete().catch(() => {});
    if (projectId) await adminDb.collection("moddulo_projects").doc(projectId).delete().catch(() => {});
    if (uid) await adminAuth.deleteUser(uid).catch(() => {});
    console.log("\n🧹 Limpieza completa (usuario, proyecto y sesión de prueba eliminados).");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ VERIFICACIÓN FALLÓ:", err);
    process.exit(1);
  });
