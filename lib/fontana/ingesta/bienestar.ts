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
// 128 recursos = 32 estados × 4 trimestres 2025). Elegido el recurso
// "4to. trim. 2025" (trimestre más reciente y completo, decisión ya
// reportada y confirmada) — campos reales `CVE_EDO`, `CVE_MUN`, `BECA`,
// sin identificador de persona; cada fila ya representa una beca activa
// ese trimestre para un municipio, así que el conteo de beneficiarios es
// el total de filas por `CVE_MUN`, sin necesidad de deduplicar.
//
// Paginación: el servidor limita cada respuesta a 32,000 registros pese
// a pedir más (confirmado en vivo, Aguascalientes Beca 4to trim: 66,289
// registros totales, servidor regresa 32,000 aunque se pida limit=70000)
// — se pagina con offset hasta agotar el total real reportado por la API.
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
import { resolveMunicipioCve, normalizeGeoName, getMunicipiosOptions } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";
import type { ElementoDeEstado } from "@/lib/fontana/ingesta/eceg";

export const FUENTE_ETIQUETA_BIENESTAR_PRODUCCION = "Bienestar (Producción para el Bienestar, 2024, datos.gob.mx)";
export const FUENTE_ETIQUETA_BIENESTAR_BECA = "Bienestar (Beca Benito Juárez, 4to. trim. 2025, datos.gob.mx)";

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

const RESOURCE_BECA_BJ: Record<string, string> = {
  "01": "04e34ae5-a91b-4ed1-8544-5472e72cf462", "02": "ccd1360e-a1c8-4694-826f-6fca94d97ee5",
  "03": "da7419ae-ec4e-4d73-9f88-b325be241753", "04": "f44c0234-a1e9-4a9c-ba57-f3e0b314cf3d",
  "05": "5829435d-82ae-41e4-94bf-b47822ef7d98", "06": "af0ca022-770a-4fa2-a45f-864fd27b087d",
  "07": "7f735e7b-36bc-4b6b-adad-5dfa9330877b", "08": "6221b114-fcb4-4215-907a-6aee6cec3bd3",
  "09": "ffb975eb-7408-4b01-99b4-1f3a27a94ad6", "10": "54f634c2-52b0-4550-9ab4-af6fdfc07647",
  "11": "300f6177-a0b5-4932-a260-77f4ec33f889", "12": "9287884b-1672-44c7-8705-14e0aa4d27d4",
  "13": "e4a8a332-59a2-4257-963c-07154ac670c0", "14": "fc4578e8-9f2e-4e39-860c-d670f8cc8ac4",
  "15": "d16ee1b9-b42b-46ec-8c43-c27d00e5e1e4", "16": "b63c37fc-5848-4559-a3d2-a11184bed0ea",
  "17": "6bf07b23-090a-482b-a67f-3a2dcfb046cc", "18": "6ef7c6fd-79a3-42ef-bb89-0bb91f6986ec",
  "19": "5598375c-4822-4268-9e94-5dd4d6469917", "20": "9cea04d5-7b66-451a-b3d2-3c8f0f887e9e",
  "21": "a5d96fdc-f4b7-47b0-be55-aad63f238057", "22": "0abaaaa7-a6d6-44a7-b73e-b60f7d123ac1",
  "23": "cc4c673c-6d9d-4a4b-9efd-34c096807adb", "24": "c482ec07-ede8-4951-a84c-cb3ba93b67bd",
  "25": "19c38c34-c5dd-4be8-9130-f20a89a8b378", "26": "8529267b-0fea-4ffa-94a5-feffcd906482",
  "27": "9451bed5-f5c2-4267-9294-d56f57c15918", "28": "1662d565-e01c-4799-85de-b963736517dd",
  "29": "57ddb4f3-20da-4668-bfc8-7d18e8a5b943", "30": "3179c6f8-838e-46f0-8c14-197b7fcc81b2",
  "31": "0e94c6ac-2581-4215-947e-a2a7a5be0043", "32": "3d9921bb-4867-4ab4-82da-da8f636bb248",
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
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
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

async function agregarProduccionEstado(estadoCve: string): Promise<ConteoPorMunicipio> {
  const path = `bienestar_produccion/${estadoCve}.json`;
  const cached = await readFromBodega<ConteoPorMunicipio>(path);
  if (cached) return cached;

  const key = `produccion:${estadoCve}`;
  const existente = enVuelo.get(key);
  if (existente) return existente;

  const promesa = (async () => {
    const resourceId = RESOURCE_PRODUCCION[estadoCve];
    if (!resourceId) return {};
    const registros = (await paginarCompleto(resourceId, ["municipio", "id_suri"])) as Array<{ municipio?: string; id_suri?: string }>;
    const idsPorMunicipio = new Map<string, Set<string>>();
    for (const r of registros) {
      if (!r.municipio || !r.id_suri) continue;
      if (!idsPorMunicipio.has(r.municipio)) idsPorMunicipio.set(r.municipio, new Set());
      idsPorMunicipio.get(r.municipio)!.add(r.id_suri);
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
  const path = `bienestar_becabj_2025q4/${estadoCve}.json`;
  const cached = await readFromBodega<ConteoPorMunicipio>(path);
  if (cached) return cached;

  const key = `becabj:${estadoCve}`;
  const existente = enVuelo.get(key);
  if (existente) return existente;

  const promesa = (async () => {
    const resourceId = RESOURCE_BECA_BJ[estadoCve];
    if (!resourceId) return {};
    const registros = (await paginarCompleto(resourceId, ["CVE_MUN"])) as Array<{ CVE_MUN?: string }>;
    const resultado: ConteoPorMunicipio = {};
    for (const r of registros) {
      if (!r.CVE_MUN) continue;
      resultado[r.CVE_MUN] = (resultado[r.CVE_MUN] ?? 0) + 1;
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

  const municipioNombre = resolverNombreMunicipio(territorio);
  let municipal: CeldaFontana;
  if (!municipioNombre) {
    municipal = { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  } else {
    const municipioCve = await resolveMunicipioCve(estadoCve, municipioNombre);
    if (!municipioCve) {
      municipal = { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo INEGI` };
    } else {
      const valor = conteos[municipioCve];
      municipal = valor != null
        ? { nivel: "municipal", valor, unidad: "beneficiarios", naturaleza: "dato_directo", fuenteEtiqueta }
        : { nivel: "municipal", motivo: "Bienestar no reportó beneficiarios para este municipio" };
    }
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

  return opcionesFiltradas.map(({ cve, nombre }): ElementoDeEstado => {
    const valor = conteos[cve];
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
