// lib/fontana/tabla/insumosPestel.ts
//
// Núcleo de la integración PESTEL↔Fontana (26-09-13) — resuelve, para una
// dimensión PEST-L (Económico/Social/Ecológico) + Territorio + tipo de
// proyecto, la lista de "insumos" listos para inyectar en el prompt de
// PESTEL. Un solo punto de lógica, consumido por 2 convenciones de
// invocación según el runtime del llamador:
// - Express (Next.js, mismo runtime) — importa `resolverInsumosFontanaPestel`
//   directo, sin HTTP (ver app/api/moddulo/f2/generate-m1-express/route.ts).
// - Controlada (Cloud Function, runtime distinto — `functions/` no puede
//   importar `lib/`) — pasa por el endpoint HTTP
//   `app/api/fontana/insumos-pestel/route.ts`, que es un wrapper delgado
//   de esta misma función.

import { resolverCeldasParaTerritorio } from "@/lib/fontana/tabla/construirCeldasTabla";
import { resolverValoresMunicipiosDelDistrito } from "@/lib/fontana/tabla/sintesisDistrital";
import { buscarFuenteOficialCurada } from "@/lib/fontana/tabla/fuenteOficialCurada";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { INDICADORES_PESTEL_POR_DIMENSION, type DimensionPestelConFontana, type InsumoFontana } from "@/lib/fontana/pestelInsumos";
import type { Territorio, NivelTerritorial } from "@/types/shared.types";
import type { ProjectType } from "@/types/moddulo.types";
import type { NivelTablaFontana } from "@/lib/fontana/tablaColumnas";

// Mapea el nivel propio del territorio al nivel de columna correspondiente
// en la tabla de Fontana — mismo criterio que ya usa el override de
// agregación plural en construirCeldasTabla.ts. Exportada: también la usa
// el semáforo de cobertura de Etapa 4 (coverage/route.ts) para decidir si
// Fontana cubre una dimensión sin necesitar resolver el dato en vivo.
export function nivelTablaDeTerritorio(nivel: NivelTerritorial): NivelTablaFontana {
  if (nivel === "distrito_federal" || nivel === "distrito_local" || nivel === "distrito") return "distrital";
  if (nivel === "municipal") return "municipal";
  if (nivel === "estatal") return "estatal";
  return "nacional";
}

// Corrección post-verificación (26-09-13): la narrativa real de PESTEL
// citaba a Fontana como "Fontana (SESNSP (RNID, ...))" — sub-fuente
// anidada y SIN fecha — en vez del formato cerrado 'Fontana, YYYY[-Tn]'
// acordado, igual de estricto que Banxico/DOF/INEGI-BISE. Causa raíz
// confirmada: `InsumoFontana` nunca cargó un campo de período — el
// formatter solo mandaba `fuenteEtiqueta` completo entre paréntesis, y el
// prompt permitía a Claude improvisar el formato de cita a partir de eso.
// `CeldaTablaFontana` no tiene un campo de fecha estructurado, pero la
// mayoría de las etiquetas de fuente SÍ embeben su vintage real en texto
// (ej. "CONEVAL (Medición de la pobreza 2020)", "INEGI (ENSU 2026-T2,
// ...)") — se extrae aquí, UNA sola vez, para no duplicar la lógica de
// extracción en los 2 formatters de prompt (Express/Controlada). Cuando
// la fuente no publica vintage reconocible en su etiqueta (ej. SESNSP/
// RNID, dataset corriente sin fecha propia) devuelve `undefined` —
// nunca se inventa una fecha; el prompt instruye omitir la fecha de la
// cita en ese caso (mismo principio ya vigente para Banxico/DOF sin
// período).
const RE_TRIMESTRE = /\b(\d)(?:er|do|to)?\.?\s*trim(?:estre)?\.?\s*(\d{4})\b/i;
const RE_TRIMESTRE_CORTO = /\b(20\d{2})-T(\d)\b/;
const RE_ANIO = /\b(19|20)\d{2}\b/g;

export function extraerPeriodoFuente(fuenteEtiqueta?: string): string | undefined {
  if (!fuenteEtiqueta) return undefined;

  const matchTrimestreCorto = fuenteEtiqueta.match(RE_TRIMESTRE_CORTO);
  if (matchTrimestreCorto) return `${matchTrimestreCorto[1]}-T${matchTrimestreCorto[2]}`;

  const matchTrimestre = fuenteEtiqueta.match(RE_TRIMESTRE);
  if (matchTrimestre) return `${matchTrimestre[2]}-T${matchTrimestre[1]}`;

  // Último año de 4 dígitos en la etiqueta — las etiquetas de Fontana
  // ponen el vintage al final ("... 2020)", "Beca Benito Juárez, 3er.
  // trim. 2025, ..." ya cubierto arriba), nunca al inicio.
  const anios = fuenteEtiqueta.match(RE_ANIO);
  if (anios && anios.length > 0) return anios[anios.length - 1];

  return undefined;
}

// Corrección post-verificación (26-09-13, 2ª ronda): Raúl reportó que la
// narrativa citaba "(Fontana, 2026-T2)" para el dato de percepción de
// inseguridad — correcto en formato, pero equivocado en fondo: al
// usuario le importa la fuente OFICIAL del dato (INEGI/ENSU, en este
// caso), no "Fontana", que es solo la app que agrega y verifica datos ya
// oficiales. NUNCA "Fontana" como fuente citable.
//
// 3ª corrección (26-09-13): la 2ª ronda extraía solo la agencia (texto
// antes del primer paréntesis) — correcto para "no digas Fontana", pero
// insuficiente: colapsaba productos distintos de una misma institución
// bajo el mismo nombre (ej. Censo y ENSU, ambos "INEGI"). Se consulta
// PRIMERO la tabla curada a mano (`buscarFuenteOficialCurada`,
// `fuenteOficialCurada.ts` — mismo criterio editorial ya aplicado en las
// Notas Metodológicas de Fontana, un parser genérico no puede adivinar
// la etiqueta humana correcta) y solo si NINGÚN patrón coincide (fuente
// aún no curada) se cae al fallback agencia-sola de siempre.
export function extraerFuenteOficial(fuenteEtiqueta?: string): string {
  if (!fuenteEtiqueta) return "Fontana";

  const curada = buscarFuenteOficialCurada(fuenteEtiqueta);
  if (curada) return curada;

  const idx = fuenteEtiqueta.indexOf("(");
  const agencia = (idx > 0 ? fuenteEtiqueta.slice(0, idx) : fuenteEtiqueta).trim();
  return agencia || "Fontana";
}

/**
 * Resuelve los insumos de Fontana para una dimensión PEST-L, un
 * `Territorio` y un `ProjectType` dados. Nunca lanza — un indicador sin
 * dato real cae en `{tipo:"sin_dato"}`, nunca detiene al resto.
 *
 * `opts.timeoutMs` (26-09-13, corrección post-verificación — bug
 * bloqueante real): sin este parámetro, cada indicador se resolvía SIN
 * ningún límite de tiempo (`resolverCeldasParaTerritorio` solo activa su
 * guard de timeout cuando `timeoutMs > 0` — ver `construirCeldasTabla.ts`).
 * Los 2 llamadores de esta función (Express, en proceso; el endpoint
 * `insumos-pestel/route.ts` para Controlada) corren en un request HTTP con
 * su propio techo de tiempo — sin este límite, un solo indicador externo
 * lento (ej. SESNSP en frío) podía colgar la petición completa hasta que
 * la plataforma la mataba, sin ningún error visible para el usuario.
 * Ambos llamadores DEBEN pasar un valor explícito.
 */
export async function resolverInsumosFontanaPestel(
  dimension: DimensionPestelConFontana,
  territorio: Territorio,
  tipoProyecto: ProjectType,
  opts?: { timeoutMs?: number }
): Promise<InsumoFontana[]> {
  const indicadorIds = INDICADORES_PESTEL_POR_DIMENSION[dimension];
  const nivelPropio = nivelTablaDeTerritorio(territorio.nivel);
  const resueltos = await resolverCeldasParaTerritorio(indicadorIds, territorio, tipoProyecto, opts);

  return Promise.all(
    resueltos.map(async (r): Promise<InsumoFontana> => {
      const celdaPropia = r.celdas.find((c) => c.nivel === nivelPropio);

      if (celdaPropia && "valor" in celdaPropia && celdaPropia.valor !== undefined) {
        return {
          id: r.id,
          nombre: r.nombre,
          tipo: "simple",
          valor: celdaPropia.valor,
          unidad: celdaPropia.unidad,
          fuenteEtiqueta: celdaPropia.fuenteEtiqueta,
          periodo: extraerPeriodoFuente(celdaPropia.fuenteEtiqueta),
          fuenteOficial: extraerFuenteOficial(celdaPropia.fuenteEtiqueta),
        };
      }

      if (celdaPropia?.agregacionPlural && celdaPropia.agregacionPlural.desglosePorUnidad.length > 0) {
        return {
          id: r.id,
          nombre: r.nombre,
          tipo: "sintesis",
          tipoCalculo: celdaPropia.agregacionPlural.tipoCalculo,
          desglose: celdaPropia.agregacionPlural.desglosePorUnidad.map((u) => ({
            nombre: u.nombre,
            valor: "valor" in u.celda ? u.celda.valor : undefined,
            unidad: "valor" in u.celda ? u.celda.unidad : undefined,
            motivo: "valor" in u.celda ? undefined : u.celda.motivo,
          })),
          fuenteEtiqueta: r.fuenteEtiqueta,
          periodo: extraerPeriodoFuente(r.fuenteEtiqueta),
          fuenteOficial: extraerFuenteOficial(r.fuenteEtiqueta),
        };
      }

      if (nivelPropio === "distrital") {
        const valoresMunicipios = await resolverValoresMunicipiosDelDistrito(r.id, territorio, opts);
        const conAlgunValor = valoresMunicipios?.some((m) => "valor" in m.celda && m.celda.valor !== undefined);
        if (valoresMunicipios && valoresMunicipios.length > 0 && conAlgunValor) {
          const registro = await getIndicadorRegistro(r.id);
          return {
            id: r.id,
            nombre: r.nombre,
            tipo: "sintesis",
            tipoCalculo: registro?.agregacionPlural?.tipo,
            desglose: valoresMunicipios.map((m) => ({
              nombre: m.nombre,
              valor: "valor" in m.celda ? m.celda.valor : undefined,
              unidad: "valor" in m.celda ? m.celda.unidad : undefined,
              motivo: "valor" in m.celda ? undefined : m.celda.motivo,
            })),
            fuenteEtiqueta: r.fuenteEtiqueta,
            periodo: extraerPeriodoFuente(r.fuenteEtiqueta),
            fuenteOficial: extraerFuenteOficial(r.fuenteEtiqueta),
          };
        }
      }

      return {
        id: r.id,
        nombre: r.nombre,
        tipo: "sin_dato",
        motivo: (celdaPropia && "motivo" in celdaPropia ? celdaPropia.motivo : undefined) ?? "Sin dato disponible en Fontana para este territorio.",
      };
    })
  );
}

/**
 * Determina, sin resolver ningún dato en vivo (solo contra el registry
 * estático de indicadores), si Fontana tiene al menos un indicador
 * "confirmado" para la dimensión y el nivel territorial de un proyecto de
 * PESTEL. Usado por el semáforo de cobertura de Etapa 4 — decidir si una
 * dimensión debe marcarse verde automáticamente NO puede depender de una
 * resolución en vivo (los adaptadores externos, ej. SESNSP, tardan
 * segundos-minutos; la Etapa 4 se consulta en cada visita a la página).
 *
 * Nivel `distrital` acepta también un indicador confirmado a nivel
 * `municipal` — mismo fallback de síntesis narrativa diseñado para el
 * mismatch de granularidad (un distrito sin cobertura propia pero cuyos
 * municipios sí la tienen).
 */
export async function fontanaCubreDimension(
  dimension: DimensionPestelConFontana,
  nivelTerritorio: NivelTerritorial
): Promise<boolean> {
  const nivelTabla = nivelTablaDeTerritorio(nivelTerritorio);
  const nivelesAceptados: NivelTablaFontana[] =
    nivelTabla === "distrital" ? ["distrital", "municipal"] : [nivelTabla];

  const indicadorIds = INDICADORES_PESTEL_POR_DIMENSION[dimension];
  const registros = await Promise.all(indicadorIds.map((id) => getIndicadorRegistro(id)));

  return registros.some(
    (registro) =>
      registro !== null &&
      registro.niveles.some(
        (n) => nivelesAceptados.includes(n.nivel as NivelTablaFontana) && n.estado === "confirmado"
      )
  );
}
