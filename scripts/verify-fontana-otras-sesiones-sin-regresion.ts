import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:3000";

async function main() {
  const { adminDb, adminAuth } = await import("../lib/firebase-admin");
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  const snap = await adminDb.collection("fontana_sesiones").get();
  console.log(`Probando las ${snap.size} sesiones reales contra GET /api/fontana/familia/F1...\n`);

  for (const doc of snap.docs) {
    const sesion = doc.data();
    try {
      const customToken = await adminAuth.createCustomToken(sesion.uid);
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
      const cookie = sessionRes.headers.get("set-cookie")?.split(";")[0];
      if (!cookie) throw new Error("sin cookie de sesión");

      const famRes = await fetch(`${BASE_URL}/api/fontana/familia/F1?sesionId=${doc.id}`, { headers: { Cookie: cookie } });
      const status = famRes.status;
      const body = await famRes.json();
      const nIndicadores = Array.isArray(body.indicadores) ? body.indicadores.length : 0;
      console.log(`${status === 200 ? "✅" : "❌"} sesión ${doc.id} (proyecto ${sesion.modduloProjectId ?? "sin proyecto"}): HTTP ${status}, ${nIndicadores} indicadores`);
    } catch (err) {
      console.log(`❌ sesión ${doc.id}: ERROR — ${(err as Error).message}`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
