// lib/fontana/ingesta/conapo.ts
// Adaptador de F1-18 (Razón de dependencia demográfica) sobre la API CKAN
// de datos.gob.mx (CONAPO, Proyecciones de población). Bodega BAJO
// DEMANDA — mismo criterio que compendio.ts: se consulta y cachea por
// municipio/estado la primera vez que un territorio real lo pide, sin
// precomputar el país completo.
//
// ⚠️ Hallazgo de esta sesión (2026-07-31): el resource_id documentado en
// una investigación previa (info_geo_eske/conapo_migracion_municipal/
// README.md), "99b28bb6-8e31-48e1-b162-85a7e4deafc3", YA NO apunta a los
// mismos datos — la plataforma se migró a datos.gob.mx (CKAN 2.11.5,
// sin el prefijo /busca/ anterior) y ese resource_id ahora sirve un
// dataset distinto (población por sexo/grupo de edad, sin RAZ_DEP).
// Verificado en vivo el recurso correcto dentro del mismo paquete
// "Proyecciones de población" (datos.gob.mx/api/3/action/package_show?
// id=f2b9b220-3ef7-4e3a-bde6-87e1dac78c6a):
//
//   RESOURCE_MUNICIPAL = "e9160552-769b-41ee-88d1-afc765552608"
//   ("Proyecciones de población, indicadores demográficos", 126,225
//   registros — mismo total que documentó la investigación previa).
//   Campos confirmados vía datastore_search: CLAVE, CLAVE_ENT, NOM_ENT,
//   NOM_MUN, ANO, RAZ_DEP_ADU, RAZ_DEP_INF, RAZ_DEP, entre otros.
//   Dato real de control (coincide EXACTO con la investigación previa):
//   CLAVE="1001" (Aguascalientes), ANO="1990" →
//   RAZ_DEP_ADU:7.36, RAZ_DEP_INF:69.53, RAZ_DEP:76.9.
//
//   RESOURCE_ESTATAL = "b4fe49a8-c86a-4c32-8450-8f3c4cc83125"
//   ("Indicadores demográficos, 1950-2070", 33 registros por año — 32
//   entidades + "República Mexicana"). CONAPO publica RAZ_DEP también a
//   nivel estatal de forma DIRECTA — no hace falta agregar desde
//   municipios. Confirmado en vivo: ANIO=2026, ENTIDAD="Aguascalientes",
//   CVE_GEO=1 → RAZ_DEP:48.69.
//
// CLAVE (municipal) NO es el CVE_MUN oficial de 5 dígitos — es
// CLAVE_ENT SIN padding (ej. "1", no "01") + MUN de 3 dígitos con
// padding (ej. "001"), confirmado con Zapopan: CLAVE_ENT="14",
// MUN→"120" → CLAVE="14120" (aquí sí coincide con el CVE de 5 dígitos
// porque Jalisco ya tiene 2 dígitos, pero para estados de 1 dígito como
// Aguascalientes el resultado tiene 4 caracteres, no 5).
//
// Año usado: 2026 (año en curso al momento de esta implementación) — la
// serie de CONAPO es una única proyección continua 1990-2040
// recalibrada contra el censo, sin distinción "observado/proyectado"
// expuesta en los datos; se usa el año más cercano al presente en vez
// del más reciente disponible (2040), que sería una proyección a futuro
// lejano, no el estado actual del territorio.

import https from "https";
import { readFromBodega, writeToBodega } from "@/lib/fontana/bodegaStorage";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { normalizeGeoName } from "@/lib/geo/municipios";
import { extraerCiudadCabecera } from "@/lib/moddulo/territorioLabel";
import type { Territorio } from "@/types/shared.types";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

const CKAN_BASE = "https://www.datos.gob.mx/api/3/action/datastore_search";
const RESOURCE_MUNICIPAL = "e9160552-769b-41ee-88d1-afc765552608";
const RESOURCE_ESTATAL = "b4fe49a8-c86a-4c32-8450-8f3c4cc83125";
const ANO_VIGENTE = "2026";

// Año incluido dinámicamente desde ANO_VIGENTE — al hacer el bump anual
// documentado en el runbook (Fontana_T10_Runbook_Bodega.md), la etiqueta
// de fuente se actualiza sola, sin un segundo lugar que recordar tocar.
export const FUENTE_ETIQUETA_CONAPO = `CONAPO (Proyecciones de población, ${ANO_VIGENTE})`;

interface RazDepRecord {
  razDep: number;
}

function resolveEstadoCve(estadoNombre: string): string | null {
  return ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)] ?? null;
}

function resolverNombreMunicipio(territorio: Territorio): string | undefined {
  if (territorio.nivel === "distrito_federal" || territorio.nivel === "distrito_local") {
    return extraerCiudadCabecera(territorio.municipio ?? territorio.nombre) ?? undefined;
  }
  return territorio.municipio;
}

// datos.gob.mx sirve un certificado TLS con la cadena incompleta — solo
// el certificado hoja (Let's Encrypt E8), sin el intermedio. Confirmado
// en esta sesión con `openssl s_client -showcerts` (1 solo certificado
// en la respuesta del servidor). Node/undici (fetch nativo) valida la
// cadena estrictamente y rechaza la conexión
// ("UNABLE_TO_VERIFY_LEAF_SIGNATURE"); navegadores y curl lo toleran
// porque cachean o resuelven intermedios por su cuenta. Es un problema
// del servidor de datos.gob.mx, no de este código — se usa el módulo
// nativo `https` con `rejectUnauthorized:false` como excepción acotada
// SOLO para este host, con GET público sin credenciales (open data, sin
// secretos en tránsito). No usar este patrón para ningún otro fetch.
function ckanDatastoreSearch(resourceId: string, filters: Record<string, string | number>): Promise<unknown[]> {
  const url = `${CKAN_BASE}?resource_id=${resourceId}&filters=${encodeURIComponent(JSON.stringify(filters))}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false, timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`CKAN HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(body) as { success: boolean; result?: { records: unknown[] } };
          if (!data.success) {
            reject(new Error("CKAN respondió success:false"));
            return;
          }
          resolve(data.result?.records ?? []);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("CKAN timeout")));
  });
}

async function resolverRazDepEstatal(estadoCve: string): Promise<RazDepRecord | null> {
  const path = `conapo_indicadores_estatales/${estadoCve}.json`;
  const cached = await readFromBodega<RazDepRecord>(path);
  if (cached) return cached;

  const cveGeo = parseInt(estadoCve, 10);
  const records = (await ckanDatastoreSearch(RESOURCE_ESTATAL, { CVE_GEO: cveGeo, ANIO: parseInt(ANO_VIGENTE, 10) })) as Array<{ RAZ_DEP?: number }>;
  const rec = records[0];
  if (!rec || typeof rec.RAZ_DEP !== "number") return null;

  const result: RazDepRecord = { razDep: rec.RAZ_DEP };
  await writeToBodega(path, result);
  return result;
}

async function resolverRazDepMunicipal(estadoCve: string, municipioCve: string): Promise<RazDepRecord | null> {
  const clave = `${estadoCve}${municipioCve}`;
  const path = `conapo_indicadores_municipales/${clave}.json`;
  const cached = await readFromBodega<RazDepRecord>(path);
  if (cached) return cached;

  // CLAVE de CONAPO: CLAVE_ENT sin padding + MUN con padding de 3.
  const claveConapo = `${parseInt(estadoCve, 10)}${municipioCve}`;
  const records = (await ckanDatastoreSearch(RESOURCE_MUNICIPAL, { CLAVE: claveConapo, ANO: ANO_VIGENTE })) as Array<{ RAZ_DEP?: number }>;
  const rec = records[0];
  if (!rec || typeof rec.RAZ_DEP !== "number") return null;

  const result: RazDepRecord = { razDep: rec.RAZ_DEP };
  await writeToBodega(path, result);
  return result;
}

export async function resolverRazonDependencia(territorio: Territorio): Promise<CeldaFontana[]> {
  const nacional = await resolverNacionalCelda();

  if (!territorio.estado) {
    const motivo = "El proyecto no tiene un estado definido en su territorio";
    return [nacional, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const estadoCve = resolveEstadoCve(territorio.estado);
  if (!estadoCve) {
    const motivo = `Estado "${territorio.estado}" no reconocido en el catálogo INEGI`;
    return [nacional, { nivel: "estatal", motivo }, { nivel: "municipal", motivo }];
  }

  const [estatal, municipal] = await Promise.all([
    resolverEstatalCelda(estadoCve),
    resolverMunicipalCelda(estadoCve, territorio),
  ]);
  return [nacional, estatal, municipal];
}

// Nacional — CONAPO publica RAZ_DEP directo a nivel país dentro del mismo
// RESOURCE_ESTATAL (CVE_GEO=0, ENTIDAD="República Mexicana", verificado
// en vivo) — sin agregación de Fontana. dato_directo.
async function resolverNacionalCelda(): Promise<CeldaFontana> {
  try {
    const rec = await resolverRazDepEstatal("0");
    if (!rec) return { nivel: "nacional", motivo: "CONAPO no reportó razón de dependencia nacional" };
    return { nivel: "nacional", valor: rec.razDep, unidad: "razón de dependencia", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONAPO };
  } catch {
    return { nivel: "nacional", motivo: "Error de conexión con CONAPO (datos.gob.mx)" };
  }
}

async function resolverEstatalCelda(estadoCve: string): Promise<CeldaFontana> {
  try {
    const rec = await resolverRazDepEstatal(estadoCve);
    if (!rec) return { nivel: "estatal", motivo: "CONAPO no reportó razón de dependencia para este territorio" };
    return { nivel: "estatal", valor: rec.razDep, unidad: "razón de dependencia", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONAPO };
  } catch {
    return { nivel: "estatal", motivo: "Error de conexión con CONAPO (datos.gob.mx)" };
  }
}

async function resolverMunicipalCelda(estadoCve: string, territorio: Territorio): Promise<CeldaFontana> {
  const municipioNombre = resolverNombreMunicipio(territorio);
  if (!municipioNombre) {
    return { nivel: "municipal", motivo: "El proyecto no tiene un municipio definido en su territorio" };
  }

  const catalogo = await readFromBodega<Record<string, string>>(`iter_2020/catalogo_municipios/${estadoCve}.json`);
  const municipioCve = catalogo?.[normalizeGeoName(municipioNombre)];
  if (!municipioCve) {
    return { nivel: "municipal", motivo: `Municipio "${municipioNombre}" no reconocido en el catálogo INEGI` };
  }

  try {
    const rec = await resolverRazDepMunicipal(estadoCve, municipioCve);
    if (!rec) return { nivel: "municipal", motivo: "CONAPO no reportó razón de dependencia para este territorio" };
    return { nivel: "municipal", valor: rec.razDep, unidad: "razón de dependencia", naturaleza: "dato_directo", fuenteEtiqueta: FUENTE_ETIQUETA_CONAPO };
  } catch {
    return { nivel: "municipal", motivo: "Error de conexión con CONAPO (datos.gob.mx)" };
  }
}
