// lib/moddulo/versionado/inertCubiertos.ts
// C4b-2a (H-V63) — mientras el panel «Historial» está abierto, la cabecera y el pie del sitio quedan inertes. SOLO los
// elementos marcados con `data-cubre-dialogo` (`app/components/Layout.tsx`); nada más del `body` se toca (el overlay de
// errores de Next, el anuncio de rutas y el aviso de cookies siguen como están). Devuelve la función que RESTAURA el
// estado previo de cada elemento (no los pone a `false` a ciegas: si ya eran inertes por otra razón, siguen siéndolo) y
// que no lanza aunque un elemento falle.

export const SELECTOR_CUBIERTOS = "[data-cubre-dialogo]";

interface ElementoInerte {
  inert: boolean;
}

export function inertarCubiertos(raiz: { querySelectorAll(s: string): ArrayLike<ElementoInerte> }): () => void {
  const previos: { el: ElementoInerte; inert: boolean }[] = [];
  try {
    const els = raiz.querySelectorAll(SELECTOR_CUBIERTOS);
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      previos.push({ el, inert: el.inert === true });
      el.inert = true;
    }
  } catch {
    // Si algo falla a medias, lo ya marcado se restaura igual en la función devuelta.
  }
  let hecho = false;
  return () => {
    if (hecho) return;
    hecho = true;
    for (const p of previos) {
      try {
        p.el.inert = p.inert;
      } catch {
        // un elemento que ya no existe no debe impedir restaurar los demás
      }
    }
  };
}
