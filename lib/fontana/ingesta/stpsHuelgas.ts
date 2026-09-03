// lib/fontana/ingesta/stpsHuelgas.ts
// F3-16 (Huelgas y paros laborales) — STPS, dataset "Huelgas" (datos.gob.mx,
// package "huelgas", resource "Huelgas (de 1989 a marzo 2026)").
//
// Verificado en vivo 2026-08-26 vía `package_show`/`datastore_search`
// (https://www.datos.gob.mx/api/3/action/package_show?id=huelgas):
// resource_id "5182c882-e5cb-42ee-8c2e-34a604a4a53d", datastore_active,
// 1,597 registros totales (1989 a marzo 2026), campos reales `anio_estallamiento`,
// `entidad_federativa` (numérico), `num_trabajadores`, sin campo de
// municipio — el dataset SOLO tiene nivel estatal.
//
// HALLAZGO DE INTEGRIDAD (mismo tipo de riesgo que
// docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md, aquí a
// nivel ESTATAL en vez de municipal): `entidad_federativa` NO es el CVE_ENT
// oficial INEGI — es una numeración PROPIA de STPS, desplazada +1 respecto
// a INEGI para las primeras 32 entidades, más 3 códigos especiales (34
// "Más de una entidad", 35 "Opera internacionalmente", 36 "No especificada",
// sin CVE_ENT equivalente). Confirmado cruzando el diccionario de datos
// oficial (https://www.datos.gob.mx/dataset/f70026bd-5a3c-4907-904f-0bf6017f1188/resource/d5371f09-51df-453f-bbd2-877a7ad9c787/download/diccionario-huelgas.csv,
// descargado 2026-08-26) contra el orden alfabético estándar INEGI: código
// 2→Aguascalientes (INEGI 01), 10→Distrito Federal (INEGI 09), 16→México
// (INEGI 15), 33→Zacatecas (INEGI 32) — offset +1 consistente en las 32
// entidades. NUNCA usar `entidad_federativa` como CVE_ENT directo — se
// traduce por NOMBRE vía ENTIDAD_STPS_A_NOMBRE (tabla propia, de la misma
// fuente del diccionario, no inferida) y luego se compara por nombre
// normalizado contra `territorio.estado`, mismo protocolo de join-por-nombre
// ya exigido para claves municipales.

import https from "https";
import { normalizeGeoName } from "@/lib/geo/municipios";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ResultadoSerie } from "@/lib/fontana/series/tipos";
import { nivelObjetivoSerie } from "@/lib/fontana/series/tipos";

export const FUENTE_ETIQUETA_STPS_HUELGAS = "STPS (Huelgas, datos.gob.mx)";

const CKAN_BASE = "https://www.datos.gob.mx/api/3/action/datastore_search";
const RESOURCE_HUELGAS = "5182c882-e5cb-42ee-8c2e-34a604a4a53d";

// Tabla código STPS → nombre de entidad, tomada literalmente del
// diccionario de datos oficial citado arriba (descargado 2026-08-26) — no
// se asume ningún offset aritmético en el código, se usa el nombre.
const ENTIDAD_STPS_A_NOMBRE: Record<number, string> = {
  2: "Aguascalientes", 3: "Baja California", 4: "Baja California Sur",
  5: "Campeche", 6: "Coahuila", 7: "Colima", 8: "Chiapas", 9: "Chihuahua",
  10: "Distrito Federal", 11: "Durango", 12: "Guanajuato", 13: "Guerrero",
  14: "Hidalgo", 15: "Jalisco", 16: "México", 17: "Michoacán", 18: "Morelos",
  19: "Nayarit", 20: "Nuevo León", 21: "Oaxaca", 22: "Puebla",
  23: "Querétaro", 24: "Quintana Roo", 25: "San Luis Potosí", 26: "Sinaloa",
  27: "Sonora", 28: "Tabasco", 29: "Tamaulipas", 30: "Tlaxcala",
  31: "Veracruz", 32: "Yucatán", 33: "Zacatecas",
  // 34/35/36 ("Más de una entidad"/"Opera internacionalmente"/"No
  // especificada") no tienen equivalente de entidad — se excluyen del
  // conteo estatal/nacional a propósito, nunca asignados a un estado real.
};

interface RegistroHuelga {
  anio_estallamiento?: string;
  entidad_federativa?: number;
}

let cache: { expiresAt: number; porAnioEstado: Map<string, Map<string, number>> } | null = null;
let enVuelo: Promise<Map<string, Map<string, number>>> | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// datos.gob.mx sirve un certificado TLS con la cadena incompleta (mismo
// hallazgo ya documentado en conapo.ts/bienestar.ts — Node/undici, `fetch`
// nativo incluido, rechaza la conexión con UNABLE_TO_VERIFY_LEAF_SIGNATURE;
// navegadores y curl lo toleran). Verificado en esta sesión (2026-08-26)
// que `fetch()` SÍ funcionó de forma consistente contra este host desde
// este entorno de desarrollo — pero no hay garantía de que el runtime de
// producción (Vercel) tenga el mismo comportamiento que este sandbox, así
// que se usa el mismo workaround ya establecido (`https` nativo,
// `rejectUnauthorized:false`, acotado a este host, GET público sin
// credenciales) en vez de depender de `fetch` sin haberlo confirmado en
// producción.
function descargarTodos(): Promise<RegistroHuelga[]> {
  const url = `${CKAN_BASE}?resource_id=${RESOURCE_HUELGAS}&limit=5000&fields=anio_estallamiento,entidad_federativa`;
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
          const data = JSON.parse(body) as { success: boolean; result?: { records: RegistroHuelga[] } };
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

// Mapa {año: {nombreEstadoCanonico: conteo}} — dataset completo cabe en
// memoria (1,597 registros totales, confirmado en vivo), sin necesidad de
// bodega en Storage ni paginación por estado (a diferencia de bienestar.ts).
async function cargarConteos(): Promise<Map<string, Map<string, number>>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.porAnioEstado;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const registros = await descargarTodos();
    const porAnioEstado = new Map<string, Map<string, number>>();
    for (const r of registros) {
      if (!r.anio_estallamiento || r.entidad_federativa == null) continue;
      const nombre = ENTIDAD_STPS_A_NOMBRE[r.entidad_federativa];
      if (!nombre) continue; // 34/35/36 — sin estado real, se excluyen
      const clave = normalizeGeoName(nombre);
      if (!porAnioEstado.has(r.anio_estallamiento)) porAnioEstado.set(r.anio_estallamiento, new Map());
      const porEstado = porAnioEstado.get(r.anio_estallamiento)!;
      porEstado.set(clave, (porEstado.get(clave) ?? 0) + 1);
    }
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, porAnioEstado };
    return porAnioEstado;
  })();

  try {
    return await enVuelo;
  } finally {
    enVuelo = null;
  }
}

// Año calendario completo más reciente — el dataset se actualiza mensual
// con el año en curso incompleto (confirmado en vivo: datos hasta marzo
// 2026), así que se usa el año calendario anterior al actual, calculado en
// cada corrida (nunca un año fijo que quede obsoleto).
function anioReferencia(): string {
  return String(new Date().getFullYear() - 1);
}

export async function resolverHuelgasStps(territorio: Territorio): Promise<CeldaFontana[]> {
  const anio = anioReferencia();
  let porAnioEstado: Map<string, Map<string, number>>;
  try {
    porAnioEstado = await cargarConteos();
  } catch {
    const motivo = "Error de conexión con STPS (datos.gob.mx)";
    return [
      { nivel: "nacional", motivo },
      { nivel: "estatal", motivo },
      { nivel: "distrital", motivo: "STPS no publica huelgas por distrito electoral" },
      { nivel: "municipal", motivo: "STPS no publica huelgas por municipio, solo por entidad federativa" },
    ];
  }

  const porEstado = porAnioEstado.get(anio) ?? new Map<string, number>();
  const totalNacional = [...porEstado.values()].reduce((a, b) => a + b, 0);

  const nacional: CeldaFontana = {
    nivel: "nacional",
    valor: totalNacional,
    unidad: "huelgas",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_STPS_HUELGAS,
  };

  let estatal: CeldaFontana;
  if (!territorio.estado) {
    estatal = { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" };
  } else {
    const valor = porEstado.get(normalizeGeoName(territorio.estado));
    estatal = valor != null
      ? { nivel: "estatal", valor, unidad: "huelgas", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_STPS_HUELGAS }
      : { nivel: "estatal", valor: 0, unidad: "huelgas", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_STPS_HUELGAS };
  }

  return [
    nacional,
    estatal,
    { nivel: "distrital", motivo: "STPS no publica huelgas por distrito electoral" },
    { nivel: "municipal", motivo: "STPS no publica huelgas por municipio, solo por entidad federativa" },
  ];
}

// ==========================================
// SERIE TEMPORAL (T10, 1ª ola 2026-09-01) — F3-16.
// `cargarConteos()` ya construye Map<año, Map<estadoNorm, conteo>> con el
// dataset completo (1989-presente). El resolver de celda expone un solo
// año (`anioReferencia()`); este lee todos.
//
// CRITERIO DE AÑOS INCOMPLETOS (explícito, no implícito): el dataset STPS
// se actualiza MENSUALMENTE, así que el año calendario EN CURSO está
// parcial por definición (ej. "de 1989 a marzo 2026" en el título del
// recurso — no hay campo estructurado de fecha de corte en los registros,
// solo `anio_estallamiento`). Regla: se EXCLUYE siempre el año calendario
// en curso de la serie. Todos los años < año en curso están completos
// (cobertura del dataset), así que ninguno lleva nota de "parcial" — no se
// muestra ningún año parcial.
// ==========================================

const CVE_ESTADO_NOMBRE_HUELGAS: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

export async function resolverSerieHuelgas(territorio: Territorio): Promise<ResultadoSerie> {
  let porAnioEstado: Map<string, Map<string, number>>;
  try {
    porAnioEstado = await cargarConteos();
  } catch {
    return { ok: false, motivo: "Error de conexión con STPS (datos.gob.mx)" };
  }

  const anioEnCurso = new Date().getFullYear();
  const aniosConDatos = [...porAnioEstado.keys()]
    .filter((a) => /^\d{4}$/.test(a) && parseInt(a, 10) < anioEnCurso)
    .map((a) => parseInt(a, 10))
    .sort((a, b) => a - b);
  if (aniosConDatos.length === 0) return { ok: false, motivo: "STPS no reportó una serie de huelgas" };

  // Serie DENSA de minAño..añoEnCurso-1: un año sin registros en este
  // dataset (registro de eventos de huelga individuales) significa CERO
  // huelgas registradas ese año — es un valor real, no un hueco. Se emite
  // el año con valor 0 en vez de omitirlo, para que la gráfica no muestre
  // un salto ambiguo.
  const minAnio = aniosConDatos[0];
  const anios: string[] = [];
  for (let y = minAnio; y < anioEnCurso; y++) anios.push(String(y));

  const nivel = nivelObjetivoSerie(territorio, ["nacional", "estatal"]);

  let territorioLabel: string;
  let claveEstado: string | null = null;
  if (nivel === "nacional") {
    territorioLabel = "Nacional";
  } else {
    if (!territorio.estado) return { ok: false, motivo: "El proyecto no tiene un estado definido en su territorio" };
    claveEstado = normalizeGeoName(territorio.estado);
    const cve = ESTADO_CVE_MAP[claveEstado];
    territorioLabel = (cve && CVE_ESTADO_NOMBRE_HUELGAS[cve]) ?? territorio.estado;
  }

  const puntos = anios.map((periodo) => {
    const porEstado = porAnioEstado.get(periodo) ?? new Map<string, number>();
    const valor =
      nivel === "nacional"
        ? [...porEstado.values()].reduce((a, b) => a + b, 0)
        : porEstado.get(claveEstado!) ?? 0; // sin huelga registrada ese año = 0 real
    return { periodo, valor };
  });

  return {
    ok: true,
    nivel,
    territorioLabel,
    unidad: "huelgas y paros",
    naturaleza: "dato_directo",
    fuenteEtiqueta: FUENTE_ETIQUETA_STPS_HUELGAS,
    formato: "conteo",
    puntos,
  };
}
