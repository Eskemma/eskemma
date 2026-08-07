// lib/fontana/naturalezaDato.ts
// Definiciones de las 5 categorías de naturaleza del dato — fuente única
// para el tooltip clicable del badge de naturaleza en
// FontanaComparativeTable.tsx. Fontana_T10_Prontuario_Naturaleza_Dato.md
// (referenciado en Fontana_T10_Arquitectura_Paso3_v2.md §6) nunca se
// materializó como archivo; estas definiciones se redactaron a partir de
// lo ya establecido en Fontana_T10_Documentacion_Tecnica.md y el ejemplo
// de F3-4/Participación electoral en Fontana_T10_Cierre_Paso4.md (caso
// real de proxy_conceptual: dato recibido ya calculado de Sefix, no
// generado por Fontana).
//
// Si aparece una categoría de naturaleza nueva al construir Familia 2-5,
// avisar antes de agregarla aquí — no inventar la definición sin
// contrastarla contra el precedente documentado, mismo criterio que se
// aplicó para corregir proxy_conceptual en este archivo.

import type { NaturalezaDato } from "@/lib/fontana/indicatorRegistry";

export const NATURALEZA_DEFINICION: Record<NaturalezaDato, string> = {
  dato_directo:
    "La cifra viene tal cual la reporta la fuente oficial (censo o registro administrativo), sin cálculo ni estimación adicional de Fontana.",
  calculo_directo:
    "Resultado de una operación aritmética simple (suma, división, porcentaje) sobre datos oficiales, sin modelos estadísticos ni supuestos adicionales.",
  estimacion_modelada:
    "Valor generado por un modelo estadístico o metodología de estimación propia de la fuente, no un conteo directo.",
  estimacion_agregada:
    "Valor calculado por Fontana sumando o promediando datos de un nivel geográfico más fino, cuando la fuente no publica el dato directamente en el nivel mostrado.",
  proxy_conceptual:
    "Un proxy conceptual es un indicador que no se calcula en Fontana, sino que se recibe ya calculado de otra app del ecosistema (por ejemplo, Sefix).",
};
