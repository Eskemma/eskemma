// app/api/sefix/lne-distrito/route.ts
// Devuelve lista nominal desglosada por género para un distrito electoral federal
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getLneByDistrito } from "@/lib/sefix/storage";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get("estado");
    const cvDistrito = searchParams.get("cvDistrito");

    if (!estado || !cvDistrito) {
      return NextResponse.json(
        { error: "Parámetros 'estado' y 'cvDistrito' requeridos" },
        { status: 400 }
      );
    }

    const data = await getLneByDistrito(estado, cvDistrito);

    if (!data) {
      return NextResponse.json(
        { error: `No se encontraron datos LNE para distrito ${cvDistrito} de ${estado}` },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[lne-distrito] Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
