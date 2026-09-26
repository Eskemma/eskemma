// app/api/fontana/consulta-territorio/route.ts
// GET ?sesionId=&indicadorId=&territorio=&estado=&nivel= — consulta puntual
// de un indicador en un territorio EXPLÍCITO nombrado por el usuario en el
// chat, distinto al del proyecto activo (Fase 1: solo lectura, sin Canvas).
//
// `sesionId` se usa SOLO para autenticar (mismo patrón que familia/F4/paises).
// El territorio NO sale de la sesión: se resuelve del nombre libre que
// tecleó el usuario, SIEMPRE vía claveCanonicaMunicipio()/normalizeGeoName()
// + ESTADO_CVE_MAP (nunca comparación de string a mano — disciplina de
// docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md). Si el
// nombre no resuelve a una sola unidad, devuelve `ambiguo` con candidatos —
// nunca asume el primero.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { resolverIndicadorFontana } from "@/lib/fontana/ingesta";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { esIndicadorNarrativoCurado } from "@/lib/fontana/ingesta/contenidoCurado";
import { familiaDeIndicador } from "@/types/fontana.types";
import { resolverReferenciaTerritorio } from "@/lib/fontana/geo/resolverReferenciaTerritorio";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  const indicadorId = searchParams.get("indicadorId");
  const territorio = searchParams.get("territorio");
  const estadoHint = searchParams.get("estado");
  const nivelHint = searchParams.get("nivel");
  // Paso 3: clave elegida de una lista de candidatos (se verifica en el servidor) y tipo explícito.
  const claveTerritorio = searchParams.get("clave");
  const tipoTerritorio = searchParams.get("tipo");

  if (!sesionId || !indicadorId || !territorio) {
    return NextResponse.json({ error: "sesionId, indicadorId y territorio son requeridos" }, { status: 400 });
  }

  // Auth: la sesión debe existir y ser del usuario. Se carga con su territorio activo: "este
  // distrito" / "nivel estatal" se resuelven contra él (lib/geo/referenciaContextual.ts).
  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion } = cargada;

  const familia = familiaDeIndicador(indicadorId);
  if (familia === "F4") {
    return NextResponse.json(
      { error: "familia_4", mensaje: "Familia 4 compara países; no aplica a una consulta por territorio de México." },
      { status: 400 }
    );
  }
  if (esIndicadorNarrativoCurado(indicadorId)) {
    return NextResponse.json(
      { error: "narrativo", mensaje: "El contenido narrativo de otros territorios no está disponible en consulta puntual." },
      { status: 400 }
    );
  }

  const registro = await getIndicadorRegistro(indicadorId);
  if (!registro) {
    return NextResponse.json({ error: "id_invalido", mensaje: `El indicador «${indicadorId}» no existe.` }, { status: 400 });
  }

  // Paso 3: el adaptador decide los tipos a considerar según los niveles que ESTE indicador admite
  // (si el estado no es viable y el municipio sí, "Querétaro" es el municipio; si admite ambos,
  // pregunta), resuelve referencias contextuales y valida la clave elegida.
  const resol = await resolverReferenciaTerritorio({
    texto: territorio,
    estadoHint,
    nivelHint,
    claveTerritorio,
    tipoTerritorio,
    registro,
    territorioActivo: sesion.territorio,
  });
  if (!resol.ok) {
    return NextResponse.json(resol, { status: 200 });
  }
  // "este distrito" en una consulta de territorio EXTERNO es el propio territorio del proyecto: la
  // herramienta correcta es consultar_indicador (que además compara niveles).
  if (resol.via === "contexto") {
    return NextResponse.json(
      {
        ok: false,
        referencia: "territorio_del_proyecto",
        esTerritorioDelProyecto: true,
        mensaje: `«${territorio}» es el territorio de tu proyecto (${resol.label}). Usa consultar_indicador (sin territorio externo) para este dato.`,
      },
      { status: 200 }
    );
  }

  const celdas = await resolverIndicadorFontana(indicadorId, resol.territorio);
  const nivelTerritorio = resol.territorio.nivel;
  const nivelObjetivo =
    nivelTerritorio === "municipal"
      ? "municipal"
      : nivelTerritorio === "nacional"
        ? "nacional"
        : nivelTerritorio === "distrito_federal" || nivelTerritorio === "distrito_local" || nivelTerritorio === "distrito"
          ? "distrital"
          : "estatal";
  // Un municipio o estado puede caer a otra celda con valor; un distrito o el país NUNCA: no se
  // presenta el valor de otro nivel como si fuera el pedido.
  const puedeCaerAOtroNivel = nivelObjetivo === "municipal" || nivelObjetivo === "estatal";
  const celda =
    celdas.find((c) => c.nivel === nivelObjetivo) ?? (puedeCaerAOtroNivel ? celdas.find((c) => "valor" in c) : undefined);
  const tieneValor = celda && "valor" in celda;

  return NextResponse.json(
    {
      ok: true,
      indicadorId,
      nombre: registro.nombre,
      definicion: registro.definicion ?? null,
      territorio: { label: resol.label, nivel: resol.territorio.nivel, estado: resol.territorio.estado, municipio: resol.territorio.municipio ?? null },
      aviso: resol.aviso ?? null,
      nivel: celda?.nivel ?? nivelObjetivo,
      valor: tieneValor ? (celda as { valor: number }).valor : null,
      unidad: tieneValor ? (celda as { unidad?: string }).unidad ?? null : null,
      naturaleza: tieneValor ? (celda as { naturaleza?: string }).naturaleza ?? null : null,
      fuenteEtiqueta: tieneValor ? (celda as { fuenteEtiqueta?: string }).fuenteEtiqueta ?? null : null,
      motivo: tieneValor ? null : (celda as { motivo?: string } | undefined)?.motivo ?? "Nivel no cubierto.",
      disponibilidadTemporal: registro.disponibilidadTemporal ?? null,
    },
    { status: 200 }
  );
}
