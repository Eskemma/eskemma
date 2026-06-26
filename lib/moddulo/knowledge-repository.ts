// lib/moddulo/knowledge-repository.ts
// Server-only: Firestore access for Moddulo knowledge base collections.
// In-memory caching per spec: MEC/MVP/FODA permanent, RAE with 1-hour TTL.
import { adminDb } from "@/lib/firebase-admin";
import type {
  RAEVersion,
  MECInstrument,
  MVPInstrument,
  FODAInstrument,
  RPFEntry,
  KPIEntry,
} from "@/types/knowledge.types";

const RAE_TTL_MS = 60 * 60 * 1000;

// Module-level caches (shared within the same Next.js server instance)
const _mecCache = new Map<string, MECInstrument>();
let _mvpCache: MVPInstrument | null = null;
let _fodaCache: FODAInstrument | null = null;
let _raeCache: { version: RAEVersion; expiresAt: number } | null = null;

export async function getActiveRAEVersion(): Promise<RAEVersion | null> {
  if (_raeCache && Date.now() < _raeCache.expiresAt) {
    return _raeCache.version;
  }

  try {
    const pointerSnap = await adminDb.collection("rae_versions").doc("active").get();
    if (!pointerSnap.exists) return null;

    const versionId = (pointerSnap.data() as { versionId?: string }).versionId;
    if (!versionId) return null;

    const versionSnap = await adminDb.collection("rae_versions").doc(versionId).get();
    if (!versionSnap.exists) return null;

    const version = versionSnap.data() as RAEVersion;
    _raeCache = { version, expiresAt: Date.now() + RAE_TTL_MS };
    return version;
  } catch {
    return null;
  }
}

export async function getMECByType(tipo: string): Promise<MECInstrument | null> {
  if (_mecCache.has(tipo)) return _mecCache.get(tipo)!;

  try {
    const snap = await adminDb
      .collection("mec_instruments")
      .where("tipo_proyecto", "==", tipo)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const instrument = snap.docs[0].data() as MECInstrument;
    _mecCache.set(tipo, instrument);
    return instrument;
  } catch {
    return null;
  }
}

export async function getMVPGeneral(): Promise<MVPInstrument | null> {
  if (_mvpCache) return _mvpCache;

  try {
    const snap = await adminDb.collection("mvp_instruments").limit(1).get();
    if (snap.empty) return null;

    _mvpCache = snap.docs[0].data() as MVPInstrument;
    return _mvpCache;
  } catch {
    return null;
  }
}

export async function getFODAInstrument(): Promise<FODAInstrument | null> {
  if (_fodaCache) return _fodaCache;

  try {
    const snap = await adminDb.collection("foda_instruments").limit(1).get();
    if (snap.empty) return null;

    _fodaCache = snap.docs[0].data() as FODAInstrument;
    return _fodaCache;
  } catch {
    return null;
  }
}

export async function getRPFEntries(
  tipo: string,
  maniobra?: string
): Promise<RPFEntry[]> {
  try {
    const snap = await adminDb
      .collection("rpf_entries")
      .where("tipos_proyecto", "array-contains", tipo)
      .get();

    let entries = snap.docs.map((d) => d.data() as RPFEntry);

    if (maniobra) {
      const maniobraLower = maniobra.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.componente.toLowerCase().includes(maniobraLower) ||
          e.sub_componente.toLowerCase().includes(maniobraLower) ||
          e.apartado.toLowerCase().includes(maniobraLower)
      );
    }

    return entries;
  } catch {
    return [];
  }
}

export async function getKPIsByType(tipo: string): Promise<KPIEntry[]> {
  try {
    const snap = await adminDb
      .collection("kpi_catalog")
      .where("tipos_proyecto", "array-contains", tipo)
      .get();

    return snap.docs.map((d) => d.data() as KPIEntry);
  } catch {
    return [];
  }
}

export async function getKPIsByIds(ids: string[]): Promise<KPIEntry[]> {
  if (ids.length === 0) return [];

  try {
    const snaps = await Promise.all(
      ids.map((id) => adminDb.collection("kpi_catalog").doc(id).get())
    );
    return snaps
      .filter((s) => s.exists)
      .map((s) => s.data() as KPIEntry);
  } catch {
    return [];
  }
}