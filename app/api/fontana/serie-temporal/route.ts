// app/api/fontana/serie-temporal/route.ts
// GET ?sesionId=&indicadorId=&territorio=&estado=&nivel=
// Serie histórica (varios años) de un indicador con historia consultable en
// Fontana. Qué indicadores la tienen y con qué resolver: config
// lib/fontana/series/seriesDisponibles.ts (SERIES_DISPONIBLES / tieneSerie).
// El dispatcher lib/fontana/ingesta/serieTemporal.ts normaliza cada fuente
// a la shape ResultadoSerie.
//
// - Sin `territorio` → serie del territorio del proyecto. Si el proyecto
//   abarca MÁS DE UN estado NO se elige por el usuario: se devuelve
//   `{ ok:false, multiEstado:true, estados:[...] }` y el agente pregunta.
// - Con `territorio` → un estado nombrado por el usuario (ajeno o propio
//   tras la desambiguación), resuelto vía resolverTerritorioNombre.
// La respuesta lleva `nivel` (nacional | estatal) para que el agente aclare
// que un dato estatal/nacional aplica a todo el estado/país, no es un
// promedio de los municipios/distritos del proyecto.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { resolverTerritorioNombre } from "@/lib/fontana/geo/resolverTerritorioNombre";
import { estadosDelTerritorio } from "@/lib/fontana/geo/estadosDelTerritorio";
import { resolverSerieTemporal } from "@/lib/fontana/ingesta/serieTemporal";
import { tieneSerie } from "@/lib/fontana/series/seriesDisponibles";
import type { ResultadoSerie } from "@/lib/fontana/series/tipos";
import { normalizeGeoName } from "@/lib/geo/municipios";
import type { Territorio } from "@/types/shared.types";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  const indicadorId = searchParams.get("indicadorId");
  const territorioNombre = searchParams.get("territorio");
  const estadoHint = searchParams.get("estado");
  const nivelHint = searchParams.get("nivel");

  if (!sesionId || !indicadorId) {
    return NextResponse.json({ error: "sesionId e indicadorId son requeridos" }, { status: 400 });
  }

  if (!tieneSerie(indicadorId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "sin_serie",
        mensaje: "Este indicador no tiene serie histórica disponible en Fontana todavía.",
      },
      { status: 400 }
    );
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion } = cargada;
  const estadosProyecto = estadosDelTerritorio(sesion.territorio);
  const registro = await getIndicadorRegistro(indicadorId);
  const nombre = registro?.nombre ?? indicadorId;

  // --- Serie del territorio del proyecto (sin `territorio` en la query) ---
  if (!territorioNombre) {
    if (estadosProyecto.length > 1) {
      return NextResponse.json(
        { ok: false, multiEstado: true, estados: estadosProyecto },
        { status: 200 }
      );
    }
    const serie = await resolverSerieTemporal(indicadorId, sesion.territorio);
    return responderSerie(serie, indicadorId, nombre, registro, {
      esTerritorioExterno: false,
      esTerritorioDelProyecto: true,
    });
  }

  // --- Serie de un estado nombrado por el usuario ---
  const resol = await resolverTerritorioNombre(territorioNombre, estadoHint, nivelHint);
  if (!resol.ok) {
    return NextResponse.json(resol, { status: 200 });
  }
  // Los indicadores de la 1ª ola son nacional/estatal; un municipio nombrado
  // se resuelve a la serie de su estado.
  const territorioEstatal: Territorio =
    resol.territorio.nivel === "municipal"
      ? { nivel: "estatal", estado: resol.territorio.estado, nombre: resol.territorio.estado ?? resol.label }
      : resol.territorio;

  const serie = await resolverSerieTemporal(indicadorId, territorioEstatal);
  const nombreEstado = territorioEstatal.estado ?? resol.label;
  const esTerritorioDelProyecto = estadosProyecto.some(
    (e) => normalizeGeoName(e) === normalizeGeoName(nombreEstado)
  );

  return responderSerie(serie, indicadorId, nombre, registro, {
    esTerritorioExterno: !esTerritorioDelProyecto,
    esTerritorioDelProyecto,
    labelOverride: nombreEstado,
  });
}

function responderSerie(
  serie: ResultadoSerie,
  indicadorId: string,
  nombre: string,
  registro: Awaited<ReturnType<typeof getIndicadorRegistro>>,
  origen: { esTerritorioExterno: boolean; esTerritorioDelProyecto: boolean; labelOverride?: string }
) {
  if (!serie.ok) {
    return NextResponse.json({ ok: false, motivo: serie.motivo }, { status: 200 });
  }
  const label = origen.labelOverride ?? serie.territorioLabel;
  return NextResponse.json(
    {
      ok: true,
      indicadorId,
      nombre,
      nivel: serie.nivel,
      territorio: { label },
      esTerritorioExterno: origen.esTerritorioExterno,
      esTerritorioDelProyecto: origen.esTerritorioDelProyecto,
      unidad: serie.unidad ?? null,
      naturaleza: serie.naturaleza ?? null,
      fuenteEtiqueta: serie.fuenteEtiqueta,
      formato: serie.formato,
      puntos: serie.puntos,
      periodoInicio: serie.puntos[0]?.periodo ?? null,
      periodoFin: serie.puntos[serie.puntos.length - 1]?.periodo ?? null,
      disponibilidadTemporal: registro?.disponibilidadTemporal ?? null,
    },
    { status: 200 }
  );
}
