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
 *
 * Convención: la imagen descargada SIEMPRE se ve en tema CLARO (fondo
 * blanco, texto oscuro), sea cual sea el tema activo del sitio. Una imagen
 * que el usuario pega en un informe o una lámina debe ser legible ahí, y
 * dos personas que exportan la misma tarjeta deben obtener el mismo
 * archivo. `html-to-image` inlina los colores COMPUTADOS de los nodos
 * vivos, así que forzar solo `backgroundColor:"#ffffff"` no basta en modo
 * oscuro: el fondo sale blanco pero el texto conserva su variante oscura
 * (texto claro sobre fondo claro = invisible). Bug real 26-09-07: la tabla
 * año×país de las series internacionales/geográficas quedaba ilegible en
 * la descarga con el sitio en modo oscuro. Solución: quitar la clase
 * `.dark` del `<html>` durante la captura y restaurarla en `finally`
 * (parpadeo breve del sitio — aceptable para una acción explícita del
 * usuario). No toca el path de PDF, que ya se renderiza con CSS claro fijo.
 */
export async function exportElementAsImage(
  el: HTMLElement,
  filename: string,
  formato: FormatoImagen = "png"
): Promise<void> {
  const root = document.documentElement;
  const teniaDark = root.classList.contains("dark");
  if (teniaDark) {
    root.classList.remove("dark");
    // Fuerza el recálculo de estilos antes de que html-to-image lea los
    // colores computados de cada nodo.
    void root.getBoundingClientRect();
  }
  try {
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
  } finally {
    if (teniaDark) root.classList.add("dark");
  }
}
