// app/api/fontana/familia/[familiaId]/route.ts
// GET ?sesionId=  — indicadores de una familia (mínimos + selección del
// usuario) con su valor por nivel geográfico. Un endpoint por familia
// (Arquitectura Paso3 v2, §5.1) — este incremento solo implementa F1;
// las demás responden 400 explícito, no un array vacío silencioso.
//
// Columnas por nivel: el tipo de proyecto decide el patrón ofrecido
// (§5.2) — electoral → Nacional/Estatal/Distrital/Municipal; el resto →
// Nacional/Estatal/Municipal/AGEB. Fontana solo resuelve dato real en
// Estatal/Municipal este incremento (lib/fontana/ingesta/eceg.ts);
// Nacional/Distrital/AGEB se declaran explícitamente "nivel no cubierto"
// — nunca una columna vacía sin motivo.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { FontanaSesion, FamiliaFontanaId } from "@/types/fontana.types";
import { resolverIndicadorFamilia1 } from "@/lib/fontana/ingesta";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { FAMILIA1_NOMBRES, FAMILIA1_ORDEN } from "@/lib/fontana/familia1Catalogo";
import {
  columnasParaTipoProyecto,
  MOTIVO_NIVEL_NO_CUBIERTO,
  type CeldaTablaFontana,
  type NivelTablaFontana,
} from "@/lib/fontana/tablaColumnas";

interface IndicadorRespuesta {
  id: string;
  nombre: string;
  definicion?: string;
  fuenteEtiqueta?: string;
  esMinimo: boolean;
  celdas: CeldaTablaFontana[];
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ familiaId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { familiaId } = await context.params;
  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  if (!sesionId) {
    return NextResponse.json({ error: "sesionId es requerido" }, { status: 400 });
  }

  const snap = await adminDb.collection("fontana_sesiones").doc(sesionId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const sesion = snap.data() as FontanaSesion;
  if (sesion.uid !== session.uid) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  if (familiaId !== "F1") {
    return NextResponse.json(
      { error: "familia_no_disponible", mensaje: `Familia ${familiaId} aún no está disponible en Fontana.` },
      { status: 400 }
    );
  }

  const columnas = columnasParaTipoProyecto(sesion.tipoProyecto);
  const familia = sesion.indicadoresPorFamilia[familiaId as FamiliaFontanaId];
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  const idsOrdenados = FAMILIA1_ORDEN.filter((id) => idsEnSesion.has(id));

  const indicadores: IndicadorRespuesta[] = await Promise.all(
    idsOrdenados.map(async (id) => {
      const [registro, celdasReales] = await Promise.all([
        getIndicadorRegistro(id),
        resolverIndicadorFamilia1(id, sesion.territorio),
      ]);
      const celdas = construirCeldasTabla(columnas, celdasReales);
      return {
        id,
        nombre: registro?.nombre ?? FAMILIA1_NOMBRES[id] ?? id,
        definicion: registro?.definicion,
        fuenteEtiqueta: registro?.fuenteEtiqueta,
        esMinimo: familia.minimos.includes(id),
        celdas,
      };
    })
  );

  return NextResponse.json({ familiaId: "F1", columnas, indicadores }, { status: 200 });
}

// Mapea las 2 celdas reales (estatal/municipal, de resolverIndicadorF1) al
// set completo de columnas de la tabla, rellenando nacional/distrital/ageb
// con el motivo explícito de nivel no cubierto.
function construirCeldasTabla(
  columnas: NivelTablaFontana[],
  celdasReales: Awaited<ReturnType<typeof resolverIndicadorFamilia1>>
): CeldaTablaFontana[] {
  return columnas.map((nivel) => {
    if (nivel === "estatal" || nivel === "municipal") {
      const real = celdasReales.find((c) => c.nivel === nivel);
      if (real && "valor" in real) {
        return { nivel, valor: real.valor, unidad: real.unidad, naturaleza: real.naturaleza, fuenteEtiqueta: real.fuenteEtiqueta };
      }
      if (real) {
        return { nivel, motivo: real.motivo };
      }
    }
    return { nivel, motivo: MOTIVO_NIVEL_NO_CUBIERTO };
  });
}
