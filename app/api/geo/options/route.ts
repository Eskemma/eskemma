import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";
import type { GeoOption } from "@/types/geo.types";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX_INE   = "sefix/geo/ine";
const STORAGE_PREFIX_INEGI = "sefix/geo/inegi";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day — data changes once a year

type OptionTipo = "municipios" | "distritos_fed" | "distritos_loc" | "secciones" | "localidades";

interface CacheEntry { options: GeoOption[]; ts: number }
const cache = new Map<string, CacheEntry>();

function cacheKey(
  tipo: OptionTipo,
  estado_id: string,
  distrito_fed?: string,
  distrito_loc?: string,
  municipio?: string
): string {
  return `${tipo}:${estado_id}:${distrito_fed ?? ""}:${distrito_loc ?? ""}:${municipio ?? ""}`;
}

function buildStoragePath(tipo: OptionTipo, estado_id: string): string {
  const id = estado_id.padStart(2, "0");
  if (tipo === "secciones")   return `${STORAGE_PREFIX_INE}/estados/${id}/secciones.topojson`;
  if (tipo === "localidades") return `${STORAGE_PREFIX_INEGI}/estados/${id}/ageb_urbana.topojson`;
  return `${STORAGE_PREFIX_INE}/nacional/${tipo}.topojson`;
}

function extractOptions(
  topojson: Record<string, unknown>,
  tipo: OptionTipo,
  estado_id: string,
  distrito_fed?: string,
  distrito_loc?: string,
  municipio?: string
): GeoOption[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { feature } = require("topojson-client") as typeof import("topojson-client");
  const obj = topojson.objects as Record<string, unknown>;
  const layerName = Object.keys(obj)[0];
  const fc = feature(topojson as unknown as Parameters<typeof feature>[0], obj[layerName] as Parameters<typeof feature>[1]) as {
    features: { properties: Record<string, unknown> }[];
  };

  const padId = estado_id.padStart(2, "0");
  let features = fc.features.filter(
    (f) => String(f.properties?.["CVE_ENT"] ?? "").padStart(2, "0") === padId
  );

  // Apply secondary filters
  if (distrito_fed) {
    const pad = distrito_fed.padStart(3, "0");
    features = features.filter(
      (f) => String(f.properties?.["DISTRITO_FED"] ?? "").padStart(3, "0") === pad
    );
  } else if (distrito_loc) {
    const pad = distrito_loc.padStart(3, "0");
    features = features.filter(
      (f) => String(f.properties?.["DISTRITO_LOC"] ?? "").padStart(3, "0") === pad
    );
  } else if (municipio) {
    const pad = municipio.padStart(3, "0");
    features = features.filter(
      (f) => String(f.properties?.["CVE_MUN"] ?? "").padStart(3, "0") === pad
    );
  }

  const seen = new Set<string>();
  const options: GeoOption[] = [];

  for (const f of features) {
    const p = f.properties;
    let cve = "";
    let nombre = "";

    switch (tipo) {
      case "municipios":
        cve = String(p["CVE_MUN"] ?? "").padStart(3, "0");
        nombre = String(p["NOMGEO"] ?? cve);
        break;
      case "distritos_fed":
        cve = String(p["DISTRITO_FED"] ?? "").padStart(3, "0");
        nombre = `D.F. ${cve}`;
        break;
      case "distritos_loc":
        cve = String(p["DISTRITO_LOC"] ?? "").padStart(3, "0");
        nombre = `D.L. ${cve}`;
        break;
      case "secciones":
        cve = String(p["CVE_SECCION"] ?? "").padStart(4, "0");
        nombre = `Sección ${cve}`;
        break;
      case "localidades":
        cve = String(p["CVE_LOC"] ?? "").padStart(4, "0");
        nombre = `Localidad ${cve}`;
        break;
    }

    if (cve && !seen.has(cve)) {
      seen.add(cve);
      options.push({ cve, nombre });
    }
  }

  return options.sort((a, b) => a.cve.localeCompare(b.cve));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tipo = searchParams.get("tipo") as OptionTipo | null;
  const estado_id = searchParams.get("estado_id") ?? "";
  const distrito_fed = searchParams.get("distrito_fed") ?? undefined;
  const distrito_loc = searchParams.get("distrito_loc") ?? undefined;
  const municipio = searchParams.get("municipio") ?? undefined;

  const VALID_TIPOS: OptionTipo[] = ["municipios", "distritos_fed", "distritos_loc", "secciones", "localidades"];
  if (!tipo || !VALID_TIPOS.includes(tipo)) {
    return NextResponse.json(
      { error: `Invalid 'tipo'. Must be one of: ${VALID_TIPOS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!estado_id) {
    return NextResponse.json({ error: "'estado_id' is required" }, { status: 400 });
  }

  const key = cacheKey(tipo, estado_id, distrito_fed, distrito_loc, municipio);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.options, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  const storagePath = buildStoragePath(tipo, estado_id);

  try {
    const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: `File not found: ${storagePath}` }, { status: 404 });
    }

    const [buf] = await file.download();
    const topojson = JSON.parse(buf.toString("utf-8"));

    const options = extractOptions(topojson, tipo, estado_id, distrito_fed, distrito_loc, municipio);
    cache.set(key, { options, ts: Date.now() });

    return NextResponse.json(options, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch (err) {
    console.error("[geo/options] Error:", err);
    return NextResponse.json({ error: "Failed to load options" }, { status: 500 });
  }
}
