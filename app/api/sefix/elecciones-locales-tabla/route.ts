// app/api/sefix/elecciones-locales-tabla/route.ts
// DataTable y descarga CSV para Elecciones Locales.
import { NextRequest, NextResponse } from "next/server";
import { getEleccionesLocalesTablaRows } from "@/lib/sefix/storage";
import { TABLA_COLUMN_LABELS_LOC } from "@/lib/sefix/eleccionesLocalesConstants";
import { getPartidoLabelLoc } from "@/lib/sefix/eleccionesLocalesConstants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anioParam = searchParams.get("anio");
    const cargo = searchParams.get("cargo") ?? "dip_loc";
    const estado = searchParams.get("estado") ?? "";
    const tipoEleccion = searchParams.get("tipo") ?? undefined;
    const principio = searchParams.get("principio") ?? undefined;
    const cabecera = searchParams.get("cabecera") ?? undefined;
    const municipio = searchParams.get("municipio") ?? undefined;
    const seccionesParam = searchParams.get("secciones") ?? "";
    const partidosParam = searchParams.get("partidos") ?? "";
    const download = searchParams.get("download") === "true";
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");

    if (!estado) {
      return NextResponse.json(
        { error: "Parámetro 'estado' requerido" },
        { status: 400 }
      );
    }

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

    const secciones = seccionesParam ? seccionesParam.split(",").filter(Boolean) : [];
    const partidos = partidosParam ? partidosParam.split(",").filter(Boolean) : [];
    const columnas = partidos.includes("Todos") || partidos.length === 0 ? undefined : partidos;

    const { rows, total } = await getEleccionesLocalesTablaRows({
      anio,
      cargoKey: cargo,
      estadoNombre: estado,
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
      const fixedCols = ["anio", "cargo", "estado", "cabecera", "municipio", "seccion", "tipo", "principio"];
      const metaCols = ["total_votos", "lne", "part_ciud"];
      const partidoCols =
        partidos.includes("Todos") || partidos.length === 0
          ? Object.keys(rows[0] ?? {}).filter(
              (k) => ![...fixedCols, ...metaCols].includes(k)
            )
          : partidos;
      const allCols = [...fixedCols, ...partidoCols, ...metaCols];

      const header = allCols
        .map((c) => TABLA_COLUMN_LABELS_LOC[c] ?? getPartidoLabelLoc(c))
        .join(",");

      const csvRows = rows.map((row) =>
        allCols
          .map((c) => {
            const v = row[c];
            if (c === "part_ciud") return typeof v === "number" ? v.toFixed(2) + "%" : (v ?? "");
            return v ?? "";
          })
          .join(",")
      );

      const csv = [
        header,
        ...csvRows,
        "",
        `Fuente: INE — Sistema de Consulta de la Estadística de las Elecciones Locales ${anio}`,
      ].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="elecciones_locales_${anio}_${estado}.csv"`,
        },
      });
    }

    return NextResponse.json({ rows, total });
  } catch (error) {
    console.error("[sefix/elecciones-locales-tabla] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener tabla de elecciones locales" },
      { status: 500 }
    );
  }
}
