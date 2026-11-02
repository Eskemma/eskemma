// lib/centinela/pestel/ajustesSinReflejar.ts
// T3: ¿qué ajustes del analista (Centinela) NO están reflejados en el mapa que Moddulo F2 importó? Puro: lo comparten
// la ruta (que arma el resumen del mapa importado) y la pantalla de Interpretación (que decide si avisa).

/** Lo mínimo de un ajuste guardado en el análisis. */
export interface AjusteAnalisis {
  dimensionCode: string;
  newClassification?: string;
  justification?: string;
}

/** De cada dimensión del mapa importado solo interesa su `ajuste` (si lo trae). */
export interface AjusteImportado {
  clasificacionAjustada?: string;
  justificacion?: string;
}

/** Resumen del mapa que F2 importó. `ajustes` está vacío si el mapa no trae ningún ajuste (p. ej. un Express). */
export interface MapaImportadoResumen {
  ajustes: Record<string, AjusteImportado>;
}

/**
 * Proyección mínima de `linkedSource.payload` (el mapa de trabajo de F2): solo el `ajuste` de cada dimensión. El
 * servidor devuelve esto en vez del mapa completo.
 */
export function ajustesDelMapaImportado(payload: unknown): MapaImportadoResumen {
  const ajustes: Record<string, AjusteImportado> = {};
  if (payload && typeof payload === "object") {
    for (const [code, dim] of Object.entries(payload as Record<string, unknown>)) {
      const a = (dim as { ajuste?: unknown } | null | undefined)?.ajuste;
      if (a && typeof a === "object") {
        const x = a as { clasificacionAjustada?: unknown; justificacion?: unknown };
        ajustes[code] = {
          ...(typeof x.clasificacionAjustada === "string" ? { clasificacionAjustada: x.clasificacionAjustada } : {}),
          ...(typeof x.justificacion === "string" ? { justificacion: x.justificacion } : {}),
        };
      }
    }
  }
  return { ajustes };
}

/**
 * Códigos de las dimensiones cuyo ajuste del análisis NO está reflejado en el mapa importado: el mapa no trae
 * `ajuste` para esa dimensión, o trae uno distinto (otra clasificación o otra justificación). Con `importado`
 * ausente (no se pudo leer) devuelve [] — no se afirma nada que no se sabe. Respeta el orden de los ajustes.
 */
export function ajustesSinReflejarEnF2(
  adjustments: AjusteAnalisis[] | null | undefined,
  importado: MapaImportadoResumen | null | undefined
): string[] {
  if (!importado) return [];
  const sin: string[] = [];
  for (const adj of adjustments ?? []) {
    if (!adj?.dimensionCode || sin.includes(adj.dimensionCode)) continue;
    const imp = importado.ajustes[adj.dimensionCode];
    const igual =
      !!imp &&
      imp.clasificacionAjustada === adj.newClassification &&
      (imp.justificacion ?? "").trim() === (adj.justification ?? "").trim();
    if (!igual) sin.push(adj.dimensionCode);
  }
  return sin;
}

/** «Político», «Político y Económico», «A, B y C». */
export function listaEnEspanol(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}
