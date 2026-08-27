// lib/fontana/ingesta/shcpGasto.ts
// F3-7 (Gasto federalizado per cápita) — SHCP, dataset "Transferencias a
// Entidades Federativas (2011 - Actual)" (datos.gob.mx, package
// "transferencias_entidades_federativas_2011_actual").
//
// Verificado en vivo 2026-08-26 vía `package_show`/`datastore_search`:
// resource_id "5c3d406e-44dc-4423-9797-1b643a3fd90d", datastore_active,
// 253,164 registros (detalle mensual por concepto desde 2011) — PERO el
// mismo dataset incluye filas YA AGREGADAS por `subtema: "Gasto
// Federalizado"`, `nombre: "{Estado}: Total Gasto Federalizado"` (una por
// mes/entidad) y `nombre: "Total: Total Gasto Federalizado"` (nacional) —
// se usan esas filas directamente, sin sumar los ~253k registros de
// detalle por concepto. `monto` en MILES de pesos (`unidad_medida`).
// Confirmado con datos reales: Jalisco 2024 = 12 filas mensuales, suma
// 147,102,059.571 miles de pesos (~147,102 millones de pesos) — orden de
// magnitud consistente con transferencias federales reales a un estado de
// ese tamaño.
//
// HALLAZGO DE NOMBRE (no de CVE numérico esta vez): SHCP usa
// "Distrito Federal" para la Ciudad de México (confirmado en vivo, fila
// "Distrito Federal: Total Gasto Federalizado") — nombre pre-2016, distinto
// del que usa CONAPO/INEGI hoy ("Ciudad de México"). NUNCA asumido
// compatible sin verificar: se traduce explícitamente antes de comparar
// contra `territorio.estado` (ver ALIAS_ENTIDAD_SHCP).
//
// Denominador de población: se reutiliza resolverPoblacionEstatal()
// (lib/fontana/ingesta/conapo.ts, agregado en esta misma ronda) — mismo
// año calendario que el dato de SHCP, nunca un año distinto (mismo
// criterio de alineación temporal ya exigido para F3-1/SESNSP).

import https from "https";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import { resolverPoblacionEstatal } from "@/lib/fontana/ingesta/conapo";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

export const FUENTE_ETIQUETA_SHCP_GASTO = "SHCP (Transferencias a Entidades Federativas, datos.gob.mx)";

const CKAN_BASE = "https://www.datos.gob.mx/api/3/action/datastore_search";
const RESOURCE_TRANSFERENCIAS = "5c3d406e-44dc-4423-9797-1b643a3fd90d";
const SUFIJO_TOTAL = ": Total Gasto Federalizado";
const NOMBRE_NACIONAL = "Total: Total Gasto Federalizado";

// SHCP usa el nombre pre-2016 para la Ciudad de México — ver hallazgo en
// el header. Único caso encontrado al verificar las 32 entidades + fila
// nacional en vivo (resto de nombres coincide con ESTADO_CVE_MAP).
const ALIAS_ENTIDAD_SHCP: Record<string, string> = {
  [normalizeGeoName("Distrito Federal")]: normalizeGeoName("Ciudad de México"),
};

function nombreShcpCanonico(nombre: string): string {
  const norm = normalizeGeoName(nombre);
  return ALIAS_ENTIDAD_SHCP[norm] ?? norm;
}

interface RegistroTransferencia {
  nombre?: string;
  monto?: string;
}

// Mismo hallazgo TLS de conapo.ts/bienestar.ts/stpsHuelgas.ts — workaround
// acotado a datos.gob.mx.
function ckanBuscarTotalGastoFederalizado(anio: string): Promise<RegistroTransferencia[]> {
  const filters = encodeURIComponent(JSON.stringify({ ciclo: anio }));
  const q = encodeURIComponent("Total Gasto Federalizado");
  const url = `${CKAN_BASE}?resource_id=${RESOURCE_TRANSFERENCIAS}&limit=500&q=${q}&filters=${filters}&fields=nombre,monto`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false, timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`CKAN HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          const data = JSON.parse(body) as { success: boolean; result?: { records: RegistroTransferencia[] } };
          if (!data.success || !data.result) {
            reject(new Error("CKAN respondió success:false"));
            return;
          }
          resolve(data.result.records);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("CKAN timeout")));
  });
}

interface GastoAnioCache {
  anio: string;
  expiresAt: number;
  porEntidadMilesPesos: Map<string, number>;
  nacionalMilesPesos: number;
}

let cache: GastoAnioCache | null = null;
let enVuelo: Promise<GastoAnioCache> | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function anioReferencia(): string {
  return String(new Date().getFullYear() - 1);
}

async function cargarGastoAnio(anio: string): Promise<GastoAnioCache> {
  if (cache && cache.anio === anio && cache.expiresAt > Date.now()) return cache;
  if (enVuelo) {
    const c = await enVuelo;
    if (c.anio === anio) return c;
  }

  enVuelo = (async (): Promise<GastoAnioCache> => {
    const registros = await ckanBuscarTotalGastoFederalizado(anio);
    const porEntidadMilesPesos = new Map<string, number>();
    let nacionalMilesPesos = 0;
    for (const r of registros) {
      if (!r.nombre || r.monto == null) continue;
      const monto = parseFloat(r.monto);
      if (Number.isNaN(monto)) continue;
      if (r.nombre === NOMBRE_NACIONAL) {
        nacionalMilesPesos += monto;
        continue;
      }
      if (!r.nombre.endsWith(SUFIJO_TOTAL)) continue; // excluye "No distribuible" y desgloses por ramo
      const entidadNombre = r.nombre.slice(0, -SUFIJO_TOTAL.length);
      const clave = nombreShcpCanonico(entidadNombre);
      porEntidadMilesPesos.set(clave, (porEntidadMilesPesos.get(clave) ?? 0) + monto);
    }
    const resultado = { anio, expiresAt: Date.now() + CACHE_TTL_MS, porEntidadMilesPesos, nacionalMilesPesos };
    cache = resultado;
    return resultado;
  })();

  return await enVuelo;
}

export async function resolverGastoFederalizadoPerCapita(territorio: Territorio): Promise<CeldaFontana[]> {
  const anio = anioReferencia();
  let datos: GastoAnioCache;
  try {
    datos = await cargarGastoAnio(anio);
  } catch {
    const motivo = "Error de conexión con SHCP (datos.gob.mx)";
    return [
      { nivel: "nacional", motivo },
      { nivel: "estatal", motivo },
      { nivel: "distrital", motivo: "SHCP no publica gasto federalizado por distrito electoral" },
      { nivel: "municipal", motivo: "SHCP no publica gasto federalizado consultable por municipio (SRFT es de reporte, no de consulta)" },
    ];
  }

  const poblacionNacional = await resolverPoblacionEstatal("0", anio).catch(() => null);
  const nacional: CeldaFontana = poblacionNacional
    ? {
        nivel: "nacional",
        valor: Math.round((datos.nacionalMilesPesos * 1000) / poblacionNacional),
        unidad: "pesos por habitante",
        naturaleza: "calculo_directo",
        fuenteEtiqueta: FUENTE_ETIQUETA_SHCP_GASTO,
      }
    : { nivel: "nacional", motivo: "No se pudo obtener la población nacional (CONAPO) para calcular el per cápita" };

  let estatal: CeldaFontana;
  if (!territorio.estado) {
    estatal = { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" };
  } else {
    const estadoCve = ESTADO_CVE_MAP[normalizeGeoName(territorio.estado)];
    const gastoMilesPesos = datos.porEntidadMilesPesos.get(nombreShcpCanonico(territorio.estado));
    if (!estadoCve || gastoMilesPesos == null) {
      estatal = { nivel: "estatal", motivo: `SHCP no reportó gasto federalizado para "${territorio.estado}"` };
    } else {
      const poblacion = await resolverPoblacionEstatal(estadoCve, anio).catch(() => null);
      estatal = poblacion
        ? {
            nivel: "estatal",
            valor: Math.round((gastoMilesPesos * 1000) / poblacion),
            unidad: "pesos por habitante",
            naturaleza: "calculo_directo",
            fuenteEtiqueta: FUENTE_ETIQUETA_SHCP_GASTO,
          }
        : { nivel: "estatal", motivo: "No se pudo obtener la población de este estado (CONAPO) para calcular el per cápita" };
    }
  }

  return [
    nacional,
    estatal,
    { nivel: "distrital", motivo: "SHCP no publica gasto federalizado por distrito electoral" },
    { nivel: "municipal", motivo: "SHCP no publica gasto federalizado consultable por municipio (SRFT es de reporte, no de consulta)" },
  ];
}
