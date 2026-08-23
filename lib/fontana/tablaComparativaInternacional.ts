// lib/fontana/tablaComparativaInternacional.ts
// Tipo paralelo a CeldaTablaFontana (lib/fontana/tablaColumnas.ts) para
// Familia 4 — NO se extiende NivelTablaFontana/columnasParaTipoProyecto,
// confirmado en la investigación de esta ronda que están acoplados 100%
// a la jerarquía geográfica mexicana (nacional/estatal/distrital/
// municipal). Familia 4 compara países, no niveles — cada columna es un
// país (el país principal del proyecto vía resolverPaisPrincipal() +
// PAISES_REFERENCIA_F4 de familia4Catalogo.ts, fijo). Los 11 indicadores
// están clasificados `no_agregable` en
// _docs/fontana-clasificacion-agregacion-plural.md.
//
// `paisPrincipal` (Ronda 6, 2026-08-22) — antes `mexico`, renombrado
// porque el país principal ya no es siempre México (ver
// resolverPaisPrincipal en familia4Catalogo.ts).

import type { NaturalezaDato } from "@/lib/fontana/indicatorRegistry";

// Mismo patrón de estado de consulta ya documentado en el catálogo de
// Familia 3 (Fontana_T10_Cierre_Paso2_v2.md §4, decisión 2) — distingue
// "la fuente no tiene el dato" de "falló la conexión", nunca colapsa
// ambos en un solo `motivo` genérico.
export type EstadoConsultaPais = "ok" | "error_conexion" | "sin_datos_confirmado" | "fuente_no_disponible";

export interface CeldaComparativaPais {
  iso3: string;
  valor?: number;
  unidad?: string;
  naturaleza?: NaturalezaDato;
  fuenteEtiqueta?: string;
  estadoConsulta: EstadoConsultaPais;
  motivo?: string;
  // Rank oficial publicado por la propia fuente (ej. hdi_rank_2023 de
  // PNUD HDR, "Rank" de Transparencia Internacional/RSF) — SOLO cuando
  // la fuente realmente publica uno. Nunca calcular un rank propio por
  // posición cuando este campo está disponible: bug real diagnosticado
  // en Ronda 7 (2026-08-22) — un país (México/Azerbaiyán en IDH) puede
  // empatar con otro en rank oficial (competition ranking, salta el
  // siguiente número), mientras una numeración por posición de array no
  // sabe de empates y asigna números distintos al mismo rank real.
  rankOficial?: number;
  // Nota visible junto a un valor real que podría confundirse con un
  // error sin contexto (ej. F4-4: varios países con 0% real a la línea
  // de $3.00/día — dato correcto, verificado en vivo contra Banco
  // Mundial en Ronda 7, pero indistinguible de un error sin esta nota).
  // Distinto de `motivo`, que solo aplica cuando NO hay valor.
  notaAclaratoria?: string;
  // Solo F4-6 (rank/categoría vía CRS) — confiabilidad distinta por
  // sub-campo dentro de la misma celda (score diferido, no expuesto
  // aquí). Mismo campo ya previsto en el schema de INDICATOR_REGISTRY.json
  // (`confiabilidadPorCampo`, comentario "ej. F4-6 (EIU)").
  confiabilidadPorCampo?: Record<string, "alta" | "media" | "baja">;
}

export interface FilaComparativaInternacional {
  indicadorId: string;
  paisPrincipal: CeldaComparativaPais;
  referencia: CeldaComparativaPais[];
}

// Fila completa para el modal "Ver resto de países" — todos los países
// con dato real de la fuente (no solo el país principal + los 4 de
// referencia), ordenados por el caller según FAMILIA4_POLARIDAD.
export interface PaisComparativoCompleto {
  iso3: string;
  nombre: string;
  celda: CeldaComparativaPais;
}
