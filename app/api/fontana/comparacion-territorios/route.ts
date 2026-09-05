// app/api/fontana/comparacion-territorios/route.ts
// GET ?sesionId=&indicadorId=&territorio=A&territorio=B&...&estado=EA&estado=EB
// UN indicador comparado entre VARIOS territorios ARBITRARIOS nombrados
// explícitamente por el usuario (26-09-06) — no niveles jerárquicos de un
// mismo territorio (eso es .../familia/[id] vía generar_visualizacion
// tipo "grafica"), no categorías internas (eso es .../distribucion).
//
// `territorio` se repite una vez por cada nombre (searchParams.getAll);
// `estado` y `nivel` son paralelos por índice (mismo orden), opcionales —
// `nivel` (26-09-07) fuerza "estatal"/"municipal" cuando el usuario lo pidió
// explícitamente para ESE territorio (ej. "municipios (capitales)" para un
// nombre que también es estado — mismo criterio ya usado en
// consultar_indicador_territorio_externo, que sí tenía este parámetro desde
// el principio; comparacion_territorios no lo tuvo hasta este hallazgo).
// Resolución en lote vía resolverTerritoriosNombres — nunca asume el primer
// candidato de un nombre ambiguo, nunca omite en silencio un territorio que
// no resolvió: se reporta en `noResueltos` con su motivo (mismo shape que
// agregacionPlural.noResueltas). Si CERO resuelven, `{ok:false, motivo}` —
// sin tarjeta.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { esIndicadorNarrativoCurado } from "@/lib/fontana/ingesta/contenidoCurado";
import { resolverIndicadorFontana } from "@/lib/fontana/ingesta";
import { resolverTerritoriosNombres } from "@/lib/fontana/geo/resolverTerritoriosNombres";
import { municipiosDelTerritorio } from "@/lib/fontana/geo/municipiosDelTerritorio";
import { estadosDelTerritorio } from "@/lib/fontana/geo/estadosDelTerritorio";
import { normalizeGeoName } from "@/lib/geo/municipios";
import { familiaDeIndicador } from "@/types/fontana.types";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  const indicadorId = searchParams.get("indicadorId");
  const territorios = searchParams.getAll("territorio");
  const estados = searchParams.getAll("estado"); // paralelo por índice, puede venir vacío o más corto
  const niveles = searchParams.getAll("nivel"); // paralelo por índice, puede venir vacío o más corto

  if (!sesionId || !indicadorId || territorios.length === 0) {
    return NextResponse.json({ error: "sesionId, indicadorId y al menos un territorio son requeridos" }, { status: 400 });
  }

  const familia = familiaDeIndicador(indicadorId);
  if (familia === "F4") {
    return NextResponse.json(
      { error: "familia_4", mensaje: "Familia 4 compara países; no aplica a una comparación de territorios de México." },
      { status: 400 }
    );
  }
  if (esIndicadorNarrativoCurado(indicadorId)) {
    return NextResponse.json(
      { error: "narrativo", mensaje: "El contenido narrativo no se compara entre territorios." },
      { status: 400 }
    );
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion } = cargada;

  const registro = await getIndicadorRegistro(indicadorId);
  if (!registro) {
    return NextResponse.json({ error: "id_invalido", mensaje: `El indicador «${indicadorId}» no existe.` }, { status: 400 });
  }

  // 26-09-07: por cada territorio, el nivel final combina (dentro de
  // resolverTerritoriosNombres, vía nivelHintPorIndicador) el override
  // EXPLÍCITO del usuario (`niveles[i]`, nuevo — antes comparacion_territorios
  // no tenía forma de pedirlo, causa raíz del hallazgo Puebla/Querétaro) con
  // el fallback determinístico por indicador ya existente (si "estatal" es
  // no_viable para este indicador, fuerza municipal aunque no haya override).
  const { resueltos, noResueltos } = await resolverTerritoriosNombres(
    territorios.map((nombre, i) => ({
      nombre,
      estadoHint: estados[i] || undefined,
      nivelHintExplicito: niveles[i] || null,
    })),
    registro
  );

  if (resueltos.length === 0) {
    return NextResponse.json(
      { ok: false, motivo: "Ninguno de los territorios pedidos se pudo reconocer.", noResueltos },
      { status: 200 }
    );
  }

  const municipiosProyecto = municipiosDelTerritorio(sesion.territorio);
  const estadosProyecto = estadosDelTerritorio(sesion.territorio);
  const norm = (s: string) => normalizeGeoName(s);

  const filas = await Promise.all(
    resueltos.map(async ({ territorio, label }) => {
      const celdas = await resolverIndicadorFontana(indicadorId, territorio);
      const nivelObjetivo = territorio.nivel === "municipal" ? "municipal" : "estatal";
      const celda = celdas.find((c) => c.nivel === nivelObjetivo) ?? celdas.find((c) => "valor" in c);
      const tieneValor = celda && "valor" in celda;

      const esTerritorioDelProyecto =
        territorio.nivel === "municipal"
          ? municipiosProyecto.some(
              (m) => norm(m.estado) === norm(territorio.estado ?? "") && norm(m.nombre) === norm(territorio.municipio ?? "")
            )
          : estadosProyecto.some((e) => norm(e) === norm(territorio.estado ?? territorio.nombre));

      return {
        territorioLabel: label,
        nivel: celda?.nivel ?? nivelObjetivo,
        valor: tieneValor ? (celda as { valor: number }).valor : null,
        unidad: tieneValor ? (celda as { unidad?: string }).unidad : undefined,
        naturaleza: tieneValor ? (celda as { naturaleza?: string }).naturaleza : undefined,
        motivo: tieneValor ? undefined : (celda as { motivo?: string } | undefined)?.motivo ?? "Nivel no cubierto.",
        fuenteEtiqueta: tieneValor ? (celda as { fuenteEtiqueta?: string }).fuenteEtiqueta : undefined,
        esTerritorioDelProyecto,
        esTerritorioExterno: !esTerritorioDelProyecto,
      };
    })
  );

  const unidad = filas.find((f) => f.unidad)?.unidad;
  const fuenteEtiqueta = filas.find((f) => f.fuenteEtiqueta)?.fuenteEtiqueta ?? registro.fuenteEtiqueta;

  return NextResponse.json(
    {
      ok: true,
      indicadorId,
      nombre: registro.nombre,
      unidad,
      fuenteEtiqueta,
      filas,
      noResueltos,
    },
    { status: 200 }
  );
}
