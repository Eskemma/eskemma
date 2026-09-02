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
import { adminDb } from "@/lib/firebase-admin";
import { resolverIndicadorFontana } from "@/lib/fontana/ingesta";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { esIndicadorNarrativoCurado } from "@/lib/fontana/ingesta/contenidoCurado";
import { familiaDeIndicador } from "@/types/fontana.types";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, claveCanonicaMunicipio, getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import type { Territorio } from "@/types/shared.types";

type ResolucionTerritorio =
  | { ok: true; territorio: Territorio; label: string }
  | { ok: false; ambiguo: true; candidatos: { estado: string; municipio: string }[] }
  | { ok: false; noResuelto: true };

async function resolverTerritorioNombre(
  nombre: string,
  estadoHint: string | null,
  nivelHint: string | null
): Promise<ResolucionTerritorio> {
  const norm = normalizeGeoName(nombre);

  // 1) ¿Es un ESTADO? (salvo que el usuario haya pedido explícitamente municipal)
  const cveEstadoDirecto = ESTADO_CVE_MAP[norm];
  if (cveEstadoDirecto && nivelHint !== "municipal" && !estadoHint) {
    const label = nombre.trim();
    return { ok: true, territorio: { nivel: "estatal", estado: label, nombre: label }, label };
  }

  // 2) Municipio — búsqueda nacional, join disciplinado por clave canónica.
  const todos = await getMunicipiosOptionsNacional();
  const hintCve = estadoHint ? ESTADO_CVE_MAP[normalizeGeoName(estadoHint)] : null;
  const matches = todos.filter((o) => {
    if (hintCve && o.estadoCve !== hintCve) return false;
    return claveCanonicaMunicipio(o.estadoCve, o.nombre) === claveCanonicaMunicipio(o.estadoCve, nombre);
  });

  if (matches.length === 1) {
    const m = matches[0];
    const label = `${m.nombre}, ${m.estadoNombre}`;
    return {
      ok: true,
      territorio: { nivel: "municipal", estado: m.estadoNombre, municipio: m.nombre, nombre: label },
      label,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      ambiguo: true,
      candidatos: matches.map((m) => ({ estado: m.estadoNombre, municipio: m.nombre })),
    };
  }

  // 3) Nada como municipio. Si era un estado y el hint pedía municipal, igual
  //    devolvemos el estado (mejor eso que "no resuelto").
  if (cveEstadoDirecto) {
    const label = nombre.trim();
    return { ok: true, territorio: { nivel: "estatal", estado: label, nombre: label }, label };
  }
  return { ok: false, noResuelto: true };
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  const indicadorId = searchParams.get("indicadorId");
  const territorio = searchParams.get("territorio");
  const estadoHint = searchParams.get("estado");
  const nivelHint = searchParams.get("nivel");

  if (!sesionId || !indicadorId || !territorio) {
    return NextResponse.json({ error: "sesionId, indicadorId y territorio son requeridos" }, { status: 400 });
  }

  // Auth: la sesión debe existir y ser del usuario.
  const doc = await adminDb.collection("fontana_sesiones").doc(sesionId).get();
  if (!doc.exists || doc.data()?.uid !== session.uid) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

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

  const resol = await resolverTerritorioNombre(territorio, estadoHint, nivelHint);
  if (!resol.ok) {
    return NextResponse.json(resol, { status: 200 });
  }

  const celdas = await resolverIndicadorFontana(indicadorId, resol.territorio);
  const nivelObjetivo = resol.territorio.nivel === "municipal" ? "municipal" : "estatal";
  const celda = celdas.find((c) => c.nivel === nivelObjetivo) ?? celdas.find((c) => "valor" in c);
  const tieneValor = celda && "valor" in celda;

  return NextResponse.json(
    {
      ok: true,
      indicadorId,
      nombre: registro.nombre,
      definicion: registro.definicion ?? null,
      territorio: { label: resol.label, nivel: resol.territorio.nivel, estado: resol.territorio.estado, municipio: resol.territorio.municipio ?? null },
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
