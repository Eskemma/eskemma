// app/api/sefix/geo-resultados/route.ts
// Devuelve el partido ganador (top3) por feature geográfica para el mapa coroplético.
// Sin autenticación requerida: los datos electorales del INE son dominio público,
// consistente con todos los demás endpoints de /api/sefix/*.
import { NextRequest, NextResponse } from "next/server";
import { getGanadorPorFeature } from "@/lib/sefix/storage";

export const dynamic = "force-dynamic";

const VALID_NIVELES = new Set(["entidades", "distritos_fed", "secciones"]);
const VALID_CARGOS = new Set(["dip", "sen", "pdte"]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nivel = searchParams.get("nivel") ?? "";
    const cargo = searchParams.get("cargo") ?? "dip";
    const anioParam = searchParams.get("anio");
    const estado = searchParams.get("estado") ?? undefined;
    const cabecera = searchParams.get("cabecera") ?? undefined;
    const municipio = searchParams.get("municipio") ?? undefined;

    if (!VALID_NIVELES.has(nivel)) {
      return NextResponse.json({ error: "nivel inválido" }, { status: 400 });
    }
    if (!VALID_CARGOS.has(cargo)) {
      return NextResponse.json({ error: "cargo inválido" }, { status: 400 });
    }

    const anio = anioParam ? parseInt(anioParam) : 2024;
    if (isNaN(anio)) {
      return NextResponse.json({ error: "anio inválido" }, { status: 400 });
    }

    const ganadores = await getGanadorPorFeature({
      nivel: nivel as "entidades" | "distritos_fed" | "secciones",
      cargo,
      anio,
      estadoNombre: estado,
      cveDistrito: cabecera,
      municipio,
    });

    return NextResponse.json(
      { ganadores },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    console.error("[geo-resultados] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
