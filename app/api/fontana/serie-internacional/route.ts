// app/api/fontana/serie-internacional/route.ts
// GET ?sesionId=&indicadorId=
// Serie histórica de un indicador de Familia 4 (comparación internacional):
// México (o el país principal del proyecto) + los 4 países de referencia
// fijos (PAISES_REFERENCIA_F4), una serie de puntos por país.
//
// Ruta SEPARADA de serie-temporal/route.ts a propósito: esa es de un solo
// territorio mexicano (usa sesion.territorio, estadosDelTerritorio,
// resolverTerritorioNombre, ResultadoSerie con un solo puntos[]). F4 no
// tiene Territorio y devuelve N series — meterlo ahí obligaría a un modo
// "sin territorio, multi-país" en cada rama. Config de qué indicadores F4
// tienen serie: lib/fontana/series/seriesInternacionalesDisponibles.ts.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { familiaDeIndicador } from "@/types/fontana.types";
import {
  FAMILIA4_NOMBRES,
  FAMILIA4_POLARIDAD,
  ISO3_A_NOMBRE,
  MEXICO_ISO3,
  PAISES_REFERENCIA_F4,
  resolverPaisPrincipal,
} from "@/lib/fontana/familia4Catalogo";
import {
  SERIES_INTERNACIONALES_DISPONIBLES,
  tieneSerieInternacional,
} from "@/lib/fontana/series/seriesInternacionalesDisponibles";
import { resolverSerieInternacionalF4 } from "@/lib/fontana/ingesta/serieInternacional";
import { resolverPaisesNombres } from "@/lib/fontana/geo/resolverPaisesNombres";
import type { SeriePaisComparativa } from "@/lib/fontana/tablaComparativaInternacional";

function formatoDesdeUnidad(unidad?: string): "porcentaje" | "coeficiente" | "moneda" | "conteo" | "indice" {
  if (!unidad) return "conteo";
  // "índice (0-100)" (F4-7 CPI) — chequear ANTES de "0-1": la substring
  // "0-1" está contenida en "0-100", así que sin este check el CPI se
  // clasificaría como "coeficiente" (4 decimales) en vez de índice entero.
  if (unidad.includes("0-100")) return "indice";
  if (unidad.includes("0-1")) return "coeficiente";
  if (unidad.includes("%")) return "porcentaje";
  if (unidad.toUpperCase().includes("USD")) return "moneda";
  return "conteo";
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  const indicadorId = searchParams.get("indicadorId");
  if (!sesionId || !indicadorId) {
    return NextResponse.json({ error: "sesionId e indicadorId son requeridos" }, { status: 400 });
  }
  if (familiaDeIndicador(indicadorId) !== "F4") {
    return NextResponse.json(
      { ok: false, motivo: "Esta ruta es solo para indicadores de Familia 4 (comparación internacional)." },
      { status: 400 }
    );
  }
  if (!tieneSerieInternacional(indicadorId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "sin_serie",
        motivo: "Este indicador de comparación internacional no tiene serie histórica disponible en Fontana todavía.",
      },
      { status: 200 }
    );
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  const { sesion } = cargada;

  const paisPrincipal = resolverPaisPrincipal(sesion.territorio);

  // Set de referencia: el fijo POR DEFAULT; el usuario puede pedir agregar
  // o excluir países explícitamente (el guard de tools.ts ya verificó que
  // los nombró — aquí solo se mapea nombre → iso3 y se arma la lista).
  const nombresAgregar = searchParams.getAll("paisAgregar");
  const nombresExcluir = searchParams.getAll("paisExcluir");
  const resAgregar = resolverPaisesNombres(nombresAgregar);
  const resExcluir = resolverPaisesNombres(nombresExcluir);
  const isosExcluir = new Set(resExcluir.resueltos.map((r) => r.iso3));
  const setPersonalizado = resAgregar.resueltos.length > 0 || isosExcluir.size > 0;

  const refsFinal: string[] = [];
  for (const p of PAISES_REFERENCIA_F4) {
    if (!isosExcluir.has(p.iso3) && p.iso3 !== paisPrincipal.iso3) refsFinal.push(p.iso3);
  }
  for (const r of resAgregar.resueltos) {
    if (r.iso3 !== paisPrincipal.iso3 && !refsFinal.includes(r.iso3)) refsFinal.push(r.iso3);
  }

  if (refsFinal.length + 1 > 8) {
    return NextResponse.json(
      { ok: false, motivo: "Demasiados países en la comparación — el máximo legible son 8 en total (país principal + 7)." },
      { status: 200 }
    );
  }
  if (refsFinal.length === 0) {
    return NextResponse.json(
      { ok: false, motivo: "La comparación se quedó sin países de referencia — deja al menos uno además del país principal." },
      { status: 200 }
    );
  }

  const paisesNoReconocidos = [...resAgregar.noResueltos, ...resExcluir.noResueltos].map((n) => n.nombreIngresado);

  let fila;
  try {
    fila = await resolverSerieInternacionalF4(indicadorId, paisPrincipal.iso3, refsFinal);
  } catch {
    return NextResponse.json({ ok: false, motivo: "No se pudo obtener la serie internacional." }, { status: 200 });
  }

  const todas = [fila.paisPrincipal, ...fila.referencia];
  const primeraOk = todas.find((s) => s.estadoConsulta === "ok");
  if (!primeraOk) {
    return NextResponse.json(
      { ok: false, motivo: "Ninguno de los países tiene serie histórica para este indicador." },
      { status: 200 }
    );
  }

  const nombrePais = (iso3: string) =>
    iso3 === MEXICO_ISO3 ? paisPrincipal.nombre : ISO3_A_NOMBRE[iso3] ?? iso3;

  const mapPais = (s: SeriePaisComparativa, esPaisPrincipal: boolean) => ({
    pais: nombrePais(s.iso3),
    iso3: s.iso3,
    esPaisPrincipal,
    estadoConsulta: s.estadoConsulta,
    motivo: s.motivo ?? null,
    rankOficialUltimo: s.rankOficialUltimo ?? null,
    puntos: s.puntos,
  });
  const paises = [mapPais(fila.paisPrincipal, true), ...fila.referencia.map((r) => mapPais(r, false))];

  const cfg = SERIES_INTERNACIONALES_DISPONIBLES[indicadorId];
  const periodos = [
    ...new Set(paises.flatMap((p) => p.puntos.map((pt) => pt.periodo))),
  ].sort((a, b) => Number(a) - Number(b));

  return NextResponse.json(
    {
      ok: true,
      indicadorId,
      nombre: FAMILIA4_NOMBRES[indicadorId] ?? indicadorId,
      formato: formatoDesdeUnidad(primeraOk.unidad),
      unidad: primeraOk.unidad ?? null,
      fuenteEtiqueta: primeraOk.fuenteEtiqueta ?? "",
      nota: cfg?.notaTarjeta ?? null,
      polaridad: FAMILIA4_POLARIDAD[indicadorId] ?? null,
      periodoInicio: periodos[0] ?? null,
      periodoFin: periodos[periodos.length - 1] ?? null,
      paises,
      setPersonalizado,
      paisesNoReconocidos,
    },
    { status: 200 }
  );
}
