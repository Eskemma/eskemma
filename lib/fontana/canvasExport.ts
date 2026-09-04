// lib/fontana/canvasExport.ts
// Serializa un FontanaCanvasItem tabular (resumen/tabla/desglose) a
// Markdown para reutilizar LITERAL el mecanismo ya existente de
// lib/shared/reportExport.ts (exportToPdf — popup + window.print(), sin
// dependencia nueva). Solo genera contenido; el mecanismo de exportación
// no se toca ni se duplica.

import type { FontanaCanvasItem } from "@/types/fontana.types";
import { NOMBRE_NIVEL_TABLA } from "@/lib/fontana/tablaColumnas";

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
