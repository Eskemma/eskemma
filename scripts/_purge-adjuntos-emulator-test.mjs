// Prueba controlada de la purga de adjuntos de Fontana contra el emulador
// de Firestore. Invoca la MISMA función que usa el wrapper onSchedule
// (purgarAdjuntosVencidos) — no reimplementa la lógica. Salta la capa de
// Cloud Scheduler / Pub/Sub, que es infraestructura de Firebase, no código
// nuestro.
//
// Requisitos: emulador de Firestore corriendo en 127.0.0.1:8080 y
// `npm --prefix functions run build` hecho.
//
//   node scripts/_purge-adjuntos-emulator-test.mjs
//
// Rama test/purge-adjuntos-dev-verification — este archivo NO se mergea.

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

// El mismo firebase-admin que usa functions/ (resuelve a
// functions/node_modules) — así los Timestamp de calcularCutoffRetencion()
// y del `db` de la prueba son de la misma instancia del paquete.
import admin from "../functions/node_modules/firebase-admin/lib/index.js";
import {
  purgarAdjuntosVencidos,
  calcularCutoffRetencion,
} from "../functions/lib/fontana/purgeAdjuntos.js";

admin.initializeApp({ projectId: "eskemma-3c4c3" });
const db = admin.firestore();
const Ts = admin.firestore.Timestamp;

const now = Date.now();
const MIN = 60 * 1000;

const seed = [
  { ses: "purgetest_sesA", uid: "u-test-1", adjuntos: [
      { id: "viejo",    nombre: "viejo-10min.pdf",     cargadoEn: Ts.fromMillis(now - 10 * MIN) },
      { id: "reciente", nombre: "reciente-ahora.pdf",  cargadoEn: Ts.fromMillis(now) },
  ]},
  { ses: "purgetest_sesB", uid: "u-test-2", adjuntos: [
      { id: "recienteB", nombre: "recienteB-ahora.pdf", cargadoEn: Ts.fromMillis(now) },
      { id: "viejoB",    nombre: "viejoB-3min.pdf",     cargadoEn: Ts.fromMillis(now - 3 * MIN) },
  ]},
  { ses: "purgetest_sesC", uid: "u-test-3", adjuntos: [] }, // sin adjuntos: path viejos.empty
];

async function limpiar() {
  for (const s of seed) {
    await db.recursiveDelete(db.collection("fontana_sesiones").doc(s.ses));
  }
}

async function sembrar() {
  for (const s of seed) {
    await db.collection("fontana_sesiones").doc(s.ses).set({
      sesionId: s.ses, uid: s.uid, tipoProyecto: "electoral",
    });
    for (const a of s.adjuntos) {
      await db.collection("fontana_sesiones").doc(s.ses)
        .collection("adjuntos").doc(a.id).set({
          id: a.id, nombreArchivo: a.nombre,
          textoExtraido: "contenido de prueba", tipoMime: "application/pdf",
          cargadoEn: a.cargadoEn,
        });
    }
  }
}

async function inventario() {
  const set = new Set();
  const filas = [];
  for (const s of seed) {
    const snap = await db.collection("fontana_sesiones").doc(s.ses)
      .collection("adjuntos").get();
    for (const d of snap.docs) {
      const edad = ((now - d.data().cargadoEn.toMillis()) / MIN).toFixed(1);
      filas.push({ sesion: s.ses, adjunto: d.id, edad_min: edad });
      set.add(`${s.ses}/${d.id}`);
    }
  }
  return { set, filas };
}

const main = async () => {
  await limpiar();
  await sembrar();

  const cutoff = calcularCutoffRetencion();
  const cutoffEdadSeg = ((now - cutoff.getTime()) / 1000).toFixed(1);
  console.log(`cutoff calculado = ${cutoff.toISOString()} ` +
    `(hace ${cutoffEdadSeg}s; esperado ~60s por el DIAS_RETENCION de prueba)`);

  const antes = await inventario();
  console.log("\n--- ANTES ---");
  console.table(antes.filas);

  const borrados = await purgarAdjuntosVencidos(db, cutoff);
  console.log(`\npurgarAdjuntosVencidos() -> ${borrados} borrado(s)`);

  const despues = await inventario();
  console.log("\n--- DESPUÉS ---");
  console.table(despues.filas);

  const casos = [
    { caso: "purgetest_sesA/viejo (10min)",    esperado: "BORRADO",    ok: !despues.set.has("purgetest_sesA/viejo") },
    { caso: "purgetest_sesA/reciente (0min)",  esperado: "CONSERVADO", ok: despues.set.has("purgetest_sesA/reciente") },
    { caso: "purgetest_sesB/recienteB (0min)", esperado: "CONSERVADO", ok: despues.set.has("purgetest_sesB/recienteB") },
    { caso: "purgetest_sesB/viejoB (3min)",    esperado: "BORRADO",    ok: !despues.set.has("purgetest_sesB/viejoB") },
  ];
  console.log("\n=== ASERCIONES ===");
  console.table(casos.map((c) => ({ ...c, resultado: c.ok ? "OK" : "FALLO", ok: undefined })));

  const cutoffSano = Math.abs((now - cutoff.getTime()) - 60_000) < 5_000;
  const netos = antes.set.size - despues.set.size;
  const todo = casos.every((c) => c.ok) && borrados === 2 && netos === 2 && cutoffSano;

  console.log(`\ncutoff ~= now-60s: ${cutoffSano ? "OK" : "FALLO"}`);
  console.log(`borrados reportados: ${borrados} (esperado 2)`);
  console.log(`docs desaparecidos: ${netos} (esperado 2 — ni uno de más)`);
  console.log(todo ? "\n✅ PRUEBA PASA" : "\n❌ PRUEBA FALLA");

  await limpiar();
  process.exit(todo ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(2); });
