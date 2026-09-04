// app/components/shared/exportElementAsImage.ts
// Exporta un elemento del DOM (una tarjeta, un gráfico) como PNG/JPG —
// primera instancia de este patrón en el proyecto (26-09-05, Fontana
// Canvas). Ningún otro módulo capturaba HTML/SVG como imagen antes de
// esto (verificado — sin html2canvas/html-to-image/dom-to-image previos
// en el repo). Construido aquí, en shared, para que el PRÓXIMO módulo que
// necesite exportar una imagen reutilice esto en vez de reimplementarlo.
//
// Client-side únicamente (rasterizar un nodo del DOM es inherentemente de
// navegador) — usa html-to-image (liviana, buen soporte de SVG/CSS, sin
// dependencias nativas), la única librería de este tipo en el proyecto.

import { toPng, toJpeg } from "html-to-image";

export type FormatoImagen = "png" | "jpg";

/**
 * Captura `el` como imagen y dispara la descarga en el navegador —
 * blob → object URL → click sintético, sin dejar un `<a>` persistente en
 * el DOM.
 */
export async function exportElementAsImage(
  el: HTMLElement,
  filename: string,
  formato: FormatoImagen = "png"
): Promise<void> {
  const dataUrl =
    formato === "jpg"
      ? await toJpeg(el, { quality: 0.95, backgroundColor: "#ffffff", pixelRatio: 2 })
      : await toPng(el, { backgroundColor: "#ffffff", pixelRatio: 2 });

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
