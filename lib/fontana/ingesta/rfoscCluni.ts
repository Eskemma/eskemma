// lib/fontana/ingesta/rfoscCluni.ts
// F3-15 (Presencia de organizaciones sociales) — fuente correcta:
// RFOSC/CLUNI (Registro Federal de las Organizaciones de la Sociedad
// Civil, INDESOL/Bienestar). Sin conector esta ronda: verificado en vivo
// 2026-08-26 que ambos puntos de acceso conocidos siguen caídos —
// `corresponsabilidad.gob.mx` (connection refused) y
// `sii.bienestar.gob.mx/portal` (HTTP 500). Mismo diagnóstico que la
// investigación original de Familia 3 ("infraestructura caída,
// reintentar"), sin cambios. No se busca fuente alterna — RFOSC/CLUNI es
// la fuente oficial correcta, sustituirla por un proxy de menor calidad no
// es aceptable (decisión de Raúl, 2026-08-26).
//
// A diferencia del Bloque 2 (F3-5/6/9-14, dependen de Sefix-AI, app en
// pausa), aquí SÍ hay una fuente externa real y definitiva — solo su
// infraestructura está caída. Motivo propio (MOTIVO_RFOSC_CAIDO),
// visualmente distinto del motivo de Bloque 2, para no confundir "depende
// de otra app" con "fuente caída, reintentar".

import { getMunicipiosOptions } from "@/lib/geo/municipios";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import { MOTIVO_RFOSC_CAIDO } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_RFOSC = "RFOSC/CLUNI (INDESOL-Bienestar)";

export async function resolverPresenciaOrganizacionesSociales(
  _territorio: Territorio
): Promise<CeldaFontana[]> {
  return (["nacional", "estatal", "distrital", "municipal"] as const).map(
    (nivel) => ({ nivel, motivo: MOTIVO_RFOSC_CAIDO })
  );
}

// --- Agregación plural (2026-08-27, Gap B) ---
// Bulk resolver trivial — sin conector, el motivo de caída es el mismo
// para cualquier municipio. Existe solo para que el path plural
// (resolverAgregacionPlural, index.ts) muestre MOTIVO_RFOSC_CAIDO en vez
// del genérico "Sin valor combinado disponible para este indicador".
export async function resolverMunicipiosEstadoRfosc(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  const opciones = await getMunicipiosOptions(estadoCve);
  const filtradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;
  return filtradas.map(({ cve, nombre }): ElementoDeEstado => ({ cve, nombre, celda: { nivel: "municipal", motivo: MOTIVO_RFOSC_CAIDO } }));
}
