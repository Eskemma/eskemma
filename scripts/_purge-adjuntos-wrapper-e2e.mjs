// E2E del wrapper onSchedule vía el emulador de Functions.
// Uso:
//   node scripts/_purge-adjuntos-wrapper-e2e.mjs seed
//   curl -s -X POST http://127.0.0.1:5001/eskemma-3c4c3/us-central1/purgeAdjuntos-0 -d '{}'
//   node scripts/_purge-adjuntos-wrapper-e2e.mjs check
// Rama test/purge-adjuntos-dev-verification — no se mergea.

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
import admin from "../functions/node_modules/firebase-admin/lib/index.js";
admin.initializeApp({ projectId: "eskemma-3c4c3" });
const db = admin.firestore();
const Ts = admin.firestore.Timestamp;
const now = Date.now();
const MIN = 60 * 1000;

const ses = "purgetest_e2e";
const ids = {
  viejo: Ts.fromMillis(now - 10 * MIN),
  reciente: Ts.fromMillis(now),
};

async function seed() {
  await db.recursiveDelete(db.collection("fontana_sesiones").doc(ses));
  await db.collection("fontana_sesiones").doc(ses).set({ sesionId: ses, uid: "u-e2e" });
  for (const [id, cargadoEn] of Object.entries(ids)) {
    await db.collection("fontana_sesiones").doc(ses).collection("adjuntos").doc(id)
      .set({ id, nombreArchivo: `${id}.pdf`, textoExtraido: "x", tipoMime: "application/pdf", cargadoEn });
  }
  const s = await db.collection("fontana_sesiones").doc(ses).collection("adjuntos").get();
  console.log("sembrado:", s.docs.map((d) => d.id).sort());
}

async function check() {
  const s = await db.collection("fontana_sesiones").doc(ses).collection("adjuntos").get();
  const restantes = s.docs.map((d) => d.id).sort();
  console.log("restantes tras el wrapper:", restantes);
  const ok = restantes.length === 1 && restantes[0] === "reciente";
  console.log(ok ? "✅ wrapper E2E: borró 'viejo', conservó 'reciente'" : "❌ wrapper E2E inesperado");
  await db.recursiveDelete(db.collection("fontana_sesiones").doc(ses));
  process.exit(ok ? 0 : 1);
}

const cmd = process.argv[2];
(cmd === "seed" ? seed() : cmd === "check" ? check() : Promise.reject(new Error("seed|check")))
  .catch((e) => { console.error(e); process.exit(2); });
