// app/api/sefix/padron/route.ts
// Devuelve datos de Padrón Electoral y Lista Nominal por estado, distrito o municipio
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import {
  getPadronByEstado,
  getPadronByGeo,
  getPadronByDistritoLocal,
} from "@/lib/sefix/storage";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get("estado");

    if (!estado) {
      return NextResponse.json(
        { error: "Parámetro 'estado' requerido" },
        { status: 400 }
      );
    }

    const cveDistrito   = searchParams.get("cveDistrito")    ?? undefined;
    const cabeceraLocal = searchParams.get("cabeceraLocal")  ?? undefined;
    const municipioNom  = searchParams.get("municipioNombre") ?? undefined;

    const padron = cabeceraLocal
      ? await getPadronByDistritoLocal(estado, cabeceraLocal)
      : cveDistrito || municipioNom
      ? await getPadronByGeo(estado, { cveDistrito, municipioNombre: municipioNom })
      : await getPadronByEstado(estado);

    if (!padron) {
      return NextResponse.json(
        { error: `No se encontraron datos de padrón para ${estado}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ padron });
  } catch (error) {
    console.error("[sefix/padron] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener datos del padrón" },
      { status: 500 }
    );
  }
}
