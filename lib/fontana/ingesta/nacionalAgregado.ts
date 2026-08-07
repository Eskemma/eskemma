// lib/fontana/ingesta/nacionalAgregado.ts
// Funciones puras de agregación Nacional sobre los 32 registros estatales
// ya en Storage (sefix/eceg_2020/national.json y equivalentes de ITER) —
// sin nueva descarga. Ni ECEG ni ITER publican un total país propio
// (verificado en vivo: national.json es 32 filas por CVE_ENT, nunca un
// total agregado) — Fontana es quien construye el Nacional, siempre
// naturaleza estimacion_agregada (salvo las excepciones documentadas en
// cada adaptador: F1-5, F1-17, F1-18 dato_directo; F1-16 calculo_directo).

export function sumarConteo(
  registrosPorEstado: Record<string, Record<string, number>>,
  col: string
): number {
  let total = 0;
  for (const registro of Object.values(registrosPorEstado)) {
    total += registro[col] ?? 0;
  }
  return total;
}

export function calcularPorcentaje(
  registrosPorEstado: Record<string, Record<string, number>>,
  numCol: string,
  denomCol: string
): { valor: number; numerador: number; denominador: number } | null {
  let numerador = 0;
  let denominador = 0;
  for (const registro of Object.values(registrosPorEstado)) {
    numerador += registro[numCol] ?? 0;
    denominador += registro[denomCol] ?? 0;
  }
  if (denominador === 0) return null;
  return { valor: Math.round((numerador / denominador) * 10000) / 100, numerador, denominador };
}

// Promedio de promedios ponderado por peso_i — aproximación razonable,
// no la metodología exacta de INEGI (que promediaría sobre microdatos
// individuales, no disponibles aquí). Documentar esta limitación en el
// registro (notas) de cualquier indicador que use esta función.
export function promedioPonderado(
  registrosPorEstado: Record<string, Record<string, number>>,
  valorCol: string,
  pesoCol: string
): number | null {
  let sumaProducto = 0;
  let sumaPeso = 0;
  for (const registro of Object.values(registrosPorEstado)) {
    const valor = registro[valorCol];
    const peso = registro[pesoCol];
    if (typeof valor !== "number" || typeof peso !== "number") continue;
    sumaProducto += valor * peso;
    sumaPeso += peso;
  }
  if (sumaPeso === 0) return null;
  return Math.round((sumaProducto / sumaPeso) * 100) / 100;
}
