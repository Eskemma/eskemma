// app/api/sefix/elecciones-locales-geo/route.ts
// Cascade geográfico y metadata para filtros de Elecciones Locales.
// Incluye endpoints para la cascada estado→años→cargos y la geo electoral.
import { NextRequest, NextResponse } from "next/server";
import {
  getEleccionesLocalesGeo,
  getEleccionesLocalesMetadata,
  getEleccionesLocalesPartidos,
  getResultadosLocalesAvailableYears,
  getResultadosLocalesAvailableCargos,
} from "@/lib/sefix/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nivel = searchParams.get("nivel") as
      | "available_years"
      | "available_cargos"
      | "metadata"
      | "distritos"
      | "municipios"
      | "secciones"
      | "partidos"
      | null;
    const estado = searchParams.get("estado") ?? "";
    const anioParam = searchParams.get("anio");
    const cargo = searchParams.get("cargo") ?? "dip_loc";

    if (!estado) {
      return NextResponse.json(
        { error: "Parámetro 'estado' requerido" },
        { status: 400 }
      );
    }

    // Cascade paso 1: estado → años disponibles
    if (nivel === "available_years") {
      const years = await getResultadosLocalesAvailableYears(estado);
      return NextResponse.json({ availableYears: years });
    }

    // Cascade paso 2: estado + año → cargos disponibles
    if (nivel === "available_cargos") {
      if (!anioParam) {
        return NextResponse.json(
          { error: "Parámetro 'anio' requerido para available_cargos" },
          { status: 400 }
        );
      }
      const anio = parseInt(anioParam);
      if (isNaN(anio)) {
        return NextResponse.json({ error: "Parámetro 'anio' inválido" }, { status: 400 });
      }
      const cargos = await getResultadosLocalesAvailableCargos(estado, anio);
      return NextResponse.json({ cargos });
    }

    // Los siguientes niveles requieren anio
    if (!anioParam) {
      return NextResponse.json(
        { error: "Parámetro 'anio' requerido" },
        { status: 400 }
      );
    }

    const anio = parseInt(anioParam);
    if (isNaN(anio)) {
      return NextResponse.json({ error: "Parámetro 'anio' inválido" }, { status: 400 });
    }

    // Metadata: tipos y principios disponibles para estado+año+cargo
    if (nivel === "metadata") {
      const cabecera = searchParams.get("cabecera") ?? undefined;
      const metadata = await getEleccionesLocalesMetadata(anio, cargo, estado, cabecera);
      return NextResponse.json({ metadata });
    }

    // Partidos: columnas de partido presentes en el CSV del estado+año+cargo
    if (nivel === "partidos") {
      const partidos = await getEleccionesLocalesPartidos(anio, cargo, estado);
      return NextResponse.json({ partidos });
    }

    if (!nivel || !["distritos", "municipios", "secciones"].includes(nivel)) {
      return NextResponse.json(
        { error: "Parámetro 'nivel' inválido. Valores: available_years, available_cargos, metadata, distritos, municipios, secciones, partidos" },
        { status: 400 }
      );
    }

    const cabecera = searchParams.get("cabecera") ?? undefined;
    const municipio = searchParams.get("municipio") ?? undefined;

    const opciones = await getEleccionesLocalesGeo(nivel, anio, cargo, estado, cabecera, municipio);
    return NextResponse.json({ opciones });
  } catch (error) {
    console.error("[sefix/elecciones-locales-geo] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener datos geográficos locales" },
      { status: 500 }
    );
  }
}
