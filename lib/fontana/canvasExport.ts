// lib/fontana/canvasExport.ts
// Serializa un FontanaCanvasItem tabular (resumen/tabla/desglose) a
// Markdown para reutilizar LITERAL el mecanismo ya existente de
// lib/shared/reportExport.ts (exportToPdf — popup + window.print(), sin
// dependencia nueva). Solo genera contenido; el mecanismo de exportación
// no se toca ni se duplica.

import type { FontanaCanvasItem } from "@/types/fontana.types";
import { NOMBRE_NIVEL_TABLA, type CeldaTablaFontana, type NivelTablaFontana } from "@/lib/fontana/tablaColumnas";

function escapeCelda(v: string): string {
  return v.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function filaMd(cols: string[]): string {
  return `| ${cols.map(escapeCelda).join(" | ")} |`;
}

/**
 * Convierte un item de Canvas tabular (resumen/tabla/desglose) a Markdown
 * — único tipo de contenido que `exportToPdf` sabe consumir. Los tipos
 * gráficos (grafica/distribucion/serie_temporal) NO pasan por aquí; se
 * exportan como imagen (ver app/components/shared/exportElementAsImage.ts).
 */
export function canvasItemToMarkdown(item: FontanaCanvasItem): string {
  const lineas: string[] = [`# ${item.titulo}`, ""];

  if (item.tipo === "resumen") {
    lineas.push(filaMd(["Indicador", "Valor", "Fuente"]));
    lineas.push(filaMd(["---", "---", "---"]));
    for (const f of item.filas) {
      const valor = f.valor !== null ? `${f.valor}${f.unidad ? ` ${f.unidad}` : ""}` : (f.motivo ?? "Sin dato");
      lineas.push(filaMd([f.nombre, valor, f.fuenteEtiqueta ?? ""]));
    }
    return lineas.join("\n");
  }

  if (item.tipo === "desglose") {
    lineas.push(item.motivoNoAgregable, "");
    lineas.push(filaMd(["Unidad", "Valor"]));
    lineas.push(filaMd(["---", "---"]));
    for (const f of item.filas) {
      const valor =
        f.valor !== null && f.valor !== undefined
          ? typeof f.valor === "number"
            ? f.valor.toLocaleString("es-MX")
            : String(f.valor)
          : (f.motivo ?? "Sin dato");
      lineas.push(filaMd([f.unidad, valor]));
    }
    if (item.fuenteEtiqueta) lineas.push("", `Fuente: ${item.fuenteEtiqueta}`);
    return lineas.join("\n");
  }

  if (item.tipo === "tabla") {
    const encabezado = ["Indicador", ...item.columnas.map((c) => NOMBRE_NIVEL_TABLA[c])];
    lineas.push(filaMd(encabezado));
    lineas.push(filaMd(encabezado.map(() => "---")));
    for (const ind of item.indicadores) {
      const fila = [ind.nombre];
      for (const col of item.columnas) {
        const celda = ind.celdas.find((c) => c.nivel === col);
        if (!celda) {
          fila.push("");
        } else if (celda.valor !== undefined) {
          fila.push(`${celda.valor.toLocaleString("es-MX")}${celda.unidad ? ` ${celda.unidad}` : ""}`);
        } else {
          fila.push(celda.motivo ?? "Sin dato");
        }
      }
      lineas.push(filaMd(fila));
    }
    return lineas.join("\n");
  }

  // Tipos gráficos no deberían llegar aquí — defensa en profundidad.
  return lineas.join("\n");
}

function fmtNum(v: number | null | undefined): string {
  return v === null || v === undefined ? "Sin dato" : v.toLocaleString("es-MX");
}

/**
 * Bloque Markdown corto y sin prosa para un canvasItem GRÁFICO
 * (grafica / distribucion / serie_temporal / comparacion_territorios /
 * serie_internacional). El reporte de sesión no puede embeber imágenes
 * (exportToPdf es popup + window.print()), así que cada gráfica del Canvas
 * se representa aquí como su título + una tabla compacta de los valores +
 * la fuente. NO reemplaza la tarjeta visual del Canvas; es solo para que
 * el reporte descargable lleve las cifras.
 */
export function canvasItemResumenTextoMd(item: FontanaCanvasItem): string {
  const lineas: string[] = [`### ${item.titulo}`, ""];

  if (item.tipo === "grafica") {
    lineas.push(filaMd(["Nivel", "Valor"]));
    lineas.push(filaMd(["---", "---"]));
    for (const b of item.barras) {
      const valor = b.valor !== null ? `${fmtNum(b.valor)}${item.unidad ? ` ${item.unidad}` : ""}` : (b.motivo ?? "Sin dato");
      lineas.push(filaMd([b.etiquetaNivel, valor]));
    }
    if (item.fuenteEtiqueta) lineas.push("", `Fuente: ${item.fuenteEtiqueta}`);
    return lineas.join("\n");
  }

  if (item.tipo === "distribucion") {
    if (item.piramideSexo && item.piramideSexo.length > 0) {
      lineas.push(filaMd(["Grupo de edad", "Hombres", "Mujeres"]));
      lineas.push(filaMd(["---", "---", "---"]));
      for (const g of item.piramideSexo) {
        lineas.push(filaMd([g.etiqueta, fmtNum(g.hombres), fmtNum(g.mujeres)]));
      }
    } else {
      lineas.push(filaMd(["Categoría", "Valor"]));
      lineas.push(filaMd(["---", "---"]));
      for (const c of item.categorias) lineas.push(filaMd([c.etiqueta, fmtNum(c.valor)]));
    }
    if (item.nota) lineas.push("", `_${item.nota}_`);
    if (item.fuenteEtiqueta) lineas.push("", `Fuente: ${item.fuenteEtiqueta}`);
    return lineas.join("\n");
  }

  if (item.tipo === "serie_temporal") {
    lineas.push(`Serie ${item.territorioLabel} (${item.periodoInicio}–${item.periodoFin}), nivel ${item.nivel}.`, "");
    lineas.push(filaMd(["Año", "Valor"]));
    lineas.push(filaMd(["---", "---"]));
    for (const p of item.puntos) lineas.push(filaMd([p.periodo, fmtNum(p.valor)]));
    if (item.nota) lineas.push("", `_${item.nota}_`);
    lineas.push("", `Fuente: ${item.fuenteEtiqueta}`);
    return lineas.join("\n");
  }

  if (item.tipo === "comparacion_territorios") {
    lineas.push(filaMd(["Territorio", "Nivel", "Valor"]));
    lineas.push(filaMd(["---", "---", "---"]));
    for (const f of item.filas) {
      const valor = f.valor !== null ? `${fmtNum(f.valor)}${item.unidad ? ` ${item.unidad}` : ""}` : (f.motivo ?? "Sin dato");
      lineas.push(filaMd([f.territorioLabel, NOMBRE_NIVEL_TABLA[f.nivel], valor]));
    }
    if (item.noResueltos.length > 0) {
      lineas.push("", `No resueltos: ${item.noResueltos.map((n) => `${n.nombreIngresado} (${n.motivo})`).join("; ")}`);
    }
    if (item.fuenteEtiqueta) lineas.push("", `Fuente: ${item.fuenteEtiqueta}`);
    return lineas.join("\n");
  }

  if (item.tipo === "serie_internacional") {
    lineas.push(`Comparación internacional (${item.periodoInicio}–${item.periodoFin}).`, "");
    lineas.push(filaMd(["País", `Valor ${item.periodoFin}`, "Estado"]));
    lineas.push(filaMd(["---", "---", "---"]));
    for (const p of item.paises) {
      const ultimo = p.puntos.length > 0 ? p.puntos[p.puntos.length - 1].valor : null;
      const estado = p.estadoConsulta === "ok" ? "" : (p.motivo ?? p.estadoConsulta);
      lineas.push(filaMd([p.pais, fmtNum(ultimo), estado]));
    }
    if (item.nota) lineas.push("", `_${item.nota}_`);
    lineas.push("", `Fuente: ${item.fuenteEtiqueta}`);
    return lineas.join("\n");
  }

  return lineas.join("\n");
}

// Orden canónico de columnas de la tabla comparativa (unión de todos los
// sets que produce columnasParaTipoProyecto).
const ORDEN_NIVELES: NivelTablaFontana[] = [
  "nacional", "estatal", "distrital", "distrital_federal", "distrital_local", "municipal", "ageb",
];

function valorCeldaMd(celda: CeldaTablaFontana | undefined): string {
  if (!celda) return "";
  if (celda.valor !== undefined) {
    return `${celda.valor.toLocaleString("es-MX")}${celda.unidad ? ` ${celda.unidad}` : ""}`;
  }
  return celda.motivo ?? "Sin dato";
}

/**
 * Serializa a UNA tabla markdown los valores CRUDOS de la tabla
 * comparativa (CeldaTablaFontana por nivel) de una lista de indicadores —
 * para el reporte de sesión, que debe incluir los indicadores heredados/
 * consultados en la tabla aunque nunca hayan pasado por el chat
 * (defecto Oaxaca, 26-09-10). Mismo criterio de valor/motivo que
 * canvasItemToMarkdown para `tipo:"tabla"`.
 *
 * Columnas = los niveles realmente presentes en los datos, en orden
 * canónico. Fuente = fuenteEtiqueta de la primera celda con valor.
 */
export function celdasTablaResumenMd(
  indicadores: { id: string; nombre: string; celdas: CeldaTablaFontana[] }[]
): string {
  if (indicadores.length === 0) return "";

  const nivelesPresentes = new Set<NivelTablaFontana>();
  for (const ind of indicadores) {
    for (const c of ind.celdas) nivelesPresentes.add(c.nivel);
  }
  const niveles = ORDEN_NIVELES.filter((n) => nivelesPresentes.has(n));

  const encabezado = ["Indicador", ...niveles.map((n) => NOMBRE_NIVEL_TABLA[n]), "Fuente"];
  const lineas: string[] = [filaMd(encabezado), filaMd(encabezado.map(() => "---"))];

  for (const ind of indicadores) {
    const fila = [ind.nombre];
    for (const nivel of niveles) {
      fila.push(valorCeldaMd(ind.celdas.find((c) => c.nivel === nivel)));
    }
    const fuente = ind.celdas.find((c) => c.valor !== undefined && c.fuenteEtiqueta)?.fuenteEtiqueta ?? "";
    fila.push(fuente);
    lineas.push(filaMd(fila));
  }

  return lineas.join("\n");
}
