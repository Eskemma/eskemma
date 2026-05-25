import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";
import type { GeoLayerTipo } from "@/types/geo.types";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX_INE   = "sefix/geo/ine";
const STORAGE_PREFIX_INEGI = "sefix/geo/inegi";
const STORAGE_PREFIX_ECEG  = "sefix/geo/eceg_2020";

// Types sourced from INEGI (per-state only, no national file)
const INEGI_TIPOS: GeoLayerTipo[] = ["ageb_urbana", "ageb_rural"];
// Types sourced from ECEG 2020 (per-state only)
const ECEG_TIPOS: GeoLayerTipo[] = ["eceg_secciones_2020", "eceg_municipios_2020"];

type NivelParam = "nacional" | "estado";

const VALID_TIPOS: GeoLayerTipo[] = [
  "entidades", "municipios", "distritos_fed", "distritos_loc", "secciones",
  "ageb_urbana", "ageb_rural",
  "eceg_secciones_2020", "eceg_municipios_2020",
];

function buildStoragePath(
  tipo: GeoLayerTipo,
  nivel: NivelParam,
  estado_id?: string
): string | null {
  // ECEG layers are per-state only
  if (ECEG_TIPOS.includes(tipo)) {
    if (!estado_id) return null;
    const id = estado_id.padStart(2, "0");
    const subdir = tipo === "eceg_secciones_2020" ? "secciones" : "municipios";
    return `${STORAGE_PREFIX_ECEG}/${subdir}/${id}.topojson`;
  }

  const isInegi = INEGI_TIPOS.includes(tipo);
  const prefix  = isInegi ? STORAGE_PREFIX_INEGI : STORAGE_PREFIX_INE;

  if (nivel === "nacional") {
    if (isInegi)           return null; // INEGI layers are per-state only
    if (tipo === "secciones") return null;
    return `${prefix}/nacional/${tipo}.topojson`;
  }
  if (!estado_id) return null;
  const id = estado_id.padStart(2, "0");
  return `${prefix}/estados/${id}/${tipo}.topojson`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") as GeoLayerTipo | null;
  const nivel = (searchParams.get("nivel") ?? "nacional") as NivelParam;
  const estado_id = searchParams.get("estado_id") ?? undefined;

  if (!tipo || !VALID_TIPOS.includes(tipo)) {
    return NextResponse.json(
      { error: `Invalid 'tipo'. Must be one of: ${VALID_TIPOS.join(", ")}` },
      { status: 400 }
    );
  }

  if (nivel !== "nacional" && nivel !== "estado") {
    return NextResponse.json(
      { error: "Invalid 'nivel'. Must be 'nacional' or 'estado'" },
      { status: 400 }
    );
  }

  if (nivel === "estado" && !estado_id) {
    return NextResponse.json(
      { error: "'estado_id' is required when nivel=estado" },
      { status: 400 }
    );
  }

  const storagePath = buildStoragePath(tipo, nivel, estado_id);
  if (!storagePath) {
    return NextResponse.json(
      { error: `'${tipo}' is only available per-state. Use nivel=estado with an estado_id.` },
      { status: 400 }
    );
  }


  try {
    const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { error: `Shape file not found: ${storagePath}` },
        { status: 404 }
      );
    }

    const [buf] = await file.download();
    const json = buf.toString("utf-8");

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[geo/shapes] Storage error:", err);
    return NextResponse.json(
      { error: "Failed to load shape file" },
      { status: 500 }
    );
  }
}
