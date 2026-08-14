// lib/fontana/ingesta/index.ts
// Dispatcher de indicadores de Fontana — enruta cada indicador al
// adaptador que lo resuelve, sin importar a qué familia pertenece (el ID
// del indicador ya es único en todo el catálogo). Único punto que
// app/api/fontana/familia/[familiaId]/route.ts necesita importar; agregar
// una fuente nueva no requiere tocar la ruta. Renombrado de
// resolverIndicadorFamilia1 → resolverIndicadorFontana al abrir Familia 2
// (Incremento 1, 2026-08-07) — el dispatcher nunca fue exclusivo de
// Familia 1, solo lo parecía porque era la única familia con indicadores
// reales hasta ahora.

import {
  resolverIndicadorECEG as resolverIndicadorF1Eceg,
  FONTANA_ECEG_CONFIG,
  MOTIVO_CONECTOR_PENDIENTE,
  resolverElementosDeEstado,
  resolverMunicipiosDeDistrito,
  resolverEstadosNacional,
  resolverElementosDeNacional,
  getOpcionesElementoEstado,
  clasificarDistritoDeMunicipio,
  type ElementoDeEstado,
  type ElementoDeNacional,
  type MunicipioDeDistrito,
  type TipoDistrito,
  type TipoElementoNacional,
  type DistritosMunicipiosStorage,
  type CeldaDistritalDeMunicipio,
} from "@/lib/fontana/ingesta/eceg";
import { buildEcegStoragePath, fetchEcegFromStorage } from "@/lib/sefix/ecegStorage";
import { esValorDisponible } from "@/lib/fontana/ingesta/types";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import { extraerNumeroDistrito } from "@/lib/moddulo/distritoElectoral";
import { resolverIndicadorIter } from "@/lib/fontana/ingesta/iter";
import { resolverDensidad } from "@/lib/fontana/ingesta/compendio";
import { resolverRazonDependencia } from "@/lib/fontana/ingesta/conapo";
import { resolverRemesasPerCapita } from "@/lib/fontana/ingesta/banxico";
import {
  resolverIndiceMarginacion,
  resolverMunicipiosEstadoMarginacion,
  resolverEstadosMarginacion,
} from "@/lib/fontana/ingesta/conapoMarginacion";
import {
  resolverBeneficiariosProduccion,
  resolverBeneficiariosBecaBJ,
  resolverMunicipiosEstadoProduccion,
  resolverMunicipiosEstadoBecaBJ,
  resolverEstadosProduccion,
  // resolverEstadosBecaBJ existe (bienestar.ts) pero NO se conecta aquí
  // — DIFERIDO 2026-08-09 tras investigar la varianza real entre
  // corridas (8.0s-29.9s, 8 mediciones independientes, ver comentario
  // completo junto a resolverEstadosBecaBJ en bienestar.ts): causa
  // externa no controlable (latencia variable de datos.gob.mx), no un
  // bug propio — mismo criterio de "diferido documentado" que ENOE.
} from "@/lib/fontana/ingesta/bienestar";
import {
  resolverPobreza,
  resolverPobrezaExtrema,
  resolverRezagoSocial,
  resolverCarenciaSocial,
  resolverMunicipiosEstadoPobreza,
  resolverMunicipiosEstadoPobrezaExtrema,
  resolverMunicipiosEstadoRezagoSocial,
  resolverMunicipiosEstadoCarenciaSocial,
  resolverEstadosPobreza,
  resolverEstadosPobrezaExtrema,
  resolverEstadosCarenciaSocial,
  resolverEstadosRezagoSocial,
  resolverNumeradorDenominadorMunicipios,
  FUENTE_ETIQUETA_CONEVAL_POBREZA,
} from "@/lib/fontana/ingesta/coneval";
import {
  resolverIngresoCorrienteMunicipal,
  resolverMunicipiosEstadoIcmm,
  resolverEstadosIcmm,
} from "@/lib/fontana/ingesta/icmm";
import {
  resolverCompetitividadEstatal,
  resolverEstadosImcoIce,
} from "@/lib/fontana/ingesta/imco";
import {
  resolverGini,
  resolverDecilesIngreso,
  resolverGastoSalud,
  resolverGastoEducacion,
  resolverEstadosGini,
  resolverEstadosDeciles,
  resolverEstadosGastoSalud,
  resolverEstadosGastoEducacion,
} from "@/lib/fontana/ingesta/enigh";
import {
  resolverSalarioImss,
  resolverEstadosStpsSalario,
} from "@/lib/fontana/ingesta/stpsSalario";
import {
  resolverIdhMunicipal,
  resolverSaludMunicipal,
  resolverEducacionMunicipal,
  resolverIngresoMunicipal,
  resolverIdgMunicipal,
  resolverMunicipiosEstadoIdh,
  resolverMunicipiosEstadoSalud,
  resolverMunicipiosEstadoEducacion,
  resolverMunicipiosEstadoIngreso,
  resolverMunicipiosEstadoIdg,
} from "@/lib/fontana/ingesta/pnud";
import {
  resolverInformalidadLaboral,
  resolverEstadosInformalidadLaboral,
} from "@/lib/fontana/ingesta/enoeInformalidad";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

const MOTIVO_NIVEL_NO_CUBIERTO_ITER_COMPENDIO_ETC =
  "Nivel no cubierto — mecanismo de agregación no disponible para esta fuente";

// Los adaptadores fuera de ECEG (ITER, Compendio, Banxico, CONAPO) solo
// resuelven estatal/municipal — Nacional/Distrital no tienen mecanismo
// construido para ellos (investigación previa, cierre de Familia 1:
// ITER no viene por sección, Compendio es municipal, Banxico/CONAPO no
// bajan de entidad). Se completan aquí con motivo explícito para que el
// contrato de salida sea siempre 4 celdas, sin tocar cada adaptador.
function completarA4Celdas(celdas: CeldaFontana[]): CeldaFontana[] {
  const porNivel = new Map(celdas.map((c) => [c.nivel, c] as const));
  return (["nacional", "estatal", "distrital", "municipal"] as const).map(
    (nivel) => porNivel.get(nivel) ?? { nivel, motivo: MOTIVO_NIVEL_NO_CUBIERTO_ITER_COMPENDIO_ETC }
  );
}

// Celda "distrital" PROPIA de un proyecto de nivel distrito_federal/
// distrito_local, para F2-1/F2-2/F2-7/F2-14/F2-18 — Encargo de cierre,
// 2026-08-09 (F2-18 agregado 2026-08-10, revisión de consistencia).
// Hallazgo real: calcularValorDistritoPonderado (más abajo en este
// archivo) ya existía y ya estaba verificado (caso Zapopan, encargo
// anterior) pero solo se había conectado al browsing Nacional
// (resolverDesgloseDistritosNacional) — nunca a la resolución de la
// celda propia de un proyecto que YA ES de ese nivel de territorio, así
// que completarA4Celdas la rellenaba con el motivo genérico aunque el
// mecanismo para calcularla ya existía. F2-3/F2-4 (índices compuestos,
// sin fórmula de recombinación válida) y F2-8 (Bienestar, diferido)
// deliberadamente no pasan por aquí — mismo criterio que su propio
// Nacional/Distrital-nacional.
async function conCeldaDistritalPropia(
  indicadorId: string,
  territorio: Territorio,
  celdasBase: CeldaFontana[]
): Promise<CeldaFontana[]> {
  if (territorio.nivel !== "distrito_federal" && territorio.nivel !== "distrito_local") return celdasBase;
  if (!territorio.estado) return celdasBase;
  const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
  if (!estadoCve) return celdasBase;
  const numeroDistrito = extraerNumeroDistrito(territorio.municipio ?? territorio.nombre, territorio.cve_distrito);
  if (!numeroDistrito) return celdasBase;
  const tipoDistrito: TipoDistrito = territorio.nivel === "distrito_local" ? "local" : "federal";
  const distrital = await calcularValorDistritoPonderado(indicadorId, estadoCve, numeroDistrito, tipoDistrito);
  return [...celdasBase, distrital];
}

export async function resolverIndicadorFontana(
  indicadorId: string,
  territorio: Territorio
): Promise<CeldaFontana[]> {
  if (indicadorId in FONTANA_ECEG_CONFIG) {
    return resolverIndicadorF1Eceg(indicadorId, territorio);
  }
  if (indicadorId === "F1-2" || indicadorId === "F1-11") {
    return completarA4Celdas(await resolverIndicadorIter(indicadorId, territorio));
  }
  if (indicadorId === "F1-16") {
    return completarA4Celdas(await resolverDensidad(territorio));
  }
  if (indicadorId === "F1-17") {
    return completarA4Celdas(await resolverRemesasPerCapita(territorio));
  }
  if (indicadorId === "F1-18") {
    return completarA4Celdas(await resolverRazonDependencia(territorio));
  }
  if (indicadorId === "F2-4") {
    return completarA4Celdas(await resolverIndiceMarginacion(territorio));
  }
  if (indicadorId === "F2-7") {
    return completarA4Celdas(await conCeldaDistritalPropia(indicadorId, territorio, await resolverBeneficiariosProduccion(territorio)));
  }
  if (indicadorId === "F2-8") {
    return completarA4Celdas(await resolverBeneficiariosBecaBJ(territorio));
  }
  if (indicadorId === "F2-1") {
    return completarA4Celdas(await conCeldaDistritalPropia(indicadorId, territorio, await resolverPobreza(territorio)));
  }
  if (indicadorId === "F2-2") {
    return completarA4Celdas(await conCeldaDistritalPropia(indicadorId, territorio, await resolverPobrezaExtrema(territorio)));
  }
  if (indicadorId === "F2-3") {
    return completarA4Celdas(await resolverRezagoSocial(territorio));
  }
  if (indicadorId === "F2-14") {
    return completarA4Celdas(await conCeldaDistritalPropia(indicadorId, territorio, await resolverCarenciaSocial(territorio)));
  }
  if (indicadorId === "F2-18") {
    return completarA4Celdas(await conCeldaDistritalPropia(indicadorId, territorio, await resolverIngresoCorrienteMunicipal(territorio)));
  }
  if (indicadorId === "F2-17") {
    return completarA4Celdas(await resolverCompetitividadEstatal(territorio));
  }
  if (indicadorId === "F2-6") {
    return completarA4Celdas(await resolverGini(territorio));
  }
  if (indicadorId === "F2-12") {
    return completarA4Celdas(await resolverDecilesIngreso(territorio));
  }
  if (indicadorId === "F2-15") {
    return completarA4Celdas(await resolverGastoEducacion(territorio));
  }
  if (indicadorId === "F2-16") {
    return completarA4Celdas(await resolverGastoSalud(territorio));
  }
  if (indicadorId === "F2-10") {
    return completarA4Celdas(await resolverSalarioImss(territorio));
  }
  if (indicadorId === "F2-5") {
    return completarA4Celdas(await resolverIdhMunicipal(territorio));
  }
  if (indicadorId === "F2-22") {
    return completarA4Celdas(await resolverSaludMunicipal(territorio));
  }
  if (indicadorId === "F2-20") {
    return completarA4Celdas(await resolverEducacionMunicipal(territorio));
  }
  if (indicadorId === "F2-21") {
    return completarA4Celdas(await resolverIngresoMunicipal(territorio));
  }
  if (indicadorId === "F2-19") {
    return completarA4Celdas(await resolverIdgMunicipal(territorio));
  }
  if (indicadorId === "F2-9") {
    return completarA4Celdas(await resolverInformalidadLaboral(territorio));
  }

  // Ningún indicador real (F1 o F2 con conector) llega aquí hoy — esta
  // rama solo la ejercitan los 17 indicadores diferidos de Familia 2
  // (sin adaptador todavía). Mismo motivo que ECEG ya usa para sus
  // propios huecos de config (F1-10/F1-12 antes de desbloquearse), no
  // el motivo genérico de completarA4Celdas.
  return (["nacional", "estatal", "distrital", "municipal"] as const).map(
    (nivel) => ({ nivel, motivo: MOTIVO_CONECTOR_PENDIENTE })
  );
}

// Desglose "Ver municipios" en proyectos nivel "estatal" — único punto
// de ruteo por fuente para este mecanismo (mismo criterio arquitectónico
// que resolverIndicadorFontana arriba), usado por
// app/api/fontana/familia/[familiaId]/municipios/route.ts en vez de
// llamar resolverElementosDeEstado directo (que es ECEG-específico).
// Encargo de generalización, 2026-08-08: F2-4 (CONAPO)/F2-7/F2-8
// (Bienestar) ya tienen dato municipal real pero no tenían mecanismo de
// desglose — este dispatcher lo agrega sin tocar el caso ECEG. Nunca
// aplica a "distritos_fed"/"distritos_loc" para CONAPO/Bienestar (esas
// fuentes no publican por distrito electoral) — el caller decide no
// llamar este dispatcher para esos tipoElemento, mismo criterio ya
// aplicado en route.ts (ver soportaDesgloseMunicipal).
export async function resolverDesgloseMunicipiosEstado(
  indicadorId: string,
  estadoCve: string,
  soloCves?: string[]
): Promise<ElementoDeEstado[] | null> {
  if (indicadorId in FONTANA_ECEG_CONFIG) {
    return resolverElementosDeEstado(indicadorId, estadoCve, "municipios", soloCves);
  }
  if (indicadorId === "F2-4") {
    return resolverMunicipiosEstadoMarginacion(estadoCve, soloCves);
  }
  if (indicadorId === "F2-7") {
    return resolverMunicipiosEstadoProduccion(estadoCve, soloCves);
  }
  if (indicadorId === "F2-8") {
    return resolverMunicipiosEstadoBecaBJ(estadoCve, soloCves);
  }
  if (indicadorId === "F2-1") {
    return resolverMunicipiosEstadoPobreza(estadoCve, soloCves);
  }
  if (indicadorId === "F2-2") {
    return resolverMunicipiosEstadoPobrezaExtrema(estadoCve, soloCves);
  }
  if (indicadorId === "F2-3") {
    return resolverMunicipiosEstadoRezagoSocial(estadoCve, soloCves);
  }
  if (indicadorId === "F2-14") {
    return resolverMunicipiosEstadoCarenciaSocial(estadoCve, soloCves);
  }
  if (indicadorId === "F2-18") {
    return resolverMunicipiosEstadoIcmm(estadoCve, soloCves);
  }
  if (indicadorId === "F2-5") {
    return resolverMunicipiosEstadoIdh(estadoCve, soloCves);
  }
  if (indicadorId === "F2-22") {
    return resolverMunicipiosEstadoSalud(estadoCve, soloCves);
  }
  if (indicadorId === "F2-20") {
    return resolverMunicipiosEstadoEducacion(estadoCve, soloCves);
  }
  if (indicadorId === "F2-21") {
    return resolverMunicipiosEstadoIngreso(estadoCve, soloCves);
  }
  if (indicadorId === "F2-19") {
    return resolverMunicipiosEstadoIdg(estadoCve, soloCves);
  }
  return null;
}

// Desglose "Ver estados" en proyectos nivel "nacional" — mismo criterio
// arquitectónico que resolverDesgloseMunicipiosEstado (Encargo de
// generalización, 2026-08-09). F2-8 deliberadamente ausente (ver nota
// en el import de bienestar.ts) — DIFERIDO tras investigar la varianza
// real (8.0s-29.9s, causa externa no controlable, no un bug propio),
// mismo criterio de documentación que ENOE.
export async function resolverDesgloseEstadosNacional(indicadorId: string): Promise<ElementoDeEstado[] | null> {
  if (indicadorId in FONTANA_ECEG_CONFIG) {
    return resolverEstadosNacional(indicadorId);
  }
  if (indicadorId === "F2-4") {
    return resolverEstadosMarginacion();
  }
  if (indicadorId === "F2-7") {
    return resolverEstadosProduccion();
  }
  if (indicadorId === "F2-1") {
    return resolverEstadosPobreza();
  }
  if (indicadorId === "F2-2") {
    return resolverEstadosPobrezaExtrema();
  }
  if (indicadorId === "F2-3") {
    return resolverEstadosRezagoSocial();
  }
  if (indicadorId === "F2-14") {
    return resolverEstadosCarenciaSocial();
  }
  if (indicadorId === "F2-18") {
    return resolverEstadosIcmm();
  }
  if (indicadorId === "F2-17") {
    return resolverEstadosImcoIce();
  }
  if (indicadorId === "F2-6") {
    return resolverEstadosGini();
  }
  if (indicadorId === "F2-12") {
    return resolverEstadosDeciles();
  }
  if (indicadorId === "F2-15") {
    return resolverEstadosGastoEducacion();
  }
  if (indicadorId === "F2-16") {
    return resolverEstadosGastoSalud();
  }
  if (indicadorId === "F2-10") {
    return resolverEstadosStpsSalario();
  }
  if (indicadorId === "F2-9") {
    return resolverEstadosInformalidadLaboral();
  }
  // F2-8 (y cualquier otro sin mecanismo) cae aquí — null, mismo
  // contrato que "sin mecanismo de desglose para este nivel".
  return null;
}

// Desglose municipal ("Ver datos municipales") en proyectos
// distrito_federal/distrito_local — Punto 2 del Encargo de
// generalización, 2026-08-09. Para ECEG delega directo a
// resolverMunicipiosDeDistrito (sin cambio, cero riesgo). Para las 7
// fuentes no-ECEG: la composición distrito→municipios
// (distritos_municipios/{estado}.json o distritos_locales_municipios/)
// es geografía electoral pura, sin nada de ECEG — se reutiliza tal
// cual, y los VALORES se piden a resolverDesgloseMunicipiosEstado (ya
// construido, acepta soloCves) en vez de leer municipios/{estado}.json
// (archivo ECEG-específico). Naturaleza: cada fila conserva la
// naturaleza propia de su valor municipal (dato_directo/lo que ya
// resuelva la fuente) — esta pieza solo LISTA valores ya resueltos
// agrupados por distrito, nunca calcula un agregado nuevo (por eso no
// es estimacion_agregada, a diferencia de "Ver estados"/Nacional).
export async function resolverMunicipiosDeDistritoFontana(
  indicadorId: string,
  estadoCve: string,
  distritoCve: string,
  tipoDistrito: TipoDistrito = "federal"
): Promise<MunicipioDeDistrito[] | null> {
  if (indicadorId in FONTANA_ECEG_CONFIG) {
    return resolverMunicipiosDeDistrito(indicadorId, estadoCve, distritoCve, tipoDistrito);
  }

  const nivelStorage = tipoDistrito === "federal" ? "distritos_municipios" : "distritos_locales_municipios";
  const path = buildEcegStoragePath(nivelStorage, estadoCve);
  if (!path) return null;
  const distritosMunicipios = await fetchEcegFromStorage<DistritosMunicipiosStorage>(path);

  const municipiosDelDistrito = distritosMunicipios.composicion[distritoCve];
  if (!municipiosDelDistrito) return null;

  const cves = Object.keys(municipiosDelDistrito);
  const elementos = await resolverDesgloseMunicipiosEstado(indicadorId, estadoCve, cves);
  if (!elementos) return null;
  const celdaPorCve = new Map(elementos.map((e) => [e.cve, e.celda] as const));

  return cves.map((municipioCve) => ({
    municipioCve,
    pctPobtot: municipiosDelDistrito[municipioCve],
    coberturaMunicipioPct: distritosMunicipios.coberturaMunicipios[municipioCve] ?? 100,
    celda: celdaPorCve.get(municipioCve) ?? { nivel: "municipal", motivo: "Sin dato para este municipio" },
  }));
}

// Desglose "Ver municipios" en proyectos nivel "nacional" (índices
// nacionales completos, 2026-08-09) — mismo patrón que
// resolverElementosDeNacional (ECEG): agrupa la selección del cliente
// (modo buscador, nunca los 2,477 de golpe) por estado y reutiliza
// resolverDesgloseMunicipiosEstado ya construido — sin función nueva
// por adaptador, el mecanismo de Incremento 1 ya alcanza. F2-8 excluido
// (mismo motivo que "Ver estados" — diferido, varianza de red no
// controlable).
// F2-5/19/20/21/22 (PNUD) agregados en BUG NUEVO 2 (revisión de
// consistencia 3ª ronda, 2026-08-12) — mismo Set que
// app/api/fontana/familia/[familiaId]/route.ts (sin fuente compartida
// entre ambos, hay que mantenerlos sincronizados a mano).
const INDICADORES_MUNICIPAL_NACIONAL = new Set([
  "F2-4", "F2-1", "F2-2", "F2-3", "F2-14", "F2-7", "F2-18",
  "F2-5", "F2-19", "F2-20", "F2-21", "F2-22",
]);

export async function resolverDesgloseMunicipiosNacional(
  indicadorId: string,
  seleccion: { estadoCve: string; cve: string }[]
): Promise<ElementoDeNacional[] | null> {
  if (indicadorId in FONTANA_ECEG_CONFIG) {
    return resolverElementosDeNacional(indicadorId, "municipios", seleccion);
  }
  if (!INDICADORES_MUNICIPAL_NACIONAL.has(indicadorId)) return null;

  const porEstado = new Map<string, string[]>();
  for (const { estadoCve, cve } of seleccion) {
    if (!porEstado.has(estadoCve)) porEstado.set(estadoCve, []);
    porEstado.get(estadoCve)!.push(cve);
  }
  const porGrupo = await Promise.all(
    [...porEstado.entries()].map(async ([estadoCve, cves]) => {
      const elementos = await resolverDesgloseMunicipiosEstado(indicadorId, estadoCve, cves);
      return (elementos ?? []).map((el): ElementoDeNacional => ({ ...el, estadoCve }));
    })
  );
  return porGrupo.flat();
}

// Valor ponderado de UN distrito (Federal o Local) para las 7 fuentes
// no-ECEG — mecanismo que no existía antes de este encargo (investigado
// y confirmado: ni resolverMunicipiosDeDistrito ni
// resolverMunicipiosDeDistritoFontana fusionan municipios en un valor
// único, ambos solo listan). Aprobado 2026-08-09, con corrección
// explícita de Raúl sobre la propuesta original:
//
//   - NUNCA promediar el % ya calculado de cada municipio (mismo
//     principio que Nacional de Familia 1 — sesga si el fenómeno no se
//     distribuye parejo). F2-1/F2-2/F2-14 reconstruyen numerador
//     (Personas × pctPobtot/100) y denominador (Población2020 DE
//     CONEVAL, nunca de ECEG × pctPobtot/100) por separado, sumados
//     entre los municipios del distrito, y solo entonces se calcula el
//     % sobre esa suma — mismo criterio exacto que el Nacional agregado
//     de coneval.ts.
//   - F2-7 (conteo, no %) sí admite suma ponderada directa:
//     Σ(valor_municipio × pctPobtot/100) — no hay "porcentaje" que
//     promediar, pctPobtot ya reparte el conteo entre distritos.
//   - F2-3/F2-4 (índices compuestos) NO se calculan aquí — mismo
//     criterio que su propio Nacional (CONAPO/CONEVAL nunca validaron
//     una forma de sumar/promediar estos índices, ni a nivel país ni a
//     nivel distrito) — devuelven motivo explícito, nunca una cifra
//     inventada sin respaldo metodológico.
//
// ⚠️ CRITERIO GENERAL (fijado 2026-08-10, revisión de consistencia del
// Incremento 4 — aplicar a cualquier indicador nuevo de Familia 3+
// antes de decidir si pasa por aquí, sin tener que redescubrirlo): la
// pregunta correcta NO es "¿es un índice?" — es "¿la magnitud admite
// una operación de recombinación válida (suma/promedio ponderado por
// población)?".
//   - SIN recombinación válida (F2-3/F2-4: técnica tipo PCA u otra sin
//     fórmula de recombinación conocida) → "no corresponde calcular",
//     motivo explícito, nunca una cifra inventada.
//   - CON recombinación válida (magnitudes monetarias o de conteo,
//     AUNQUE el valor de origen sea resultado de un modelo estadístico
//     — F2-7 es un conteo; F2-18/ICMM es un promedio monetario con
//     metodología SEBLUP, pero sigue siendo una magnitud sumable/
//     promediable) → sí se calcula aquí, mismo patrón de suma ponderada
//     que F2-7 (Σ valor × pctPobtot/100). F2-18 se agregó a este grupo
//     el 2026-08-10 — inicialmente se había excluido tratándolo como
//     "estimación modelada = igual de cauteloso que un índice
//     compuesto", pero esa distinción era la incorrecta: lo que importa
//     es la recombinabilidad de la magnitud, no si el origen fue un
//     modelo estadístico.
//
// pctPobtot es un peso de POBLACIÓN TOTAL del municipio (de la
// composición geográfica ya existente, distritos_municipios/{estado}.json
// — la misma que ya usa resolverMunicipiosDeDistritoFontana, sin releer
// ni recalcular nada) — no necesariamente representativo de cómo se
// distribuye el fenómeno específico (pobreza, beneficiarios) dentro del
// municipio. Limitación estructural ya reconocida en el resto del
// sistema (mismo tipo de nota que buildDistritosMunicipiosData) —
// documentada también en INDICATOR_REGISTRY.json.
const INDICADORES_DISTRITAL_NACIONAL_PORCENTAJE: Record<string, "porMunicipioPobreza" | "porMunicipioPobrezaExtrema" | "porMunicipioCarencia"> = {
  "F2-1": "porMunicipioPobreza",
  "F2-2": "porMunicipioPobrezaExtrema",
  "F2-14": "porMunicipioCarencia",
};

async function calcularValorDistritoPonderado(
  indicadorId: string,
  estadoCve: string,
  distritoCve: string,
  tipoDistrito: TipoDistrito
): Promise<CeldaFontana> {
  const nivelStorage = tipoDistrito === "federal" ? "distritos_municipios" : "distritos_locales_municipios";
  const path = buildEcegStoragePath(nivelStorage, estadoCve);
  if (!path) return { nivel: "distrital", motivo: MOTIVO_NIVEL_NO_CUBIERTO_ITER_COMPENDIO_ETC };
  const distritosMunicipios = await fetchEcegFromStorage<DistritosMunicipiosStorage>(path);
  const municipiosDelDistrito = distritosMunicipios.composicion[distritoCve];
  if (!municipiosDelDistrito) return { nivel: "distrital", motivo: "Este distrito no tiene municipios registrados" };

  const cves = Object.keys(municipiosDelDistrito);
  const coberturaMinima = Math.min(...cves.map((c) => distritosMunicipios.coberturaMunicipios[c] ?? 100));

  let valor: number | null = null;
  let unidad = "%";
  let fuenteEtiqueta = "";

  if (indicadorId === "F2-7") {
    const elementos = await resolverDesgloseMunicipiosEstado(indicadorId, estadoCve, cves);
    if (!elementos) return { nivel: "distrital", motivo: MOTIVO_NIVEL_NO_CUBIERTO_ITER_COMPENDIO_ETC };
    let suma = 0;
    for (const el of elementos) {
      if (esValorDisponible(el.celda)) {
        suma += el.celda.valor * ((municipiosDelDistrito[el.cve] ?? 0) / 100);
        fuenteEtiqueta = el.celda.fuenteEtiqueta ?? fuenteEtiqueta;
      }
    }
    valor = Math.round(suma);
    unidad = "beneficiarios";
  } else if (indicadorId in INDICADORES_DISTRITAL_NACIONAL_PORCENTAJE) {
    const campo = INDICADORES_DISTRITAL_NACIONAL_PORCENTAJE[indicadorId];
    const datos = await resolverNumeradorDenominadorMunicipios(estadoCve, campo, cves);
    let numerador = 0;
    let denominador = 0;
    for (const cve of cves) {
      const d = datos.get(cve);
      if (!d) continue;
      const peso = (municipiosDelDistrito[cve] ?? 0) / 100;
      numerador += d.personas * peso;
      denominador += d.poblacion * peso;
    }
    if (denominador > 0) valor = Math.round((numerador / denominador) * 10000) / 100;
    fuenteEtiqueta = FUENTE_ETIQUETA_CONEVAL_POBREZA;
  } else if (indicadorId === "F2-18") {
    // ICMM (promedio monetario) admite recombinación — mismo patrón que
    // F2-7 (suma ponderada directa, sin numerador/denominador porque no
    // es un %). Ver criterio general documentado arriba (2026-08-10).
    const elementos = await resolverMunicipiosEstadoIcmm(estadoCve, cves);
    let suma = 0;
    let pesoTotal = 0;
    for (const el of elementos) {
      if (esValorDisponible(el.celda)) {
        const peso = (municipiosDelDistrito[el.cve] ?? 0) / 100;
        suma += el.celda.valor * peso;
        pesoTotal += peso;
        fuenteEtiqueta = el.celda.fuenteEtiqueta ?? fuenteEtiqueta;
      }
    }
    if (pesoTotal > 0) valor = Math.round((suma / pesoTotal) * 100) / 100;
    unidad = "pesos (ICPTH trimestral)";
  } else {
    // F2-3/F2-4 (índices compuestos) y cualquier otro sin mecanismo —
    // mismo motivo que su propio Nacional.
    return {
      nivel: "distrital",
      motivo: "No corresponde calcular — es un índice compuesto sin metodología de agregación conocida",
    };
  }

  if (valor == null) return { nivel: "distrital", motivo: "Sin datos suficientes para agregar este distrito" };
  const celda: CeldaFontana = { nivel: "distrital", valor, unidad, naturaleza: "estimacion_agregada", fuenteEtiqueta };
  return coberturaMinima < 99 ? { ...celda, coberturaPct: coberturaMinima } : celda;
}

// Columnas inversas (Municipal → Distrito Federal/Local), Hallazgo A de
// la revisión de consistencia 2ª ronda (2026-08-12): route.ts solo
// llamaba a resolverDistritalDeMunicipio (eceg.ts, ECEG-only) para
// construir distritalesMunicipio — F2-18 (ICMM) nunca se conectó pese a
// que calcularValorDistritoPonderado ya lo soporta, y F2-1/F2-2/F2-7/
// F2-14 (asumidos "ya funcionando" en rondas previas) TAMPOCO estaban
// conectados en realidad — verificado con datos reales (Cuernavaca,
// distrito federal 001, ICMM: $79,682.48 ICPTH trimestral) que el
// mecanismo de cálculo sí funciona, solo faltaba esta ruta de wiring.
// Mismos 3 casos de diseño que resolverDistritalDeMunicipio
// (dominante/sin_dominante/cobertura_incompleta), reutilizando
// clasificarDistritoDeMunicipio (100% geográfico, sin dependencia de
// ECEG) — solo cambia CÓMO se obtiene el valor del distrito dominante:
// calcularValorDistritoPonderado en vez de celdaDesdeRegistro (storage
// ECEG-específico que estas fuentes no tienen). calcularValorDistritoPonderado
// ya trae su propio criterio de "recombinación válida" (F2-3/F2-4
// regresan "no corresponde calcular" sin fabricar cifra) — el caller
// (route.ts) decide cuándo invocar esta función, pero aunque se invoque
// con un id sin mecanismo real, nunca fabrica un valor.
const MOTIVO_DISTRITO_NO_DETERMINADO_PONDERADO = "No fue posible determinar el distrito electoral de este municipio";

export async function resolverDistritalDeMunicipioPonderado(
  indicadorId: string,
  estadoCve: string,
  municipioCve: string,
  tipoDistrito: TipoDistrito
): Promise<CeldaDistritalDeMunicipio> {
  const nivel = tipoDistrito === "federal" ? "distrital_federal" : "distrital_local";

  let clasificacion;
  try {
    clasificacion = await clasificarDistritoDeMunicipio(estadoCve, municipioCve, tipoDistrito);
  } catch {
    return { nivel, motivo: "Error de conexión con la bodega de datos" };
  }
  if (!clasificacion) return { nivel, motivo: MOTIVO_DISTRITO_NO_DETERMINADO_PONDERADO };

  if (clasificacion.caso === "cobertura_incompleta") {
    return {
      nivel,
      motivo: "Cobertura de datos incompleta para este municipio — no es posible determinar con precisión su distrito.",
      municipioCoberturaPct: clasificacion.coberturaMunicipioPct,
    };
  }
  if (clasificacion.caso === "sin_dominante") {
    return {
      nivel,
      motivo: "Este municipio no tiene un distrito dominante.",
      desglose: { tipo: tipoDistrito === "federal" ? "distritos_fed" : "distritos_loc", total: clasificacion.distritos.length },
    };
  }

  const celda = await calcularValorDistritoPonderado(indicadorId, estadoCve, clasificacion.dominante.distritoCve, tipoDistrito);
  if ("valor" in celda) {
    return {
      nivel,
      valor: celda.valor,
      unidad: celda.unidad,
      naturaleza: celda.naturaleza,
      fuenteEtiqueta: celda.fuenteEtiqueta,
      municipioEnDistritoPct: clasificacion.dominante.pctPobtot,
    };
  }
  return { nivel, motivo: celda.motivo };
}

// Dispatcher "Ver distritos federales"/"Ver distritos locales" en
// proyectos nivel "nacional" — mismo patrón de agrupar-por-estado que
// resolverDesgloseMunicipiosNacional, pero cada elemento requiere su
// propio cálculo ponderado (calcularValorDistritoPonderado) en vez de
// una lectura directa. Solo 4 de las 7 fuentes no-ECEG tienen mecanismo
// aprobado (F2-1, F2-2, F2-7, F2-14) — F2-3/F2-4 (índices compuestos) y
// F2-8 (Bienestar, diferido) regresan motivo explícito vía
// calcularValorDistritoPonderado/resolverDesgloseMunicipiosEstado, pero
// nunca null aquí (a diferencia de Municipal/Estados) porque la
// composición geográfica sí aplica a los 7 — solo el VALOR varía según
// el mecanismo real de cada uno.
export async function resolverDesgloseDistritosNacional(
  indicadorId: string,
  tipoElemento: "distritos_fed" | "distritos_loc",
  seleccion: { estadoCve: string; cve: string }[]
): Promise<ElementoDeNacional[] | null> {
  if (indicadorId in FONTANA_ECEG_CONFIG) {
    return resolverElementosDeNacional(indicadorId, tipoElemento, seleccion);
  }
  // F2-8 diferido — mismo motivo que "Ver estados"/Municipal nacional.
  if (indicadorId === "F2-8") return null;
  // Fuentes no-ECEG sin ningún mecanismo en absoluto (12 diferidos) —
  // sin composición que mostrar.
  const FUENTES_CON_ALGUN_MECANISMO = new Set(["F2-4", "F2-1", "F2-2", "F2-3", "F2-14", "F2-7", "F2-18"]);
  if (!FUENTES_CON_ALGUN_MECANISMO.has(indicadorId)) return null;

  const tipoDistrito: TipoDistrito = tipoElemento === "distritos_fed" ? "federal" : "local";
  const porEstado = new Map<string, string[]>();
  for (const { estadoCve, cve } of seleccion) {
    if (!porEstado.has(estadoCve)) porEstado.set(estadoCve, []);
    porEstado.get(estadoCve)!.push(cve);
  }
  const porGrupo = await Promise.all(
    [...porEstado.entries()].map(async ([estadoCve, cves]) => {
      const opciones = await getOpcionesElementoEstado(tipoElemento, estadoCve);
      const nombrePorCve = new Map(opciones.map((o) => [o.cve, o.nombre] as const));
      const celdas = await Promise.all(
        cves.map((cve) => calcularValorDistritoPonderado(indicadorId, estadoCve, cve, tipoDistrito))
      );
      return cves.map((cve, i): ElementoDeNacional => ({
        cve,
        nombre: nombrePorCve.get(cve) ?? cve,
        estadoCve,
        celda: celdas[i],
      }));
    })
  );
  return porGrupo.flat();
}
