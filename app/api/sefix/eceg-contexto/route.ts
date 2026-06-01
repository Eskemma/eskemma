import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX = "sefix/eceg_2020";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry { data: Record<string, Record<string, number>>; expiresAt: number }
const cache = new Map<string, CacheEntry>();

async function fetchFile(path: string): Promise<Record<string, Record<string, number>>> {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expiresAt > now) return hit.data;

  const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
  const [exists] = await bucket.file(path).exists();
  if (!exists) throw new Error(`Not found: ${path}`);
  const [buf] = await bucket.file(path).download();
  const data = JSON.parse(buf.toString("utf-8")) as Record<string, Record<string, number>>;
  cache.set(path, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

function extract(
  data: Record<string, Record<string, number>>,
  key: string,
  variable: string,
  denominator: string | null
): { numerador: number; denominador: number | null; porcentaje: number | null; valor: number } | null {
  const rec = data[key];
  if (!rec) return null;
  const val = rec[variable];
  if (typeof val !== "number") return null;
  const den = denominator ? rec[denominator] : null;
  const pct = den && den > 0 ? Math.round((val / den) * 10000) / 100 : null;
  return { numerador: val, denominador: den ?? null, porcentaje: pct, valor: val };
}

function sumRecords(
  data: Record<string, Record<string, number>>,
  keys: string[],
  variable: string,
  denominator: string | null
): { numerador: number; denominador: number | null; porcentaje: number | null; valor: number } | null {
  let num = 0;
  let den = 0;
  let found = false;
  for (const k of keys) {
    const rec = data[k];
    if (!rec) continue;
    const v = rec[variable];
    if (typeof v !== "number") continue;
    num += v;
    found = true;
    if (denominator && typeof rec[denominator] === "number") den += rec[denominator] as number;
  }
  if (!found) return null;
  const pct = denominator && den > 0 ? Math.round((num / den) * 10000) / 100 : null;
  return { numerador: num, denominador: denominator ? den : null, porcentaje: pct, valor: num };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const variable = searchParams.get("variable") ?? "";
  const denominator = searchParams.get("denominator") || null;
  const estado_id = searchParams.get("estado_id") ?? "";
  const distrito_cve = searchParams.get("distrito_cve") ?? "";
  const municipio_cve = searchParams.get("municipio_cve") ?? "";
  const seccionesRaw = searchParams.get("secciones") ?? "";
  const secciones = seccionesRaw ? seccionesRaw.split(",").filter(Boolean) : [];

  if (!variable) return NextResponse.json({ error: "variable is required" }, { status: 400 });

  type NivelResult = {
    numerador: number;
    denominador: number | null;
    porcentaje: number | null;
    valor: number;
  };
  const result: Record<string, NivelResult> = {};

  try {
    // ── Nacional + Estado ────────────────────────────────────────────────────
    const national = await fetchFile(`${STORAGE_PREFIX}/national.json`);
    const allStateKeys = Object.keys(national);

    const nacSum = sumRecords(national, allStateKeys, variable, denominator);
    if (nacSum) result.nacional = nacSum;

    if (estado_id) {
      const estadoKey = estado_id.padStart(2, "0");
      const est = extract(national, estadoKey, variable, denominator);
      if (est) result.estado = est;
    }

    // ── Distrito ─────────────────────────────────────────────────────────────
    if (estado_id && distrito_cve && distrito_cve !== "TODOS") {
      const distData = await fetchFile(
        `${STORAGE_PREFIX}/distritos/${estado_id.padStart(2, "0")}.json`
      );
      const distKey = estado_id.padStart(2, "0") + distrito_cve.padStart(3, "0");
      const dst = extract(distData, distKey, variable, denominator);
      if (dst) result.distrito = dst;
    }

    // ── Municipio ─────────────────────────────────────────────────────────────
    if (estado_id && municipio_cve) {
      const munData = await fetchFile(
        `${STORAGE_PREFIX}/municipios/${estado_id.padStart(2, "0")}.json`
      );
      const munKey = estado_id.padStart(2, "0") + municipio_cve.padStart(3, "0");
      const mun = extract(munData, munKey, variable, denominator);
      if (mun) result.municipio = mun;
    }

    // ── Sección(es) ───────────────────────────────────────────────────────────
    if (estado_id && secciones.length > 0) {
      const secData = await fetchFile(
        `${STORAGE_PREFIX}/secciones/${estado_id.padStart(2, "0")}.json`
      );
      const secKeys = secciones.map(
        (s) => estado_id.padStart(2, "0") + s.padStart(4, "0")
      );
      const sec = sumRecords(secData, secKeys, variable, denominator);
      if (sec) result.seccion = sec;
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=1800" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.startsWith("Not found:")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[eceg-contexto]", err);
    return NextResponse.json({ error: "Failed to load context data" }, { status: 500 });
  }
}
