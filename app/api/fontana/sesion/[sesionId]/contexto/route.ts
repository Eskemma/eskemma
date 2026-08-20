// app/api/fontana/sesion/[sesionId]/contexto/route.ts
// GET — arma el FontanaContextoTerritorial completo de una sesión (todos
// los indicadores seleccionados en F1/F2, minimos + seleccionUsuario,
// CeldaTablaFontana completo sin aplanar) — usado por Canal 1
// (canal1/entregar) y por "Vincular resultado externo" cuando se abre
// desde el banner fontanaPendiente (Piezas 2/5 del plan de escenarios
// b/c). Reutiliza /api/fontana/familia/[familiaId] tal cual (mismo
// cómputo de celdas que ya usa la tabla comparativa) vía fetch interno,
// en vez de duplicar la lógica de construirCeldasTabla.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { FontanaSesion } from "@/types/fontana.types";
import type { FontanaContextoTerritorial } from "@/types/fontana.types";

interface FamiliaRespuesta {
  indicadores: { id: string; nombre: string; celdas: unknown[] }[];
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { sesionId } = await context.params;

  const doc = await adminDb.collection("fontana_sesiones").doc(sesionId).get();
  if (!doc.exists || doc.data()?.uid !== session.uid) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const sesion = { sesionId: doc.id, ...doc.data() } as FontanaSesion;

  const idsPorFamilia: Record<string, string[]> = {};
  for (const [familia, seleccion] of Object.entries(sesion.indicadoresPorFamilia)) {
    const ids = [...seleccion.minimos, ...seleccion.seleccionUsuario];
    if (ids.length > 0) idsPorFamilia[familia] = ids;
  }

  const cookie = request.headers.get("cookie") ?? "";
  const baseUrl = request.nextUrl.origin;

  const indicadores: FontanaContextoTerritorial["indicadores"] = [];
  for (const familiaId of Object.keys(idsPorFamilia)) {
    if (familiaId !== "F1" && familiaId !== "F2") continue; // únicas familias con pipeline real hoy
    const res = await fetch(`${baseUrl}/api/fontana/familia/${familiaId}?sesionId=${sesionId}`, {
      headers: { cookie },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as FamiliaRespuesta;
    const idsSeleccionados = new Set(idsPorFamilia[familiaId]);
    for (const ind of data.indicadores) {
      if (idsSeleccionados.has(ind.id)) {
        indicadores.push({ id: ind.id, nombre: ind.nombre, celdas: ind.celdas as FontanaContextoTerritorial["indicadores"][number]["celdas"] });
      }
    }
  }

  const contexto: FontanaContextoTerritorial = { territorio: sesion.territorio, indicadores };
  return NextResponse.json({ contexto }, { status: 200 });
}
