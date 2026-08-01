import { NextRequest, NextResponse } from "next/server";
import { ECEG_VALID_KEYS, ECEG_INDICATOR_MAP } from "@/lib/sefix/ecegConstants";
import { buildEcegStoragePath, fetchEcegFromStorage, type EcegNivel } from "@/lib/sefix/ecegStorage";

type NivelParam = EcegNivel;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nivel = (searchParams.get("nivel") ?? "nacional") as NivelParam;
  const variable = searchParams.get("variable") ?? "";
  const estadoId = searchParams.get("estado_id") ?? undefined;

  if (!["nacional", "distritos", "municipios", "secciones"].includes(nivel)) {
    return NextResponse.json(
      { error: "Invalid 'nivel'. Must be nacional, distritos, municipios, or secciones." },
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
      { error: "'estado_id' is required when nivel is distritos, municipios, or secciones." },
      { status: 400 }
    );
  }

  const storagePath = buildEcegStoragePath(nivel, estadoId);
  if (!storagePath) {
    return NextResponse.json({ error: "Could not build storage path." }, { status: 400 });
  }

  try {
    const allData = await fetchEcegFromStorage(storagePath);
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
