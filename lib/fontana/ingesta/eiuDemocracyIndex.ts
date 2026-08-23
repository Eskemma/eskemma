// lib/fontana/ingesta/eiuDemocracyIndex.ts
// Adaptador de F4-6 (Índice de Democracia, EIU) — Familia 4. Único
// adaptador de Familia 4 con curación manual (mecanismoAcceso
// "curacion_manual", mismo criterio ya usado para F5-3/F5-4 en Familia
// 5) en vez de fetch en vivo — justificado abajo.
//
// PARCIALMENTE DIFERIDO — solo `rank`/`categoria` están activos; `score`
// queda diferido (ver `confiabilidadPorCampo` en el tipo
// CeldaComparativaPais y las notas de INDICATOR_REGISTRY.json para F4-6).
//
// Cadena de procedencia (EIU → CRS → Fontana), verificada 2026-08-21:
//   1. EIU (The Economist Intelligence Unit) publica el Democracy Index
//      anualmente. Desde la edición 2025, EIU eliminó el apéndice
//      país-por-país de su reporte gratuito (ahora solo vía dataset de
//      pago, Snowflake Marketplace) — no hay hoy ninguna fuente EIU
//      directa y gratuita con el detalle por país.
//   2. Congressional Research Service (CRS) — el servicio de
//      investigación no partidista del Congreso de EE.UU. — publica
//      "Democracy in Latin America and the Caribbean: A Compilation of
//      Selected Indices" (informe R46016, actualizado 2025-04-25,
//      versión 11, https://www.congress.gov/crs-product/R46016), que
//      compila el EIU Democracy Index 2024 citando la fuente en nota al
//      pie (nota 9 del informe: "EIU, Democracy Index 2024: What's
//      wrong with representative democracy? 2025"). Es un documento
//      oficial del gobierno de EE.UU. (Congress.gov), citable y
//      trazable.
//   3. El CRS solo publica RANK y CATEGORÍA (Tabla 2 del informe, ej.
//      México: rank 84 de 167, "Hybrid regime") — nunca el score
//      numérico 0-10. Esto reproduce exactamente la distinción que ya
//      traía el catálogo original ("rank/categoría corroborados
//      oficialmente; score solo por espejo").
//
// Wikipedia (única fuente libre que sí publica el score numérico
// completo) queda DESCARTADA por principio del proyecto — nunca fuente
// de datos en Fontana, sin excepción (editable sin control
// institucional). El score de F4-6 queda diferido hasta que exista una
// fuente oficial citable para el valor numérico.
//
// Por qué curación manual y no fetch en vivo: el informe CRS es un PDF
// (no una API ni un CSV/XLSX estructurado), se actualiza con baja
// frecuencia (~1 vez/año, ligado a la edición anual de EIU), y su tabla
// mezcla texto narrativo con datos — parsear un PDF en cada request de
// Fontana sería frágil y desproporcionado para un dato que cambia una
// vez al año. Mismo criterio ya aplicado a F5-3/F5-4 (INAH/monografías/
// cronistas, curación manual, sin pipeline automatizado).
//
// Ronda 6 (2026-08-22) — ampliado de 5 a 24 países, transcribiendo el
// resto de las Tablas 1-3 del informe CRS R46016 ya leído (mismo
// alcance del propio informe: "Democracy in Latin America and the
// Caribbean" — Solo LATAM por diseño de la fuente, nunca los 167 países
// que sí cubre EIU globalmente; algunos países caribeños del informe
// (Antigua y Barbuda, Bahamas, Barbados, Belice, Dominica, Granada, San
// Cristóbal y Nieves, Santa Lucía, San Vicente y las Granadinas) no
// tienen fila EIU en el CRS — "—" en la Tabla 1 original, no se
// transcriben cifras inventadas). Datos transcritos de las Tablas 1/2/3
// del informe CRS R46016 (EIU Democracy Index 2024, año cubierto:
// calendario 2024):
const TABLA_EIU_CRS_2024: Record<string, { nombre: string; rank: number; categoria: string }> = {
  // Tabla 1 — Caribe
  CUB: { nombre: "Cuba", rank: 135, categoria: "Authoritarian" },
  DOM: { nombre: "República Dominicana", rank: 52, categoria: "Flawed democracy" },
  GUY: { nombre: "Guyana", rank: 69, categoria: "Flawed democracy" },
  HTI: { nombre: "Haití", rank: 131, categoria: "Authoritarian" },
  JAM: { nombre: "Jamaica", rank: 49, categoria: "Flawed democracy" },
  SUR: { nombre: "Surinam", rank: 48, categoria: "Flawed democracy" },
  TTO: { nombre: "Trinidad y Tobago", rank: 45, categoria: "Flawed democracy" },
  // Tabla 2 — México y Centroamérica
  CRI: { nombre: "Costa Rica", rank: 18, categoria: "Full democracy" },
  SLV: { nombre: "El Salvador", rank: 95, categoria: "Hybrid regime" },
  GTM: { nombre: "Guatemala", rank: 97, categoria: "Hybrid regime" },
  HND: { nombre: "Honduras", rank: 90, categoria: "Hybrid regime" },
  MEX: { nombre: "México", rank: 84, categoria: "Hybrid regime" },
  NIC: { nombre: "Nicaragua", rank: 147, categoria: "Authoritarian" },
  PAN: { nombre: "Panamá", rank: 47, categoria: "Flawed democracy" },
  // Tabla 3 — Sudamérica
  ARG: { nombre: "Argentina", rank: 54, categoria: "Flawed democracy" },
  BOL: { nombre: "Bolivia", rank: 103, categoria: "Hybrid regime" },
  BRA: { nombre: "Brasil", rank: 57, categoria: "Flawed democracy" },
  CHL: { nombre: "Chile", rank: 29, categoria: "Flawed democracy" },
  COL: { nombre: "Colombia", rank: 60, categoria: "Flawed democracy" },
  ECU: { nombre: "Ecuador", rank: 85, categoria: "Hybrid regime" },
  PRY: { nombre: "Paraguay", rank: 75, categoria: "Hybrid regime" },
  PER: { nombre: "Perú", rank: 78, categoria: "Hybrid regime" },
  URY: { nombre: "Uruguay", rank: 15, categoria: "Full democracy" },
  VEN: { nombre: "Venezuela", rank: 142, categoria: "Authoritarian" },
};

const FUENTE_ETIQUETA = "Congressional Research Service, R46016 (cita EIU Democracy Index 2024)";
const AÑO_EDICION = 2024;

import type { CeldaComparativaPais, PaisComparativoCompleto } from "@/lib/fontana/tablaComparativaInternacional";

function celdaDesdeFila(iso3: string, fila: { rank: number; categoria: string } | undefined): CeldaComparativaPais {
  if (!fila) return { iso3, estadoConsulta: "sin_datos_confirmado", motivo: "Sin dato transcrito de CRS para este país" };
  return {
    iso3,
    valor: fila.rank,
    unidad: `rank global (de 167, edición ${AÑO_EDICION}) — ${fila.categoria}`,
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA,
    estadoConsulta: "ok",
    // Aquí `valor` YA ES el rank (a diferencia de PNUD/TI/RSF, donde
    // `valor` es una métrica distinta y `rankOficial` es auxiliar) —
    // pero el campo se puebla igual: bug real reportado por Raúl
    // (2026-08-22), la ausencia de este campo hacía que el modal
    // mostrara un número de lista distinto al "Rank 84" que ya
    // aparecía a la derecha, y un aviso de "sin rank oficial" que
    // contradecía el propio dato mostrado.
    rankOficial: fila.rank,
    confiabilidadPorCampo: { rank: "alta", categoria: "alta", score: "baja" },
  };
}

export async function resolverEiuDemocracyIndex(isos3: string[]): Promise<Map<string, CeldaComparativaPais>> {
  const porPais = new Map<string, CeldaComparativaPais>();
  for (const iso3 of isos3) {
    porPais.set(iso3, celdaDesdeFila(iso3, TABLA_EIU_CRS_2024[iso3]));
  }
  return porPais;
}

// Todos los países con dato — para el modal "Ver resto de países".
export async function resolverEiuDemocracyIndexTodos(): Promise<PaisComparativoCompleto[]> {
  return Object.entries(TABLA_EIU_CRS_2024).map(([iso3, fila]) => ({ iso3, nombre: fila.nombre, celda: celdaDesdeFila(iso3, fila) }));
}
