// Window around the first difference between two texts, for the «antes → después» lines of the difference
// strips and modals. Cutting both values at their START hides a change that sits later in the text (the two
// sides then look identical); this shows the same stretch of both, starting a little before the first difference.
//
// Pure. Limits (declared): comparison is exact on the displayed text after collapsing whitespace, so a change
// that is only spaces/line breaks, or only Unicode form (NFC vs NFD), shows both sides equal. `diffXpcto`
// does not normalize either, so such a pair can still be reported as a change.

export const TEXTO_VACIO = "(vacío)";
const ELIPSIS = "…";

export interface OpcionesVentana {
  /** Max graphemes shown per side, not counting «…». */
  max?: number;
  /** Graphemes of common text kept before the first difference. */
  contexto?: number;
}

function grafemas(texto: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(texto), (s) => s.segment);
  }
  return Array.from(texto);
}

function preparar(valor: string | null | undefined): string {
  const t = (valor ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? TEXTO_VACIO : t;
}

function recortar(segs: string[], inicio: number, max: number): string {
  const fin = inicio + max;
  return (inicio > 0 ? ELIPSIS : "") + segs.slice(inicio, fin).join("") + (fin < segs.length ? ELIPSIS : "");
}

export function ventanaDeDiferencia(
  anterior: string | null | undefined,
  nuevo: string | null | undefined,
  { max = 60, contexto = 15 }: OpcionesVentana = {}
): { anterior: string; nuevo: string } {
  const a = grafemas(preparar(anterior));
  const b = grafemas(preparar(nuevo));
  const limite = Math.min(a.length, b.length);
  let prefijo = 0;
  while (prefijo < limite && a[prefijo] === b[prefijo]) prefijo++;
  // Identical values: window from the start.
  const iguales = prefijo === a.length && prefijo === b.length;
  const inicio = iguales ? 0 : Math.max(0, prefijo - contexto);
  return { anterior: recortar(a, inicio, max), nuevo: recortar(b, inicio, max) };
}
