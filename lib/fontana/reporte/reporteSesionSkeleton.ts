// lib/fontana/reporte/reporteSesionSkeleton.ts
// Esqueleto DETERMINÍSTICO del reporte de sesión de Fontana — la mitad que
// NO pasa por Claude. Combina DOS fuentes de indicadores, sin duplicar:
//   1. sesion.canvasItems — hallazgos que el usuario fijó vía el chat
//      (pirámides, series, comparaciones). Se conservan tal cual.
//   2. indicadoresTabla — las celdas crudas de la TABLA comparativa
//      (resolverCeldasIndicadoresSesion) de TODOS los indicadores
//      seleccionados (minimos + seleccionUsuario de F1/F2/F3/F5) que NO
//      estén ya cubiertos por un canvasItem. Sin esto, un indicador
//      heredado del PIP que el usuario solo vio en la tabla nunca entraba
//      al reporte (defecto Oaxaca, 26-09-10).
//
// Salida (26-09-10, Opción C): además del markdown determinístico completo,
// expone `cabecera` + `bloques` (contenido por sección SIN prosa) +
// `resumenProsa` (resumen compacto por sección). generarReporteSesion pide
// a Claude SOLO la prosa (JSON) y ensambla el markdown final de forma
// determinística — Claude nunca ve/echa las tablas → garantía estructural
// de que no altera ninguna cifra, y ~23s en vez de ~55s.
//
// Bucketing (sin cambio de regla): un canvasItem entra COMPLETO en
// "heredados" si al menos uno de sus indicadores está en la unión de
// `minimos`; un indicador crudo de la tabla, si su id está en esa unión.
// Nunca se divide ni se duplica. Sesión suelta (sin PIP) → una sola lista.
//
// LIMITACIÓN CONOCIDA (26-09-09): hoy solo F1/F2 pueblan `minimos`
// (lib/fontana/pipMinimos.ts deriva "F1-"/"F2-" únicamente). Ver CLAUDE.md.
// F4 fuera de alcance (resolverCeldasIndicadoresSesion lo excluye; F4
// nunca es heredado).

import type { FontanaCanvasItem, FontanaContextoTerritorial, FontanaSesion } from "@/types/fontana.types";
import { canvasItemToMarkdown, canvasItemResumenTextoMd, celdasTablaResumenMd } from "@/lib/fontana/canvasExport";
import { NOMBRE_NIVEL_TABLA } from "@/lib/fontana/tablaColumnas";

const TIPOS_TABULARES = new Set<FontanaCanvasItem["tipo"]>(["resumen", "tabla", "desglose"]);

type IndicadorTabla = FontanaContextoTerritorial["indicadores"][number];

export interface BloqueSeccion {
  /** Título de la sección sin el "## ". */
  titulo: string;
  /** Contenido determinístico de la sección (canvasItems + tablas "###"), SIN el "## titulo" ni prosa. */
  markdown: string;
}

export interface EsqueletoReporte {
  /** Markdown determinístico COMPLETO (cabecera + ## + contenido), sin prosa. Fallback si Claude falla + caso "sin contenido". */
  markdownEsqueleto: string;
  /** "# titulo\n\n**Territorio:** X\n\nGenerado el Y." */
  cabecera: string;
  /** Una entrada por sección de nivel "##". */
  bloques: BloqueSeccion[];
  /** Resumen COMPACTO por sección para la llamada a Claude (solo prosa). */
  resumenProsa: string;
  secciones: { heredados: string[]; libres: string[] };
  canvasItemsRef: string[];
  origen: "canal1" | "suelta";
  /** false ⇒ ni canvasItems ni indicadores de tabla — nada que reportar. */
  hayContenido: boolean;
}

/** IDs de indicador que toca un canvasItem (uno o varios). */
function idsDeCanvasItem(item: FontanaCanvasItem): string[] {
  if (item.tipo === "resumen") return item.filas.map((f) => f.indicadorId);
  if (item.tipo === "tabla") return item.indicadores.map((i) => i.id);
  return [item.indicadorId];
}

function serializarItem(item: FontanaCanvasItem): string {
  return TIPOS_TABULARES.has(item.tipo)
    ? canvasItemToMarkdown(item)
    : canvasItemResumenTextoMd(item);
}

function territorioLabel(sesion: FontanaSesion): string {
  const t = sesion.territorio;
  return (
    t.nombre ||
    [t.estado, t.municipio].filter(Boolean).join(" › ") ||
    "el territorio del proyecto"
  );
}

/** Valores de una celda en 1 línea compacta para el resumen de prosa. */
function celdasCompactas(ind: IndicadorTabla): string {
  const conValor = ind.celdas.filter((c) => c.valor !== undefined);
  if (conValor.length > 0) {
    const fuente = conValor.find((c) => c.fuenteEtiqueta)?.fuenteEtiqueta;
    return (
      conValor.map((c) => `${NOMBRE_NIVEL_TABLA[c.nivel]} ${c.valor}${c.unidad ? ` ${c.unidad}` : ""}`).join(", ") +
      (fuente ? ` (Fuente: ${fuente})` : "")
    );
  }
  const motivo = ind.celdas.find((c) => c.motivo)?.motivo;
  return motivo ? `sin dato — ${motivo}` : "sin dato";
}

/** Líneas del resumen compacto de una sección (crudos + canvasItems). */
function resumenSeccion(items: FontanaCanvasItem[], crudos: IndicadorTabla[]): string[] {
  const lineas: string[] = [];
  for (const item of items) lineas.push(`- ${item.titulo} [visualización del Canvas]`);
  for (const ind of crudos) lineas.push(`- ${ind.nombre}: ${celdasCompactas(ind)}`);
  if (lineas.length === 0) lineas.push("- (sin indicadores en esta sección)");
  return lineas;
}

/**
 * Construye el esqueleto del reporte + la clasificación por sección.
 *
 * `nombreProyecto`: nombre del proyecto de Moddulo (Escenario a), resuelto
 * por generarReporteSesion vía getProject. Fallback: sesion.nombre → territorio.
 * `indicadoresTabla`: celdas crudas de la tabla comparativa de todos los
 * indicadores seleccionados. Los ya cubiertos por un canvasItem se descartan.
 */
export function construirEsqueletoReporte(
  sesion: FontanaSesion,
  nombreProyecto?: string,
  indicadoresTabla?: IndicadorTabla[]
): EsqueletoReporte {
  const origen: "canal1" | "suelta" = sesion.tareaPipIds.length > 0 ? "canal1" : "suelta";
  const minimosUnion = new Set(
    Object.values(sesion.indicadoresPorFamilia).flatMap((f) => f.minimos)
  );

  const items = (sesion.canvasItems ?? []).filter((it) => !it.eliminado);
  const canvasItemsRef = items.map((it) => it.id);

  const cubiertos = new Set(items.flatMap(idsDeCanvasItem));
  const crudos = (indicadoresTabla ?? []).filter((ind) => !cubiertos.has(ind.id));

  const esHeredadoId = (id: string) => origen === "canal1" && minimosUnion.has(id);

  const heredadosItems: FontanaCanvasItem[] = [];
  const libresItems: FontanaCanvasItem[] = [];
  const heredadosCrudos: IndicadorTabla[] = [];
  const libresCrudos: IndicadorTabla[] = [];
  const secHeredados = new Set<string>();
  const secLibres = new Set<string>();

  for (const item of items) {
    const ids = idsDeCanvasItem(item);
    if (origen === "canal1" && ids.some((id) => minimosUnion.has(id))) {
      heredadosItems.push(item);
      ids.forEach((id) => secHeredados.add(id));
    } else {
      libresItems.push(item);
      ids.forEach((id) => secLibres.add(id));
    }
  }
  for (const ind of crudos) {
    if (esHeredadoId(ind.id)) {
      heredadosCrudos.push(ind);
      secHeredados.add(ind.id);
    } else {
      libresCrudos.push(ind);
      secLibres.add(ind.id);
    }
  }

  const hayContenido = items.length > 0 || crudos.length > 0;

  const fecha = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
  const territorio = territorioLabel(sesion);
  const identificador = nombreProyecto?.trim() || sesion.nombre?.trim() || territorio;
  const cabecera = `# Reporte de sesión — ${identificador}\n\n**Territorio:** ${territorio}\n\nGenerado el ${fecha}.`;

  if (!hayContenido) {
    const md = `${cabecera}\n\nTodavía no hay indicadores en esta sesión: no hay hallazgos fijados en el Canvas ni indicadores seleccionados en la tabla comparativa.`;
    return {
      markdownEsqueleto: md,
      cabecera,
      bloques: [],
      resumenProsa: "",
      secciones: { heredados: [], libres: [] },
      canvasItemsRef,
      origen,
      hayContenido: false,
    };
  }

  // Contenido determinístico de una sección (canvasItems serializados +
  // tabla consolidada de crudos + nota "_Ninguno_" si vacía).
  const contenidoSeccion = (
    itemsSeccion: FontanaCanvasItem[],
    crudosSeccion: IndicadorTabla[],
    subtituloTabla: string,
    notaVacia: string
  ): string => {
    const partes: string[] = [];
    for (const item of itemsSeccion) partes.push(serializarItem(item));
    if (crudosSeccion.length > 0) {
      partes.push(`### ${subtituloTabla}\n\n${celdasTablaResumenMd(crudosSeccion)}`);
    }
    if (itemsSeccion.length === 0 && crudosSeccion.length === 0) partes.push(`_${notaVacia}_`);
    return partes.join("\n\n");
  };

  const bloques: BloqueSeccion[] = [];
  const resumenPartes: string[] = [
    `Territorio: ${territorio}.${origen === "canal1" && identificador !== territorio ? ` Proyecto: ${identificador}.` : ""}`,
  ];

  if (origen === "canal1") {
    const tHered = "Indicadores del Programa de Investigación (heredados del proyecto)";
    const tLibre = "Exploración adicional";
    bloques.push({
      titulo: tHered,
      markdown: contenidoSeccion(
        heredadosItems, heredadosCrudos,
        "Otros indicadores heredados (valores de la tabla comparativa)",
        "Ninguno de los indicadores de esta sesión corresponde a los indicadores heredados del PIP de este proyecto."
      ),
    });
    bloques.push({
      titulo: tLibre,
      markdown: contenidoSeccion(
        libresItems, libresCrudos,
        "Otros indicadores consultados en la tabla comparativa",
        "Sin indicadores adicionales fuera de los heredados."
      ),
    });
    resumenPartes.push(`## ${tHered}\n${resumenSeccion(heredadosItems, heredadosCrudos).join("\n")}`);
    resumenPartes.push(`## ${tLibre}\n${resumenSeccion(libresItems, libresCrudos).join("\n")}`);
  } else {
    const tUnica = "Hallazgos de la sesión";
    bloques.push({
      titulo: tUnica,
      markdown: contenidoSeccion(libresItems, libresCrudos, "Indicadores de la tabla comparativa", "Sin indicadores."),
    });
    resumenPartes.push(`## ${tUnica}\n${resumenSeccion(libresItems, libresCrudos).join("\n")}`);
  }

  const markdownEsqueleto = [
    cabecera,
    ...bloques.map((b) => `## ${b.titulo}\n\n${b.markdown}`),
  ].join("\n\n");

  return {
    markdownEsqueleto,
    cabecera,
    bloques,
    resumenProsa: resumenPartes.join("\n\n"),
    secciones: { heredados: [...secHeredados], libres: [...secLibres] },
    canvasItemsRef,
    origen,
    hayContenido: true,
  };
}
