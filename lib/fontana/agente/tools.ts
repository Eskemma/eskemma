// lib/fontana/agente/tools.ts
// Las herramientas del agente conversacional "Fontana" (T10) + su ejecutor.
// Los datos SIEMPRE salen de los endpoints ya existentes (mismo cómputo que
// la tabla comparativa) — nunca de un import directo de
// resolverIndicadorFontana ni de una fuente paralela:
//   - consultar_indicador / generar_visualizacion → GET /api/fontana/familia/[familiaId]
//   - territorio externo → GET /api/fontana/consulta-territorio
//   - serie temporal (F2-17) → GET /api/fontana/serie-temporal
//   - indicadores narrativos de F5 → GET /api/fontana/sesion/[id]/narrativa
//   - navegar_pestana → sin datos
// El único acceso directo a `lib/` es al registry (lookup de metadatos:
// nombre, definición, naturaleza por nivel, agregacionPlural.tipo).

import type Anthropic from "@anthropic-ai/sdk";
import { adminDb } from "@/lib/firebase-admin";
import type { Territorio } from "@/types/shared.types";
import type { ProjectType } from "@/types/moddulo.types";
import { esTerritorioParcial } from "@/lib/moddulo/territorioPlural";
import { getIndicadorRegistro, getIndicadoresPorFamilia, type NaturalezaDato } from "@/lib/fontana/indicatorRegistry";
import { esIndicadorNarrativoCurado } from "@/lib/fontana/ingesta/contenidoCurado";
import { tieneSerie } from "@/lib/fontana/series/seriesDisponibles";
import { FAMILIA_META } from "@/lib/fontana/familias";
import type { CeldaTablaFontana, NivelTablaFontana } from "@/lib/fontana/tablaColumnas";
import { familiaDeIndicador, type FamiliaFontanaId, type FontanaCanvasItem, type FontanaToolCall } from "@/types/fontana.types";
import {
  construirCanvasDesglose,
  construirCanvasDistribucion,
  construirCanvasGrafica,
  construirCanvasResumen,
  construirCanvasSerieTemporal,
  construirCanvasTabla,
  limpiarUndefined,
  INDICADORES_CON_DISTRIBUCION,
  type RespuestaFamilia,
} from "./canvasBuilder";

// Etiqueta legible por familiaId — fuente única en lib/fontana/familias.ts.
export const FAMILIA_ETIQUETAS: Record<FamiliaFontanaId, string> = {
  F1: FAMILIA_META.F1.nombre,
  F2: FAMILIA_META.F2.nombre,
  F3: FAMILIA_META.F3.nombre,
  F4: FAMILIA_META.F4.nombre,
  F5: FAMILIA_META.F5.nombre,
};

// territorio.nivel → nivel de tabla que le corresponde por default.
function nivelPorDefecto(territorio: Territorio): NivelTablaFontana {
  switch (territorio.nivel) {
    case "nacional":
      return "nacional";
    case "estatal":
      return "estatal";
    case "municipal":
      return "municipal";
    case "distrito":
    case "distrito_federal":
    case "distrito_local":
      return "distrital";
    default:
      return "estatal";
  }
}

function territorioLabel(t: Territorio): string {
  return (
    t.nombre ||
    [t.estado, t.municipio].filter(Boolean).join(" › ") ||
    "el territorio del proyecto"
  );
}

// ==========================================
// SCHEMAS
// ==========================================

const NIVELES_ENUM = ["nacional", "estatal", "distrital", "municipal"];

export const FONTANA_TOOLS: Anthropic.Tool[] = [
  {
    name: "consultar_indicador",
    description:
      "Devuelve el valor de un indicador para el territorio de la sesión. Úsala para responder '¿cuánto es X?'. No genera nada en Canvas. `indicadorId` DEBE ser un ID real (F1-1, F2-13, F4-2…) obtenido de listar_indicadores_familia — NUNCA lo construyas ni lo deduzcas del nombre. Usa `compararNiveles: true` (default recomendado) para recibir el valor en TODOS los niveles geográficos aplicables y poder comparar.",
    input_schema: {
      type: "object",
      properties: {
        indicadorId: { type: "string", description: "ID exacto del registry (ej. 'F2-1'), obtenido de listar_indicadores_familia. La familia se deriva del prefijo. Jamás inventado." },
        nivel: { type: "string", enum: NIVELES_ENUM, description: "Opcional. Solo se usa si compararNiveles es false. Default = nivel del territorio de la sesión." },
        compararNiveles: { type: "boolean", description: "Si true (recomendado por default para cualquier pregunta sobre un indicador puntual), devuelve `nivelesComparados`: el valor en cada nivel geográfico aplicable (nacional→estatal→distrital→municipal según el territorio). Consolida en 1 llamada." },
      },
      required: ["indicadorId"],
    },
  },
  {
    name: "consultar_indicador_territorio_externo",
    description:
      "Consulta un indicador en un territorio de México DISTINTO al del proyecto activo, cuando el usuario lo nombra EXPLÍCITAMENTE (ej. '¿y en Jalisco?', 'la pobreza de Guadalajara', 'compárame con Nuevo León'). NUNCA la uses de forma automática — el default siempre es el territorio de la sesión (usa consultar_indicador). El resultado SIEMPRE debes presentarlo aclarando que es de ese territorio, no del proyecto.",
    input_schema: {
      type: "object",
      properties: {
        indicadorId: { type: "string", description: "ID real del indicador (de listar_indicadores_familia)." },
        territorioNombre: { type: "string", description: "Nombre del estado o municipio tal como lo dijo el usuario." },
        estadoNombre: { type: "string", description: "Opcional. El estado, si el usuario lo precisó (ej. 'Reforma, Chiapas' → territorioNombre='Reforma', estadoNombre='Chiapas'). Desambigua municipios homónimos." },
        nivel: { type: "string", enum: ["estatal", "municipal"], description: "Opcional. 'municipal' si el usuario pidió explícitamente el municipio de un nombre que también es estado." },
      },
      required: ["indicadorId", "territorioNombre"],
    },
  },
  {
    name: "consultar_serie_temporal",
    description:
      "Devuelve la serie histórica (varios años) de un indicador que tiene historia consultable en Fontana. Sabes cuáles la tienen por el campo `tieneSerie: true` (en consultar_indicador, listar_indicadores_familia, listar_indicadores_activos_todas_familias). Hoy: Gini de ingreso, distribución del ingreso por decil, huelgas y paros, Índice de Paz México, pobreza, pobreza extrema y población con al menos una carencia (corte nacional/estatal), y Competitividad Estatal. Sin territorioNombre = territorio del proyecto; con territorioNombre = un estado que el usuario nombró (ajeno al proyecto, o uno de los suyos si el proyecto abarca varios estados y ya te dijo cuál). Si el proyecto abarca más de un estado devuelve `multiEstado` — pregunta al usuario a cuál se refiere, no elijas tú. El campo `nivel` de la respuesta dice a qué nivel es la serie (nacional / estatal); si es estatal, aclara que aplica a todo el estado, no es un promedio de los municipios/distritos del proyecto. NO genera nada en Canvas (para eso usa generar_visualizacion tipo 'serie_temporal').",
    input_schema: {
      type: "object",
      properties: {
        indicadorId: { type: "string", description: "ID real del indicador. Debe tener `tieneSerie: true`." },
        territorioNombre: { type: "string", description: "Estado dicho por el usuario, solo si pidió un territorio distinto al del proyecto o si el proyecto abarca varios estados y ya te precisó cuál." },
        estadoNombre: { type: "string", description: "Opcional, desambigua municipios homónimos." },
      },
      required: ["indicadorId"],
    },
  },
  {
    name: "consultar_detalle_indicador",
    description:
      "Devuelve la lista de ENTIDADES (nombres) detrás de un conteo/clasificación, para indicadores que son una membresía y no un valor medido. Solo válida para: F3-8 (municipios en Zona de Atención Prioritaria rural del estado), F5-6 (giros económicos DENUE del municipio), F5-8 (localidades GACP con accesibilidad baja del municipio). Para cualquier otro indicadorId devuelve un error explícito — no la fuerces.",
    input_schema: {
      type: "object",
      properties: {
        indicadorId: { type: "string", enum: ["F3-8", "F5-6", "F5-8"] },
        offset: { type: "number", description: "Opcional. Para paginar listas largas; default 0 (primera página)." },
      },
      required: ["indicadorId"],
    },
  },
  {
    name: "listar_indicadores_activos_todas_familias",
    description:
      "Devuelve, en UNA sola llamada, las 5 familias con sus indicadores activos en la sesión de este usuario. Úsala para preguntas de alcance múltiple ('¿qué indicadores tengo?', 'todo lo activo en mi sesión', 'resumen de lo que hay') — NUNCA encadenes 5 llamadas a listar_indicadores_familia.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "listar_indicadores_familia",
    description:
      "Devuelve los indicadores de una familia que están activos en la sesión de este usuario (id, nombre, definición). Úsala SIEMPRE para responder qué indicadores tiene / cuáles son los de una familia — nunca enumeres de memoria.",
    input_schema: {
      type: "object",
      properties: {
        familiaId: { type: "string", enum: ["F1", "F2", "F3", "F4", "F5"], description: "F1 Sociodemográficos · F2 Socioeconómicos · F3 Geopolíticos · F4 Comparación internacional · F5 Características territoriales." },
      },
      required: ["familiaId"],
    },
  },
  {
    name: "generar_visualizacion",
    description:
      "Agrega al Canvas: 'resumen' (tabla de una familia a un nivel) · 'grafica' (un indicador comparado ENTRE NIVELES geográficos) · 'tabla' (familia completa) · 'distribucion' (desglose de CATEGORÍAS dentro de un nivel: grupos de edad, deciles, estado civil, urbano/rural — solo F1-2, F1-11, F1-12, F2-12) · 'serie_temporal' (evolución EN EL TIEMPO de un indicador — solo los que tienen `tieneSerie: true`). Familia 4 no está disponible en Canvas todavía.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["resumen", "grafica", "tabla", "distribucion", "serie_temporal"] },
        familiaId: { type: "string", enum: ["F1", "F2", "F3", "F4", "F5"], description: "Requerido para 'resumen' y 'tabla'." },
        indicadorId: { type: "string", description: "Requerido para 'grafica', 'distribucion' y 'serie_temporal'." },
        nivel: { type: "string", enum: NIVELES_ENUM, description: "Opcional para 'resumen'. Default = nivel del territorio." },
        territorioNombre: { type: "string", description: "Solo para 'serie_temporal': estado que el usuario nombró, si pidió uno distinto al del proyecto o si el proyecto abarca varios estados y ya te precisó cuál." },
        estadoNombre: { type: "string", description: "Solo para 'serie_temporal': desambigua municipios homónimos." },
      },
      required: ["tipo"],
    },
  },
  {
    name: "navegar_pestana",
    description:
      "Lleva al usuario a la pestaña 'fontana' (Canvas) o 'indicadores' (opcionalmente abriendo una familia). Úsala para Familia 4, o para 'ábreme…', 'llévame a…'.",
    input_schema: {
      type: "object",
      properties: {
        pestana: { type: "string", enum: ["fontana", "indicadores"] },
        familiaId: { type: "string", enum: ["F1", "F2", "F3", "F4", "F5"], description: "Opcional. Solo con pestana='indicadores': expande esa familia." },
      },
      required: ["pestana"],
    },
  },
];

// ==========================================
// EJECUTOR
// ==========================================

export interface ToolContext {
  sesionId: string;
  uid: string;
  cookie: string;
  baseUrl: string;
  territorio: Territorio;
  tipoProyecto: ProjectType;
}

export interface ToolResult {
  resultForModel: unknown;
  toolCall: FontanaToolCall;
  navEvent?: { pestana: "fontana" | "indicadores"; familiaId?: FamiliaFontanaId };
  canvasItem?: FontanaCanvasItem;
}

async function fetchFamilia(familiaId: string, ctx: ToolContext): Promise<RespuestaFamilia | null> {
  const res = await fetch(`${ctx.baseUrl}/api/fontana/familia/${familiaId}?sesionId=${ctx.sesionId}`, {
    headers: { cookie: ctx.cookie },
  });
  if (!res.ok) return null;
  return (await res.json()) as RespuestaFamilia;
}

async function fetchNarrativa(indicadorId: string, ctx: ToolContext) {
  const res = await fetch(
    `${ctx.baseUrl}/api/fontana/sesion/${ctx.sesionId}/narrativa?indicadorId=${indicadorId}`,
    { headers: { cookie: ctx.cookie } }
  );
  if (!res.ok) return null;
  return (await res.json()) as {
    indicadorId: string;
    nivel: string;
    territorio: string;
    valor: string | null;
    naturaleza: NaturalezaDato | null;
    motivo: string | null;
    fuenteEtiqueta: string | null;
  };
}

// Persiste un FontanaCanvasItem en fontana_sesiones/{id}.canvasItems
// (append-only) mediante transacción, para no pisar escrituras concurrentes.
async function appendCanvasItem(sesionId: string, item: FontanaCanvasItem): Promise<void> {
  // Defensa en profundidad: los builders ya limpian `undefined`, pero
  // Firestore Admin lo rechaza sin excepción — nunca escribir el item crudo.
  const limpio = limpiarUndefined(item);
  const ref = adminDb.collection("fontana_sesiones").doc(sesionId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = (snap.data()?.canvasItems ?? []) as FontanaCanvasItem[];
    tx.update(ref, { canvasItems: [...prev, limpio], fechaUltimoGuardado: new Date().toISOString() });
  });
}

function mapAgregacionPlural(celda: CeldaTablaFontana | undefined) {
  const ap = celda?.agregacionPlural;
  if (!ap) return null;
  return {
    valorAgregado: ap.valorAgregado && "valor" in ap.valorAgregado ? ap.valorAgregado.valor : null,
    tipoCalculo: ap.tipoCalculo ?? null,
    unidadesResueltas: ap.desglosePorUnidad.length,
    unidadesNoResueltas: ap.noResueltas.length,
    desglosePorUnidad: ap.desglosePorUnidad.map((u) => ({
      unidad: u.nombre,
      valor: "valor" in u.celda ? u.celda.valor : null,
      naturaleza: "valor" in u.celda ? u.celda.naturaleza : null,
      motivo: "valor" in u.celda ? null : u.celda.motivo,
    })),
  };
}

export async function ejecutarHerramienta(
  nombre: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
  mensajeId: string
): Promise<ToolResult> {
  if (nombre === "consultar_indicador") return consultarIndicador(input, ctx);
  if (nombre === "consultar_indicador_territorio_externo") return consultarIndicadorTerritorioExterno(input, ctx);
  if (nombre === "consultar_serie_temporal") return consultarSerieTemporal(input, ctx);
  if (nombre === "consultar_detalle_indicador") return consultarDetalleIndicador(input, ctx);
  if (nombre === "listar_indicadores_familia") return listarIndicadoresFamilia(input, ctx);
  if (nombre === "listar_indicadores_activos_todas_familias") return listarIndicadoresActivosTodasFamilias(ctx);
  if (nombre === "generar_visualizacion") return generarVisualizacion(input, ctx, mensajeId);
  if (nombre === "navegar_pestana") return navegarPestana(input);
  return {
    resultForModel: { error: `Herramienta desconocida: ${nombre}` },
    toolCall: { tool: "consultar_indicador", input, resultSummary: `Herramienta desconocida: ${nombre}`, ok: false },
  };
}

async function listarIndicadoresFamilia(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const familiaId = String(input.familiaId ?? "") as FamiliaFontanaId;
  const meta = FAMILIA_META[familiaId];
  if (!meta) {
    const rs = `«${input.familiaId}» no es una familia válida (F1-F5).`;
    return { resultForModel: { error: rs }, toolCall: { tool: "listar_indicadores_familia", input, resultSummary: rs, ok: false } };
  }

  const res = await fetch(`${ctx.baseUrl}/api/fontana/familia/${familiaId}?sesionId=${ctx.sesionId}`, {
    headers: { cookie: ctx.cookie },
  });
  if (!res.ok) {
    const rs = `No se pudo cargar la familia ${meta.nombre}.`;
    return { resultForModel: { familiaId, nombre: meta.nombre, error: rs }, toolCall: { tool: "listar_indicadores_familia", input, resultSummary: rs, ok: false } };
  }
  // F1/F2/F3/F5 → { indicadores: [{id, nombre, definicion, ...}] }
  // F4        → { indicadores: [{id, nombre, definicion, fila}] }  (mismo id/nombre)
  const data = (await res.json()) as { indicadores?: { id: string; nombre: string; definicion?: string }[] };
  const indicadores = (data.indicadores ?? []).map((i) => ({
    id: i.id,
    nombre: i.nombre,
    definicion: i.definicion ?? null,
    tieneSerie: tieneSerie(i.id),
  }));

  // Catálogo COMPLETO de la familia desde el registry (verificado 2026-08-27:
  // para F4, getIndicadoresPorFamilia(4) == FAMILIA4_ORDEN+NOMBRES, sin
  // divergencia). Sirve para resolver un ID por nombre aunque el indicador
  // no esté en la selección de la sesión.
  const familiaNum = Number(familiaId.slice(1)) as 1 | 2 | 3 | 4 | 5;
  const catalogoCompleto = (await getIndicadoresPorFamilia(familiaNum)).map((i) => ({
    id: i.id,
    nombre: i.nombre,
    tieneSerie: tieneSerie(i.id),
  }));
  const activos = new Set(indicadores.map((i) => i.id));

  return {
    resultForModel: {
      familiaId,
      nombre: meta.nombre,
      descripcion: meta.descripcion,
      totalActivos: indicadores.length,
      indicadoresActivos: indicadores,
      catalogoCompleto,
      nota:
        "`indicadoresActivos` son los que este usuario tiene en su tabla comparativa. " +
        "`catalogoCompleto` es toda la familia — úsalo para resolver un ID por nombre. " +
        "Si el ID que necesitas está en catalogoCompleto pero NO en indicadoresActivos, " +
        "dile al usuario que ese indicador no está en su selección (puede agregarlo en la pestaña Indicadores) " +
        "en vez de consultarlo.",
      idsNoActivos: catalogoCompleto.filter((i) => !activos.has(i.id)).map((i) => i.id),
    },
    toolCall: {
      tool: "listar_indicadores_familia",
      input,
      resultSummary: `${meta.nombre}: ${indicadores.length} activos de ${catalogoCompleto.length} en el catálogo.`,
      ok: true,
    },
  };
}

async function consultarIndicador(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const indicadorId = String(input.indicadorId ?? "");
  const registro = await getIndicadorRegistro(indicadorId);
  const familia = familiaDeIndicador(indicadorId);
  const nivelSolicitado = (input.nivel as NivelTablaFontana | undefined) ?? nivelPorDefecto(ctx.territorio);

  // Indicadores narrativos de F5 → endpoint dedicado (texto real).
  if (esIndicadorNarrativoCurado(indicadorId)) {
    const n = await fetchNarrativa(indicadorId, ctx);
    if (!n) {
      const rs = `No se pudo consultar «${indicadorId}».`;
      return { resultForModel: { indicadorId, error: rs }, toolCall: { tool: "consultar_indicador", input, resultSummary: rs, ok: false } };
    }
    const result = {
      indicadorId,
      nombre: registro?.nombre ?? indicadorId,
      definicion: registro?.definicion ?? null,
      nivel: n.nivel,
      valor: n.valor, // string con contenido | null
      unidad: null,
      naturaleza: n.naturaleza,
      fuenteEtiqueta: n.fuenteEtiqueta,
      motivo: n.motivo,
      agregacionPlural: null,
      disponibilidadTemporal: registro?.disponibilidadTemporal ?? null,
      tieneSerie: tieneSerie(indicadorId),
      nivelesComparados: null, // indicador narrativo curado: un solo nivel
    };
    const rs =
      n.valor !== null
        ? `${result.nombre}: contenido narrativo disponible (${n.nivel}).`
        : `${result.nombre}: ${n.motivo}`;
    return { resultForModel: result, toolCall: { tool: "consultar_indicador", input, resultSummary: rs, ok: n.valor !== null } };
  }

  // ID inexistente en el registry → NO seguir. Error explícito para que el
  // modelo autocorrija llamando a listar_indicadores_familia (el bug real:
  // "F4-gini" inventado en vez de F4-2). No aplica a narrativos (ya
  // retornaron arriba).
  if (!registro) {
    const rs = `El indicadorId «${indicadorId}» no existe. Llama a listar_indicadores_familia (familia ${familia}) para obtener los IDs reales y vuelve a intentar con uno de ellos.`;
    return {
      resultForModel: { indicadorId, error: rs, idInvalido: true },
      toolCall: { tool: "consultar_indicador", input, resultSummary: rs, ok: false },
    };
  }

  if (familia === "F4") {
    // F4 no cae en el flujo geográfico; el agente la consulta por su rama
    // propia del endpoint de familia (shape `fila` de países).
    const resp = await fetch(`${ctx.baseUrl}/api/fontana/familia/F4?sesionId=${ctx.sesionId}`, { headers: { cookie: ctx.cookie } });
    if (!resp.ok) {
      const rs = `No se pudo consultar «${indicadorId}» (Familia 4).`;
      return { resultForModel: { indicadorId, error: rs }, toolCall: { tool: "consultar_indicador", input, resultSummary: rs, ok: false } };
    }
    const data = (await resp.json()) as { indicadores: { id: string; nombre: string; definicion?: string; fila: unknown }[]; paisPrincipal: unknown; paisesReferencia: unknown };
    const ind = data.indicadores.find((i) => i.id === indicadorId);
    if (!ind) {
      const rs = `«${indicadorId}» no está en la selección de Familia 4 de esta sesión.`;
      return { resultForModel: { indicadorId, error: rs }, toolCall: { tool: "consultar_indicador", input, resultSummary: rs, ok: false } };
    }
    const result = { indicadorId, nombre: ind.nombre, definicion: ind.definicion ?? null, esComparacionInternacional: true, paisPrincipal: data.paisPrincipal, paisesReferencia: data.paisesReferencia, fila: ind.fila, disponibilidadTemporal: registro.disponibilidadTemporal ?? null, tieneSerie: tieneSerie(indicadorId), nivelesComparados: null };
    return { resultForModel: result, toolCall: { tool: "consultar_indicador", input, resultSummary: `${ind.nombre}: comparación internacional por país.`, ok: true } };
  }

  const resp = await fetchFamilia(familia, ctx);
  if (!resp) {
    const rs = `No se pudo consultar «${indicadorId}».`;
    return { resultForModel: { indicadorId, error: rs }, toolCall: { tool: "consultar_indicador", input, resultSummary: rs, ok: false } };
  }
  const ind = resp.indicadores.find((i) => i.id === indicadorId);
  if (!ind) {
    const rs = `«${indicadorId}» no está en la selección de ${FAMILIA_ETIQUETAS[familia]} de esta sesión.`;
    return { resultForModel: { indicadorId, error: rs }, toolCall: { tool: "consultar_indicador", input, resultSummary: rs, ok: false } };
  }
  const celda = ind.celdas.find((c) => c.nivel === nivelSolicitado);
  // naturaleza: la celda puede no traerla (ej. F3 Bloque 2 = CeldaNoDisponible);
  // se completa desde el registry (ya clasificada por nivel).
  const naturalezaRegistry =
    registro?.niveles.find((n) => n.nivel === (nivelSolicitado === "distrital" ? "distrital" : nivelSolicitado))?.naturaleza ?? null;

  const esPlural = esTerritorioParcial(ctx.territorio);
  const celdaProyecto = ind.celdas.find((c) => c.nivel === nivelPorDefecto(ctx.territorio));
  const agregacionPlural = esPlural ? mapAgregacionPlural(celdaProyecto) : null;

  const valor = celda?.valor ?? null;

  // compararNiveles: consolida en 1 llamada el valor en cada nivel geográfico
  // que el endpoint de familia ya resolvió (mismo cómputo que la tabla) — no
  // hay cálculo nuevo, solo se dejan de descartar los otros niveles.
  const compararNiveles = input.compararNiveles === true;
  const nivelesComparados = compararNiveles
    ? ind.celdas.map((c) => ({
        nivel: c.nivel,
        valor: c.valor ?? null,
        unidad: c.unidad ?? null,
        naturaleza: c.naturaleza ?? registro.niveles.find((n) => n.nivel === c.nivel)?.naturaleza ?? null,
        fuenteEtiqueta: c.fuenteEtiqueta ?? ind.fuenteEtiqueta ?? null,
        motivo: c.valor === undefined ? c.motivo ?? "Nivel no cubierto." : null,
      }))
    : null;

  const result = {
    indicadorId,
    nombre: ind.nombre,
    definicion: ind.definicion ?? registro?.definicion ?? null,
    nivelDelProyecto: nivelPorDefecto(ctx.territorio),
    nivel: nivelSolicitado,
    valor,
    unidad: celda?.unidad ?? null,
    naturaleza: celda?.naturaleza ?? naturalezaRegistry,
    fuenteEtiqueta: celda?.fuenteEtiqueta ?? ind.fuenteEtiqueta ?? null,
    motivo: valor === null ? celda?.motivo ?? "Nivel no cubierto." : null,
    agregacionPlural,
    disponibilidadTemporal: registro.disponibilidadTemporal ?? null,
    tieneSerie: tieneSerie(indicadorId),
    nivelesComparados,
  };
  const rs = compararNiveles
    ? `${ind.nombre}: ${nivelesComparados!.filter((n) => n.valor !== null).length}/${nivelesComparados!.length} niveles con dato.`
    : valor !== null
      ? `${ind.nombre} (${nivelSolicitado}): ${valor}${result.unidad ? " " + result.unidad : ""}`
      : `${ind.nombre} (${nivelSolicitado}): sin dato — ${result.motivo}`;
  return { resultForModel: result, toolCall: { tool: "consultar_indicador", input, resultSummary: rs, ok: compararNiveles ? true : valor !== null } };
}

async function generarVisualizacion(
  input: Record<string, unknown>,
  ctx: ToolContext,
  mensajeId: string
): Promise<ToolResult> {
  const tipo = String(input.tipo ?? "") as "resumen" | "grafica" | "tabla" | "distribucion" | "serie_temporal";
  const familiaFromInput = input.familiaId as FamiliaFontanaId | undefined;
  const indicadorId = input.indicadorId as string | undefined;
  const familiaId: FamiliaFontanaId | undefined =
    familiaFromInput ?? (indicadorId ? familiaDeIndicador(indicadorId) : undefined);

  const reject = (resultSummary: string): ToolResult => ({
    resultForModel: { rechazado: true, motivo: resultSummary },
    toolCall: { tool: "generar_visualizacion", input, resultSummary, ok: false },
  });

  // serie_temporal — evolución en el tiempo, solo F2-17. No usa el endpoint
  // de familia (los datos vienen de /api/fontana/serie-temporal).
  if (tipo === "serie_temporal") {
    return generarSerieTemporal(input, ctx, mensajeId, reject);
  }

  if (!familiaId) return reject("Falta familiaId (para resumen/tabla) o indicadorId (para grafica).");

  // [C4] Familia 4 no está disponible en Canvas esta ronda.
  if (familiaId === "F4") {
    return reject(
      "Familia 4 (comparación internacional) todavía no está disponible en Canvas. Usa navegar_pestana para abrirla en la pestaña Indicadores."
    );
  }

  const meta = {
    mensajeId,
    familiaId,
    familiaEtiqueta: FAMILIA_ETIQUETAS[familiaId],
    territorioLabel: territorioLabel(ctx.territorio),
  };

  const resp = await fetchFamilia(familiaId, ctx);
  if (!resp) return reject(`No se pudieron cargar los indicadores de ${FAMILIA_ETIQUETAS[familiaId]}.`);

  let item: FontanaCanvasItem;

  if (tipo === "grafica") {
    if (!indicadorId) return reject("Para una gráfica hace falta indicadorId.");
    const registro = await getIndicadorRegistro(indicadorId);
    const tipoAgregacion = registro?.agregacionPlural?.tipo;
    const esNarrativo = esIndicadorNarrativoCurado(indicadorId) || tipoAgregacion === "narrativo_sintetizado";

    // [C3] Un indicador narrativo (texto) no se grafica nunca.
    if (esNarrativo) {
      return reject(
        `No tiene sentido graficar «${registro?.nombre ?? indicadorId}»: es un indicador narrativo (texto), no numérico. Puedo agregarlo como resumen en su lugar.`
      );
    }

    const ind = resp.indicadores.find((i) => i.id === indicadorId);
    if (!ind) return reject(`«${indicadorId}» no está en la selección de ${FAMILIA_ETIQUETAS[familiaId]} de esta sesión.`);

    // [C3] no_agregable + sesión plural → sustituir la gráfica por un
    // desglose por unidad (nunca un número combinado inventado).
    if (esTerritorioParcial(ctx.territorio) && tipoAgregacion === "no_agregable") {
      const celdaProyecto = ind.celdas.find((c) => c.nivel === nivelPorDefecto(ctx.territorio));
      const motivoNoAgregable =
        registro?.agregacionPlural?.notas ??
        "Este indicador no se puede combinar en un solo valor para varias unidades territoriales.";
      item = construirCanvasDesglose(ind, celdaProyecto ?? { nivel: nivelPorDefecto(ctx.territorio) }, motivoNoAgregable, meta);
      await appendCanvasItem(ctx.sesionId, item);
      const resultSummary = `«${ind.nombre}» no se puede combinar en un solo valor para varias unidades (${motivoNoAgregable}), así que en vez de una gráfica agregué al Canvas el desglose por unidad (${item.filas.length} unidades).`;
      return {
        resultForModel: { canvasItemId: item.id, tipo: item.tipo, titulo: item.titulo, resumen: resultSummary },
        toolCall: { tool: "generar_visualizacion", input, resultSummary, ok: true },
        canvasItem: item,
      };
    }

    item = construirCanvasGrafica(resp, ind, meta);
  } else if (tipo === "distribucion") {
    if (!indicadorId) return reject("Para una distribución hace falta indicadorId.");
    if (!INDICADORES_CON_DISTRIBUCION.has(indicadorId)) {
      return reject(
        "Este indicador no tiene un desglose por categorías disponible; puedo mostrarte su comparación entre niveles geográficos en su lugar (tipo 'grafica')."
      );
    }
    const ind = resp.indicadores.find((i) => i.id === indicadorId);
    if (!ind) return reject(`«${indicadorId}» no está en la selección de ${FAMILIA_ETIQUETAS[familiaId]} de esta sesión.`);
    // La `distribucion` puede estar solo en algunos niveles (F2-12: nac/est;
    // F1-*: los 3). Se toma la del nivel del proyecto, y si no, se sube.
    const ordenBusqueda: NivelTablaFontana[] = [nivelPorDefecto(ctx.territorio), "municipal", "estatal", "nacional"];
    const celdaDist = ordenBusqueda
      .map((n) => ind.celdas.find((c) => c.nivel === n && c.distribucion && Object.keys(c.distribucion).length > 0))
      .find(Boolean);
    if (!celdaDist || !celdaDist.distribucion) {
      return reject(`«${ind.nombre}» no tiene desglose por categorías para este territorio a ningún nivel disponible.`);
    }
    item = construirCanvasDistribucion(
      indicadorId,
      ind.nombre,
      celdaDist.nivel,
      celdaDist.distribucion,
      celdaDist.fuenteEtiqueta ?? ind.fuenteEtiqueta,
      meta
    );
    await appendCanvasItem(ctx.sesionId, item);
    const dist = item as Extract<FontanaCanvasItem, { tipo: "distribucion" }>;
    const resultSummary = `Agregué al Canvas la distribución de «${ind.nombre}» (${dist.categorias.length} categorías, nivel ${dist.nivel}).`;
    return {
      resultForModel: {
        canvasItemId: item.id,
        tipo: item.tipo,
        titulo: item.titulo,
        resumen: resultSummary,
        nivel: dist.nivel,
        formato: dist.formato,
        categorias: dist.categorias,
        nota: dist.nota ?? null,
        instruccionChat: dist.nota
          ? "Menciona la `nota` al usuario en tu respuesta del chat, no la dejes solo en el Canvas."
          : null,
      },
      toolCall: { tool: "generar_visualizacion", input, resultSummary, ok: true },
      canvasItem: item,
    };
  } else if (tipo === "resumen") {
    const nivel = ((input.nivel as NivelTablaFontana | undefined) ?? nivelPorDefecto(ctx.territorio)) as NivelTablaFontana;
    item = construirCanvasResumen(resp, nivel, meta);
  } else if (tipo === "tabla") {
    item = construirCanvasTabla(resp, meta);
  } else {
    return reject(`Tipo de visualización no soportado: ${tipo}`);
  }

  await appendCanvasItem(ctx.sesionId, item);
  const resultSummary = `Agregué al Canvas: ${item.titulo}.`;
  return {
    resultForModel: {
      canvasItemId: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      resumen: resultSummary,
      // Para "resumen": los valores ya resueltos, para que el modelo escriba
      // la síntesis de 4-6 líneas en el chat SIN llamadas adicionales.
      ...(item.tipo === "resumen"
        ? {
            territorio: meta.territorioLabel,
            nivel: item.nivel,
            filas: item.filas.map((f) => ({
              indicador: f.nombre,
              valor: f.valor,
              unidad: f.unidad ?? null,
              naturaleza: f.naturaleza ?? null,
              motivo: f.motivo ?? null,
            })),
            instruccionSintesis:
              "Escribe en el chat una síntesis de 4-6 líneas (NO indicador por indicador) sobre qué dice este conjunto para el territorio del proyecto y su implicación estratégica en comunicación política. Usa SOLO estos valores; no introduzcas cifras que no estén aquí.",
          }
        : {}),
    },
    toolCall: { tool: "generar_visualizacion", input, resultSummary, ok: true },
    canvasItem: item,
  };
}

// UNA sola tool-call → las 5 familias con sus indicadores activos. Evita
// que el modelo encadene 5 llamadas a listar_indicadores_familia.
async function listarIndicadoresActivosTodasFamilias(ctx: ToolContext): Promise<ToolResult> {
  const familias: FamiliaFontanaId[] = ["F1", "F2", "F3", "F4", "F5"];
  const resultados = await Promise.all(
    familias.map(async (fid) => {
      const meta = FAMILIA_META[fid];
      const res = await fetch(`${ctx.baseUrl}/api/fontana/familia/${fid}?sesionId=${ctx.sesionId}`, {
        headers: { cookie: ctx.cookie },
      });
      const activos =
        res.ok
          ? ((await res.json()) as { indicadores?: { id: string; nombre: string }[] }).indicadores ?? []
          : [];
      const totalCatalogo = (await getIndicadoresPorFamilia(Number(fid.slice(1)) as 1 | 2 | 3 | 4 | 5)).length;
      return {
        familiaId: fid,
        nombre: meta.nombre,
        indicadoresActivos: activos.map((i) => ({ id: i.id, nombre: i.nombre, tieneSerie: tieneSerie(i.id) })),
        totalActivos: activos.length,
        totalCatalogo,
      };
    })
  );
  const totalActivos = resultados.reduce((s, f) => s + f.totalActivos, 0);
  return {
    resultForModel: {
      familias: resultados,
      totalActivos,
      nota: "`indicadoresActivos` son los que este usuario tiene en su tabla comparativa. `totalCatalogo` es el total disponible por familia (puede agregar más desde la pestaña Indicadores).",
    },
    toolCall: {
      tool: "listar_indicadores_activos_todas_familias",
      input: {},
      resultSummary: `${totalActivos} indicadores activos en total, en ${resultados.filter((f) => f.totalActivos > 0).length} familias.`,
      ok: true,
    },
  };
}

// Consulta de un indicador en un territorio EXTERNO al proyecto (Fase 1).
// Reusa la misma fuente de datos; solo cambia la resolución de territorio.
// NO se mezcla con la agregación de territorio plural del proyecto.
async function consultarIndicadorTerritorioExterno(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const indicadorId = String(input.indicadorId ?? "");
  const territorioNombre = String(input.territorioNombre ?? "").trim();
  const estadoNombre = input.estadoNombre ? String(input.estadoNombre).trim() : "";
  const nivel = input.nivel === "municipal" ? "municipal" : input.nivel === "estatal" ? "estatal" : "";
  if (!indicadorId || !territorioNombre) {
    const rs = "Faltan indicadorId o territorioNombre.";
    return { resultForModel: { error: rs }, toolCall: { tool: "consultar_indicador_territorio_externo", input, resultSummary: rs, ok: false } };
  }

  const params = new URLSearchParams({ sesionId: ctx.sesionId, indicadorId, territorio: territorioNombre });
  if (estadoNombre) params.set("estado", estadoNombre);
  if (nivel) params.set("nivel", nivel);
  const res = await fetch(`${ctx.baseUrl}/api/fontana/consulta-territorio?${params.toString()}`, {
    headers: { cookie: ctx.cookie },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const rs = String(data.mensaje ?? data.error ?? "No se pudo consultar el territorio externo.");
    return { resultForModel: { error: rs }, toolCall: { tool: "consultar_indicador_territorio_externo", input, resultSummary: rs, ok: false } };
  }
  if (data.ambiguo) {
    const cands = data.candidatos as { estado: string; municipio: string }[];
    const rs = `«${territorioNombre}» es ambiguo: ${cands.length} municipios con ese nombre.`;
    return {
      resultForModel: {
        ambiguo: true,
        candidatos: cands,
        instruccion: "Pregunta al usuario a cuál de estos territorios se refiere (municipio + estado). NO asumas ninguno.",
      },
      toolCall: { tool: "consultar_indicador_territorio_externo", input, resultSummary: rs, ok: false },
    };
  }
  if (data.noResuelto) {
    const rs = `No reconozco el territorio «${territorioNombre}».`;
    return {
      resultForModel: { noResuelto: true, error: rs, instruccion: "Dile al usuario que no reconociste ese territorio y pídele que verifique el nombre (estado o municipio de México)." },
      toolCall: { tool: "consultar_indicador_territorio_externo", input, resultSummary: rs, ok: false },
    };
  }

  const terr = data.territorio as { label: string };
  const rs =
    data.valor !== null
      ? `${String(data.nombre)} en ${terr.label}: ${String(data.valor)}${data.unidad ? " " + String(data.unidad) : ""}`
      : `${String(data.nombre)} en ${terr.label}: sin dato — ${String(data.motivo)}`;
  return {
    resultForModel: {
      ...data,
      instruccion:
        `Este dato es de ${terr.label}, NO del territorio del proyecto (${territorioLabel(ctx.territorio)}). ` +
        `Dilo explícitamente en tu respuesta (ej. "Este dato es de ${terr.label}, no de tu proyecto en ${territorioLabel(ctx.territorio)}."). ` +
        `Cita la fuente igual que en cualquier otro dato.`,
    },
    toolCall: { tool: "consultar_indicador_territorio_externo", input, resultSummary: rs, ok: data.valor !== null },
  };
}

// ==========================================
// SERIE TEMPORAL (T10, piloto 2026-09-01) — solo F2-17. Los datos vienen de
// GET /api/fontana/serie-temporal (nunca de un import directo). Dos rutas:
// consultar_serie_temporal (solo lectura) y generar_visualizacion tipo
// "serie_temporal" (al Canvas). Ambas comparten el fetch de abajo.
// ==========================================

type PuntoSerieCanvas = {
  periodo: string;
  valor: number | null;
  ranking?: number | null;
  nivelCompetitividad?: string;
  nota?: string;
};

async function fetchSerie(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<Record<string, unknown>> {
  const indicadorId = String(input.indicadorId ?? "");
  const params = new URLSearchParams({ sesionId: ctx.sesionId, indicadorId });
  const territorioNombre = input.territorioNombre ? String(input.territorioNombre).trim() : "";
  const estadoNombre = input.estadoNombre ? String(input.estadoNombre).trim() : "";
  if (territorioNombre) params.set("territorio", territorioNombre);
  if (estadoNombre) params.set("estado", estadoNombre);
  const res = await fetch(`${ctx.baseUrl}/api/fontana/serie-temporal?${params.toString()}`, {
    headers: { cookie: ctx.cookie },
  });
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

// Frase de alcance según el nivel REAL de la serie — SIEMPRE, sea el
// territorio del proyecto o uno externo.
function instruccionAlcance(nivel: unknown, label: string): string {
  if (nivel === "nacional") {
    return "Este es un dato NACIONAL (todo México). Dilo así al reportarlo.";
  }
  if (nivel === "estatal") {
    return `Este es un dato ESTATAL — aplica a TODO el estado (${label}). NO es un promedio ni agregado de los municipios/distritos del proyecto. Dilo así al reportarlo.`;
  }
  if (nivel === "municipal") {
    return `Este es un dato MUNICIPAL — de ${label}.`;
  }
  return "";
}

async function consultarSerieTemporal(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const territorioNombre = input.territorioNombre ? String(input.territorioNombre).trim() : "";
  const data = await fetchSerie(input, ctx);
  const tool = "consultar_serie_temporal" as const;

  if (data.multiEstado) {
    const estados = (data.estados as string[]) ?? [];
    const rs = `El proyecto abarca ${estados.length} estados (${estados.join(", ")}).`;
    return {
      resultForModel: {
        multiEstado: true,
        estados,
        instruccion:
          "El proyecto abarca varios estados y el ICE es un dato estatal. Pregunta al usuario a CUÁL de ESTOS estados suyos se refiere — es su proyecto, solo hay que precisar cuál (mismo criterio que un municipio homónimo). Cuando responda, vuelve a llamar esta herramienta con territorioNombre = ese estado. NO elijas tú.",
      },
      toolCall: { tool, input, resultSummary: rs, ok: false },
    };
  }
  if (data.ambiguo) {
    const cands = (data.candidatos as { estado: string; municipio: string }[]) ?? [];
    const rs = `«${territorioNombre}» es ambiguo: ${cands.length} municipios con ese nombre.`;
    return {
      resultForModel: {
        ambiguo: true,
        candidatos: cands,
        instruccion: "Pregunta al usuario a cuál de estos territorios se refiere (municipio + estado). NO asumas.",
      },
      toolCall: { tool, input, resultSummary: rs, ok: false },
    };
  }
  if (data.noResuelto) {
    const rs = `No reconozco el territorio «${territorioNombre}».`;
    return {
      resultForModel: { noResuelto: true, error: rs, instruccion: "Dile al usuario que no reconociste ese territorio y pídele que verifique el nombre del estado." },
      toolCall: { tool, input, resultSummary: rs, ok: false },
    };
  }
  if (data.error === "sin_serie") {
    const rs = String(data.mensaje ?? "Este indicador no tiene serie histórica.");
    return {
      resultForModel: { error: "sin_serie", mensaje: rs, instruccion: "Explica que ese indicador no tiene serie histórica disponible en Fontana todavía; si aplica, usa su `disponibilidadTemporal.nota`. Aplica el bloque de 'Preguntas de evolución temporal'." },
      toolCall: { tool, input, resultSummary: rs, ok: false },
    };
  }
  if (!data.ok) {
    const rs = String(data.motivo ?? "No se pudo obtener la serie.");
    return { resultForModel: { error: rs }, toolCall: { tool, input, resultSummary: rs, ok: false } };
  }

  const terr = data.territorio as { label: string };
  const puntos = (data.puntos as { periodo: string; valor: number | null }[]) ?? [];
  const rs = `${String(data.nombre)} en ${terr.label}: serie ${String(data.periodoInicio)}-${String(data.periodoFin)} (${puntos.length} años).`;
  const instruccion =
    `${instruccionAlcance(data.nivel, terr.label)} ` +
    (data.esTerritorioExterno
      ? `Además, esta serie es de ${terr.label}, que NO es parte del territorio del proyecto (${territorioLabel(ctx.territorio)}). Aclárualo. `
      : data.esTerritorioDelProyecto
        ? `Esta es la serie de ${terr.label} — el territorio del proyecto a este nivel. `
        : "") +
    "Cita la fuente. Si la serie trae `ranking` por punto, menciona los cambios de posición cuando sean relevantes.";
  return {
    resultForModel: { ...data, instruccion },
    toolCall: { tool, input, resultSummary: rs, ok: true },
  };
}

async function generarSerieTemporal(
  input: Record<string, unknown>,
  ctx: ToolContext,
  mensajeId: string,
  reject: (rs: string) => ToolResult
): Promise<ToolResult> {
  const indicadorId = String(input.indicadorId ?? "");
  if (!tieneSerie(indicadorId)) {
    return reject("Este indicador no tiene serie histórica disponible en Fontana todavía.");
  }
  const data = await fetchSerie(input, ctx);

  if (data.multiEstado) {
    const estados = (data.estados as string[]) ?? [];
    return reject(
      `El proyecto abarca varios estados (${estados.join(", ")}). Este es un dato por estado — pregunta al usuario a cuál de sus estados se refiere y vuelve a intentar con ese estado (territorioNombre).`
    );
  }
  if (data.ambiguo) {
    const cands = (data.candidatos as { estado: string; municipio: string }[]) ?? [];
    return reject(`«${String(input.territorioNombre ?? "")}» coincide con ${cands.length} municipios; pregunta al usuario a cuál se refiere.`);
  }
  if (data.noResuelto) return reject(`No reconozco el territorio «${String(input.territorioNombre ?? "")}».`);
  if (data.error === "sin_serie") return reject(String(data.mensaje ?? "Ese indicador no tiene serie histórica."));
  if (!data.ok) return reject(String(data.motivo ?? "No se pudo obtener la serie."));

  const terr = data.territorio as { label: string };
  const esTerritorioExterno = Boolean(data.esTerritorioExterno);
  const esTerritorioDelProyecto = Boolean(data.esTerritorioDelProyecto);
  const familiaId = familiaDeIndicador(indicadorId);
  const meta = {
    mensajeId,
    familiaId,
    familiaEtiqueta: FAMILIA_ETIQUETAS[familiaId],
    territorioLabel: terr.label,
  };
  const formato = (["conteo", "moneda", "porcentaje", "indice"] as const).includes(
    data.formato as "conteo" | "moneda" | "porcentaje" | "indice"
  )
    ? (data.formato as "conteo" | "moneda" | "porcentaje" | "indice")
    : "conteo";
  const item = construirCanvasSerieTemporal(
    indicadorId,
    String(data.nombre ?? indicadorId),
    {
      unidad: data.unidad as string | undefined,
      naturaleza: data.naturaleza as NaturalezaDato | undefined,
      fuenteEtiqueta: String(data.fuenteEtiqueta ?? ""),
      formato,
      nivel: data.nivel as NivelTablaFontana,
      puntos: (data.puntos as PuntoSerieCanvas[] | undefined) ?? [],
    },
    terr.label,
    { esTerritorioExterno, esTerritorioDelProyecto },
    meta
  );
  await appendCanvasItem(ctx.sesionId, item);
  const resultSummary = `Agregué al Canvas la serie de «${item.indicadorNombre}» para ${terr.label} (${item.periodoInicio}-${item.periodoFin}).`;
  return {
    resultForModel: {
      canvasItemId: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      resumen: resultSummary,
      nivel: item.nivel,
      esTerritorioExterno,
      esTerritorioDelProyecto,
      territorioLabel: terr.label,
      instruccionChat:
        `${instruccionAlcance(item.nivel, terr.label)}` +
        (esTerritorioExterno
          ? ` Además, ${terr.label} no es parte del territorio del proyecto — aclárualo.`
          : ""),
    },
    toolCall: { tool: "generar_visualizacion", input, resultSummary, ok: true },
    canvasItem: item,
  };
}

// Lista de ENTIDADES detrás de un conteo/clasificación — solo F3-8 / F5-6 / F5-8.
const INDICADORES_CON_DETALLE = new Set(["F3-8", "F5-6", "F5-8"]);

async function consultarDetalleIndicador(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const indicadorId = String(input.indicadorId ?? "");
  const offset = Number.isFinite(Number(input.offset)) && Number(input.offset) >= 0 ? Number(input.offset) : 0;

  if (!INDICADORES_CON_DETALLE.has(indicadorId)) {
    const rs = `«${indicadorId}» no tiene desglose por entidad disponible. Solo F3-8 (municipios ZAP), F5-6 (giros DENUE) y F5-8 (localidades GACP) lo tienen.`;
    return { resultForModel: { indicadorId, error: rs, sinDetalle: true }, toolCall: { tool: "consultar_detalle_indicador", input, resultSummary: rs, ok: false } };
  }

  const familia = familiaDeIndicador(indicadorId);
  const estado = ctx.territorio.estado;
  const municipio = ctx.territorio.municipio;
  if (!estado) {
    const rs = "La sesión no tiene un estado definido; no puedo obtener el desglose por entidad.";
    return { resultForModel: { indicadorId, error: rs }, toolCall: { tool: "consultar_detalle_indicador", input, resultSummary: rs, ok: false } };
  }
  if ((indicadorId === "F5-6" || indicadorId === "F5-8") && !municipio) {
    const rs = `El desglose de «${indicadorId}» es por municipio y la sesión no tiene uno definido.`;
    return { resultForModel: { indicadorId, error: rs }, toolCall: { tool: "consultar_detalle_indicador", input, resultSummary: rs, ok: false } };
  }

  const params = new URLSearchParams({ sesionId: ctx.sesionId, indicadorId, estado, offset: String(offset) });
  if (municipio) params.set("municipio", municipio);
  const res = await fetch(`${ctx.baseUrl}/api/fontana/familia/${familia}/detalle?${params.toString()}`, {
    headers: { cookie: ctx.cookie },
  });
  if (!res.ok) {
    const rs = `No se pudo obtener el desglose de «${indicadorId}».`;
    return { resultForModel: { indicadorId, error: rs }, toolCall: { tool: "consultar_detalle_indicador", input, resultSummary: rs, ok: false } };
  }
  const data = (await res.json()) as {
    items: Array<{ nombre?: string; giro?: string; conteo?: number; poblacion?: number; grado?: string }>;
    total: number;
    offset: number;
    hasMore: boolean;
  };
  const registro = await getIndicadorRegistro(indicadorId);
  const entidades = data.items.map((it) => {
    if (it.giro !== undefined) return { nombre: it.giro, conteo: it.conteo ?? null };
    if (it.grado !== undefined) return { nombre: it.nombre ?? "", poblacion: it.poblacion ?? null, grado: it.grado };
    return { nombre: it.nombre ?? "" };
  });
  const rs = `${registro?.nombre ?? indicadorId}: ${entidades.length} entidades (de ${data.total} en total${data.hasMore ? ", hay más" : ""}).`;
  return {
    resultForModel: {
      indicadorId,
      nombre: registro?.nombre ?? indicadorId,
      total: data.total,
      offset: data.offset,
      hasMore: data.hasMore,
      entidades,
      nota: data.hasMore
        ? "Lista parcial. Si el usuario quiere ver más, vuelve a llamar con `offset` incrementado."
        : "Lista completa.",
    },
    toolCall: { tool: "consultar_detalle_indicador", input, resultSummary: rs, ok: true },
  };
}

function navegarPestana(input: Record<string, unknown>): ToolResult {
  const pestana = input.pestana === "indicadores" ? "indicadores" : "fontana";
  const familiaId = input.familiaId as FamiliaFontanaId | undefined;
  return {
    resultForModel: { ok: true },
    toolCall: {
      tool: "navegar_pestana",
      input,
      resultSummary: `Navegación → ${pestana}${familiaId ? ` (${familiaId})` : ""}`,
      ok: true,
    },
    navEvent: { pestana, familiaId: pestana === "indicadores" ? familiaId : undefined },
  };
}
