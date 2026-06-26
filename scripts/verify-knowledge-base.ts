/**
 * scripts/verify-knowledge-base.ts
 *
 * Verifica que las colecciones de la base de conocimiento en Firestore
 * contienen los datos correctos tras el seed.
 *
 * Uso: npx ts-node --skip-project --compiler-options '{"module":"CommonJS","moduleResolution":"node","esModuleInterop":true}' \
 *        scripts/verify-knowledge-base.ts
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    console.error("Faltan variables: FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID");
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}
const db = admin.firestore();

// ─── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string, detail = "") {
  console.log(`  ✅ ${label}${detail ? " — " + detail : ""}`);
  passed++;
}

function fail(label: string, detail = "") {
  console.log(`  ❌ ${label}${detail ? " — " + detail : ""}`);
  failed++;
}

function check(condition: boolean, labelOk: string, labelFail: string, detail = "") {
  if (condition) ok(labelOk, detail);
  else fail(labelFail, detail);
}

// ─── RAE ──────────────────────────────────────────────────────────────────────

async function verifyRAE() {
  console.log("\n📚 RAE — Marco de Axiomas Estratégicos");

  const activeSnap = await db.collection("rae_versions").doc("active").get();
  check(activeSnap.exists, "rae_versions/active existe", "rae_versions/active NO existe");

  if (!activeSnap.exists) return;
  const { versionId } = activeSnap.data() as { versionId?: string };
  check(!!versionId, `campo versionId = "${versionId}"`, "campo versionId ausente");

  if (!versionId) return;
  const versionSnap = await db.collection("rae_versions").doc(versionId).get();
  check(versionSnap.exists, `rae_versions/${versionId} existe`, `rae_versions/${versionId} NO existe`);

  if (!versionSnap.exists) return;
  const { axiomas } = versionSnap.data() as { axiomas?: unknown[] };
  check(
    Array.isArray(axiomas) && axiomas.length === 1541,
    `axiomas.length === 1541`,
    `axiomas.length esperado 1541, obtenido ${Array.isArray(axiomas) ? axiomas.length : "N/A"}`
  );

  if (!Array.isArray(axiomas) || axiomas.length === 0) return;

  // Show a random axiom
  const sample = axiomas[Math.floor(Math.random() * axiomas.length)] as Record<string, unknown>;
  console.log("\n  🔍 Axioma muestra:");
  console.log(`     id: ${sample.id}`);
  console.log(`     nombre: ${sample.nombre}`);
  console.log(`     variable_xpcto: [${(sample.variable_xpcto as string[] || []).join(", ")}]`);
  console.log(`     fases_aplicacion: [${(sample.fases_aplicacion as number[] || []).join(", ")}]`);
  console.log(`     severidad: ${sample.severidad}`);
  console.log(`     protocolo_accion: ${String(sample.protocolo_accion).substring(0, 80)}...`);

  check(
    Array.isArray(sample.variable_xpcto) && (sample.variable_xpcto as string[]).length > 0,
    "variable_xpcto no vacío",
    "variable_xpcto vacío en la muestra"
  );
  check(
    Array.isArray(sample.fases_aplicacion) && (sample.fases_aplicacion as number[]).length > 0,
    "fases_aplicacion no vacío",
    "fases_aplicacion vacío en la muestra"
  );
  check(
    typeof sample.protocolo_accion === "string" && sample.protocolo_accion.length > 0,
    "protocolo_accion no vacío",
    "protocolo_accion vacío en la muestra"
  );
}

// ─── RPF ──────────────────────────────────────────────────────────────────────

async function verifyRPF() {
  console.log("\n📋 RPF — Registro de Patrones Funcionales");

  const snap = await db.collection("rpf_entries").get();
  check(snap.size === 444, `total 444 entradas`, `total esperado 444, obtenido ${snap.size}`);

  const byTipo: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const tipos = (d.data().tipos_proyecto as string[]) || [];
    tipos.forEach((t) => { byTipo[t] = (byTipo[t] || 0) + 1; });
  });

  for (const tipo of ["electoral", "gubernamental", "legislativo", "ciudadano"]) {
    check(
      byTipo[tipo] === 111,
      `tipo "${tipo}": 111 entradas`,
      `tipo "${tipo}": esperado 111, obtenido ${byTipo[tipo] ?? 0}`
    );
  }

  // Show a sample electoral entry
  const electoralDocs = snap.docs.filter((d) =>
    ((d.data().tipos_proyecto as string[]) || []).includes("electoral")
  );
  if (electoralDocs.length > 0) {
    const sample = electoralDocs[Math.floor(Math.random() * electoralDocs.length)].data();
    console.log("\n  🔍 Entrada electoral muestra:");
    console.log(`     id: ${sample.id}`);
    console.log(`     componente: ${sample.componente}`);
    console.log(`     sub_componente: ${sample.sub_componente}`);
    console.log(`     apartado: ${sample.apartado}`);
    console.log(`     descripcion_alcance: ${String(sample.descripcion_alcance).substring(0, 80)}...`);
    console.log(`     aporte_tactico: ${String(sample.aporte_tactico).substring(0, 80)}...`);
  }
}

// ─── MEC ──────────────────────────────────────────────────────────────────────

async function verifyMEC() {
  console.log("\n🗺️  MEC — Mapa de Espacio Competitivo");

  const snap = await db.collection("mec_instruments").get();
  check(snap.size === 4, `mec_instruments tiene 4 documentos`, `mec_instruments tiene ${snap.size} (esperado 4)`);

  const TIPOS = ["electoral", "gubernamental", "legislativo", "ciudadano"];
  let electoralDoc: Record<string, unknown> | null = null;

  for (const tipo of TIPOS) {
    const doc = snap.docs.find((d) => d.data().tipo_proyecto === tipo);
    if (!doc) {
      fail(`Documento tipo "${tipo}" existe`, `Documento tipo "${tipo}" NO encontrado`);
      continue;
    }

    const data = doc.data();
    const ejes = (data.ejes as unknown[]) || [];
    const narrativas = (data.narrativas as unknown[]) || [];

    check(ejes.length >= 2, `${tipo}: ejes.length >= 2 (${ejes.length})`, `${tipo}: ejes.length = ${ejes.length} (esperado >= 2)`);
    check(
      narrativas.length === 16,
      `${tipo}: narrativas.length === 16`,
      `${tipo}: narrativas.length = ${narrativas.length} (esperado 16)`
    );

    if (tipo === "electoral") electoralDoc = data as Record<string, unknown>;
  }

  if (electoralDoc) {
    const narrativas = electoralDoc.narrativas as Array<{ nombre: string; cuadrante: string; instruccion_moddulo: string }>;
    console.log("\n  🔍 Narrativas del MEC Electoral:");
    narrativas.forEach((n, i) => {
      const instrPreview = n.instruccion_moddulo?.substring(0, 60) ?? "";
      console.log(`     ${String(i + 1).padStart(2, " ")}. [${n.cuadrante}] ${n.nombre}`);
      console.log(`         → ${instrPreview}${instrPreview.length >= 60 ? "..." : ""}`);
    });
  }
}

// ─── MVP ──────────────────────────────────────────────────────────────────────

async function verifyMVP() {
  console.log("\n🎯 MVP — Marco de Vectores Políticos");

  const snap = await db.collection("mvp_instruments").get();
  check(snap.size === 1, `mvp_instruments tiene 1 documento`, `mvp_instruments tiene ${snap.size} (esperado 1)`);
  if (snap.size === 0) return;

  const data = snap.docs[0].data();
  const vectores = (data.vectores as Array<Record<string, unknown>>) || [];
  check(vectores.length === 6, `vectores.length === 6`, `vectores.length = ${vectores.length} (esperado 6)`);

  if (vectores.length === 0) return;

  const v1 = vectores[0];
  console.log(`\n  🔍 Vector 1: "${v1.nombre}"`);
  console.log(`     descripcion: ${String(v1.descripcion).substring(0, 80)}...`);

  const indicadores = (v1.indicadores as string[]) || [];
  console.log(`     indicadores (${indicadores.length}):`);
  indicadores.forEach((ind) => console.log(`       - ${String(ind).substring(0, 80)}`));

  const esp = v1.especificidades as Record<string, string> | undefined;
  const tiposEsp = esp ? Object.keys(esp).filter((k) => esp[k]?.length > 0) : [];
  check(
    tiposEsp.length === 4,
    `especificidades tiene los 4 tipos (${tiposEsp.join(", ")})`,
    `especificidades incompleto: ${tiposEsp.join(", ")} (esperado 4)`
  );

  if (esp) {
    for (const tipo of ["electoral", "gubernamental", "legislativo", "ciudadano"]) {
      const preview = esp[tipo]?.substring(0, 70) ?? "(vacío)";
      console.log(`     esp.${tipo}: ${preview}...`);
    }
  }
}

// ─── FODA ──────────────────────────────────────────────────────────────────────

async function verifyFODA() {
  console.log("\n🔍 FODA — Sistema FODA-CAME-IBEA");

  const snap = await db.collection("foda_instruments").get();
  check(snap.size === 1, `foda_instruments tiene 1 documento`, `foda_instruments tiene ${snap.size} (esperado 1)`);
  if (snap.size === 0) return;

  const data = snap.docs[0].data();
  const marcos = (data.marcos as Array<Record<string, unknown>>) || [];
  check(marcos.length === 5, `marcos.length === 5`, `marcos.length = ${marcos.length} (esperado 5)`);

  const expectedSiglas = ["FODA", "ADV", "MAT", "CAME", "IBEA"];
  for (const sigla of expectedSiglas) {
    const marco = marcos.find((m) => m.sigla === sigla);
    check(!!marco, `marco "${sigla}" existe`, `marco "${sigla}" NO encontrado`);
    if (marco) {
      const comps = (marco.componentes as unknown[]) || [];
      check(
        comps.length >= 4,
        `${sigla}: ${comps.length} componentes`,
        `${sigla}: ${comps.length} componentes (esperado >= 4)`
      );
    }
  }

  // Show FODA Propio components
  const fodaPropio = marcos.find((m) => m.sigla === "FODA");
  if (fodaPropio) {
    const comps = fodaPropio.componentes as Array<{ nombre: string; definicion: string }>;
    console.log("\n  🔍 Componentes del FODA Propio:");
    comps.forEach((c, i) => {
      const defPreview = c.definicion?.substring(0, 70) ?? "";
      console.log(`     ${i + 1}. ${c.nombre}`);
      console.log(`        → ${defPreview}${defPreview.length >= 70 ? "..." : ""}`);
    });
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Verificación de la Base de Conocimiento — Firestore");
  console.log("═══════════════════════════════════════════════════════════");

  await verifyRAE();
  await verifyRPF();
  await verifyMEC();
  await verifyMVP();
  await verifyFODA();

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  Resultado: ${passed} ✅  ${failed} ❌`);
  if (failed === 0) {
    console.log("  Todo correcto. La base de conocimiento está lista.");
  } else {
    console.log("  Hay verificaciones fallidas. Revisar el seed.");
  }
  console.log("═══════════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ Error en la verificación:", err);
  process.exit(1);
});
