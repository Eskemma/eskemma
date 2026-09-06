// lib/fontana/ingesta/bienestar.ts
// Adaptador de F2-7 (Beneficiarios Producción para el Bienestar) y F2-8
// (Beneficiarios Beca Benito Juárez) — API CKAN de datos.gob.mx, mismo
// host/workaround TLS ya documentado en lib/fontana/ingesta/conapo.ts
// (certificado con cadena incompleta, `rejectUnauthorized:false` acotado
// a este host, GET público sin credenciales).
//
// A diferencia de CONAPO (un resource_id fijo para todo el país), aquí
// CADA ESTADO tiene su propio resource_id — confirmado en vivo
// 2026-08-07 vía `package_show`, ambos paquetes con EXACTAMENTE 32
// recursos (uno por estado, sin faltantes). Los resource_ids se dejan
// hardcodeados (verificados abajo) en vez de resolverse en cada consulta
// vía package_show — mismo criterio que RESOURCE_MUNICIPAL/RESOURCE_ESTATAL
// en conapo.ts: menos una llamada de red por indicador, y una API que
// cambia sus IDs de recurso sin aviso sería un problema en sí mismo, no
// algo que resolver reconsultando en cada request.
//
// F2-7 — Producción para el Bienestar (datos.gob.mx, package
// "beneficiarios_programa_produccion_bienestar", 32 recursos "(2024)").
// Confirmado en vivo: campos reales `estado` (CVE 2 díg.), `municipio`
// (CVE 3 díg.), `id_suri` (identificador de persona) — un mismo
// `id_suri` puede repetirse varias veces (un incentivo por cultivo/ciclo,
// no por persona), así que el conteo de beneficiarios por municipio es
// `id_suri` ÚNICOS, no el total de filas (verificado con Aguascalientes/
// municipio 001: varias filas con el mismo id_suri y distinto cultivo).
//
// F2-8 — Beca Benito Juárez (datos.gob.mx, package
// "programa_nacional_becas_bienestar_benito_juarez_2025_programa_s311",
// 128 recursos = 32 estados × 4 trimestres 2025, "Becas de Educación
// Media Superior"). Se usa el recurso "3er. trim. 2025" — campos reales
// `NOM_MUN` (se agrega por nombre, ver FIX DE FONDO Paso 4 abajo), `BECA`,
// sin identificador de persona; en un snapshot trimestral limpio cada
// fila representa un becario, así que el conteo de beneficiarios es el
// total de filas por municipio, sin deduplicar.
//
// POR QUÉ Q3 Y NO Q4 (el más reciente) — corrección de integridad de
// dato, verificada en vivo 2026-09-06 (3 hallazgos convergentes; ver
// CLAUDE.md, sprint 26-09-06). El "4to. trim. 2025" (usado antes) NO es
// un snapshot limpio: sobre-cuenta a nivel nacional y en cada municipio.
//   1. Salto UNIFORME: total nacional Q1=4,206,066 · Q2=4,236,344 ·
//      Q3=4,237,327 (planos), pero Q4=5,919,559 (+40.7%), con un
//      multiplicador de 1.31–1.54 (casi todos ~1.40) en LOS 32 estados —
//      un factor casi constante en todo el país es artefacto del archivo,
//      no crecimiento real de matrícula (que sería disparejo).
//   2. Contra la cifra oficial: la Beca Universal EMS 2025 tiene
//      4,224,381 estudiantes (gob.mx). Q1/Q2/Q3 cuadran ±0.4%; Q4 la
//      excede en ~1.7 millones — imposible como conteo de becarios EMS.
//   3. Estructura de montos: `BECA` en Q4 son escalones ACUMULADOS
//      1900/3800/5700/7600/9500 (×1..×5 del apoyo bimestral de $1,900);
//      Q4 se publicó tras el cierre fiscal (16-ene-2026) y trae >1 fila
//      por becario. Q1-Q3 no tienen esa mezcla. Sin columna de corte
//      dentro de Q4 para aislar un periodo (campos: TRIMESTRE constante,
//      BECA, FECHA_ALTA heterogénea) → no se puede "arreglar" Q4 filtrando.
// Spot-check municipal (Jalisco/Colima): Q3 cae dentro de ±15% de un
// prorrateo poblacional de la cifra oficial (Tlaquepaque 1.03×, Puerto
// Vallarta 1.02×, Manzanillo 0.96×); Q4 infla ~1.25–1.45× por municipio.
// NO reintroducir Q4 pensando que "más reciente = mejor".
//
// Paginación: el servidor limita cada respuesta a 32,000 registros pese
// a pedir más (confirmado en vivo — Colima Q3: 25,466 registros totales
// en 1 página; estados grandes como Edomex Q3 ~565k se paginan) — se
// pagina con offset hasta agotar el total real reportado por la API.
//
// Mecanismo de bodega: BAJO DEMANDA por estado completo (no por
// municipio individual) — mismo criterio que conapo.ts/compendio.ts,
// adaptado: la primera vez que un territorio real de un estado se
// consulta, se pagina y agrega TODO el estado de una vez (single-flight
// por estado dentro del proceso, mismo patrón ya usado en
// conapoMarginacion.ts) y se cachea el mapa {municipioCve: conteo}
// completo en Storage — evita reconsultar CKAN por cada municipio del
// mismo estado. Alternativa a un pipeline separado (`scripts/
// bienestar-data-pipeline.ts`) que sí se planteó en el diseño original —
// se adapta a este mecanismo bajo-demanda porque reutiliza directamente
// bodegaStorage.ts sin artefacto de build nuevo, mismo tipo de ajuste ya
// aplicado a conapoMarginacion.ts (in-memory cache en vez de bodega).

import https from "https";
import { readFromBodega, writeToBodega } from "@/lib/fontana/bodegaStorage";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName, getMunicipiosOptions, claveCanonicaMunicipio } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_BIENESTAR_PRODUCCION = "Bienestar (Producción para el Bienestar, 2024, datos.gob.mx)";
export const FUENTE_ETIQUETA_BIENESTAR_BECA = "Bienestar (Beca Benito Juárez, 3er. trim. 2025, datos.gob.mx)";

const CKAN_BASE = "https://www.datos.gob.mx/api/3/action/datastore_search";
const PAGE_SIZE = 32000; // tope real del servidor, confirmado en vivo — pedir más no cambia el resultado

// Verificado en vivo 2026-08-07 vía package_show — 32/32 estados, sin
// faltantes, ambos paquetes.
const RESOURCE_PRODUCCION: Record<string, string> = {
  "01": "5ced003f-d8e4-4815-a515-d6333eee4041", "02": "2f004d7b-19e6-4fcb-8d57-2d324bcd98c8",
  "03": "8ba725a7-0cd7-44ae-ab4e-a55cefeee2ae", "04": "8dce4b9a-b02b-4db4-b793-6fbc5d4dfdb2",
  "05": "aa735b52-d6c5-4b14-9f5c-f81383322baa", "06": "8e10a909-7414-4e9c-9948-0eb2ea14357c",
  "07": "6f80eb83-1451-431e-91f6-d88476816741", "08": "ec48eafa-2422-4de3-9bd2-ca6ef30545a7",
  "09": "e34d562f-eb44-46ae-bb3d-0a14bf9645f7", "10": "fdb9945a-2383-4ffb-a4cc-f62e2accb02c",
  "11": "91094aae-9987-4e4d-905a-b3448c557a28", "12": "81a7dfa0-165b-4a19-8817-a874b2eb1eed",
  "13": "5536e7bf-495e-4cea-82c6-70c96e78253d", "14": "820204e6-ac29-46e7-b719-4839e4c53f25",
  "15": "d81501e8-4e56-4954-9638-bd9316ba08b9", "16": "7590d281-bebb-4b66-903f-00a048cc4f4f",
  "17": "33128161-ebff-4557-bd56-8f3a7f5eb0dc", "18": "4b2e869b-5f43-4999-81d3-8a614108345e",
  "19": "804e5c53-622d-44fa-9ef1-c728cf1eb16d", "20": "350ac21f-85ca-409d-97a5-fcf1e99c03ec",
  "21": "e6ae5aff-7474-4407-98a9-4491f34398dc", "22": "6a932018-3cda-4dd3-884b-1d6a37291060",
  "23": "5dbc0b5d-6234-4699-8d13-07edd27d6c57", "24": "de262434-3bdd-4e7f-942e-8b9b5cd47692",
  "25": "553f086b-08f3-4cd4-a236-5e22e0a241f3", "26": "eaa8d339-1f27-48a9-a20d-af5cfd7b629c",
  "27": "fb2ce19f-f6f5-49a3-a4b8-54b2769ae422", "28": "a7bf4828-8c07-4adf-a9ba-97f0fa2b251d",
  "29": "5ca0d709-a939-4971-9628-da9de6b9265f", "30": "1062afcd-cfa6-49b6-9265-77a3ad08900c",
  "31": "b1a366e3-98e4-4127-8238-d8c137d43196", "32": "67a2f459-c3ee-425c-89ce-639ee2a552a8",
};

// "3er. trim. 2025", uno por estado — extraídos vía package_show
// (2026-09-06), CVE de estado tomada del nombre de archivo del recurso
// (`S311_EDO_NN_...`). NO son los de "4to. trim." (ver nota arriba sobre
// por qué Q4 se descartó por sobre-conteo).
const RESOURCE_BECA_BJ: Record<string, string> = {
  "01": "f41c6f33-7dd2-45c1-97d6-5ccf0c7fb468", "02": "820cb97e-754f-4f7a-a5e3-c72319ab3da2",
  "03": "c36efafe-f943-4b7c-a7ee-c072d3d8bc35", "04": "5c6be4dc-911b-4341-b440-0657f4cb36d8",
  "05": "56e556cf-4570-47b4-8d34-94122f5b321c", "06": "284c961a-8f24-4d12-b636-b5ce294c397e",
  "07": "d9993bf7-e69a-498e-96ad-97df49ec63c2", "08": "68ab2a82-4016-4453-95cf-1e02493a979c",
  "09": "7e4b8534-3639-4829-b179-536022085cf9", "10": "d1441a13-eefa-46ff-83d7-891202bc6686",
  "11": "e669d52d-c796-4402-84e1-0b20cd0bd190", "12": "d37cf766-cb20-422e-a1c7-17f10071a9ea",
  "13": "616ee8b5-7b57-4376-b566-e4f654d2c128", "14": "ac47b87f-171c-4f84-9f45-98fe8e625aa1",
  "15": "e7594cd4-f88c-45d9-9924-d15da613d48f", "16": "4da5256d-fe66-4312-8aaa-4f0b681999e1",
  "17": "be6fc1bb-8a52-428c-b2e8-a6f932197013", "18": "1c769ffd-e0fc-4ae3-99c5-8c28042fdf96",
  "19": "7e9691b2-1588-4ed5-9ae7-3773d3466fe6", "20": "1acc9771-7dd8-4b08-a5ae-d79cfc8fba4e",
  "21": "0ae277ed-bd82-4787-b239-1554f70b4c3d", "22": "cab45d8f-503b-4b30-b46b-878d201880ec",
  "23": "75f67ac4-0334-45df-9197-331c69402fd5", "24": "e396d52b-3134-4b9c-ac1b-203d4011fb03",
  "25": "1abbff21-1bc9-49ca-9898-7aff8e1c0c56", "26": "45084355-3f22-4085-8974-d82f6f426d87",
  "27": "cae56e73-d2fb-47b8-8581-f6ec28d81c7b", "28": "46f2529e-5436-4c0a-8a01-4fbff9d73ca4",
  "29": "f946d228-873b-457c-bc52-f7674f586a63", "30": "0c10cd71-e446-4c2a-978b-18bc8791dbe0",
  "31": "3c92eb98-6736-4d0b-a17b-09a99f3a4003", "32": "f1832ab7-34cd-4407-8acf-d97eacb75bcd",
};

function ckanDatastoreSearch(resourceId: string, fields: string[], offset: number): Promise<{ records: unknown[]; total: number }> {
  const url = `${CKAN_BASE}?resource_id=${resourceId}&limit=${PAGE_SIZE}&offset=${offset}&fields=${fields.join(",")}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false, timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`CKAN HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      // FIX DE FONDO (Incidente 2, 2026-08-23) — BUG REAL encontrado y
      // corregido: `body += chunk` fuerza cada Buffer a string
      // individualmente (utf8 por defecto de Buffer.toString()) ANTES de
      // concatenar — si un carácter multibyte (ej. Ñ, 2 bytes en UTF-8)
      // queda partido entre dos chunks de red, cada mitad se decodifica
      // por separado y produce el carácter de reemplazo "�" (mojibake),
      // irrecuperable después. Confirmado en vivo: "MATIAS ROMERO
      // AVENDA��O" (Oaxaca, dataset de Producción). Fix: acumular los
      // Buffers crudos y decodificar UNA sola vez al final, cuando ya
      // está completo el payload.
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          const data = JSON.parse(body) as { success: boolean; result?: { records: unknown[]; total: number } };
          if (!data.success || !data.result) {
            reject(new Error("CKAN respondió success:false"));
            return;
          }
          resolve({ records: data.result.records, total: data.result.total });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("CKAN timeout")));
  });
}

async function paginarCompleto(resourceId: string, fields: string[]): Promise<unknown[]> {
  const primera = await ckanDatastoreSearch(resourceId, fields, 0);
  const todos = [...primera.records];
  let offset = PAGE_SIZE;
  while (offset < primera.total) {
    const pagina = await ckanDatastoreSearch(resourceId, fields, offset);
    todos.push(...pagina.records);
    offset += PAGE_SIZE;
  }
  return todos;
}

type ConteoPorMunicipio = Record<string, number>;

// Single-flight por estado+fuente dentro del proceso — mismo criterio ya
// aplicado en conapoMarginacion.ts, evita N descargas concurrentes del
// mismo estado cuando varios indicadores/territorios lo piden a la vez.
const enVuelo = new Map<string, Promise<ConteoPorMunicipio>>();

// FIX DE FONDO (Paso 4, 2026-08-23) — ambas funciones de abajo agregan
// por NOMBRE de municipio (campo propio de cada dataset de Bienestar:
// "nombre_del_municipio" en Producción, "NOM_MUN" en Beca BJ), no por su
// CVE_MUN de 3 dígitos — ese CVE_MUN no está verificado contra el
// catálogo oficial INEGI y el resto de Fontana solo puede cruzarlo de
// forma segura por nombre (mismo patrón ya aprobado en icmm.ts). Rutas
// de bodega renombradas con sufijo `_v2` para no leer caché vieja
// (keyed por CVE_MUN, incompatible con este esquema).
async function agregarProduccionEstado(estadoCve: string): Promise<ConteoPorMunicipio> {
  const path = `bienestar_produccion_v2/${estadoCve}.json`;
  const cached = await readFromBodega<ConteoPorMunicipio>(path);
  if (cached) return cached;

  const key = `produccion:${estadoCve}`;
  const existente = enVuelo.get(key);
  if (existente) return existente;

  const promesa = (async () => {
    const resourceId = RESOURCE_PRODUCCION[estadoCve];
    if (!resourceId) return {};
    const registros = (await paginarCompleto(resourceId, ["nombre_del_municipio", "id_suri"])) as Array<{ nombre_del_municipio?: string; id_suri?: string }>;
    const idsPorMunicipio = new Map<string, Set<string>>();
    for (const r of registros) {
      if (!r.nombre_del_municipio || !r.id_suri) continue;
      // FIX DE FONDO (Incidente 2, 2026-08-23) — ver nota en coneval.ts.
      const clave = claveCanonicaMunicipio(estadoCve, r.nombre_del_municipio);
      if (!idsPorMunicipio.has(clave)) idsPorMunicipio.set(clave, new Set());
      idsPorMunicipio.get(clave)!.add(r.id_suri);
    }
    const resultado: ConteoPorMunicipio = {};
    for (const [mun, ids] of idsPorMunicipio) resultado[mun] = ids.size;
    await writeToBodega(path, resultado);
    return resultado;
  })();

  enVuelo.set(key, promesa);
  try {
    return await promesa;
  } finally {
    enVuelo.delete(key);
  }
}

async function agregarBecaBJEstado(estadoCve: string): Promise<ConteoPorMunicipio> {
  // path con sufijo de trimestre — al cambiar de Q4 a Q3 (corrección de
  // integridad, 2026-09-06) se renombra para invalidar la caché vieja
  // (que tenía los conteos inflados de Q4), mismo patrón `_v2` ya usado.
  const path = `bienestar_becabj_2025q3_v2/${estadoCve}.json`;
  const cached = await readFromBodega<ConteoPorMunicipio>(path);
  if (cached) return cached;

  const key = `becabj:${estadoCve}`;
  const existente = enVuelo.get(key);
  if (existente) return existente;

  const promesa = (async () => {
    const resourceId = RESOURCE_BECA_BJ[estadoCve];
    if (!resourceId) return {};
    const registros = (await paginarCompleto(resourceId, ["NOM_MUN"])) as Array<{ NOM_MUN?: string }>;
    const resultado: ConteoPorMunicipio = {};
    for (const r of registros) {
      if (!r.NOM_MUN) continue;
      const clave = claveCanonicaMunicipio(estadoCve, r.NOM_MUN);
      resultado[clave] = (resultado[clave] ?? 0) + 1;
    }
    await writeToBodega(path, resultado);
    return resultado;
  })();

  enVuelo.set(key, promesa);
  try {
    return await promesa;
  } finally {
    enVuelo.delete(key);
  }
}

// Nacional — suma los 32 estados, mismo principio conceptual que
// sumarConteo (lib/fontana/ingesta/nacionalAgregado.ts, ya usado en
// Familia 1 para F1-1), adaptado porque aquí los 32 estados no viven en
// un solo archivo precomputado (como ECEG) sino en 32 objetos de bodega
// independientes — cada uno ya cacheado+single-flight por
// agregarProduccionEstado/agregarBecaBJEstado. Medido en vivo 2026-08-08
// en frío total (sin ningún estado cacheado): F2-7 7.3s, F2-8 8.0s — muy
// por debajo del maxDuration=60s del endpoint principal.
async function calcularTotalNacional(
  resourceMap: Record<string, string>,
  agregarEstado: (estadoCve: string) => Promise<ConteoPorMunicipio>
): Promise<number> {
  const totales = await Promise.all(
    Object.keys(resourceMap).map(async (estadoCve) => {
      const conteos = await agregarEstado(estadoCve);
      return Object.values(conteos).reduce((a, b) => a + b, 0);
    })
  );
  return totales.reduce((a, b) => a + b, 0);
}

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

// Reverso de ESTADO_CVE_MAP — mismo patrón ya usado en eceg.ts/conapoMarginacion.ts/coneval.ts.
const CVE_ESTADO_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_CVE_MAP).map(([nombre, cve]) => [cve, nombre])
);

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

async function resolverCeldas(
  territorio: Territorio,
  agregarEstado: (estadoCve: string) => Promise<ConteoPorMunicipio>,
  resourceMap: Record<string, string>,
  fuenteEtiqueta: string
): Promise<CeldaFontana[]> {
  // Nacional se calcula siempre, en paralelo con estatal/municipal — no
  // depende del territorio del proyecto (suma los 32 estados completos).
  const nacionalPromise: Promise<CeldaFontana> = calcularTotalNacional(resourceMap, agregarEstado)
    .then((valor): CeldaFontana => ({ nivel: "nacional", valor, unidad: "beneficiarios", naturaleza: "estimacion_agregada", fuenteEtiqueta }))
    .catch((): CeldaFontana => ({ nivel: "nacional", motivo: "Error de conexión con Bienestar (datos.gob.mx) al calcular el total nacional" }));

  if (!territorio.estado) {
    return [
      await nacionalPromise,
      { nivel: "estatal", motivo: "El proyecto no tiene un estado definido en su territorio" },
      { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" },
    ];
  }
  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [await nacionalPromise, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  let conteos: ConteoPorMunicipio;
  try {
    conteos = await agregarEstado(estadoCve);
  } catch {
    const motivo = "Error de conexión con Bienestar (datos.gob.mx)";
    return [await nacionalPromise, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const totalEstado = Object.values(conteos).reduce((a, b) => a + b, 0);
  const estatal: CeldaFontana = totalEstado > 0
    ? { nivel: "estatal", valor: totalEstado, unidad: "beneficiarios", naturaleza: "estimacion_agregada", fuenteEtiqueta }
    : { nivel: "estatal", motivo: "Bienestar no reportó beneficiarios para este estado" };

  // FIX DE FONDO (Paso 4, 2026-08-23) — join municipal por NOMBRE, no
  // por CVE_MUN (ver nota junto a agregarProduccionEstado/agregarBecaBJEstado).
  // claveCanonicaMunicipio() (Incidente 2, ver coneval.ts) aplica la
  // tabla de alias antes de comparar.
  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const valor = conteos[claveCanonicaMunicipio(estadoCve, municipioNombre)];
    municipal = valor != null
      ? { nivel: "municipal", valor, unidad: "beneficiarios", naturaleza: "dato_directo", fuenteEtiqueta }
      : { nivel: "municipal", motivo: "Bienestar no reportó beneficiarios para este municipio" };
  }

  return [await nacionalPromise, estatal, municipal];
}

// Estatal: suma de todos los municipios del estado — Fontana agrega, la
// fuente publica solo el detalle por municipio (estimacion_agregada).
// Municipal: conteo directo del municipio (dato_directo). Nacional: suma
// de los 32 estados, calcularTotalNacional (estimacion_agregada) — desde
// 2026-08-08, medido en frío antes de habilitarlo (ver comentario ahí).
export async function resolverBeneficiariosProduccion(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverCeldas(territorio, agregarProduccionEstado, RESOURCE_PRODUCCION, FUENTE_ETIQUETA_BIENESTAR_PRODUCCION);
}

export async function resolverBeneficiariosBecaBJ(territorio: Territorio): Promise<CeldaFontana[]> {
  return resolverCeldas(territorio, agregarBecaBJEstado, RESOURCE_BECA_BJ, FUENTE_ETIQUETA_BIENESTAR_BECA);
}

// Desglose "Ver municipios" en proyectos nivel "estatal" (botón ya
// construido en la tabla para ECEG — Encargo de generalización,
// 2026-08-08). Envuelve agregarProduccionEstado/agregarBecaBJEstado (ya
// cacheadas) + nombres vía getMunicipiosOptions (mismo catálogo que ya
// usa resolverElementosDeEstado de eceg.ts). Nunca aplica a
// distritos_fed/distritos_loc — Bienestar no publica por distrito
// electoral, ese caso se queda fuera (400 "sin mecanismo" ya existente).
async function resolverMunicipiosEstadoBienestar(
  estadoCve: string,
  agregarEstado: (estadoCve: string) => Promise<ConteoPorMunicipio>,
  fuenteEtiqueta: string,
  soloCves?: string[]
): Promise<ElementoDeEstado[]> {
  const [conteos, opciones] = await Promise.all([
    agregarEstado(estadoCve),
    getMunicipiosOptions(estadoCve),
  ]);
  const opcionesFiltradas = soloCves ? opciones.filter((o) => soloCves.includes(o.cve)) : opciones;

  // FIX DE FONDO (Paso 4, 2026-08-23) — join por nombre, mismo patrón
  // que resolverMunicipiosEstadoIcmm (icmm.ts).
  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => {
    const valor = conteos[claveCanonicaMunicipio(estadoCve, nombre)];
    return {
      cve,
      nombre,
      celda: valor != null
        ? { nivel: "municipal", valor, unidad: "beneficiarios", naturaleza: "dato_directo", fuenteEtiqueta }
        : { nivel: "municipal", motivo: "Bienestar no reportó beneficiarios para este municipio" },
    };
  });
}

export async function resolverMunicipiosEstadoProduccion(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoBienestar(estadoCve, agregarProduccionEstado, FUENTE_ETIQUETA_BIENESTAR_PRODUCCION, soloCves);
}

export async function resolverMunicipiosEstadoBecaBJ(estadoCve: string, soloCves?: string[]): Promise<ElementoDeEstado[]> {
  return resolverMunicipiosEstadoBienestar(estadoCve, agregarBecaBJEstado, FUENTE_ETIQUETA_BIENESTAR_BECA, soloCves);
}

// Desglose "Ver estados" en proyectos nivel "nacional" (Encargo de
// generalización, 2026-08-09) — a diferencia de CONAPO/CONEVAL
// (Map nacional ya en memoria), aquí no hay atajo: son las mismas 32
// llamadas de red que ya usa calcularTotalNacional (paginación CKAN por
// estado, cacheada+single-flight tras el primer uso).
//
// Medido en vivo 2026-08-09, 100% frío (0/32 estados cacheados,
// invalidados a propósito antes de medir):
//   F2-7 (Producción): 14,344ms (24% de maxDuration=60s) — verde, procede.
//   F2-8 (Beca BJ): 5 mediciones en frío independientes — 8,002ms,
//     29,918ms, 12,043ms, 13,802ms (pipeline completo), y un diagnóstico
//     aparte solo-CKAN (sin bodega/Storage, 3 corridas): 14,821ms,
//     8,270ms, 13,408ms. INVESTIGADO el origen de la varianza (no
//     asumido) — descartados los 3 candidatos controlables:
//       - Rate limiting/throttling de CKAN: 0 errores/rechazos en las 8
//         corridas totales (diagnóstico + pipeline) — nunca se activó.
//       - Paginación inestable: el total de registros por estado fue
//         idéntico entre corridas para el mismo estado (ej. Estado de
//         México "15": 787,548 registros/25 páginas, siempre).
//       - Reintentos del cliente: no existen (ckanDatastoreSearch no
//         reintenta) — no hay mecanismo propio que pueda estar
//         disparándose de forma intermitente.
//     El estado "15" (Edomex, 787,548 registros) es consistentemente el
//     más pesado, pero el estado que ACOMPAÑA como segundo/tercer más
//     lento CAMBIA entre corridas (09, 20, 11, 21, 17, 18, 23, 14, 07) —
//     latencia de red real del host compartido de datos.gob.mx,
//     genuinamente variable corrida a corrida, no un patrón
//     reproducible ni controlable desde este cliente.
//   CONCLUSIÓN: causa externa, no controlable — F2-8 en "Ver estados"
//   queda diferido (ver INDICATOR_REGISTRY.json, entrada F2-8, mismo
//   criterio de documentación que ENOE). NO se conecta al dispatcher
//   (resolverDesgloseEstadosNacional en index.ts) — resolverEstadosBecaBJ
//   queda escrita y lista para cuando se decida revisar esto de nuevo,
//   pero sin caller real.
async function resolverEstadosBienestarGenerico(
  resourceMap: Record<string, string>,
  agregarEstado: (estadoCve: string) => Promise<ConteoPorMunicipio>,
  fuenteEtiqueta: string
): Promise<ElementoDeEstado[]> {
  const entradas = await Promise.all(
    Object.keys(resourceMap).map(async (cve): Promise<ElementoDeEstado> => {
      const conteos = await agregarEstado(cve);
      const valor = Object.values(conteos).reduce((a, b) => a + b, 0);
      return {
        cve,
        nombre: CVE_ESTADO_NOMBRE[cve] ?? cve,
        celda: { nivel: "estatal", valor, unidad: "beneficiarios", naturaleza: "estimacion_agregada", fuenteEtiqueta },
      };
    })
  );
  return entradas;
}

export async function resolverEstadosProduccion(): Promise<ElementoDeEstado[]> {
  return resolverEstadosBienestarGenerico(RESOURCE_PRODUCCION, agregarProduccionEstado, FUENTE_ETIQUETA_BIENESTAR_PRODUCCION);
}

// Escrita y lista — sin conectar al dispatcher hasta decisión sobre el
// tiempo medido (ver comentario arriba).
export async function resolverEstadosBecaBJ(): Promise<ElementoDeEstado[]> {
  return resolverEstadosBienestarGenerico(RESOURCE_BECA_BJ, agregarBecaBJEstado, FUENTE_ETIQUETA_BIENESTAR_BECA);
}
