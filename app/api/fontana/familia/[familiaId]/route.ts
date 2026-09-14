// app/api/fontana/familia/[familiaId]/route.ts
// GET ?sesionId=  — indicadores de una familia (mínimos + selección del
// usuario) con su valor por nivel geográfico. Un endpoint por familia
// (Arquitectura Paso3 v2, §5.1). F1/F2/F3/F5 pasan por el flujo geográfico
// común (nacional/estatal/distrital/municipal); F4 tiene rama propia al
// inicio del handler (shape `fila` de países). El 400 explícito solo
// aplica a un familiaId que no sea una de las 5 — nunca un array vacío
// silencioso. (Las 5 familias del registry están pobladas y clasificadas,
// 86 indicadores — verificado 2026-08-27.)
//
// Columnas por nivel: el tipo de proyecto decide el patrón ofrecido
// (§5.2) — electoral → Nacional/Estatal/Distrital/Municipal; el resto →
// Nacional/Estatal/Municipal/AGEB. Cierre de Familia 1 (2026-08-02):
// resolverIndicadorFontana ya regresa hasta 4 celdas reales (nacional,
// estatal, distrital, municipal) — este endpoint solo mapea "distrital"
// a "ageb" cuando el proyecto no es electoral (AGEB nunca tuvo mecanismo
// construido, se declara "nivel no cubierto" explícitamente).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import type { FamiliaFontanaId } from "@/types/fontana.types";
import { resolverIndicadorComparativoF4 } from "@/lib/fontana/ingesta/familia4";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { tieneSerie } from "@/lib/fontana/series/seriesDisponibles";
import { tieneSerieInternacional } from "@/lib/fontana/series/seriesInternacionalesDisponibles";
import { FAMILIA1_NOMBRES, FAMILIA1_ORDEN } from "@/lib/fontana/familia1Catalogo";
import { FAMILIA2_NOMBRES, FAMILIA2_ORDEN } from "@/lib/fontana/familia2Catalogo";
import { FAMILIA3_NOMBRES, FAMILIA3_ORDEN } from "@/lib/fontana/familia3Catalogo";
import { FAMILIA5_NOMBRES, FAMILIA5_ORDEN } from "@/lib/fontana/familia5Catalogo";
import { FAMILIA4_NOMBRES, FAMILIA4_ORDEN, PAISES_REFERENCIA_F4, resolverPaisPrincipal } from "@/lib/fontana/familia4Catalogo";
import { resolverCeldasParaTerritorio } from "@/lib/fontana/tabla/construirCeldasTabla";
import { columnasParaTipoProyecto, type CeldaTablaFontana } from "@/lib/fontana/tablaColumnas";

// F1-16 (compendio.ts) descarga y parsea PDFs de INEGI bajo demanda —
// medido en vivo contra los 125 municipios de Jalisco: los más grandes
// (10-12.7 MB) tardan 8-9.5s solo en fetch+parse localmente, cerca del
// límite default de la plataforma (10s Hobby/15s Pro sin config). Mismo
// patrón que app/api/sefix/semanal-tabla/route.ts.
export const maxDuration = 60;

interface IndicadorRespuesta {
  id: string;
  nombre: string;
  definicion?: string;
  fuenteEtiqueta?: string;
  esMinimo: boolean;
  tieneSerie: boolean;
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
  // timeoutMs: solo lo usa el job del reporte de sesión
  // (resolverCeldasIndicadoresSesion). Si un indicador tarda más, su celda
  // cae a MOTIVO_TIMEOUT_REPORTE (distinto de "sin dato") y el job NO se
  // cuelga por una fuente lenta. La tabla comparativa y la entrega a F3 NO
  // lo pasan → comportamiento sin cambios (0 = sin límite).
  const timeoutMs = Number(searchParams.get("timeoutMs")) || 0;

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion } = cargada;

  // Familia 4 (comparación internacional) — rama separada, ANTES del
  // resto del handler: esa lógica (columnas, desgloses, columnas
  // inversas, agregación plural) asume territorio mexicano de punta a
  // punta (confirmado en la investigación de esta ronda) y Familia 4
  // compara países, nunca niveles geográficos — forzarla ahí habría
  // requerido reinterpretar cada pieza sin necesidad real. Shape de
  // respuesta distinto a propósito (`fila` en vez de `celdas`), consumido
  // por FontanaF4Panel.tsx, no por FontanaComparativeTable.tsx.
  if (familiaId === "F4") {
    const familiaF4 = sesion.indicadoresPorFamilia.F4;
    const idsEnSesionF4 = new Set([...familiaF4.minimos, ...familiaF4.seleccionUsuario]);
    const idsOrdenadosF4 = FAMILIA4_ORDEN.filter((id) => idsEnSesionF4.has(id));
    const paisPrincipal = resolverPaisPrincipal(sesion.territorio);
    const indicadoresF4 = await Promise.all(
      idsOrdenadosF4.map(async (id) => {
        const [registro, fila] = await Promise.all([
          getIndicadorRegistro(id),
          resolverIndicadorComparativoF4(id, paisPrincipal.iso3),
        ]);
        return {
          id,
          nombre: FAMILIA4_NOMBRES[id] ?? id,
          definicion: registro?.definicion,
          esMinimo: familiaF4.minimos.includes(id),
          tieneSerie: tieneSerie(id) || tieneSerieInternacional(id),
          fila,
        };
      })
    );
    return NextResponse.json({ indicadores: indicadoresF4, paisPrincipal, paisesReferencia: PAISES_REFERENCIA_F4 });
  }

  if (familiaId !== "F1" && familiaId !== "F2" && familiaId !== "F3" && familiaId !== "F5") {
    return NextResponse.json(
      { error: "familia_no_disponible", mensaje: `Familia ${familiaId} aún no está disponible en Fontana.` },
      { status: 400 }
    );
  }
  // F3 (Geopolíticos) y F5 (Características territoriales) — mismo
  // contrato geográfico que F1/F2 (nacional/estatal/distrital/municipal),
  // a diferencia de F4 (comparación internacional, rama propia arriba) —
  // se reutiliza el mismo flujo, ningún gate de desglose (municipal/
  // distrital/nacional) reconoce IDs de F3/F5 todavía, así que caen a "sin
  // mecanismo" de forma segura (mismo comportamiento que cualquier
  // indicador F1/F2 sin desglose construido). F3 agregada 2026-08-26.
  const [ordenFamilia, nombresFamilia] =
    familiaId === "F2" ? [FAMILIA2_ORDEN, FAMILIA2_NOMBRES]
    : familiaId === "F3" ? [FAMILIA3_ORDEN, FAMILIA3_NOMBRES]
    : familiaId === "F5" ? [FAMILIA5_ORDEN, FAMILIA5_NOMBRES]
    : [FAMILIA1_ORDEN, FAMILIA1_NOMBRES];

  const columnas = columnasParaTipoProyecto(sesion.tipoProyecto, sesion.territorio.nivel);
  const familia = sesion.indicadoresPorFamilia[familiaId as FamiliaFontanaId];
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  const idsOrdenados = ordenFamilia.filter((id) => idsEnSesion.has(id));

  // Resolución de celdas extraída a lib/fontana/tabla/construirCeldasTabla.ts
  // (26-09-13) — reutilizable sin FontanaSesion (ver integración PESTEL↔Fontana).
  // `esMinimo` es lo único que depende de la sesión y se añade aquí.
  const resueltos = await resolverCeldasParaTerritorio(idsOrdenados, sesion.territorio, sesion.tipoProyecto, { timeoutMs });
  const indicadores: IndicadorRespuesta[] = resueltos.map((r) => ({
    id: r.id,
    nombre: r.nombre !== r.id ? r.nombre : (nombresFamilia[r.id] ?? r.id),
    definicion: r.definicion,
    fuenteEtiqueta: r.fuenteEtiqueta,
    esMinimo: familia.minimos.includes(r.id),
    tieneSerie: r.tieneSerie,
    celdas: r.celdas,
  }));

  return NextResponse.json({ familiaId, columnas, indicadores }, { status: 200 });
}
