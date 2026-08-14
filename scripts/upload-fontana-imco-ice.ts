/**
 * scripts/upload-fontana-imco-ice.ts
 * Sube el ICE (IMCO) 2025 — "Posiciones generales del ICE.csv", ya
 * verificado (32 entidades x 10 años, 2016-2025, sin huecos ni
 * duplicados) — a la bodega de Fontana en Storage
 * (fontana/bodega/imco_ice/2025.json), vía lib/fontana/bodegaStorage.ts.
 *
 * Fuente original: dataset Alphacast (id 46612, republicando IMCO) vía
 * URL firmada ya caducada — respaldo local entregado por Raúl en
 * info_geo_eske/imco_ice_2025/. No hay URL institucional estable
 * conocida hoy; este script documenta el proceso de carga manual, a
 * repetir en la próxima edición del ICE (la URL de Alphacast no será
 * reutilizable, hay que buscar el dataset de nuevo).
 *
 * Usage: npx tsx scripts/upload-fontana-imco-ice.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

interface FilaIce {
  valor: number;
  nivelCompetitividad: string;
  ranking: number;
  cambioPosicion: number;
}

async function main() {
  const fs = await import("fs");
  const { normalizeGeoName } = await import("../lib/geo/municipios");
  const { ESTADO_CVE_MAP } = await import("../lib/sefix/eleccionesConstants");
  const { writeToBodega, ensureManifest } = await import("../lib/fontana/bodegaStorage");

  // IMCO usa "México" para referirse a Estado de México (para
  // distinguirlo de "Ciudad de México") — único alias necesario,
  // verificado: las otras 31 entidades ya calzan con normalizeGeoName +
  // ESTADO_CVE_MAP sin ajuste.
  function resolverEstadoCve(nombreImco: string): string | null {
    const nombre = nombreImco === "México" ? "Estado de México" : nombreImco;
    return ESTADO_CVE_MAP[normalizeGeoName(nombre)] ?? null;
  }

  const csvPath = path.resolve(
    __dirname,
    "../info_geo_eske/imco_ice_2025/Posiciones generales del ICE.csv"
  );
  const lineas = fs.readFileSync(csvPath, "utf-8").split("\n").slice(1).filter(Boolean);

  // estadoCve -> año (YYYY) -> fila
  const porEstado: Record<string, Record<string, FilaIce>> = {};
  let procesadas = 0;

  for (const linea of lineas) {
    const m = linea.match(/^"([^"]+)","([^"]+)",([^,]+),"([^"]+)",(\d+),(-?\d+)/);
    if (!m) throw new Error(`Fila con formato inesperado: ${linea}`);
    const [, anoFecha, entidad, valorStr, nivel, rankingStr, cambioStr] = m;
    const ano = anoFecha.slice(0, 4);
    const estadoCve = resolverEstadoCve(entidad);
    if (!estadoCve) throw new Error(`Entidad no reconocida: "${entidad}"`);

    porEstado[estadoCve] ??= {};
    porEstado[estadoCve][ano] = {
      valor: Number(valorStr),
      nivelCompetitividad: nivel,
      ranking: Number(rankingStr),
      cambioPosicion: Number(cambioStr),
    };
    procesadas++;
  }

  const estados = Object.keys(porEstado);
  console.log(`Procesadas ${procesadas} filas, ${estados.length} entidades.`);
  if (estados.length !== 32) throw new Error(`Se esperaban 32 entidades, se obtuvieron ${estados.length}`);
  for (const cve of estados) {
    const anos = Object.keys(porEstado[cve]);
    if (anos.length !== 10) throw new Error(`Entidad ${cve} tiene ${anos.length} años, se esperaban 10`);
  }

  const payload = {
    fuentePrimaria: "IMCO — Índice de Competitividad Estatal (ICE) 2025",
    fuenteCanal: "Alphacast (dataset id 46612, republica IMCO) — URL firmada, ya caducada",
    fechaDescarga: "2026-08-10",
    notaMantenimiento:
      "La URL de Alphacast usada para obtener este archivo es temporal (firma CloudFront con expiración) " +
      "y ya no funciona. Para actualizar en la próxima edición del ICE, buscar el dataset de nuevo en " +
      "alphacast.io (o directamente en imco.org.mx si publican descarga estructurada) — no reintentar la " +
      "misma URL.",
    porEstado,
  };

  await writeToBodega("imco_ice/2025.json", payload);
  await ensureManifest("imco_ice", {
    creado: new Date().toISOString(),
    adaptador: "lib/fontana/ingesta/imco.ts",
    estrategia: "precomputado",
    notas:
      "Fuente republicada por Alphacast (no IMCO directo) vía URL firmada temporal ya caducada — " +
      "respaldo local cargado manualmente. Requiere re-descarga manual en cada edición futura del ICE.",
  });

  console.log("✅ Subido a fontana/bodega/imco_ice/2025.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});