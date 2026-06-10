// app/api/sefix/elecciones-tabla/route.ts
// DataTable y descarga CSV para Elecciones Federales.
import { NextRequest, NextResponse } from "next/server";
import { getEleccionesTablaRows, resolveEstadoName } from "@/lib/sefix/storage";
import { TABLA_COLUMN_LABELS, PARTIDO_LABELS } from "@/lib/sefix/eleccionesConstants";

export const dynamic = "force-dynamic";

const CARGO_TO_KEY: Record<string, string> = {
  dip: "dip", sen: "sen", pdte: "pdte",
  diputados: "dip", senadores: "sen", presidente: "pdte",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anioParam = searchParams.get("anio");
    const cargo = searchParams.get("cargo") ?? "dip";
    const estadoParam = searchParams.get("estado") ?? "";
    const tipoEleccion = searchParams.get("tipo") ?? undefined;
    const principio = searchParams.get("principio") ?? undefined;
    const cabecera = searchParams.get("cabecera") ?? undefined;
    const municipio = searchParams.get("municipio") ?? undefined;
    const seccionesParam = searchParams.get("secciones") ?? "";
    const partidosParam = searchParams.get("partidos") ?? "";
    const download = searchParams.get("download") === "true";
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");

    if (!anioParam) {
      return NextResponse.json({ error: "Parámetro 'anio' requerido" }, { status: 400 });
    }

    const anio = parseInt(anioParam);
    const cargoKey = CARGO_TO_KEY[cargo] ?? "dip";
    const isNacional = !estadoParam || estadoParam.toLowerCase() === "nacional";
    const estadoNombre = isNacional ? null : resolveEstadoName(estadoParam);
    const secciones = seccionesParam ? seccionesParam.split(",").filter(Boolean) : [];
    const partidos = partidosParam ? partidosParam.split(",").filter(Boolean) : [];
    const columnas = partidos.includes("Todos") || partidos.length === 0 ? undefined : partidos;

    const { rows, total } = await getEleccionesTablaRows({
      anio,
      cargoKey,
      estadoNombre,
      tipoEleccion,
      principio,
      cabecera,
      municipio,
      secciones,
      columnas,
      page: !download && pageParam ? parseInt(pageParam) : undefined,
      pageSize: !download && pageSizeParam ? parseInt(pageSizeParam) : undefined,
    });

    if (download) {
      const fixedCols = ["anio", "cargo", "tipo", "principio", "estado", "cabecera", "municipio", "seccion"];
      const partidoCols = partidos.includes("Todos") || partidos.length === 0
        ? Object.keys(rows[0] ?? {}).filter((k) => !["anio","cargo","estado","cabecera","municipio","seccion","tipo","principio","total_votos","lne","part_ciud"].includes(k))
        : partidos;
      const metaCols = ["total_votos", "lne", "part_ciud"];
      const allCols = [...fixedCols, ...partidoCols, ...metaCols];

      const header = allCols.map((c) => {
        if (TABLA_COLUMN_LABELS[c]) return TABLA_COLUMN_LABELS[c];
        if (PARTIDO_LABELS[c]) return PARTIDO_LABELS[c];
        return c;
      }).join(",");

      const csvRows = rows.map((row) =>
        allCols.map((c) => {
          const v = row[c];
          if (c === "part_ciud") return typeof v === "number" ? v.toFixed(2) + "%" : v ?? "";
          return v ?? "";
        }).join(",")
      );

      const csv = [header, ...csvRows, "", "Fuente: INE — Sistema de Consulta de la Estadística de las Elecciones Federales"].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="elecciones_federales_${anio}_${estadoNombre ?? "NACIONAL"}.csv"`,
        },
      });
    }

    return NextResponse.json({ rows, total });
  } catch (error) {
    console.error("[sefix/elecciones-tabla] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener tabla de elecciones" },
      { status: 500 }
    );
  }
}
