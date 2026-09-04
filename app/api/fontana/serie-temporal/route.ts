// app/api/fontana/serie-temporal/route.ts
// GET ?sesionId=&indicadorId=&territorio=&estado=&nivel=
// Serie histórica (varios años) de un indicador con historia consultable en
// Fontana. Qué indicadores la tienen y con qué resolver: config
// lib/fontana/series/seriesDisponibles.ts (SERIES_DISPONIBLES / tieneSerie).
// El dispatcher lib/fontana/ingesta/serieTemporal.ts normaliza cada fuente
// a la shape ResultadoSerie.
//
// - Sin `territorio` → serie del territorio del proyecto. Si el proyecto
//   abarca MÁS DE UN estado (indicador con serie estatal) o MÁS DE UN
//   municipio (indicador con serie municipal — F2-3/5/20/21/22) NO se
//   elige por el usuario: se devuelve `{ ok:false, multiEstado:true, ... }`
//   o `{ ok:false, multiMunicipio:true, municipios:[...] }` y el agente
//   pregunta a cuál se refiere.
// - Con `territorio` → un estado o municipio nombrado por el usuario (ajeno
//   o propio tras la desambiguación), resuelto vía resolverTerritorioNombre.
//   Un municipio nombrado se mantiene municipal solo si el indicador publica
//   serie municipal; si NO, se devuelve `{ ok:false, colapsoNivel:true, ... }`
//   (nunca se colapsa a estado en silencio — hallazgo 1, 26-09-03).
// La respuesta lleva `nivel` (nacional | estatal | municipal) para que el
// agente aclare a qué unidad geográfica aplica el dato (un dato estatal es
// de todo el estado, no un promedio de sus municipios/distritos).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { resolverTerritorioNombre } from "@/lib/fontana/geo/resolverTerritorioNombre";
import { estadosDelTerritorio } from "@/lib/fontana/geo/estadosDelTerritorio";
import { municipiosDelTerritorio } from "@/lib/fontana/geo/municipiosDelTerritorio";
import { resolverSerieTemporal } from "@/lib/fontana/ingesta/serieTemporal";
import { SERIES_DISPONIBLES, tieneSerie } from "@/lib/fontana/series/seriesDisponibles";
import { nivelObjetivoSerie, type ResultadoSerie } from "@/lib/fontana/series/tipos";
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
  const cfg = SERIES_DISPONIBLES[indicadorId]; // garantizado por tieneSerie()
  const estadosProyecto = estadosDelTerritorio(sesion.territorio);
  const municipiosProyecto = municipiosDelTerritorio(sesion.territorio);
  const registro = await getIndicadorRegistro(indicadorId);
  const nombre = registro?.nombre ?? indicadorId;

  // --- Serie del territorio del proyecto (sin `territorio` en la query) ---
  if (!territorioNombre) {
    const nivelObjetivo = nivelObjetivoSerie(sesion.territorio, cfg.niveles);

    // Proyecto plural: NO se elige por el usuario — se le pregunta a cuál de
    // sus estados/municipios se refiere.
    if (nivelObjetivo === "estatal" && estadosProyecto.length > 1) {
      return NextResponse.json(
        { ok: false, multiEstado: true, estados: estadosProyecto },
        { status: 200 }
      );
    }
    if (nivelObjetivo === "municipal" && municipiosProyecto.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          multiMunicipio: true,
          municipios: municipiosProyecto.map((m) => `${m.nombre}, ${m.estado}`),
        },
        { status: 200 }
      );
    }

    const serie = await resolverSerieTemporal(indicadorId, sesion.territorio);
    return responderSerie(serie, indicadorId, nombre, registro, {
      esTerritorioExterno: false,
      esTerritorioDelProyecto: true,
      pedidoMunicipio: nivelObjetivo === "municipal",
    });
  }

  // --- Serie de un territorio nombrado por el usuario ---
  const resol = await resolverTerritorioNombre(territorioNombre, estadoHint, nivelHint);
  if (!resol.ok) {
    return NextResponse.json(resol, { status: 200 });
  }

  // Un municipio nombrado NO se colapsa en silencio a su estado. Si el
  // indicador no publica serie municipal, se devuelve una señal explícita
  // (colapsoNivel) para que el agente lo aclare ANTES de ofrecer nada
  // (lectura) o rechace la visualización (Canvas) — nunca persista una
  // tarjeta de otra geografía que la pedida. Ver hallazgo 1 (26-09-03).
  if (resol.territorio.nivel === "municipal" && !cfg.niveles.includes("municipal")) {
    const estado = resol.territorio.estado ?? "";
    const entregaNivel = cfg.niveles.includes("estatal") ? "estatal" : "nacional";
    return NextResponse.json(
      {
        ok: false,
        colapsoNivel: true,
        pidioNivel: "municipal",
        entregaNivel,
        municipioPedido: resol.territorio.municipio ?? resol.label,
        estado,
        motivo:
          entregaNivel === "estatal"
            ? `«${nombre}» no tiene serie histórica a nivel municipal — solo a nivel estatal (${estado}).`
            : `«${nombre}» no tiene serie histórica a nivel municipal — solo a nivel nacional.`,
      },
      { status: 200 }
    );
  }

  let territorioSerie: Territorio;
  let labelOverride: string;
  let esTerritorioDelProyecto: boolean;

  if (resol.territorio.nivel === "municipal") {
    // El indicador SÍ tiene serie municipal (cfg.niveles la incluye).
    territorioSerie = resol.territorio;
    labelOverride = resol.label;
    const norm = (s: string) => normalizeGeoName(s);
    esTerritorioDelProyecto = municipiosProyecto.some(
      (m) =>
        norm(m.estado) === norm(resol.territorio.estado ?? "") &&
        norm(m.nombre) === norm(resol.territorio.municipio ?? "")
    );
  } else {
    // Estado nombrado directamente.
    const nombreEstado = resol.territorio.estado ?? resol.label;
    territorioSerie = resol.territorio;
    labelOverride = nombreEstado;
    esTerritorioDelProyecto = estadosProyecto.some(
      (e) => normalizeGeoName(e) === normalizeGeoName(nombreEstado)
    );
  }

  const serie = await resolverSerieTemporal(indicadorId, territorioSerie);
  return responderSerie(serie, indicadorId, nombre, registro, {
    esTerritorioExterno: !esTerritorioDelProyecto,
    esTerritorioDelProyecto,
    labelOverride,
    pedidoMunicipio: resol.territorio.nivel === "municipal",
  });
}

function responderSerie(
  serie: ResultadoSerie,
  indicadorId: string,
  nombre: string,
  registro: Awaited<ReturnType<typeof getIndicadorRegistro>>,
  origen: {
    esTerritorioExterno: boolean;
    esTerritorioDelProyecto: boolean;
    labelOverride?: string;
    pedidoMunicipio?: boolean;
  }
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
      // true si el territorio pedido (proyecto o nombrado) era un municipio —
      // el guard de generarSerieTemporal lo usa para no persistir una tarjeta
      // de otra geografía (hallazgo 1).
      pedidoMunicipio: Boolean(origen.pedidoMunicipio),
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
