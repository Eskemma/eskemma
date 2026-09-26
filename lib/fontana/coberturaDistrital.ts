// lib/fontana/coberturaDistrital.ts
// Cobertura del dato DISTRITAL (26-09-26). El valor distrital de Fontana agrega el Censo 2020
// (por sección censal, vía ECEG) al distrito con la cartografía electoral vigente; una fracción
// de las secciones 2020 no tiene correspondencia en esa cartografía (desfase censo ↔ redistritación)
// y `coberturaPct` mide qué parte de la población del distrito sí se pudo asignar. NO es un dato
// dudoso: es el dato real del Censo agregado a un distrito, con un porcentaje conocido de cobertura.
//
// Un aviso graduado (decisión de Raúl, 26-09-26; mismo criterio en el chat y en el panel):
//   ≥ 99 %      → sin aviso
//   90 – 99 %   → nota breve
//   < 90 %      → advertencia fuerte
// Antes el panel avisaba igual a 98.4 % y a 64.1 %, y el chat no veía la cobertura (Yucatán: los 6
// distritos federales van de 98.7 % a 64.1 %).
//
// Módulo PURO (sin firebase/red/React): lo consumen el chat (tools.ts) y el panel (cliente).

/** Desde este % de cobertura el dato distrital se presenta sin aviso. */
export const UMBRAL_COBERTURA_COMPLETA = 99;
/** Desde este % (y por debajo del anterior) basta una nota breve; por debajo, advertencia fuerte. */
export const UMBRAL_COBERTURA_ALTA = 90;

export type NivelAvisoCobertura = "ninguno" | "nota" | "fuerte";

/** Nivel de aviso según la cobertura. Sin cobertura conocida no hay nada que advertir. */
export function nivelAvisoCobertura(coberturaPct: number | null | undefined): NivelAvisoCobertura {
  if (typeof coberturaPct !== "number" || Number.isNaN(coberturaPct)) return "ninguno";
  if (coberturaPct >= UMBRAL_COBERTURA_COMPLETA) return "ninguno";
  if (coberturaPct >= UMBRAL_COBERTURA_ALTA) return "nota";
  return "fuerte";
}

/** Un decimal, sin ceros de más ("98.4", "72.8", "64.1"). */
const fmt = (n: number): string => String(Math.round(n * 10) / 10);

export interface AvisoCoberturaChat {
  nivel: Exclude<NivelAvisoCobertura, "ninguno">;
  /** Texto que el modelo debe transmitir (con el % real), en lenguaje llano. */
  texto: string;
}

/**
 * Aviso para el chat. `esProporcion`: el valor es un porcentaje/razón (los no asignados no "restan
 * población" al resultado, solo lo calculan con menos secciones); si es un conteo, sí lo subestima.
 */
export function avisoCoberturaChat(
  coberturaPct: number | null | undefined,
  opts: { esProporcion: boolean }
): AvisoCoberturaChat | null {
  const nivel = nivelAvisoCobertura(coberturaPct);
  if (nivel === "ninguno" || typeof coberturaPct !== "number") return null;

  const pct = fmt(coberturaPct);
  const resto = fmt(100 - coberturaPct);
  const base =
    `El dato distrital cubre aproximadamente el ${pct}% de la población del distrito según el Censo 2020 y la cartografía electoral vigente ` +
    `(el ${resto}% restante no pudo asignarse a este distrito por el desfase entre el censo y la redistritación).`;
  const efecto = opts.esProporcion
    ? "Como es un porcentaje, se calcula solo con la población que sí se pudo asignar."
    : "Por eso la cifra puede subestimar la población real del distrito.";

  if (nivel === "nota") return { nivel, texto: `${base} ${efecto}` };
  return {
    nivel,
    texto:
      `ADVERTENCIA: ${base} ${efecto} Con una cobertura tan baja el valor puede no representar al distrito completo: úsalo con reserva ` +
      `y ofrécele al usuario el dato municipal como referencia complementaria — que decida él cuál le sirve.`,
  };
}

/** ¿La unidad del indicador es un porcentaje/razón? (afecta cómo se explica la cobertura). */
export function esUnidadProporcion(unidad: string | null | undefined): boolean {
  return typeof unidad === "string" && /%|por cada|tasa|raz[oó]n/i.test(unidad);
}
