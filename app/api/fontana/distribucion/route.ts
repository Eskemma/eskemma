// app/api/fontana/distribucion/route.ts
// GET ?sesionId=&indicadorId=&territorio=&estado=&nivel=
// Desglose por categorías de un indicador de F1 (F1-2 pirámide de edades por
// sexo · F1-11 urbano/rural) para un territorio — el del proyecto o uno
// NOMBRADO por el usuario ("la pirámide de todo Jalisco"). Mismo patrón que
// serie-temporal/route.ts:
//   - Sin `territorio` y proyecto plural municipal (>1 municipio) →
//     { ok:false, multiMunicipio:true, municipios:[...] } → el agente pregunta
//     y puede recibir varios municipios (una tarjeta de Canvas por cada uno).
//   - Con `territorio` → resolverTerritorioNombre; la respuesta lleva
//     esTerritorioExterno / esTerritorioDelProyecto para que el agente aclare
//     que el dato es de ese territorio y no del proyecto.
// Solo F1-2 / F1-11 (ITER — resolverIndicadorIter acepta cualquier Territorio).
// F1-12 / F2-12 siguen por el flujo de familia (solo territorio del proyecto).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { resolverTerritorioNombre } from "@/lib/fontana/geo/resolverTerritorioNombre";
import { estadosDelTerritorio } from "@/lib/fontana/geo/estadosDelTerritorio";
import { municipiosDelTerritorio } from "@/lib/fontana/geo/municipiosDelTerritorio";
import { resolverIndicadorIter } from "@/lib/fontana/ingesta/iter";
import { normalizeGeoName } from "@/lib/geo/municipios";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

const IDS_ITER_DISTRIBUCION = new Set(["F1-2", "F1-11"]);

type NivelObjetivo = "nacional" | "estatal" | "municipal";

function nivelDelTerritorio(t: Territorio): NivelObjetivo {
  if (t.nivel === "nacional") return "nacional";
  if (t.nivel === "estatal") return "estatal";
  return "municipal"; // municipal + distrito_* (se resuelve por cabecera)
}

function etiquetaTerritorio(t: Territorio, nivel: NivelObjetivo): string {
  if (nivel === "nacional") return "Nacional";
  if (nivel === "municipal") return [t.municipio, t.estado].filter(Boolean).join(", ") || t.nombre;
  return t.estado ?? t.nombre;
}

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
  if (!IDS_ITER_DISTRIBUCION.has(indicadorId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_soportado",
        mensaje: "Este indicador solo se puede desglosar para el territorio del proyecto.",
      },
      { status: 400 }
    );
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  const { sesion } = cargada;

  const registro = await getIndicadorRegistro(indicadorId);
  const nombre = registro?.nombre ?? indicadorId;
  const idIter = indicadorId as "F1-2" | "F1-11";

  // --- Desglose del territorio del proyecto ---
  if (!territorioNombre) {
    const nivel = nivelDelTerritorio(sesion.territorio);
    if (nivel === "municipal") {
      const muns = municipiosDelTerritorio(sesion.territorio);
      if (muns.length > 1) {
        return NextResponse.json(
          { ok: false, multiMunicipio: true, municipios: muns.map((m) => `${m.nombre}, ${m.estado}`) },
          { status: 200 }
        );
      }
    }
    if (nivel === "estatal") {
      const estados = estadosDelTerritorio(sesion.territorio);
      if (estados.length > 1) {
        return NextResponse.json({ ok: false, multiEstado: true, estados }, { status: 200 });
      }
    }
    const celdas = await resolverIndicadorIter(idIter, sesion.territorio);
    return responder(celdas, nivel, indicadorId, nombre, {
      esTerritorioExterno: false,
      esTerritorioDelProyecto: true,
      labelOverride: etiquetaTerritorio(sesion.territorio, nivel),
    });
  }

  // --- Desglose de un territorio nombrado por el usuario ---
  const resol = await resolverTerritorioNombre(territorioNombre, estadoHint, nivelHint);
  if (!resol.ok) return NextResponse.json(resol, { status: 200 });

  const nivel: NivelObjetivo = resol.territorio.nivel === "municipal" ? "municipal" : "estatal";
  const celdas = await resolverIndicadorIter(idIter, resol.territorio);

  let esTerritorioDelProyecto: boolean;
  if (nivel === "municipal") {
    const norm = (s: string) => normalizeGeoName(s);
    esTerritorioDelProyecto = municipiosDelTerritorio(sesion.territorio).some(
      (m) =>
        norm(m.estado) === norm(resol.territorio.estado ?? "") &&
        norm(m.nombre) === norm(resol.territorio.municipio ?? "")
    );
  } else {
    esTerritorioDelProyecto = estadosDelTerritorio(sesion.territorio).some(
      (e) => normalizeGeoName(e) === normalizeGeoName(resol.territorio.estado ?? resol.label)
    );
  }

  return responder(celdas, nivel, indicadorId, nombre, {
    esTerritorioExterno: !esTerritorioDelProyecto,
    esTerritorioDelProyecto,
    labelOverride: resol.label,
  });
}

function responder(
  celdas: CeldaFontana[],
  nivel: NivelObjetivo,
  indicadorId: string,
  nombre: string,
  origen: { esTerritorioExterno: boolean; esTerritorioDelProyecto: boolean; labelOverride: string }
) {
  const celda = celdas.find((c) => c.nivel === nivel);
  if (!celda || !("valor" in celda)) {
    const motivo =
      celda && "motivo" in celda && celda.motivo
        ? celda.motivo
        : "No hay desglose para este territorio a este nivel.";
    return NextResponse.json({ ok: false, motivo }, { status: 200 });
  }
  if (!celda.distribucion || Object.keys(celda.distribucion).length === 0) {
    return NextResponse.json(
      { ok: false, motivo: "Este indicador no trae desglose por categorías para este territorio." },
      { status: 200 }
    );
  }
  return NextResponse.json(
    {
      ok: true,
      indicadorId,
      nombre,
      nivel,
      territorio: { label: origen.labelOverride },
      esTerritorioExterno: origen.esTerritorioExterno,
      esTerritorioDelProyecto: origen.esTerritorioDelProyecto,
      distribucion: celda.distribucion,
      distribucionSexo: celda.distribucionSexo ?? null,
      unidad: celda.unidad ?? null,
      naturaleza: celda.naturaleza ?? null,
      fuenteEtiqueta: celda.fuenteEtiqueta ?? null,
    },
    { status: 200 }
  );
}
