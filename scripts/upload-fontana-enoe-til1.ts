/**
 * scripts/upload-fontana-enoe-til1.ts
 * Sube la Tasa de Informalidad Laboral 1 (TIL1, F2-9) — 32 archivos ya
 * exportados manualmente desde INEGI Infolaboral (ASP.NET WebForms sin
 * URL en vivo reproducible, verificado 2026-08-10) — a la bodega de
 * Fontana en Storage (fontana/bodega/enoe_til1/2026-08-10.json), vía
 * lib/fontana/bodegaStorage.ts. Mismo patrón que
 * scripts/upload-fontana-imco-ice.ts.
 *
 * Cada archivo es HTML disfrazado de .xls, un solo valor (trimestre
 * más reciente al momento de la exportación), sin serie histórica.
 *
 * Usage: npx tsx scripts/upload-fontana-enoe-til1.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const fs = await import("fs");
  const { normalizeGeoName } = await import("../lib/geo/municipios");
  const { ESTADO_CVE_MAP } = await import("../lib/sefix/eleccionesConstants");
  const { writeToBodega, ensureManifest } = await import("../lib/fontana/bodegaStorage");

  const dir = path.resolve(
    __dirname,
    "../info_geo_eske/enoe_nav/tasa_informalidad_laboral (TIL 1)"
  );
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".xls")).sort();
  if (archivos.length !== 32) {
    throw new Error(`Se esperaban 32 archivos, se encontraron ${archivos.length}`);
  }

  // INEGI usa el nombre oficial largo para algunas entidades — mismo
  // tipo de alias ya necesario en enigh.ts/imco.ts, verificado contra
  // ESTADO_CVE_MAP (no fuzzy-matching).
  const ALIAS_NOMBRE: Record<string, string> = {
    "Coahuila de Zaragoza": "Coahuila",
    "México": "Estado de México",
    "Michoacán de Ocampo": "Michoacán",
    "Veracruz de Ignacio de la Llave": "Veracruz",
  };

  const porEstado: Record<string, { valor: number; entidadOrigen: string }> = {};
  let periodo: string | null = null;

  for (const archivo of archivos) {
    const prefijo = archivo.slice(0, 2);
    if (!/^\d{2}$/.test(prefijo)) throw new Error(`Archivo sin prefijo numérico esperado: ${archivo}`);

    const html = fs.readFileSync(path.join(dir, archivo), "latin1");

    // Estructura real confirmada (los 32 archivos comparten el mismo
    // patrón): fila "Total" (colspan=2, bold) seguida de la fila con
    // el nombre de la entidad (mismo estilo colspan=2 bold).
    const entidadMatch = html.match(/colspan="2"[^>]*>Total<\/td>\s*<\/tr><tr[^>]*>\s*<td[^>]*colspan="2"[^>]*>([^<]+)<\/td>/);
    const entidad = entidadMatch?.[1]?.trim();
    if (!entidad) throw new Error(`No se encontró el nombre de entidad en ${archivo}`);

    const valorMatch = html.match(/Tasa de informalidad laboral \(TIL 1\)<\/td><td[^>]*>([\d.]+)<\/td>/);
    if (!valorMatch) throw new Error(`No se encontró el valor de TIL1 en ${archivo}`);
    const valor = Number(valorMatch[1]);
    if (!Number.isFinite(valor)) throw new Error(`Valor TIL1 no numérico en ${archivo}: "${valorMatch[1]}"`);

    const anoMatch = html.match(/<td align="left">Indicadores<\/td><td[^>]*>(\d{4})<\/td>/);
    const trimestreMatch = html.match(/<td[^>]*background-color:#CCCCCC[^>]*>([^<]*[Tt]rimestre[^<]*)<\/td>/);
    if (anoMatch && trimestreMatch) periodo = `${trimestreMatch[1].trim()} de ${anoMatch[1]}`;

    // Cruce de verificación: el nombre de entidad dentro del archivo
    // debe resolver al mismo cve que el prefijo numérico del nombre de
    // archivo — si no coinciden, algo real está mal (archivo mal
    // nombrado o parseo equivocado), se detiene en vez de subir un dato
    // dudoso.
    const nombreResuelto = ALIAS_NOMBRE[entidad] ?? entidad;
    const cveDesdeNombre = ESTADO_CVE_MAP[normalizeGeoName(nombreResuelto)];
    if (!cveDesdeNombre) throw new Error(`Entidad "${entidad}" (${archivo}) no reconocida en ESTADO_CVE_MAP`);
    if (cveDesdeNombre !== prefijo) {
      throw new Error(
        `Desalineo real: ${archivo} trae entidad "${entidad}" (cve ${cveDesdeNombre}) pero el prefijo del archivo es ${prefijo}`
      );
    }

    porEstado[prefijo] = { valor, entidadOrigen: entidad };
  }

  const estados = Object.keys(porEstado);
  console.log(`Procesados ${estados.length} archivos, periodo detectado: ${periodo}`);
  if (estados.length !== 32) throw new Error(`Se esperaban 32 entidades, se obtuvieron ${estados.length}`);

  const payload = {
    fuentePrimaria: "INEGI — Encuesta Nacional de Ocupación y Empleo (ENOE), Tasa de Informalidad Laboral 1 (TIL 1)",
    fuenteCanal: "INEGI Infolaboral (sistemas/Infoenoe) — exportación manual, sin URL en vivo reproducible",
    periodo,
    fechaDescarga: "2026-08-10",
    notaMantenimiento:
      "Infolaboral es un sistema ASP.NET WebForms clásico (__VIEWSTATE/__EVENTVALIDATION) — no tiene una " +
      "URL pública reproducible por fetch simple (verificado en vivo 2026-08-10, incluyendo un intento con " +
      "un pxq de tabulados interactivos que resultó ser un tablero distinto). Actualizar este indicador en " +
      "el futuro requiere repetir la navegación manual en Infolaboral (32 exportaciones, una por entidad), " +
      "no hay mecanismo automatizable.",
    porEstado,
  };

  await writeToBodega("enoe_til1/2026-08-10.json", payload);
  await ensureManifest("enoe_til1", {
    creado: new Date().toISOString(),
    adaptador: "lib/fontana/ingesta/enoeInformalidad.ts",
    estrategia: "bajo_demanda",
    notas:
      "32 archivos HTML disfrazados de .xls, exportados manualmente desde Infolaboral (INEGI) — sin URL " +
      "en vivo reproducible. Requiere actualización manual periódica, mismo patrón documentado que " +
      "imco_ice.",
  });

  console.log("✅ Subido a fontana/bodega/enoe_til1/2026-08-10.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
