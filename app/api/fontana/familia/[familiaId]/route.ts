// app/api/fontana/familia/[familiaId]/route.ts
// GET ?sesionId=  — indicadores de una familia (mínimos + selección del
// usuario) con su valor por nivel geográfico. Un endpoint por familia
// (Arquitectura Paso3 v2, §5.1) — este incremento solo implementa F1;
// las demás responden 400 explícito, no un array vacío silencioso.
//
// Columnas por nivel: el tipo de proyecto decide el patrón ofrecido
// (§5.2) — electoral → Nacional/Estatal/Distrital/Municipal; el resto →
// Nacional/Estatal/Municipal/AGEB. Cierre de Familia 1 (2026-08-02):
// resolverIndicadorFamilia1 ya regresa hasta 4 celdas reales (nacional,
// estatal, distrital, municipal) — este endpoint solo mapea "distrital"
// a "ageb" cuando el proyecto no es electoral (AGEB nunca tuvo mecanismo
// construido, se declara "nivel no cubierto" explícitamente).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { FontanaSesion, FamiliaFontanaId } from "@/types/fontana.types";
import { resolverIndicadorFamilia1 } from "@/lib/fontana/ingesta";
import {
  FONTANA_F1_ECEG_CONFIG,
  resolverDistritalDeMunicipio,
  type CeldaDistritalDeMunicipio,
} from "@/lib/fontana/ingesta/eceg";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { FAMILIA1_NOMBRES, FAMILIA1_ORDEN } from "@/lib/fontana/familia1Catalogo";
import { buildEcegStoragePath, fetchEcegFromStorage } from "@/lib/sefix/ecegStorage";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, getMunicipiosOptions, resolveMunicipioCve, getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import {
  getDistritosFederalesOptions,
  getDistritosLocalesOptions,
  getDistritosFederalesOptionsNacional,
  getDistritosLocalesOptionsNacional,
} from "@/lib/geo/distritos";
import { extraerNumeroDistrito } from "@/lib/moddulo/distritoElectoral";
import {
  columnasParaTipoProyecto,
  MOTIVO_NIVEL_NO_CUBIERTO,
  UMBRAL_PRECARGA_COMPLETA,
  type CeldaTablaFontana,
  type NivelTablaFontana,
  type DesgloseEstatal,
} from "@/lib/fontana/tablaColumnas";

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

  const columnas = columnasParaTipoProyecto(sesion.tipoProyecto, sesion.territorio.nivel);
  const familia = sesion.indicadoresPorFamilia[familiaId as FamiliaFontanaId];
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  const idsOrdenados = FAMILIA1_ORDEN.filter((id) => idsEnSesion.has(id));

  // Composición municipal del distrito — una sola resolución por
  // request (mismo estado/distrito para todos los indicadores de la
  // sesión), no una por indicador. Aplica a distrito_federal y
  // distrito_local (Encargo 1, cierre 2026-08-03).
  const municipiosEnDistrito = await contarMunicipiosEnDistrito(sesion.territorio);
  // Desgloses estatales — mismo criterio (una sola resolución por
  // request, no una por indicador). Aplica a proyectos nivel "estatal"
  // (Encargo 2, cierre 2026-08-04): botón "Ver municipios"/"Ver
  // distritos federales"/"Ver distritos locales".
  const desglosesEstado = await calcularDesglosesEstado(sesion.territorio);
  // Desgloses Nacional — mismo criterio, una sola resolución por request.
  // Aplica a proyectos nivel "nacional" (cierre 2026-08-06): botones "Ver
  // estados"/"Ver distritos federales"/"Ver distritos locales"/"Ver
  // municipios" a escala país.
  const desglosesNacional = await calcularDesglosesNacional(sesion.territorio);
  // Contexto de columnas inversas — resuelve estadoCve+municipioCve UNA
  // sola vez (no por indicador). Aplica a proyectos nivel "municipal"
  // (columnas inversas, cierre 2026-08-05).
  const contextoMunicipal = await prepararContextoMunicipal(sesion.territorio);
  // Tipo del distrito PROPIO del proyecto (celda "distrital" genérica) —
  // para que CoberturaAdvertencia identifique "federal"/"local" en su
  // propio texto (cierre 2026-08-06). Mutuamente exclusivo con
  // contextoMunicipal (nunca un proyecto es distrito_federal/local Y
  // municipal a la vez).
  const tipoDistritoPropio: "federal" | "local" | null =
    sesion.territorio.nivel === "distrito_federal" ? "federal" : sesion.territorio.nivel === "distrito_local" ? "local" : null;

  const indicadores: IndicadorRespuesta[] = await Promise.all(
    idsOrdenados.map(async (id) => {
      const [registro, celdasReales] = await Promise.all([
        getIndicadorRegistro(id),
        resolverIndicadorFamilia1(id, sesion.territorio),
      ]);
      const tieneMecanismoDistrital = id in FONTANA_F1_ECEG_CONFIG;
      const distritalesMunicipio =
        tieneMecanismoDistrital && contextoMunicipal
          ? await Promise.all([
              resolverDistritalDeMunicipio(id, contextoMunicipal.estadoCve, contextoMunicipal.municipioCve, "federal"),
              resolverDistritalDeMunicipio(id, contextoMunicipal.estadoCve, contextoMunicipal.municipioCve, "local"),
            ]).then(([federal, local]) => ({ federal, local }))
          : null;
      const celdas = construirCeldasTabla(
        columnas,
        celdasReales,
        tieneMecanismoDistrital ? municipiosEnDistrito : null,
        tieneMecanismoDistrital ? desglosesEstado : null,
        distritalesMunicipio,
        tipoDistritoPropio,
        tieneMecanismoDistrital ? desglosesNacional : null
      );
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

async function contarMunicipiosEnDistrito(territorio: FontanaSesion["territorio"]): Promise<number | null> {
  if (territorio.nivel !== "distrito_federal" && territorio.nivel !== "distrito_local") return null;
  if (!territorio.estado) return null;

  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) return null;

  const numeroDistrito = extraerNumeroDistrito(territorio.municipio ?? territorio.nombre, territorio.cve_distrito);
  if (!numeroDistrito) return null;

  const nivelStorage = territorio.nivel === "distrito_federal" ? "distritos_municipios" : "distritos_locales_municipios";
  try {
    const path = buildEcegStoragePath(nivelStorage, estadoCve)!;
    const data = await fetchEcegFromStorage<{ composicion: Record<string, Record<string, number>> }>(path);
    const composicion = data.composicion[numeroDistrito];
    return composicion ? Object.keys(composicion).length : null;
  } catch {
    return null;
  }
}

interface DesglosesEstadoTabla {
  municipal: DesgloseEstatal[] | null;
  distrital: DesgloseEstatal[] | null;
}

// Cuenta municipios/distritos federales/distritos locales del ESTADO del
// proyecto (no de un distrito) — solo para proyectos nivel "estatal".
// Cuenta barata: usa las opciones ligeras (cve+nombre) ya cacheadas por
// lib/geo/{municipios,distritos}.ts, sin descargar valores.
async function calcularDesglosesEstado(territorio: FontanaSesion["territorio"]): Promise<DesglosesEstadoTabla> {
  if (territorio.nivel !== "estatal" || !territorio.estado) {
    return { municipal: null, distrital: null };
  }
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) return { municipal: null, distrital: null };

  try {
    const [municipios, distritosFed, distritosLoc] = await Promise.all([
      getMunicipiosOptions(estadoCve),
      getDistritosFederalesOptions(estadoCve),
      getDistritosLocalesOptions(estadoCve),
    ]);
    const modoDe = (total: number): "precarga-completa" | "buscador" =>
      total > UMBRAL_PRECARGA_COMPLETA ? "buscador" : "precarga-completa";

    return {
      municipal: [{ tipo: "municipios", total: municipios.length, modo: modoDe(municipios.length) }],
      distrital: [
        { tipo: "distritos_fed", total: distritosFed.length, modo: modoDe(distritosFed.length) },
        { tipo: "distritos_loc", total: distritosLoc.length, modo: modoDe(distritosLoc.length) },
      ],
    };
  } catch {
    return { municipal: null, distrital: null };
  }
}

interface DesglosesNacionalTabla {
  estatal: DesgloseEstatal[] | null;
  distritalFederal: DesgloseEstatal[] | null;
  distritalLocal: DesgloseEstatal[] | null;
  municipal: DesgloseEstatal[] | null;
}

// Cuenta estados/distritos federales/distritos locales/municipios a
// escala NACIONAL — solo para proyectos nivel "nacional" (cierre
// 2026-08-06). Reutiliza las funciones de agregación nacional ya
// construidas en el Encargo 2 y ya protegidas contra concurrencia en
// Fase 1 (single-flight guard) — primera vez que se llaman desde el
// flujo real de un proyecto, no de forma aislada.
async function calcularDesglosesNacional(territorio: FontanaSesion["territorio"]): Promise<DesglosesNacionalTabla> {
  if (territorio.nivel !== "nacional") {
    return { estatal: null, distritalFederal: null, distritalLocal: null, municipal: null };
  }

  try {
    const [municipios, distritosFed, distritosLoc] = await Promise.all([
      getMunicipiosOptionsNacional(),
      getDistritosFederalesOptionsNacional(),
      getDistritosLocalesOptionsNacional(),
    ]);
    const modoDe = (total: number): "precarga-completa" | "buscador" =>
      total > UMBRAL_PRECARGA_COMPLETA ? "buscador" : "precarga-completa";

    return {
      estatal: [{ tipo: "estados", total: Object.keys(ESTADO_CVE_MAP).length, modo: "precarga-completa" }],
      distritalFederal: [{ tipo: "distritos_fed", total: distritosFed.length, modo: modoDe(distritosFed.length) }],
      distritalLocal: [{ tipo: "distritos_loc", total: distritosLoc.length, modo: modoDe(distritosLoc.length) }],
      municipal: [{ tipo: "municipios", total: municipios.length, modo: modoDe(municipios.length) }],
    };
  } catch {
    return { estatal: null, distritalFederal: null, distritalLocal: null, municipal: null };
  }
}

// Columnas inversas — territorio.municipio ya guarda un nombre limpio
// cuando nivel === "municipal" (a diferencia de distrito_federal/local,
// que guardan una descripción larga con cabecera — ver resolverNombreMunicipio
// en lib/fontana/ingesta/eceg.ts). No hace falta extraer cabecera aquí.
async function prepararContextoMunicipal(
  territorio: FontanaSesion["territorio"]
): Promise<{ estadoCve: string; municipioCve: string } | null> {
  if (territorio.nivel !== "municipal" || !territorio.estado || !territorio.municipio) return null;
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) return null;
  try {
    const municipioCve = await resolveMunicipioCve(estadoCve, territorio.municipio);
    return municipioCve ? { estadoCve, municipioCve } : null;
  } catch {
    return null;
  }
}

interface DistritalesMunicipio {
  federal: CeldaDistritalDeMunicipio;
  local: CeldaDistritalDeMunicipio;
}

// Mapea las hasta 4 celdas reales (nacional/estatal/distrital/municipal,
// de resolverIndicadorFamilia1) al set de columnas de la tabla según el
// tipo de proyecto. "ageb" nunca tiene mecanismo (no electoral) — motivo
// explícito de nivel no cubierto, nunca simulado. "distrital_federal"/
// "distrital_local" (columnas inversas, proyectos Municipal) no vienen
// de celdasReales — se resuelven aparte (distritalesMunicipio) y se
// insertan directo, mismo criterio que ageb de tener su propia rama.
function construirCeldasTabla(
  columnas: NivelTablaFontana[],
  celdasReales: Awaited<ReturnType<typeof resolverIndicadorFamilia1>>,
  municipiosEnDistrito: number | null,
  desglosesEstado: DesglosesEstadoTabla | null,
  distritalesMunicipio: DistritalesMunicipio | null,
  tipoDistritoPropio: "federal" | "local" | null,
  desglosesNacional: DesglosesNacionalTabla | null
): CeldaTablaFontana[] {
  return columnas.map((nivel) => {
    if (nivel === "ageb") {
      return { nivel, motivo: MOTIVO_NIVEL_NO_CUBIERTO };
    }
    if (nivel === "distrital_federal" || nivel === "distrital_local") {
      // Municipal (columnas inversas) y Nacional comparten estas 2
      // columnas pero con fuentes de celda distintas — mutuamente
      // exclusivas por territorio.nivel, nunca ambas presentes a la vez.
      if (distritalesMunicipio) {
        return celdaDesdeDistritalMunicipio(
          nivel,
          nivel === "distrital_federal" ? distritalesMunicipio.federal : distritalesMunicipio.local
        );
      }
      const desgloseNacionalCampo =
        nivel === "distrital_federal" ? desglosesNacional?.distritalFederal : desglosesNacional?.distritalLocal;
      if (desgloseNacionalCampo) {
        return { nivel, motivo: MOTIVO_NIVEL_NO_CUBIERTO, desglosesEstado: desgloseNacionalCampo };
      }
      return { nivel, motivo: MOTIVO_NIVEL_NO_CUBIERTO };
    }
    const real = celdasReales.find((c) => c.nivel === nivel);
    const municipiosEnDistritoField =
      nivel === "municipal" && municipiosEnDistrito != null ? { municipiosEnDistrito } : {};
    const desglosesEstadoField =
      nivel === "municipal" && desglosesEstado?.municipal
        ? { desglosesEstado: desglosesEstado.municipal }
        : nivel === "distrital" && desglosesEstado?.distrital
          ? { desglosesEstado: desglosesEstado.distrital }
          : nivel === "municipal" && desglosesNacional?.municipal
            ? { desglosesEstado: desglosesNacional.municipal }
            : nivel === "estatal" && desglosesNacional?.estatal
              ? { desglosesEstado: desglosesNacional.estatal }
              : {};
    // tipoDistritoPropio — solo la celda "distrital" (el distrito PROPIO
    // del proyecto) lo necesita, para que CoberturaAdvertencia identifique
    // "federal"/"local" en su texto (cierre 2026-08-06).
    const tipoDistritoPropioField =
      nivel === "distrital" && tipoDistritoPropio ? { tipoDistritoPropio } : {};
    if (real && "valor" in real) {
      return {
        nivel,
        valor: real.valor,
        unidad: real.unidad,
        naturaleza: real.naturaleza,
        fuenteEtiqueta: real.fuenteEtiqueta,
        ...(real.coberturaPct != null ? { coberturaPct: real.coberturaPct } : {}),
        ...municipiosEnDistritoField,
        ...desglosesEstadoField,
        ...tipoDistritoPropioField,
      };
    }
    if (real) {
      return { nivel, motivo: real.motivo, ...municipiosEnDistritoField, ...desglosesEstadoField };
    }
    return { nivel, motivo: MOTIVO_NIVEL_NO_CUBIERTO, ...municipiosEnDistritoField, ...desglosesEstadoField };
  });
}

// Traduce CeldaDistritalDeMunicipio (lib/fontana/ingesta/eceg.ts) a
// CeldaTablaFontana — los 3 casos de diseño de columnas inversas:
// dominante (valor + nota de %), cobertura incompleta (motivo +
// municipioCoberturaPct, dispara CoberturaAdvertencia en la UI), sin
// dominante (motivo + desglosesEstado con 1 elemento, dispara el mismo
// botón/componente ya construido para el caso Estatal).
function celdaDesdeDistritalMunicipio(
  nivel: "distrital_federal" | "distrital_local",
  celda: CeldaDistritalDeMunicipio | undefined
): CeldaTablaFontana {
  if (!celda) return { nivel, motivo: MOTIVO_NIVEL_NO_CUBIERTO };
  if (celda.valor !== undefined) {
    return {
      nivel,
      valor: celda.valor,
      unidad: celda.unidad,
      naturaleza: celda.naturaleza,
      fuenteEtiqueta: celda.fuenteEtiqueta,
      ...(celda.municipioEnDistritoPct != null ? { municipioEnDistritoPct: celda.municipioEnDistritoPct } : {}),
    };
  }
  return {
    nivel,
    motivo: celda.motivo ?? MOTIVO_NIVEL_NO_CUBIERTO,
    ...(celda.municipioCoberturaPct != null ? { municipioCoberturaPct: celda.municipioCoberturaPct } : {}),
    ...(celda.desglose ? { desglosesEstado: [{ ...celda.desglose, modo: "precarga-completa" as const }] } : {}),
  };
}
