import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";
import type { GeoLayerTipo } from "@/types/geo.types";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX = "sefix/geo/ine";

type NivelParam = "nacional" | "estado";

const VALID_TIPOS: GeoLayerTipo[] = [
  "entidades", "municipios", "distritos_fed", "distritos_loc", "secciones",
];

function buildStoragePath(
  tipo: GeoLayerTipo,
  nivel: NivelParam,
  estado_id?: string
): string | null {
  if (nivel === "nacional") {
    if (tipo === "secciones") return null; // national secciones not stored
    return `${STORAGE_PREFIX}/nacional/${tipo}.topojson`;
  }
  if (!estado_id) return null;
  const id = estado_id.padStart(2, "0");
  return `${STORAGE_PREFIX}/estados/${id}/${tipo}.topojson`;
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
      { error: "National secciones are not available. Use nivel=estado with an estado_id." },
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
