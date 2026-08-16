/**
 * scripts/verify-fase2-territorio-plural-e2e.ts
 * Fase 2 del rediseño de territorio (26-08-13) — verificación en vivo del
 * modelo de datos plural contra la superficie real (crear proyecto real vía
 * lib/moddulo/project.ts, leerlo de vuelta de Firestore, y golpear el
 * endpoint HTTP real de Canal 3 con sesión autenticada real).
 *
 * NO reemplaza la verificación manual en navegador de la interacción de UI
 * (multi-select de distritos/estados, deduplicación de municipios al
 * escribir) — este entorno no tiene herramienta de automatización de
 * navegador disponible. Este script verifica el CONTRATO DE DATOS que esa
 * UI produce y consume: exactamente el shape que
 * handleDistritosDelEstadoChange/agregarDistrito/agregarMunicipio de
 * TerritorySelector.tsx construyen, persistido y leído end-to-end.
 *
 * Usage: (con `npm run dev` corriendo)
 *   npx tsx scripts/verify-fase2-territorio-plural-e2e.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:3000";
const PROJECT_ID_REFERENCIA = "nZvpYu4nnZrsw5hoGcVP"; // dueño real conocido, para obtener un uid válido

async function main() {
  const { adminDb, adminAuth } = await import("../lib/firebase-admin");
  const { createProject, getProject, deleteProject } = await import("../lib/moddulo/project");
  const { esTerritorioParcial, resolverPrimerMunicipio } = await import("../lib/moddulo/territorioPlural");

  const refSnap = await adminDb.collection("moddulo_projects").doc(PROJECT_ID_REFERENCIA).get();
  const uid = refSnap.data()!.userId as string;

  let fallas = 0;
  const check = (cond: boolean, msg: string) => {
    console.log(`  ${cond ? "✅" : "❌"} ${msg}`);
    if (!cond) fallas++;
  };

  // ============================================================
  // Caso 1 — Distritos multi-estado (pasos 1 y 2 del plan)
  // ============================================================
  console.log("=== Caso 1: distritos de 2 estados distintos, mismo shape que agregarDistrito() produce ===");
  const proyecto1 = await createProject(uid, {
    type: "gubernamental",
    name: "[VERIFY-FASE2] Distritos multi-estado",
    territorio: {
      nivel: "distrito_local",
      nombre: "Jalisco › Distrito 5",
      pais: "México",
      estado: "Jalisco",
      municipio: "Distrito 5",
      cve_distrito: "005",
      distritosSeleccionados: [
        { cve: "005", nombre: "Distrito 5", estado: "Jalisco" },
        { cve: "010", nombre: "Distrito 10", estado: "Jalisco" },
        { cve: "005", nombre: "Distrito 5 (otro estado)", estado: "Nayarit" },
      ],
    },
  });
  try {
    const leido1 = await getProject(proyecto1.id, uid);
    const dist = leido1!.territorio!.distritosSeleccionados!;
    check(dist.length === 3, `distritosSeleccionados trae las 3 entradas (${dist.length})`);
    check(
      dist.filter((d) => d.estado === "Jalisco").length === 2 &&
      dist.filter((d) => d.estado === "Nayarit").length === 1,
      "las entradas conservan su estado correcto tras el round-trip (2 Jalisco, 1 Nayarit)"
    );
    check(
      dist.some((d) => d.cve === "005" && d.estado === "Jalisco") &&
      dist.some((d) => d.cve === "005" && d.estado === "Nayarit"),
      "el mismo cve (005) en 2 estados distintos no colisiona — la clave real es cve+estado"
    );
    check(leido1!.territorio!.estado === "Jalisco", `campo legado 'estado' = primer distrito ("${leido1!.territorio!.estado}")`);
    check(leido1!.territorio!.municipio === "Distrito 5", `campo legado 'municipio' = primer distrito ("${leido1!.territorio!.municipio}")`);
    check(leido1!.territorio!.cve_distrito === "005", `campo legado 'cve_distrito' = primer distrito ("${leido1!.territorio!.cve_distrito}")`);
    check(esTerritorioParcial(leido1!.territorio) === true, "esTerritorioParcial(territorio) === true con 3 distritos");
  } finally {
    await deleteProject(proyecto1.id, uid);
  }

  // ============================================================
  // Caso 2 — Estados múltiples (paso 3 del plan)
  // ============================================================
  console.log("\n=== Caso 2: nivel Estatal con estadosSeleccionados plural ===");
  const proyecto2 = await createProject(uid, {
    type: "gubernamental",
    name: "[VERIFY-FASE2] Estados múltiples",
    territorio: {
      nivel: "estatal",
      nombre: "Jalisco",
      pais: "México",
      estado: "Jalisco",
      estadosSeleccionados: ["Jalisco", "Nayarit"],
    },
  });
  try {
    const leido2 = await getProject(proyecto2.id, uid);
    check(
      JSON.stringify(leido2!.territorio!.estadosSeleccionados) === JSON.stringify(["Jalisco", "Nayarit"]),
      `estadosSeleccionados persiste ambos ("${leido2!.territorio!.estadosSeleccionados}")`
    );
    check(leido2!.territorio!.estado === "Jalisco", `campo legado 'estado' = primer elemento ("${leido2!.territorio!.estado}")`);
    check(esTerritorioParcial(leido2!.territorio) === true, "esTerritorioParcial(territorio) === true con 2 estados");
  } finally {
    await deleteProject(proyecto2.id, uid);
  }

  // ============================================================
  // Caso 3 — Territorio singular (no debe reportarse como parcial)
  // ============================================================
  console.log("\n=== Caso 3: control — territorio singular NO debe marcarse parcial ===");
  const proyecto3 = await createProject(uid, {
    type: "gubernamental",
    name: "[VERIFY-FASE2] Singular (control)",
    territorio: {
      nivel: "municipal",
      nombre: "Jalisco › Zapopan",
      pais: "México",
      estado: "Jalisco",
      municipio: "Zapopan",
      municipiosSeleccionados: ["Zapopan"],
    },
  });
  try {
    const leido3 = await getProject(proyecto3.id, uid);
    check(esTerritorioParcial(leido3!.territorio) === false, "esTerritorioParcial(territorio) === false con 1 solo municipio");

    // ============================================================
    // Caso 4 — Canal 3 con territorio singular: SIN advertencia extra (paso 5, control negativo)
    // ============================================================
    console.log("\n=== Caso 4: Canal 3 /evaluar contra proyecto singular — control negativo ===");
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const customToken = await adminAuth.createCustomToken(uid);
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

    const metadatosFuenteBase = {
      tipoProyectoDeclarado: "gubernamental",
      territorioDeclarado: { nivel: "municipal", nombre: "Nayarit › Tepic", pais: "México", estado: "Nayarit", municipio: "Tepic" },
      fechaObtencion: "2026-01-01",
      metodoDeclarado: "scraping",
    };

    const evalRes3 = await fetch(`${BASE_URL}/api/moddulo/f3/canal3/evaluar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ projectId: proyecto3.id, metadatosFuente: metadatosFuenteBase }),
    });
    const evalData3 = await evalRes3.json();
    const detalle3: string = evalData3.compatibilidad.pertinencia.territorioDetalle ?? "";
    console.log(`  Mensaje real: "${detalle3}"`);
    check(evalRes3.status === 200, `HTTP 200 (${evalRes3.status})`);
    check(!detalle3.includes("más de una unidad territorial"), "el mensaje NO incluye la advertencia de pluralidad (control negativo correcto)");

    // ============================================================
    // Caso 5 — Canal 3 con territorio PLURAL: SÍ debe incluir la advertencia (paso 5, positivo)
    // ============================================================
    console.log("\n=== Caso 5: Canal 3 /evaluar contra proyecto con territorio plural ===");
    const evalRes1 = await fetch(`${BASE_URL}/api/moddulo/f3/canal3/evaluar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ projectId: proyecto1.id, metadatosFuente: metadatosFuenteBase }),
    });
    // proyecto1 ya fue borrado — usamos proyecto2 (estados plural) en su lugar, sigue vivo hasta el finally externo
    void evalRes1;
    const evalRes2 = await fetch(`${BASE_URL}/api/moddulo/f3/canal3/evaluar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        projectId: (await createProject(uid, {
          type: "gubernamental",
          name: "[VERIFY-FASE2] Canal3 plural",
          territorio: {
            nivel: "estatal",
            nombre: "Jalisco",
            pais: "México",
            estado: "Jalisco",
            estadosSeleccionados: ["Jalisco", "Nayarit"],
          },
        })).id,
        metadatosFuente: metadatosFuenteBase,
      }),
    });
    const evalData2 = await evalRes2.json();
    const detalle2: string = evalData2.compatibilidad.pertinencia.territorioDetalle ?? "";
    console.log(`  Mensaje real: "${detalle2}"`);
    check(evalRes2.status === 200, `HTTP 200 (${evalRes2.status})`);
    check(
      detalle2.includes("más de una unidad territorial seleccionada"),
      "el mensaje SÍ incluye la advertencia de pluralidad cuando el proyecto tiene 2 estados"
    );
  } finally {
    await deleteProject(proyecto3.id, uid);
  }

  // Limpieza del proyecto de Canal3 plural creado inline arriba
  const restantes = await adminDb
    .collection("moddulo_projects")
    .where("userId", "==", uid)
    .where("name", "==", "[VERIFY-FASE2] Canal3 plural")
    .get();
  for (const d of restantes.docs) await deleteProject(d.id, uid);

  // ============================================================
  // Caso 6 — Decisión 2 (Ronda 3): municipiosPorEstado en 2 estados
  // ============================================================
  console.log("\n=== Caso 6: municipiosPorEstado en 2 estados distintos ===");
  const proyecto6 = await createProject(uid, {
    type: "gubernamental",
    name: "[VERIFY-FASE2] municipiosPorEstado multi-estado",
    territorio: {
      nivel: "municipal",
      nombre: "Jalisco › Guadalajara",
      pais: "México",
      estado: "Jalisco",
      municipio: "Guadalajara",
      municipiosSeleccionados: ["Guadalajara", "Zapopan", "Tepic"],
      municipiosPorEstado: [
        { nombre: "Guadalajara", estado: "Jalisco" },
        { nombre: "Zapopan", estado: "Jalisco" },
        { nombre: "Tepic", estado: "Nayarit" },
      ],
      estadosSeleccionados: ["Jalisco", "Nayarit"],
    },
  });
  try {
    const leido6 = await getProject(proyecto6.id, uid);
    const mpe = leido6!.territorio!.municipiosPorEstado!;
    check(mpe.length === 3, `municipiosPorEstado trae las 3 entradas (${mpe.length})`);
    check(
      mpe.filter((m) => m.estado === "Jalisco").length === 2 &&
      mpe.filter((m) => m.estado === "Nayarit").length === 1,
      "las entradas conservan su estado correcto tras el round-trip (2 Jalisco, 1 Nayarit)"
    );
    const primero = resolverPrimerMunicipio(leido6!.territorio);
    check(primero.valor === "Guadalajara", `resolverPrimerMunicipio() = primer elemento ("${primero.valor}")`);
    check(primero.esParcial === true, "resolverPrimerMunicipio().esParcial === true con 3 municipios");
    check(esTerritorioParcial(leido6!.territorio) === true, "esTerritorioParcial(territorio) === true (dispatcher usa resolverPrimerMunicipio)");

    // Control: fallback a municipiosSeleccionados legado cuando municipiosPorEstado está ausente
    const territorioLegado = {
      nivel: "municipal" as const,
      nombre: "Jalisco › Zapopan",
      estado: "Jalisco",
      municipio: "Zapopan",
      municipiosSeleccionados: ["Zapopan", "Guadalajara"],
    };
    const legadoResuelto = resolverPrimerMunicipio(territorioLegado);
    check(
      legadoResuelto.valor === "Zapopan" && legadoResuelto.esParcial === true,
      `fallback a municipiosSeleccionados legado funciona sin municipiosPorEstado ("${legadoResuelto.valor}", esParcial=${legadoResuelto.esParcial})`
    );
  } finally {
    await deleteProject(proyecto6.id, uid);
  }

  console.log(`\n${fallas === 0 ? "✅ TODOS los checks pasaron." : `❌ ${fallas} check(s) fallaron.`}`);
  process.exit(fallas === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
