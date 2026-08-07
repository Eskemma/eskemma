// app/api/fontana/familia/[familiaId]/municipios/route.ts
// GET ?sesionId=&indicadorId= — desglose municipal de un indicador para
// el distrito electoral (federal o local) del proyecto (modal "Ver
// datos municipales", Fontana T10). Lazy: se consulta solo al abrir el
// modal, nunca en la carga inicial de la tabla.
//
// Encargo 2 (cierre 2026-08-04) — mismo endpoint, 2 casos de uso más:
// proyectos nivel "estatal" (territorio.nivel === "estatal") piden
// desglose de TODOS los municipios/distritos_fed/distritos_loc de su
// propio estado, vía ?tipoElemento=. Si el conteo real supera
// UMBRAL_PRECARGA_COMPLETA (Oaxaca: 570 municipios), GET regresa solo el
// índice ligero (modo "buscador", sin valores) y el cliente selecciona
// antes de pedir valores vía POST (batch, nunca N llamadas).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { FontanaSesion, FamiliaFontanaId } from "@/types/fontana.types";
import {
  resolverMunicipiosDeDistrito,
  resolverElementosDeEstado,
  getOpcionesElementoEstado,
  resolverDistritosDeMunicipio,
  resolverEstadosNacional,
  getOpcionesElementoNacional,
  resolverElementosDeNacional,
  type TipoElementoEstado,
  type TipoDistrito,
  type TipoElementoNacional,
} from "@/lib/fontana/ingesta/eceg";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { getMunicipiosOptions, normalizeGeoName, resolveMunicipioCve } from "@/lib/geo/municipios";
import { extraerNumeroDistrito } from "@/lib/moddulo/distritoElectoral";
import { esValorDisponible } from "@/lib/fontana/ingesta/types";
import { UMBRAL_PRECARGA_COMPLETA } from "@/lib/fontana/tablaColumnas";

export const maxDuration = 60;

interface MunicipioRespuesta {
  municipioCve: string;
  nombre: string;
  pctPobtot: number;
  coberturaMunicipioPct: number;
  valor?: number;
  unidad?: string;
  naturaleza?: string;
  fuenteEtiqueta?: string;
  motivo?: string;
}

interface ElementoRespuesta {
  cve: string;
  nombre: string;
  valor?: number;
  unidad?: string;
  naturaleza?: string;
  fuenteEtiqueta?: string;
  motivo?: string;
}

interface DistritoDeMunicipioRespuesta {
  distritoCve: string;
  nombre: string;
  pctPobtot: number;
  valor?: number;
  unidad?: string;
  naturaleza?: string;
  fuenteEtiqueta?: string;
  motivo?: string;
}

interface ElementoNacionalRespuesta extends ElementoRespuesta {
  estadoCve: string;
}

const TIPOS_ELEMENTO_VALIDOS: TipoElementoEstado[] = ["municipios", "distritos_fed", "distritos_loc"];
const TIPOS_DISTRITO_VALIDOS: TipoDistrito[] = ["federal", "local"];
const TIPOS_ELEMENTO_NACIONAL_VALIDOS: TipoElementoNacional[] = ["estados", "municipios", "distritos_fed", "distritos_loc"];

async function cargarSesionValidada(
  request: NextRequest,
  familiaId: string,
  sesionId: string | null,
  indicadorId: string | null
) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) } as const;

  if (familiaId !== "F1") {
    return {
      error: NextResponse.json(
        { error: "familia_no_disponible", mensaje: `Familia ${familiaId} aún no está disponible en Fontana.` },
        { status: 400 }
      ),
    } as const;
  }
  if (!sesionId || !indicadorId) {
    return { error: NextResponse.json({ error: "sesionId e indicadorId son requeridos" }, { status: 400 }) } as const;
  }

  const snap = await adminDb.collection("fontana_sesiones").doc(sesionId).get();
  if (!snap.exists) {
    return { error: NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 }) } as const;
  }
  const sesion = snap.data() as FontanaSesion;
  if (sesion.uid !== session.uid) {
    return { error: NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 }) } as const;
  }

  const familia = sesion.indicadoresPorFamilia[familiaId as FamiliaFontanaId];
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  if (!idsEnSesion.has(indicadorId)) {
    return { error: NextResponse.json({ error: "indicador_no_en_sesion" }, { status: 404 }) } as const;
  }

  return { sesion } as const;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ familiaId: string }> }
) {
  const { familiaId } = await context.params;
  const { searchParams } = new URL(request.url);
  const sesionId = searchParams.get("sesionId");
  const indicadorId = searchParams.get("indicadorId");

  const validacion = await cargarSesionValidada(request, familiaId, sesionId, indicadorId);
  if ("error" in validacion) return validacion.error;
  const { sesion } = validacion;
  const { territorio } = sesion;

  if (territorio.nivel === "nacional") {
    return handleGetNacional(searchParams, indicadorId!);
  }

  if (territorio.nivel === "estatal") {
    return handleGetEstado(searchParams, territorio, indicadorId!);
  }

  if (territorio.nivel === "municipal") {
    return handleGetMunicipio(searchParams, territorio, indicadorId!);
  }

  if (territorio.nivel !== "distrito_federal" && territorio.nivel !== "distrito_local") {
    return NextResponse.json(
      { error: "nivel_no_soportado", mensaje: "El desglose municipal solo está disponible para proyectos a nivel distrito electoral, estatal, municipal o nacional." },
      { status: 400 }
    );
  }
  const tipoDistrito = territorio.nivel === "distrito_federal" ? "federal" : "local";
  if (!territorio.estado) {
    return NextResponse.json({ error: "El proyecto no tiene un estado definido en su territorio" }, { status: 400 });
  }

  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) {
    return NextResponse.json({ error: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` }, { status: 400 });
  }

  const numeroDistrito = extraerNumeroDistrito(territorio.municipio ?? territorio.nombre, territorio.cve_distrito);
  if (!numeroDistrito) {
    return NextResponse.json({ error: "No fue posible determinar el distrito electoral del territorio del proyecto" }, { status: 400 });
  }

  const [municipios, opciones] = await Promise.all([
    resolverMunicipiosDeDistrito(indicadorId!, estadoCve, numeroDistrito, tipoDistrito),
    getMunicipiosOptions(estadoCve),
  ]);

  if (!municipios) {
    return NextResponse.json({ error: "Este indicador no tiene mecanismo de desglose municipal" }, { status: 400 });
  }

  // Fix 2026-08-03: antes se resolvía cve→nombre con
  // iter_2020/catalogo_municipios/{estado}.json (numeración PROPIA de
  // ITER, construida desde NOM_MUN del censo — documentado en
  // lib/fontana/ingesta/iter.ts como divergente de la numeración
  // geo/INE en ~63% de los municipios del país). Pero municipioCve aquí
  // viene de distritos_municipios/{estado}.json, que usa la numeración
  // geo/INE (mismo shapefile que ya usa resolverMunicipal/resolverEstatal
  // en eceg.ts vía resolveMunicipioCve) — cruzarlo contra el catálogo de
  // ITER daba el municipio real correcto pero con el NOMBRE de un
  // municipio distinto. getMunicipiosOptions (lib/geo/municipios.ts) es
  // el catálogo correcto para esta numeración — confirmado en vivo: sus
  // 11 CVE del distrito 005 (Jalisco) coinciden exactamente con la lista
  // oficial de Sefix (Atengo, Atenguillo, Cabo Corrientes, Cuautla,
  // Guachinango, Mascota, Mixtlán, Puerto Vallarta, San Sebastián del
  // Oeste, Talpa de Allende, Tomatlán).
  //
  // Nota de acentos (decisión de Raúl, 2026-08-03): getMunicipiosOptions
  // normaliza vía normalizeGeoName — MAYÚSCULAS, sin diacríticos. Esa es
  // la convención ya establecida en todo Sefix para nombres geográficos
  // (mismo criterio de matching en todo el ecosistema) — Fontana la
  // mantiene tal cual, sin re-capitalizar ni intentar restituir acentos.
  // "MIXTLAN", no "Mixtlán" ni "Mixtlan" — definitivo, no un pendiente.
  const nombrePorCve = new Map<string, string>();
  for (const o of opciones) {
    nombrePorCve.set(o.cve, o.nombre);
  }

  const respuesta: MunicipioRespuesta[] = municipios
    .map(({ municipioCve, pctPobtot, coberturaMunicipioPct, celda }) => ({
      municipioCve,
      nombre: nombrePorCve.get(municipioCve) ?? `Municipio ${municipioCve}`,
      pctPobtot,
      coberturaMunicipioPct,
      ...(esValorDisponible(celda)
        ? { valor: celda.valor, unidad: celda.unidad, naturaleza: celda.naturaleza, fuenteEtiqueta: celda.fuenteEtiqueta }
        : { motivo: celda.motivo }),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return NextResponse.json({ municipios: respuesta, tipoDistrito }, { status: 200 });
}

// Proyectos nivel "estatal" — desglose de TODOS los municipios/distritos
// del ESTADO del proyecto (no de un distrito). Cada elemento pertenece
// íntegro al estado — sin pctPobtot/coberturaMunicipioPct (esos campos
// solo tienen sentido cuando un distrito reparte un municipio
// fragmentado, ver resolverMunicipiosDeDistrito).
async function handleGetEstado(
  searchParams: URLSearchParams,
  territorio: FontanaSesion["territorio"],
  indicadorId: string
) {
  const tipoElemento = searchParams.get("tipoElemento") as TipoElementoEstado | null;
  if (!tipoElemento || !TIPOS_ELEMENTO_VALIDOS.includes(tipoElemento)) {
    return NextResponse.json(
      { error: `'tipoElemento' es requerido para proyectos estatales. Debe ser uno de: ${TIPOS_ELEMENTO_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!territorio.estado) {
    return NextResponse.json({ error: "El proyecto no tiene un estado definido en su territorio" }, { status: 400 });
  }
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) {
    return NextResponse.json({ error: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` }, { status: 400 });
  }

  const opciones = await getOpcionesElementoEstado(tipoElemento, estadoCve);
  if (opciones.length > UMBRAL_PRECARGA_COMPLETA) {
    // Modo buscador — solo el índice ligero (cve+nombre), sin valores.
    // El cliente selecciona y pide valores vía POST (batch).
    return NextResponse.json({ modo: "buscador", indice: opciones }, { status: 200 });
  }

  const elementos = await resolverElementosDeEstado(indicadorId, estadoCve, tipoElemento);
  if (!elementos) {
    return NextResponse.json({ error: "Este indicador no tiene mecanismo de desglose para este nivel" }, { status: 400 });
  }
  const respuesta: ElementoRespuesta[] = elementos
    .map(({ cve, nombre, celda }) => ({
      cve,
      nombre,
      ...(esValorDisponible(celda)
        ? { valor: celda.valor, unidad: celda.unidad, naturaleza: celda.naturaleza, fuenteEtiqueta: celda.fuenteEtiqueta }
        : { motivo: celda.motivo }),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return NextResponse.json({ modo: "precarga-completa", elementos: respuesta }, { status: 200 });
}

// Proyectos nivel "nacional" (cierre 2026-08-06): desglose a escala
// país. "estados" siempre precarga completa (32 ≤ 119) — lee
// national.json, ya cacheado. Los otros 3 siempre modo buscador (300/
// 679/2,477, muy por encima de 119) — índice ligero con estadoCve/
// estadoNombre para desambiguar nombres repetidos entre estados.
async function handleGetNacional(searchParams: URLSearchParams, indicadorId: string) {
  const tipoElemento = searchParams.get("tipoElemento") as TipoElementoNacional | null;
  if (!tipoElemento || !TIPOS_ELEMENTO_NACIONAL_VALIDOS.includes(tipoElemento)) {
    return NextResponse.json(
      { error: `'tipoElemento' es requerido para proyectos nacionales. Debe ser uno de: ${TIPOS_ELEMENTO_NACIONAL_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }

  if (tipoElemento === "estados") {
    const elementos = await resolverEstadosNacional(indicadorId);
    if (!elementos) {
      return NextResponse.json({ error: "Este indicador no tiene mecanismo de desglose para este nivel" }, { status: 400 });
    }
    const respuesta: ElementoRespuesta[] = elementos
      .map(({ cve, nombre, celda }) => ({
        cve,
        nombre,
        ...(esValorDisponible(celda)
          ? { valor: celda.valor, unidad: celda.unidad, naturaleza: celda.naturaleza, fuenteEtiqueta: celda.fuenteEtiqueta }
          : { motivo: celda.motivo }),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return NextResponse.json({ modo: "precarga-completa", elementos: respuesta }, { status: 200 });
  }

  const indice = await getOpcionesElementoNacional(tipoElemento);
  // Modo buscador, siempre — 300/679/2,477 superan por mucho
  // UMBRAL_PRECARGA_COMPLETA; se compara igual, sin hardcodear, por
  // consistencia con el resto del sistema.
  if (indice.length > UMBRAL_PRECARGA_COMPLETA) {
    return NextResponse.json({ modo: "buscador", indice }, { status: 200 });
  }
  const elementos = await resolverElementosDeNacional(
    indicadorId,
    tipoElemento,
    indice.map((o) => ({ estadoCve: o.estadoCve, cve: o.cve }))
  );
  const respuesta: ElementoNacionalRespuesta[] = (elementos ?? [])
    .map(({ cve, nombre, estadoCve, celda }) => ({
      cve,
      nombre,
      estadoCve,
      ...(esValorDisponible(celda)
        ? { valor: celda.valor, unidad: celda.unidad, naturaleza: celda.naturaleza, fuenteEtiqueta: celda.fuenteEtiqueta }
        : { motivo: celda.motivo }),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return NextResponse.json({ modo: "precarga-completa", elementos: respuesta }, { status: 200 });
}

// Proyectos nivel "municipal" — columnas inversas (cierre 2026-08-05):
// dado el municipio del proyecto, los distritos (federal o local) que
// lo tocan, con su valor y % de POBTOT en cada uno. Solo se llama desde
// el botón "sin dominante" (ver celdaDesdeDistritalMunicipio,
// app/api/fontana/familia/[familiaId]/route.ts) — confirmado con datos
// reales de los 32 estados que esto NUNCA supera 12 elementos (máximo
// nacional, Local), así que siempre es precarga completa, nunca modo
// buscador — sin el parámetro `modo` que sí necesita el caso Estatal.
async function handleGetMunicipio(
  searchParams: URLSearchParams,
  territorio: FontanaSesion["territorio"],
  indicadorId: string
) {
  const tipoDistrito = searchParams.get("tipoDistrito") as TipoDistrito | null;
  if (!tipoDistrito || !TIPOS_DISTRITO_VALIDOS.includes(tipoDistrito)) {
    return NextResponse.json(
      { error: `'tipoDistrito' es requerido para proyectos municipales. Debe ser uno de: ${TIPOS_DISTRITO_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!territorio.estado || !territorio.municipio) {
    return NextResponse.json({ error: "El proyecto no tiene estado/municipio definidos en su territorio" }, { status: 400 });
  }
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) {
    return NextResponse.json({ error: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` }, { status: 400 });
  }
  const municipioCve = await resolveMunicipioCve(estadoCve, territorio.municipio);
  if (!municipioCve) {
    return NextResponse.json({ error: `Municipio "${territorio.municipio}" no reconocido en el catálogo INEGI` }, { status: 400 });
  }

  const distritos = await resolverDistritosDeMunicipio(indicadorId, estadoCve, municipioCve, tipoDistrito);
  if (!distritos) {
    return NextResponse.json({ error: "Este indicador no tiene mecanismo de desglose para este nivel" }, { status: 400 });
  }

  const respuesta: DistritoDeMunicipioRespuesta[] = distritos
    .map(({ distritoCve, nombre, pctPobtot, celda }) => ({
      distritoCve,
      nombre,
      pctPobtot,
      ...(esValorDisponible(celda)
        ? { valor: celda.valor, unidad: celda.unidad, naturaleza: celda.naturaleza, fuenteEtiqueta: celda.fuenteEtiqueta }
        : { motivo: celda.motivo }),
    }))
    .sort((a, b) => b.pctPobtot - a.pctPobtot);

  return NextResponse.json({ distritos: respuesta }, { status: 200 });
}

// POST — batch de valores para una selección de elementos (modo
// buscador, proyectos estatales). Nunca N llamadas: una sola descarga
// del archivo del estado (fetchEcegFromStorage, cacheado 30 min), sin
// importar cuántos elementos seleccionó el usuario.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ familiaId: string }> }
) {
  const { familiaId } = await context.params;
  const body = await request.json().catch(() => null);
  const sesionId = body?.sesionId as string | undefined;
  const indicadorId = body?.indicadorId as string | undefined;

  const validacion = await cargarSesionValidada(request, familiaId, sesionId ?? null, indicadorId ?? null);
  if ("error" in validacion) return validacion.error;
  const { sesion } = validacion;
  const { territorio } = sesion;

  if (territorio.nivel === "nacional") {
    return handlePostNacional(body, indicadorId!);
  }

  const tipoElemento = body?.tipoElemento as TipoElementoEstado | undefined;
  const seleccion = body?.seleccion as string[] | undefined;

  if (territorio.nivel !== "estatal") {
    return NextResponse.json({ error: "nivel_no_soportado", mensaje: "La carga por selección solo aplica a proyectos estatales o nacionales." }, { status: 400 });
  }
  if (!tipoElemento || !TIPOS_ELEMENTO_VALIDOS.includes(tipoElemento)) {
    return NextResponse.json(
      { error: `'tipoElemento' es requerido. Debe ser uno de: ${TIPOS_ELEMENTO_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!Array.isArray(seleccion) || seleccion.length === 0) {
    return NextResponse.json({ error: "'seleccion' (array de cve) es requerido y no puede estar vacío" }, { status: 400 });
  }
  if (!territorio.estado) {
    return NextResponse.json({ error: "El proyecto no tiene un estado definido en su territorio" }, { status: 400 });
  }
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) {
    return NextResponse.json({ error: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` }, { status: 400 });
  }

  const elementos = await resolverElementosDeEstado(indicadorId!, estadoCve, tipoElemento, seleccion);
  if (!elementos) {
    return NextResponse.json({ error: "Este indicador no tiene mecanismo de desglose para este nivel" }, { status: 400 });
  }

  const respuesta: ElementoRespuesta[] = elementos.map(({ cve, nombre, celda }) => ({
    cve,
    nombre,
    ...(esValorDisponible(celda)
      ? { valor: celda.valor, unidad: celda.unidad, naturaleza: celda.naturaleza, fuenteEtiqueta: celda.fuenteEtiqueta }
      : { motivo: celda.motivo }),
  }));

  return NextResponse.json({ valores: respuesta }, { status: 200 });
}

// Batch de valores para una selección Nacional — a diferencia de Estatal
// (un solo estado implícito), aquí la selección puede cruzar hasta 32
// estados: body manda {estadoCve, cve}[], no cve[] plano.
// resolverElementosDeNacional agrupa por estado (nunca N llamadas) —
// verificado en frío con el caso extremo real (2,477 municipios, 32
// estados en paralelo): 5,713ms, mismo rango que la descarga+conversión
// única ya esperada tras el fix de concurrencia de Fase 1.
async function handlePostNacional(body: unknown, indicadorId: string) {
  const b = body as { tipoElemento?: TipoElementoNacional; seleccion?: { estadoCve: string; cve: string }[] } | null;
  const tipoElemento = b?.tipoElemento;
  const seleccion = b?.seleccion;

  if (!tipoElemento || tipoElemento === "estados" || !TIPOS_ELEMENTO_NACIONAL_VALIDOS.includes(tipoElemento)) {
    return NextResponse.json(
      { error: "'tipoElemento' es requerido y debe ser uno de: municipios, distritos_fed, distritos_loc" },
      { status: 400 }
    );
  }
  if (!Array.isArray(seleccion) || seleccion.length === 0) {
    return NextResponse.json({ error: "'seleccion' ({estadoCve, cve}[]) es requerido y no puede estar vacío" }, { status: 400 });
  }

  const elementos = await resolverElementosDeNacional(indicadorId, tipoElemento, seleccion);
  if (!elementos) {
    return NextResponse.json({ error: "Este indicador no tiene mecanismo de desglose para este nivel" }, { status: 400 });
  }

  const respuesta: ElementoNacionalRespuesta[] = elementos.map(({ cve, nombre, estadoCve, celda }) => ({
    cve,
    nombre,
    estadoCve,
    ...(esValorDisponible(celda)
      ? { valor: celda.valor, unidad: celda.unidad, naturaleza: celda.naturaleza, fuenteEtiqueta: celda.fuenteEtiqueta }
      : { motivo: celda.motivo }),
  }));

  return NextResponse.json({ valores: respuesta }, { status: 200 });
}
