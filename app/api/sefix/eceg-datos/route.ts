import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";
import { ECEG_VALID_KEYS, ECEG_INDICATOR_MAP } from "@/lib/sefix/ecegConstants";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX = "sefix/eceg_2020";

// Server-side in-memory cache: storagePath → { data, expiresAt }
interface CacheEntry { data: Record<string, Record<string, number>>; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

type NivelParam = "nacional" | "municipios" | "secciones";

function buildStoragePath(nivel: NivelParam, estadoId?: string): string | null {
  if (nivel === "nacional") return `${STORAGE_PREFIX}/national.json`;
  if (!estadoId) return null;
  const id = estadoId.padStart(2, "0");
  return nivel === "secciones"
    ? `${STORAGE_PREFIX}/secciones/${id}.json`
    : `${STORAGE_PREFIX}/municipios/${id}.json`;
}

async function fetchFromStorage(
  storagePath: string
): Promise<Record<string, Record<string, number>>> {
  const now = Date.now();
  const cached = cache.get(storagePath);
  if (cached && cached.expiresAt > now) return cached.data;

  const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`File not found: ${storagePath}`);

  const [buf] = await file.download();
  const data = JSON.parse(buf.toString("utf-8")) as Record<string, Record<string, number>>;
  cache.set(storagePath, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nivel = (searchParams.get("nivel") ?? "nacional") as NivelParam;
  const variable = searchParams.get("variable") ?? "";
  const estadoId = searchParams.get("estado_id") ?? undefined;

  if (!["nacional", "municipios", "secciones"].includes(nivel)) {
    return NextResponse.json(
      { error: "Invalid 'nivel'. Must be nacional, municipios, or secciones." },
      { status: 400 }
    );
  }

  if (!ECEG_VALID_KEYS.has(variable)) {
    return NextResponse.json(
      { error: `Invalid 'variable'. Must be one of the curated ECEG indicators.` },
      { status: 400 }
    );
  }

  if (nivel !== "nacional" && !estadoId) {
    return NextResponse.json(
      { error: "'estado_id' is required when nivel is municipios or secciones." },
      { status: 400 }
    );
  }

  const storagePath = buildStoragePath(nivel, estadoId);
  if (!storagePath) {
    return NextResponse.json({ error: "Could not build storage path." }, { status: 400 });
  }

  try {
    const allData = await fetchFromStorage(storagePath);
    const indicator = ECEG_INDICATOR_MAP[variable];

    // Extract the requested variable from each feature record
    const data: Record<string, number> = {};
    let min = Infinity;
    let max = -Infinity;

    for (const [featureKey, rec] of Object.entries(allData)) {
      const val = rec[variable];
      if (typeof val !== "number") continue;
      data[featureKey] = val;
      if (val < min) min = val;
      if (val > max) max = val;
    }

    if (min === Infinity) { min = 0; max = 0; }

    return NextResponse.json(
      { data, min, max, label: indicator.label, unit: indicator.unit ?? null },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=1800" },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("not found")) {
      return NextResponse.json(
        { error: `Data not available yet. Run eceg-data-pipeline for estado_id=${estadoId}.` },
        { status: 404 }
      );
    }
    console.error("[eceg-datos]", err);
    return NextResponse.json({ error: "Failed to load ECEG data." }, { status: 500 });
  }
}
