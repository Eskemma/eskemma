// lib/fontana/familia4Catalogo.ts
// Nombres de los indicadores de Familia 4 (Comparación internacional),
// Fontana_T10_Cierre_Paso2_v2.md §3 — catálogo original de 9 indicadores
// (F4-1..F4-9). Verificación en vivo de esta ronda (2026-08-21) dividió
// F4-9 ("Confianza en instituciones", cita Latinobarómetro) en 3
// indicadores reales: CEPALSTAT no publica un solo indicador genérico de
// "confianza en instituciones" — solo indicadores por institución
// específica (congreso/partidos, policía, poder judicial), cada uno con
// su propio indicator_id. Promediarlos habría sido un índice sintético
// sin metodología real detrás (mismo criterio ya aplicado contra índices
// compuestos propios en Familia 1/2) — se muestran como 3 indicadores
// independientes en vez de 1. El catálogo de Familia 4 queda en 11
// indicadores (no es un error de numeración).
//
// A diferencia de Familia 1-3, Familia 4 no tiene niveles geográficos
// subnacionales — compara el país principal del proyecto (ver
// resolverPaisPrincipal) contra un set fijo de países de referencia (ver
// PAISES_REFERENCIA_F4). Ver lib/fontana/tablaComparativaInternacional.ts.
//
// Ronda 6 (2026-08-22): país principal dinámico — corrige un hallazgo
// erróneo de la Ronda 5 (búsqueda sobre una ruta de archivo inexistente
// que concluyó que `territorio.pais` nunca se poblaba). El componente
// real, `app/components/shared/TerritorySelector.tsx`, SÍ captura país
// activamente (dropdown cerrado de 23 países, PAISES_IBEROAMERICA) y ya
// se usa tal cual en el flujo standalone de Fontana — no hacía falta
// construir nada nuevo, solo LEER el campo donde antes no se leía.

import type { Territorio } from "@/types/shared.types";
import { isMexico } from "@/lib/centinela/pestel/utils/country";

export const FAMILIA4_ORDEN: string[] = [
  "F4-1", "F4-2", "F4-3", "F4-4", "F4-5", "F4-6", "F4-7", "F4-8",
  "F4-9", "F4-10", "F4-11",
];

export const FAMILIA4_NOMBRES: Record<string, string> = {
  "F4-1": "PIB per cápita PPA",
  "F4-2": "Gini internacional",
  "F4-3": "IDH global",
  "F4-4": "Pobreza línea internacional",
  "F4-5": "Inflación",
  "F4-6": "Índice de Democracia (EIU)",
  "F4-7": "Índice de Percepción de Corrupción",
  "F4-8": "Libertad de Prensa (RSF)",
  // F4-9 mide DESCONFIANZA (no confianza) — polaridad invertida
  // respecto a F4-10/F4-11: valor alto = mayor desconfianza, peor
  // percepción. El nombre lo deja explícito para no confundir la
  // lectura de la fila.
  "F4-9": "Desconfianza en partidos políticos y el congreso",
  "F4-10": "Confianza en la policía",
  "F4-11": "Confianza en el poder judicial",
};

// Ninguno queda completamente diferido — F4-6 tiene su campo `score`
// diferido (EIU eliminó su apéndice país-por-región país-por-país en la
// edición 2025; Wikipedia descartada por principio del proyecto — nunca
// fuente de datos), pero `rank`/`categoria` sí están activos (fuente:
// Congressional Research Service, informe R46016, que cita a EIU con
// nota al pie). Un indicador PARCIALMENTE diferido no se marca aquí —
// este set es solo para indicadores sin NINGÚN mecanismo real.
export const FAMILIA4_DIFERIDOS = new Set<string>([]);

// Set fijo de países de referencia — el usuario NUNCA elige (coherente
// con la decisión de arquitectura v1: "sin adaptador de armonización
// entre países", "no se fuerzan comparaciones"). Criterio (documentado
// en el plan de Ronda 2, 2026-08-21): las 4 economías más grandes de
// América Latina después de México, con datos reales confirmados en las
// 5 fuentes de Familia 4, y densidad visual comparable al resto de la
// tabla de Fontana (nunca más de 4-5 columnas a la vez).
export const PAISES_REFERENCIA_F4: { iso3: string; nombre: string }[] = [
  { iso3: "COL", nombre: "Colombia" },
  { iso3: "CHL", nombre: "Chile" },
  { iso3: "BRA", nombre: "Brasil" },
  { iso3: "ARG", nombre: "Argentina" },
];

export const MEXICO_ISO3 = "MEX";

// Mismo set cerrado de PAISES_IBEROAMERICA que
// app/components/shared/TerritorySelector.tsx — un país solo puede venir
// de esa lista (dropdown, no texto libre), así que este mapa nunca
// necesita más de estas 23 entradas.
const PAIS_ISO3_POR_NOMBRE: Record<string, string> = {
  "México": "MEX",
  "Estados Unidos": "USA",
  "España": "ESP",
  "Argentina": "ARG",
  "Bolivia": "BOL",
  "Brasil": "BRA",
  "Chile": "CHL",
  "Colombia": "COL",
  "Costa Rica": "CRI",
  "Cuba": "CUB",
  "Ecuador": "ECU",
  "El Salvador": "SLV",
  "Guatemala": "GTM",
  "Honduras": "HND",
  "Nicaragua": "NIC",
  "Panamá": "PAN",
  "Paraguay": "PRY",
  "Perú": "PER",
  "Portugal": "PRT",
  "Puerto Rico": "PRI",
  "República Dominicana": "DOM",
  "Uruguay": "URY",
  "Venezuela": "VEN",
};

// Reverso de PAIS_ISO3_POR_NOMBRE — usado por adaptadores cuya fuente
// solo trae `iso3` sin nombre de país en el registro (CEPALSTAT), a
// diferencia de Banco Mundial/PNUD/RSF/TI que ya traen el nombre en su
// propia respuesta. Cobertura real de CEPALSTAT confirmada como
// exactamente los 18 países LATAM (ver ALCANCE_LATAM más abajo) — los
// 23 nombres de PAISES_IBEROAMERICA siempre alcanzan.
export const ISO3_A_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(PAIS_ISO3_POR_NOMBRE).map(([nombre, iso3]) => [iso3, nombre])
);

// Único punto que decide el país principal de Familia 4 — si más
// adelante cambia el criterio de fallback (ej. Iberoamérica deja de
// asumir México por default), este es el único lugar a tocar. Mismo
// criterio de respaldo ya establecido en el ecosistema para
// `territorio.pais` ausente: `isMexico()` (lib/centinela/pestel/utils/country.ts),
// ya usado por PESTEL para el mismo campo del mismo tipo `Territorio`
// compartido — no se inventa un fallback distinto para Fontana.
export function resolverPaisPrincipal(territorio: Territorio): { iso3: string; nombre: string } {
  if (isMexico(territorio.pais)) return { iso3: MEXICO_ISO3, nombre: "México" };
  const iso3 = PAIS_ISO3_POR_NOMBRE[territorio.pais!];
  // territorio.pais viene de un dropdown cerrado — este caso solo
  // ocurriría con datos corruptos/legados fuera del set conocido; cae
  // en México por el mismo criterio de respaldo, nunca revienta.
  return iso3 ? { iso3, nombre: territorio.pais! } : { iso3: MEXICO_ISO3, nombre: "México" };
}

// Polaridad por indicador — mayor_mejor: un valor más alto es una mejor
// posición; menor_mejor: un valor más bajo es mejor. Sistemático para
// los 11 indicadores (Ronda 5, Punto 5.5) — reemplaza la nota ad-hoc que
// antes solo cubría F4-9 en FontanaF4Panel.tsx. Usado para ordenar el
// modal "Ver resto de países" de mejor a peor posición real.
export const FAMILIA4_POLARIDAD: Record<string, "mayor_mejor" | "menor_mejor"> = {
  "F4-1": "mayor_mejor", // PIB per cápita
  "F4-2": "menor_mejor", // Gini — más desigual = peor
  "F4-3": "mayor_mejor", // IDH
  "F4-4": "menor_mejor", // Pobreza
  "F4-5": "menor_mejor", // Inflación
  "F4-6": "menor_mejor", // Rank EIU — rank 1 = más democrático
  "F4-7": "mayor_mejor", // CPI — 100 = menos corrupción
  "F4-8": "mayor_mejor", // RSF — 100 = más libertad de prensa
  "F4-9": "menor_mejor", // Desconfianza — valor alto = peor
  "F4-10": "mayor_mejor", // Confianza en la policía
  "F4-11": "mayor_mejor", // Confianza en el poder judicial
};

// Indicadores cuya fuente cubre solo América Latina y el Caribe por
// diseño (CEPALSTAT y el reporte CRS que alimenta F4-6) — confirmado con
// datos reales descargados, no solo con el catálogo de dimensiones de
// cada fuente (ver Ronda 5, Punto 5.2). El modal "Ver resto de países"
// debe declarar esta limitación explícitamente para estos 5 — prometer
// cobertura global sería falso.
export const ALCANCE_LATAM = new Set<string>(["F4-2", "F4-6", "F4-9", "F4-10", "F4-11"]);
