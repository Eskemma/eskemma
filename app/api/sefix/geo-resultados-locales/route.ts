// app/api/sefix/geo-resultados-locales/route.ts
// Devuelve el partido ganador (top3) por feature geográfica para el mapa coroplético de locales.
import { NextRequest, NextResponse } from "next/server";
import { getGanadorPorFeatureLoc } from "@/lib/sefix/storage";

export const dynamic = "force-dynamic";

const VALID_NIVELES = new Set(["municipios", "secciones"]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nivel = searchParams.get("nivel") ?? "";
    const cargo = searchParams.get("cargo") ?? "dip_loc";
    const anioParam = searchParams.get("anio");
    const estado = searchParams.get("estado") ?? "";
    const cabecera = searchParams.get("cabecera") ?? undefined;
    const municipio = searchParams.get("municipio") ?? undefined;

    if (!VALID_NIVELES.has(nivel)) {
      return NextResponse.json({ error: "nivel inválido" }, { status: 400 });
    }
    if (!estado) {
      return NextResponse.json({ error: "estado requerido" }, { status: 400 });
    }

    const anio = anioParam ? parseInt(anioParam) : 2024;
    if (isNaN(anio)) {
      return NextResponse.json({ error: "anio inválido" }, { status: 400 });
    }

    const ganadores = await getGanadorPorFeatureLoc({
      nivel: nivel as "municipios" | "secciones",
      cargo,
      anio,
      estadoNombre: estado,
      cabecera,
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
    console.error("[geo-resultados-locales] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
