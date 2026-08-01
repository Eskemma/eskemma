// lib/fontana/ingesta/banxico.ts
// Adaptador de F1-17 (Remesas recibidas per cápita) sobre el SIE de
// Banxico. Bodega BAJO DEMANDA, con TTL de revalidación (a diferencia
// de compendio.ts/conapo.ts, que no caducan): las remesas se publican
// trimestralmente, así que un dato cacheado se revalida a los 30 días.
//
// Series confirmadas en vivo en el sandbox (lib/dev/fontanaBanxicoSandbox.ts,
// 2026-07-31): cuadro CA79 de Banxico SIE, 32 series de remesas por
// entidad federativa (SE29670-SE29701) + 1 total nacional (SE29702).
// Periodicidad "Trimestral", unidad "Millones de Dólares". Banxico SÍ
// desagrega por entidad — no hace falta el fallback de "promedio
// nacional aplicado" para el nivel estatal.
//
// Nivel municipal: Banxico no expone un mecanismo de serie individual
// confirmado por municipio (ver nota en el sandbox sobre el cuadro
// CE166) — siempre CeldaNoDisponible con motivo explícito, sin
// excepción, tal como se acordó.

import { readFromBodega, writeToBodega } from "@/lib/fontana/bodegaStorage";
import { resolverIndicadorIter } from "@/lib/fontana/ingesta/iter";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import { esValorDisponible } from "@/lib/fontana/ingesta/types";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_BANXICO = "Banxico (SIE, Ingresos por Remesas Familiares)";

// Verificado en vivo 2026-07-31 (ver lib/dev/fontanaBanxicoSandbox.ts):
// GET /SieAPIRest/service/v1/series/{id}?locale=es → campo "titulo"
// confirmado para las 32 entidades, cruzado contra el catálogo oficial
// INEGI CVE_ENT (no el orden alfabético de la tabla de Banxico, que no
// coincide 1:1 con CVE_ENT — mismo tipo de divergencia ya encontrada
// entre catálogos en iter.ts, verificada aquí aparte para no asumirla).
const BANXICO_REMESAS_ESTATAL_SERIES: Record<string, string> = {
  "01": "SE29670", // Aguascalientes
  "02": "SE29671", // Baja California
  "03": "SE29672", // Baja California Sur
  "04": "SE29673", // Campeche
  "05": "SE29674", // Coahuila
  "06": "SE29675", // Colima
  "07": "SE29676", // Chiapas
  "08": "SE29677", // Chihuahua
  "09": "SE29678", // Ciudad de México
  "10": "SE29679", // Durango
  "11": "SE29681", // Guanajuato
  "12": "SE29682", // Guerrero
  "13": "SE29683", // Hidalgo
  "14": "SE29684", // Jalisco
  "15": "SE29680", // México (Estado de)
  "16": "SE29685", // Michoacán
  "17": "SE29686", // Morelos
  "18": "SE29687", // Nayarit
  "19": "SE29688", // Nuevo León
  "20": "SE29689", // Oaxaca
  "21": "SE29690", // Puebla
  "22": "SE29691", // Querétaro
  "23": "SE29692", // Quintana Roo
  "24": "SE29693", // San Luis Potosí
  "25": "SE29694", // Sinaloa
  "26": "SE29695", // Sonora
  "27": "SE29696", // Tabasco
  "28": "SE29697", // Tamaulipas
  "29": "SE29698", // Tlaxcala
  "30": "SE29699", // Veracruz
  "31": "SE29700", // Yucatán
  "32": "SE29701", // Zacatecas
};

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días — remesas se publican trimestralmente

interface RemesaCache {
  remesasMillonesUsd: number;
  fecha: string; // periodo reportado por Banxico, ej. "01/01/2026"
  fetchedAt: number; // epoch ms
}

interface BanxicoDatosResponse {
  bmx?: { series?: Array<{ datos?: Array<{ fecha: string; dato: string }> }> };
}

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

async function fetchRemesasSerie(serieId: string): Promise<{ remesasMillonesUsd: number; fecha: string } | null> {
  const token = process.env.BANXICO_TOKEN;
  if (!token) return null;

  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${serieId}/datos/oportuno`;
  const response = await fetch(url, { headers: { "Bmx-Token": token }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;

  const data = (await response.json()) as BanxicoDatosResponse;
  const datos = data.bmx?.series?.[0]?.datos ?? [];
  const latest = datos[datos.length - 1];
  if (!latest) return null;

  const valor = parseFloat(latest.dato.replace(",", ""));
  if (isNaN(valor)) return null;

  return { remesasMillonesUsd: valor, fecha: latest.fecha };
}

async function resolverRemesasEstatal(estadoCve: string): Promise<RemesaCache | null> {
  const path = `banxico_remesas/${estadoCve}.json`;
  const cached = await readFromBodega<RemesaCache>(path);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached;

  const serieId = BANXICO_REMESAS_ESTATAL_SERIES[estadoCve];
  if (!serieId) return null;

  const fetched = await fetchRemesasSerie(serieId);
  if (!fetched) return cached ?? null; // si falla el refresh, prefiere dato cacheado vencido a nada

  const result: RemesaCache = { ...fetched, fetchedAt: Date.now() };
  await writeToBodega(path, result);
  return result;
}

export async function resolverRemesasPerCapita(territorio: Territorio): Promise<CeldaFontana[]> {
  const municipal: CeldaFontana = {
    nivel: "municipal",
    motivo: "Banxico no publica remesas a nivel municipal con un mecanismo de serie individual confirmado",
  };

  if (!territorio.estado) {
    return [{ nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" }, municipal];
  }

  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    return [{ nivel: "estatal", motivo: `Estado "${territorio.estado}" no reconocido en el catálogo INEGI` }, municipal];
  }

  let remesas: RemesaCache | null;
  try {
    remesas = await resolverRemesasEstatal(estadoCve);
  } catch {
    return [{ nivel: "estatal", motivo: "Error de conexión con Banxico (SIE)" }, municipal];
  }
  if (!remesas) {
    return [{ nivel: "estatal", motivo: "Banxico no reportó remesas para este territorio (token ausente o serie no disponible)" }, municipal];
  }

  const piramideCeldas = await resolverIndicadorIter("F1-2", territorio);
  const celdaEstatal = piramideCeldas.find((c) => c.nivel === "estatal");
  if (!celdaEstatal || !esValorDisponible(celdaEstatal)) {
    return [{ nivel: "estatal", motivo: "No fue posible resolver la población estatal (ITER) para calcular el per cápita" }, municipal];
  }

  const remesasUsd = remesas.remesasMillonesUsd * 1_000_000;
  const perCapita = Math.round((remesasUsd / celdaEstatal.valor) * 100) / 100;

  return [
    {
      nivel: "estatal",
      valor: perCapita,
      unidad: `USD/hab (trimestre ${remesas.fecha})`,
      naturaleza: "calculo_directo",
      fuenteEtiqueta: `${FUENTE_ETIQUETA_BANXICO} + INEGI (ITER, Censo 2020)`,
    },
    municipal,
  ];
}
