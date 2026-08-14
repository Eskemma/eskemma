// app/api/fontana/familia/[familiaId]/route.ts
// GET ?sesionId=  — indicadores de una familia (mínimos + selección del
// usuario) con su valor por nivel geográfico. Un endpoint por familia
// (Arquitectura Paso3 v2, §5.1) — F1 y F2 implementadas (Incremento 1 de
// Familia 2, 2026-08-07); F3-F5 responden 400 explícito, no un array
// vacío silencioso.
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
import type { FontanaSesion, FamiliaFontanaId } from "@/types/fontana.types";
import { resolverIndicadorFontana, resolverDistritalDeMunicipioPonderado } from "@/lib/fontana/ingesta";
import {
  FONTANA_ECEG_CONFIG,
  resolverDistritalDeMunicipio,
  type CeldaDistritalDeMunicipio,
} from "@/lib/fontana/ingesta/eceg";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { FAMILIA1_NOMBRES, FAMILIA1_ORDEN } from "@/lib/fontana/familia1Catalogo";
import { FAMILIA2_NOMBRES, FAMILIA2_ORDEN } from "@/lib/fontana/familia2Catalogo";
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

// Fuentes no-ECEG con mecanismo real de "Ver municipios" en proyectos
// Estatal (2026-08-08) — ver resolverDesgloseMunicipiosEstado en
// lib/fontana/ingesta/index.ts, único punto de ruteo por fuente para
// este mecanismo. Nunca implica distrital (esas fuentes no publican por
// distrito electoral) — el gate de abajo lo aplica solo a `.municipal`.
// pnud_idh/pnud_se/pnud_si/pnud_idg agregados en la revisión de
// consistencia del Incremento 4 (2026-08-10) — nunca se habían
// conectado pese a que pnud.ts sí tiene mecanismo real de "Ver
// municipios" desde ese mismo incremento.
const FUENTES_DESGLOSE_MUNICIPAL_EXTRA = new Set([
  "conapo_marginacion", "bienestar_ckan", "coneval_pobreza", "coneval_irs", "icmm",
  "pnud_idh", "pnud_se", "pnud_si", "pnud_idg",
]);

// Índices nacionales completos (2026-08-09) — por INDICADOR, no por
// fuenteSlug: CONAPO y CONEVAL tienen indicadores en ambos grupos (ej.
// F2-3/F2-4 son índices compuestos, sin mecanismo de agregación
// municipio→distrito; F2-1/F2-2/F2-14 sí lo tienen), así que un gate
// por fuenteSlug no distinguiría correctamente. F2-8 (Bienestar) fuera
// de ambos — diferido, misma varianza de red ya documentada. F2-18
// (ICMM, Incremento 3) agregado 2026-08-09 — mismo grupo que F2-3/F2-4:
// índice municipal completo disponible, pero sin agregación distrital.
// F2-5/19/20/21/22 (PNUD) agregados en BUG NUEVO 2 (revisión de
// consistencia 3ª ronda, 2026-08-12) — PNUD sí publica dato municipal
// real (Municipal-confirmado, Nacional/Estatal/Distrital no_viable por
// ser índice compuesto), mismo perfil que F2-1/F2-7 en este Set.
// Verificado que este Set NO alimenta el gate de "Ver estados"
// (soportaDesgloseEstadosNacional usa su propio Set independiente,
// INDICADORES_ESTADOS_NACIONAL, sin ningún OR compartido — a diferencia
// del Problema #1 original, aquí no hay riesgo de reabrir ese gate).
const INDICADORES_MUNICIPAL_NACIONAL = new Set([
  "F2-4", "F2-1", "F2-2", "F2-3", "F2-14", "F2-7", "F2-18",
  "F2-5", "F2-19", "F2-20", "F2-21", "F2-22",
]);
// F2-18 (ICMM) agregado en la revisión de consistencia del Incremento 4
// (2026-08-10): es una magnitud monetaria (promedio), no un índice
// compuesto sin recombinación como F2-3/F2-4 — sí admite suma ponderada
// por población municipio→distrito (mismo criterio que F2-7), ver
// calcularValorDistritoPonderado en lib/fontana/ingesta/index.ts para
// el criterio general documentado ahí.
const INDICADORES_DISTRITAL_NACIONAL = new Set(["F2-1", "F2-2", "F2-7", "F2-14", "F2-18"]);

// "Ver estados" en Nacional (2026-08-09, revisado 2026-08-10 y de nuevo
// en la revisión de consistencia 2ª ronda 2026-08-12 — Problema #1
// original, seguía roto tras el primer fix). Lista completa y explícita
// de indicadores con mecanismo real en resolverDesgloseEstadosNacional
// (lib/fontana/ingesta/index.ts) — NUNCA acoplada a soportaDesgloseMunicipal:
// el primer fix (`soportaDesgloseMunicipal || INDICADORES_ESTADOS_NACIONAL.has(id)`)
// parecía correcto porque los 7 nuevos (ENIGH/STPS/ENOE/IMCO) no tenían
// mecanismo municipal, pero cuando el fix de "Ver municipios" agregó
// pnud_idh/pnud_se/pnud_si/pnud_idg a FUENTES_DESGLOSE_MUNICIPAL_EXTRA,
// el OR volvió a encender "Ver estados" para PNUD (F2-5/19/20/21/22) —
// que NO tiene el mecanismo (Nacional/Estatal son no_viable para PNUD,
// índice compuesto). Confirmado con datos reales: PNUD no aparece en
// ninguna rama de resolverDesgloseEstadosNacional. F2-1/F2-2/F2-3/F2-4/
// F2-7/F2-14/F2-18 sí tienen el mecanismo desde antes (por eso el
// acoplamiento parecía funcionar) — se agregan aquí explícitamente en
// vez de depender de un proxy indirecto.
const INDICADORES_ESTADOS_NACIONAL = new Set([
  "F2-1", "F2-2", "F2-3", "F2-4", "F2-7", "F2-14", "F2-18",
  "F2-6", "F2-9", "F2-10", "F2-12", "F2-15", "F2-16", "F2-17",
]);

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

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion } = cargada;

  if (familiaId !== "F1" && familiaId !== "F2") {
    return NextResponse.json(
      { error: "familia_no_disponible", mensaje: `Familia ${familiaId} aún no está disponible en Fontana.` },
      { status: 400 }
    );
  }
  const [ordenFamilia, nombresFamilia] =
    familiaId === "F2" ? [FAMILIA2_ORDEN, FAMILIA2_NOMBRES] : [FAMILIA1_ORDEN, FAMILIA1_NOMBRES];

  const columnas = columnasParaTipoProyecto(sesion.tipoProyecto, sesion.territorio.nivel);
  const familia = sesion.indicadoresPorFamilia[familiaId as FamiliaFontanaId];
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  const idsOrdenados = ordenFamilia.filter((id) => idsEnSesion.has(id));

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
        resolverIndicadorFontana(id, sesion.territorio),
      ]);
      const tieneMecanismoDistrital = id in FONTANA_ECEG_CONFIG;
      // Desglose "Ver municipios" en proyectos Estatal — generalizado más
      // allá de ECEG (2026-08-08): CONAPO/Bienestar sí tienen dato
      // municipal real, aunque nunca distrital (esas fuentes no publican
      // por distrito electoral). Gate POR COLUMNA, no por indicador
      // completo — nunca se ofrece "Ver distritos federales/locales" para
      // estas fuentes. municipiosEnDistrito/desglosesNacional/columnas
      // inversas Municipal se quedan ECEG-only por ahora (deferido,
      // requieren mecanismo de composición sección→distrito o índice
      // nacional que CONAPO/Bienestar no tienen listo).
      const soportaDesgloseMunicipal =
        tieneMecanismoDistrital || FUENTES_DESGLOSE_MUNICIPAL_EXTRA.has(registro?.fuenteSlug ?? "");
      // "Ver distritos federales/locales" en proyectos Estatal para F2-18
      // y las demás fuentes con recombinación ponderada válida (Hallazgo
      // E, revisión de consistencia 2ª ronda, 2026-08-12) — antes
      // `distrital` se forzaba a null para CUALQUIER indicador no-ECEG,
      // aunque calcularValorDistritoPonderado (index.ts) ya soporta a
      // F2-1/F2-2/F2-7/F2-14/F2-18 (INDICADORES_DISTRITAL_NACIONAL). El
      // endpoint que resuelve los valores al abrir el modal
      // (municipios/route.ts, handleGetEstado) tiene el fix simétrico.
      const soportaDesgloseDistritalEstatal = INDICADORES_DISTRITAL_NACIONAL.has(id);
      const desglosesEstadoIndicador = tieneMecanismoDistrital
        ? desglosesEstado
        : soportaDesgloseMunicipal || soportaDesgloseDistritalEstatal
          ? {
              municipal: soportaDesgloseMunicipal ? desglosesEstado.municipal : null,
              distrital: soportaDesgloseDistritalEstatal ? desglosesEstado.distrital : null,
            }
          : null;
      // "Ver estados" en proyectos Nacional (2026-08-09) — gate
      // desacoplado de soportaDesgloseMunicipal (ver comentario junto a
      // INDICADORES_ESTADOS_NACIONAL arriba; F2-8 diferido, ya no incluido
      // en el Set). .distritalFederal/.distritalLocal/.municipal de
      // Nacional siguen ECEG-only para F1 (deferido, requieren índice
      // nacional de 300/679/2,477 que esas fuentes no tienen construido).
      const soportaDesgloseEstadosNacional = INDICADORES_ESTADOS_NACIONAL.has(id);
      // Municipal/Distrital Federal/Local nacional (2026-08-09) — gate
      // por indicador (no por fuenteSlug, ver comentario junto a
      // INDICADORES_MUNICIPAL_NACIONAL arriba). F2-3/F2-4 (índices
      // compuestos) obtienen Municipal pero NUNCA Distrital — mismo
      // criterio que su propio Nacional (sin metodología de agregación
      // válida para un índice compuesto).
      const soportaMunicipalNacional = tieneMecanismoDistrital || INDICADORES_MUNICIPAL_NACIONAL.has(id);
      const soportaDistritalNacional = tieneMecanismoDistrital || INDICADORES_DISTRITAL_NACIONAL.has(id);
      const desglosesNacionalIndicador = tieneMecanismoDistrital
        ? desglosesNacional
        : soportaDesgloseEstadosNacional || soportaMunicipalNacional || soportaDistritalNacional
          ? {
              estatal: soportaDesgloseEstadosNacional ? desglosesNacional.estatal : null,
              distritalFederal: soportaDistritalNacional ? desglosesNacional.distritalFederal : null,
              distritalLocal: soportaDistritalNacional ? desglosesNacional.distritalLocal : null,
              municipal: soportaMunicipalNacional ? desglosesNacional.municipal : null,
            }
          : null;
      // Desglose municipal ("Ver datos municipales") en proyectos
      // distrito_federal/distrito_local (2026-08-09) — municipiosEnDistrito
      // es 100% geografía (cuenta de distritos_municipios/{estado}.json,
      // sin ninguna dependencia de ECEG), su gate pasa de
      // tieneMecanismoDistrital a soportaDesgloseMunicipal.
      // Columnas inversas para fuentes no-ECEG con recombinación ponderada
      // válida (Hallazgo A, revisión de consistencia 2ª ronda,
      // 2026-08-12) — mismo Set que INDICADORES_DISTRITAL_NACIONAL
      // (F2-1/F2-2/F2-7/F2-14/F2-18), la única diferencia con "Ver
      // distritos" en Nacional es que aquí el municipio del proyecto ya
      // fija el estado+municipio, solo falta clasificar el distrito
      // dominante — ver resolverDistritalDeMunicipioPonderado (index.ts).
      const soportaColumnasInversasPonderado = INDICADORES_DISTRITAL_NACIONAL.has(id);
      const distritalesMunicipio =
        contextoMunicipal && (tieneMecanismoDistrital || soportaColumnasInversasPonderado)
          ? tieneMecanismoDistrital
            ? await Promise.all([
                resolverDistritalDeMunicipio(id, contextoMunicipal.estadoCve, contextoMunicipal.municipioCve, "federal"),
                resolverDistritalDeMunicipio(id, contextoMunicipal.estadoCve, contextoMunicipal.municipioCve, "local"),
              ]).then(([federal, local]) => ({ federal, local }))
            : await Promise.all([
                resolverDistritalDeMunicipioPonderado(id, contextoMunicipal.estadoCve, contextoMunicipal.municipioCve, "federal"),
                resolverDistritalDeMunicipioPonderado(id, contextoMunicipal.estadoCve, contextoMunicipal.municipioCve, "local"),
              ]).then(([federal, local]) => ({ federal, local }))
          : null;
      const celdas = construirCeldasTabla(
        columnas,
        celdasReales,
        soportaDesgloseMunicipal ? municipiosEnDistrito : null,
        desglosesEstadoIndicador,
        distritalesMunicipio,
        tipoDistritoPropio,
        desglosesNacionalIndicador
      );
      return {
        id,
        nombre: registro?.nombre ?? nombresFamilia[id] ?? id,
        definicion: registro?.definicion,
        fuenteEtiqueta: registro?.fuenteEtiqueta,
        esMinimo: familia.minimos.includes(id),
        celdas,
      };
    })
  );

  return NextResponse.json({ familiaId, columnas, indicadores }, { status: 200 });
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
// de resolverIndicadorFontana) al set de columnas de la tabla según el
// tipo de proyecto. "ageb" nunca tiene mecanismo (no electoral) — motivo
// explícito de nivel no cubierto, nunca simulado. "distrital_federal"/
// "distrital_local" (columnas inversas, proyectos Municipal) no vienen
// de celdasReales — se resuelven aparte (distritalesMunicipio) y se
// insertan directo, mismo criterio que ageb de tener su propia rama.
function construirCeldasTabla(
  columnas: NivelTablaFontana[],
  celdasReales: Awaited<ReturnType<typeof resolverIndicadorFontana>>,
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
      // Hallazgo D (revisión de consistencia 2ª ronda, 2026-08-12): en
      // proyectos Nacional con "Ver distritos" real y navegable
      // (desgloseNacionalCampo con total>0), el motivo NO puede ser el
      // genérico "no cubierto todavía" — es contradictorio con un enlace
      // funcional. Mismo patrón informativo ya usado en la celda propia
      // de un proyecto distrito_federal/distrito_local sin territorio
      // definido, adaptado a "usa el enlace" en vez de "define tu
      // territorio".
      const desgloseNacionalCampo =
        nivel === "distrital_federal" ? desglosesNacional?.distritalFederal : desglosesNacional?.distritalLocal;
      if (desgloseNacionalCampo) {
        return {
          nivel,
          motivo: "Este proyecto es de nivel Nacional — no tiene un distrito propio. Usa el enlace para consultar un distrito específico.",
          desglosesEstado: desgloseNacionalCampo,
        };
      }
      // Hallazgo B/C (revisión de consistencia 2ª ronda, 2026-08-12):
      // sin mecanismo de columnas inversas ni de "Ver distritos" Nacional
      // para este indicador, el texto correcto es el motivo REAL ya
      // calculado por el adaptador para la celda "distrital" genérica
      // (resolverIndicadorFontana/completarA4Celdas) — nunca el genérico
      // "no cubierto en este incremento", que suena a pendiente de
      // desarrollo cuando en realidad es una limitación permanente de la
      // fuente (PNUD: índice compuesto sin metodología válida; ENIGH/
      // IMCO/STPS: fuente sin granularidad municipal/distrital).
      const celdaDistritalReal = celdasReales.find((c) => c.nivel === "distrital");
      const motivoReal = celdaDistritalReal && "motivo" in celdaDistritalReal ? celdaDistritalReal.motivo : undefined;
      return { nivel, motivo: motivoReal ?? MOTIVO_NIVEL_NO_CUBIERTO };
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
    // BUG NUEVO 3 (revisión de consistencia 3ª ronda, 2026-08-12) — mismo
    // patrón que Hallazgo D (ronda anterior), aplicado aquí a la columna
    // "distrital" ordinaria de un proyecto Estatal: cuando SÍ hay un
    // desglose real navegable ("Ver distritos federales/locales", ya
    // poblado por Hallazgo E) pero la celda propia no trae valor, el
    // motivo real del adaptador ("mecanismo no disponible"/"no cubierto")
    // es contradictorio con un enlace funcional — usar el mismo texto
    // informativo que Hallazgo D en vez de `real.motivo` tal cual.
    if (real && nivel === "distrital" && "desglosesEstado" in desglosesEstadoField) {
      return {
        nivel,
        motivo: "Este proyecto es de nivel Estatal — no tiene un distrito propio. Usa el enlace para consultar un distrito específico.",
        ...municipiosEnDistritoField,
        ...desglosesEstadoField,
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
