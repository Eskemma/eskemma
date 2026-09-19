// lib/fontana/tabla/construirCeldasTabla.ts
//
// Extraído de app/api/fontana/familia/[familiaId]/route.ts (26-09-13) —
// refactor SIN cambio de comportamiento. La ruta original acoplaba esta
// lógica a una FontanaSesion (`sesion.territorio`/`sesion.tipoProyecto`),
// pero toda la lógica real ya operaba solo sobre `Territorio`/`ProjectType`
// — se extrae para que un llamador SIN sesión de Fontana (ej. la
// integración con PESTEL, `app/api/fontana/insumos-pestel/route.ts`)
// pueda resolver celdas para un `Territorio` ad-hoc, reutilizando
// exactamente el mismo cálculo de columnas/desgloses/agregación plural
// que ya usa la tabla comparativa.
//
// `resolverCeldasParaTerritorio` es el punto de entrada nuevo. La ruta
// original pasa a ser un wrapper delgado que la llama con
// `sesion.territorio`/`sesion.tipoProyecto` y le añade `esMinimo` (que sí
// depende de la sesión) después.

import { resolverIndicadorFontana, resolverDistritalDeMunicipioPonderado, resolverAgregacionPlural, desgloseEstatalParaEstados } from "@/lib/fontana/ingesta";
import { esTerritorioParcial } from "@/lib/moddulo/territorioPlural";
import { estadosDelTerritorio } from "@/lib/fontana/geo/estadosDelTerritorio";
import {
  FONTANA_ECEG_CONFIG,
  resolverDistritalDeMunicipio,
  type CeldaDistritalDeMunicipio,
} from "@/lib/fontana/ingesta/eceg";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { tieneSerie } from "@/lib/fontana/series/seriesDisponibles";
import { buildEcegStoragePath, fetchEcegFromStorage } from "@/lib/sefix/ecegStorage";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { getMunicipiosOptions, resolveMunicipioCve, getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
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
  MOTIVO_TIMEOUT_REPORTE,
  UMBRAL_PRECARGA_COMPLETA,
  type CeldaTablaFontana,
  type NivelTablaFontana,
  type DesgloseEstatal,
} from "@/lib/fontana/tablaColumnas";
import { resolverEstadoCve } from "@/lib/geo/estados";
import type { Territorio } from "@/types/shared.types";
import type { ProjectType } from "@/types/moddulo.types";

// Ver comentarios originales en la ruta — mismos Sets, sin cambio.
const FUENTES_DESGLOSE_MUNICIPAL_EXTRA = new Set([
  "conapo_marginacion", "bienestar_ckan", "coneval_pobreza", "coneval_irs", "icmm",
  "pnud_idh", "pnud_se", "pnud_si", "pnud_idg",
]);
const INDICADORES_MUNICIPAL_NACIONAL = new Set([
  "F2-4", "F2-1", "F2-2", "F2-3", "F2-14", "F2-7", "F2-18",
  "F2-5", "F2-19", "F2-20", "F2-21", "F2-22",
]);
const INDICADORES_DISTRITAL_NACIONAL = new Set(["F2-1", "F2-2", "F2-7", "F2-14", "F2-18"]);
const INDICADORES_ESTADOS_NACIONAL = new Set([
  "F2-1", "F2-2", "F2-3", "F2-4", "F2-7", "F2-14", "F2-18",
  "F2-6", "F2-9", "F2-10", "F2-12", "F2-15", "F2-16", "F2-17",
]);
const INDICADORES_ESTATAL_ALCANCE_PLURAL = new Set(["F2-17", "F2-6", "F2-15", "F2-16"]);

export interface IndicadorCeldasResuelto {
  id: string;
  nombre: string;
  definicion?: string;
  fuenteEtiqueta?: string;
  tieneSerie: boolean;
  celdas: CeldaTablaFontana[];
}

/**
 * Resuelve las celdas de la tabla comparativa para una lista de
 * indicadores y un `Territorio` + `ProjectType` — sin depender de una
 * FontanaSesion. Mismo cálculo (columnas por tipo de proyecto, desgloses,
 * agregación plural) que ya usaba `app/api/fontana/familia/[familiaId]/route.ts`.
 */
export async function resolverCeldasParaTerritorio(
  indicadorIds: string[],
  territorio: Territorio,
  tipoProyecto: ProjectType,
  opts?: { timeoutMs?: number }
): Promise<IndicadorCeldasResuelto[]> {
  const timeoutMs = opts?.timeoutMs ?? 0;
  const columnas = columnasParaTipoProyecto(tipoProyecto, territorio.nivel);

  const municipiosEnDistrito = await contarMunicipiosEnDistrito(territorio);
  const desglosesEstado = await calcularDesglosesEstado(territorio);
  const desglosesNacional = await calcularDesglosesNacional(territorio);
  const contextoMunicipal = await prepararContextoMunicipal(territorio);
  const tipoDistritoPropio: "federal" | "local" | null =
    territorio.nivel === "distrito_federal" ? "federal" : territorio.nivel === "distrito_local" ? "local" : null;

  const NIVELES_TIMEOUT: NivelTablaFontana[] = ["nacional", "estatal", "distrital", "municipal"];
  const resolverCeldas = async (
    id: string
  ): Promise<{ celdas: Awaited<ReturnType<typeof resolverIndicadorFontana>>; timedOut: boolean }> => {
    if (timeoutMs <= 0) {
      return { celdas: await resolverIndicadorFontana(id, territorio), timedOut: false };
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const TIMEOUT = Symbol("timeout");
    try {
      const r = await Promise.race([
        resolverIndicadorFontana(id, territorio),
        new Promise<typeof TIMEOUT>((res) => {
          timer = setTimeout(() => res(TIMEOUT), timeoutMs);
        }),
      ]);
      if (r === TIMEOUT) {
        console.warn(`[fontana/tabla] timeout (${timeoutMs}ms) resolviendo ${id}`);
        return {
          celdas: NIVELES_TIMEOUT.map((nivel) => ({ nivel, motivo: MOTIVO_TIMEOUT_REPORTE })) as Awaited<
            ReturnType<typeof resolverIndicadorFontana>
          >,
          timedOut: true,
        };
      }
      return { celdas: r, timedOut: false };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  return Promise.all(
    indicadorIds.map(async (id) => {
      const [registro, resuelto] = await Promise.all([
        getIndicadorRegistro(id),
        resolverCeldas(id),
      ]);
      const celdasReales = resuelto.celdas;
      const tieneMecanismoDistrital = id in FONTANA_ECEG_CONFIG;
      const soportaDesgloseMunicipal =
        tieneMecanismoDistrital || FUENTES_DESGLOSE_MUNICIPAL_EXTRA.has(registro?.fuenteSlug ?? "");
      const soportaDesgloseDistritalEstatal = INDICADORES_DISTRITAL_NACIONAL.has(id);
      const desglosesEstadoIndicador = tieneMecanismoDistrital
        ? desglosesEstado
        : soportaDesgloseMunicipal || soportaDesgloseDistritalEstatal
          ? {
              municipal: soportaDesgloseMunicipal ? desglosesEstado.municipal : null,
              distrital: soportaDesgloseDistritalEstatal ? desglosesEstado.distrital : null,
            }
          : null;
      const soportaDesgloseEstadosNacional = INDICADORES_ESTADOS_NACIONAL.has(id);
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

      const usaResolverPropio = registro?.agregacionPlural?.resolverPropio === true;
      if (esTerritorioParcial(territorio) && !usaResolverPropio && !resuelto.timedOut) {
        const resultadoPlural = await resolverAgregacionPlural(id, territorio);
        if (resultadoPlural) {
          const nivelObjetivo =
            territorio.nivel === "estatal" ? "estatal"
            : territorio.nivel === "municipal" ? "municipal"
            : "distrital";
          const celdaObjetivo = celdas.find((c) => c.nivel === nivelObjetivo);
          if (celdaObjetivo) {
            celdaObjetivo.agregacionPlural = {
              valorAgregado: resultadoPlural.valorAgregado,
              desglosePorUnidad: resultadoPlural.desglosePorUnidad,
              noResueltas: resultadoPlural.noResueltas,
              tipoCalculo: registro?.agregacionPlural?.tipo,
            };
            const agregado = resultadoPlural.valorAgregado;
            celdaObjetivo.valor = undefined;
            celdaObjetivo.unidad = undefined;
            celdaObjetivo.naturaleza = undefined;
            celdaObjetivo.fuenteEtiqueta = undefined;
            celdaObjetivo.motivo = undefined;
            if (agregado && "valor" in agregado) {
              celdaObjetivo.valor = agregado.valor;
              celdaObjetivo.unidad = agregado.unidad;
              celdaObjetivo.naturaleza = agregado.naturaleza;
              celdaObjetivo.fuenteEtiqueta = agregado.fuenteEtiqueta;
              if (resultadoPlural.zonaMetropolitanaDetectada) {
                celdaObjetivo.zonaMetropolitana = resultadoPlural.zonaMetropolitanaDetectada;
              }
            } else {
              celdaObjetivo.motivo =
                agregado?.motivo ?? "Sin valor combinado disponible para este indicador";
            }
          }
        }
      }

      if (
        INDICADORES_ESTATAL_ALCANCE_PLURAL.has(id) &&
        territorio.nivel !== "estatal" &&
        !resuelto.timedOut
      ) {
        const estados = estadosDelTerritorio(territorio);
        if (estados.length > 1) {
          const d = await desgloseEstatalParaEstados(id, estados);
          const celdaEstatal = celdas.find((c) => c.nivel === "estatal");
          if (celdaEstatal && (d.desglosePorUnidad.length > 0 || d.noResueltas.length > 0)) {
            celdaEstatal.valor = undefined;
            celdaEstatal.unidad = undefined;
            celdaEstatal.naturaleza = undefined;
            celdaEstatal.fuenteEtiqueta = undefined;
            celdaEstatal.motivo =
              d.valorAgregado && "motivo" in d.valorAgregado
                ? d.valorAgregado.motivo
                : `Este indicador es estatal y tu proyecto abarca ${estados.length} estados (${estados.join(", ")}). No es un promedio ni cubre a todos por igual — abre el desglose para ver el valor de cada estado.`;
            celdaEstatal.agregacionPlural = {
              valorAgregado: d.valorAgregado,
              desglosePorUnidad: d.desglosePorUnidad,
              noResueltas: d.noResueltas,
              tipoCalculo: registro?.agregacionPlural?.tipo,
            };
          }
        }
      }

      return {
        id,
        nombre: registro?.nombre ?? id,
        definicion: registro?.definicion,
        fuenteEtiqueta: registro?.fuenteEtiqueta,
        tieneSerie: tieneSerie(id),
        celdas,
      };
    })
  );
}

async function contarMunicipiosEnDistrito(territorio: Territorio): Promise<number | null> {
  if (territorio.nivel !== "distrito_federal" && territorio.nivel !== "distrito_local") return null;
  if (!territorio.estado) return null;

  const estadoCve = resolverEstadoCve(territorio.estado);
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

async function calcularDesglosesEstado(territorio: Territorio): Promise<DesglosesEstadoTabla> {
  if (territorio.nivel !== "estatal" || !territorio.estado) {
    return { municipal: null, distrital: null };
  }
  const estadoCve = resolverEstadoCve(territorio.estado);
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

async function calcularDesglosesNacional(territorio: Territorio): Promise<DesglosesNacionalTabla> {
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

async function prepararContextoMunicipal(
  territorio: Territorio
): Promise<{ estadoCve: string; municipioCve: string } | null> {
  if (territorio.nivel !== "municipal" || !territorio.estado || !territorio.municipio) return null;
  const estadoCve = resolverEstadoCve(territorio.estado);
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
      if (distritalesMunicipio) {
        return celdaDesdeDistritalMunicipio(
          nivel,
          nivel === "distrital_federal" ? distritalesMunicipio.federal : distritalesMunicipio.local
        );
      }
      const desgloseNacionalCampo =
        nivel === "distrital_federal" ? desglosesNacional?.distritalFederal : desglosesNacional?.distritalLocal;
      if (desgloseNacionalCampo) {
        return {
          nivel,
          motivo: "Este proyecto es de nivel Nacional — no tiene un distrito propio. Usa el enlace para consultar un distrito específico.",
          desglosesEstado: desgloseNacionalCampo,
        };
      }
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
        ...(real.zonaMetropolitana ? { zonaMetropolitana: real.zonaMetropolitana } : {}),
        ...(real.areaEnsu ? { areaEnsu: real.areaEnsu } : {}),
        ...(real.distribucion ? { distribucion: real.distribucion } : {}),
        ...(real.distribucionSexo ? { distribucionSexo: real.distribucionSexo } : {}),
        ...municipiosEnDistritoField,
        ...desglosesEstadoField,
        ...tipoDistritoPropioField,
      };
    }
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
