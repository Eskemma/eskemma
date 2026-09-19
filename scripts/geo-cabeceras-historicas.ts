#!/usr/bin/env npx tsx
/**
 * scripts/geo-cabeceras-historicas.ts
 *
 * Genera lib/geo/cabeceras_historicas.json: para cada distrito electoral
 * (código de 4 dígitos = CVE estado + número de distrito) cuyo NOMBRE de
 * cabecera cambia entre años en los CSV de resultados de Sefix, el nombre que
 * traía cada año. Solo se incluyen los códigos con más de un nombre.
 *
 * Por qué existe (hallazgo del 2026-09-19, CSV reales en Storage):
 *   - el nombre de una misma cabecera cambia entre años en 136 de 313 códigos
 *     federales (26 estados) y 342 de 692 locales (30 estados);
 *   - una parte son renombres de la MISMA cabecera ("QUERETARO" ↔ "SANTIAGO DE
 *     QUERETARO", "CD." ↔ "CIUDAD", "TOLUCA" ↔ "TOLUCA DE LERDO");
 *   - el resto es el mismo CÓDIGO reasignado a otro territorio (redistritación:
 *     Baja California 0206 = Mexicali en 2016, Tecate desde 2019; México 1521 =
 *     Naucalpan hasta 2015, Amecameca desde 2018).
 *   Por eso este archivo NO afirma continuidad entre años: la identidad de un
 *   distrito es (tipo, año, código). Solo registra qué nombre traía cada año.
 *
 * Los nombres se guardan en CLAVE INTERNA (normalizeGeoName, con el mojibake de
 * los CSV locales reparado): MAYÚSCULAS, sin acentos, Ñ/Ü conservadas.
 *
 * Solo LECTURA de Storage; escribe únicamente el JSON local.
 *
 *   npx tsx scripts/geo-cabeceras-historicas.ts            # resumen, no escribe
 *   npx tsx scripts/geo-cabeceras-historicas.ts --write    # escribe el JSON
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

process.loadEnvFile(".env");

async function main() {
  const { getStorage } = await import("firebase-admin/storage");
  const { adminApp } = await import("../lib/firebase-admin");
  const { normalizeGeoName, repararMojibakeGeo } = await import("../lib/geo/municipioCanonico");

  const limpiar = (s: string) =>
    normalizeGeoName(repararMojibakeGeo(s).replace(/\?/g, "")).replace(/\s+/g, " ").trim();

  const bucket = getStorage(adminApp).bucket();
  const [fed] = await bucket.getFiles({ prefix: "sefix/results/federals/" });
  const [loc] = await bucket.getFiles({ prefix: "sefix/results/locals/" });
  const archivos = [
    ...fed.map((f) => f.name).filter((n) => /pef_dip_\d{4}\.csv$/.test(n)).map((n) => ({ tipo: "federal" as const, n })),
    ...loc.map((f) => f.name).filter((n) => /_pel_dip_loc_\d{4}\.csv$/.test(n)).map((n) => ({ tipo: "local" as const, n })),
  ];

  let sinNombreReal = 0;
  // tipo → código → año → nombres distintos vistos ese año
  const acc: Record<"federal" | "local", Map<string, Map<string, Set<string>>>> = { federal: new Map(), local: new Map() };

  for (const { tipo, n } of archivos) {
    const anio = n.match(/_(\d{4})\.csv$/)![1];
    const rl = createInterface({ input: bucket.file(n).createReadStream(), crlfDelay: Infinity });
    let headers: string[] = [];
    let primera = true;
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (primera) {
        headers = line.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        primera = false;
        continue;
      }
      const v = line.split(",");
      const g = (c: string) => {
        const i = headers.indexOf(c);
        return i < 0 ? "" : (v[i] ?? "").trim().replace(/^"|"$/g, "");
      };
      const sec = g("seccion");
      if (!sec || sec === "0" || sec === "00") continue;
      const m = g("cabecera").match(/^(\d{4})\s+(.+)$/);
      if (!m) continue;
      // Colima 2015 (local) trae "0601 NO ESTABLECIDO ACUERDO 27/2014", con un
      // sufijo distinto por fila: es un marcador de dato faltante del INE, no un
      // nombre de cabecera. Se excluye y se cuenta aparte.
      if (/^NO ESTABLECIDO/.test(limpiar(m[2]))) { sinNombreReal++; continue; }
      const porCodigo = acc[tipo];
      if (!porCodigo.has(m[1])) porCodigo.set(m[1], new Map());
      const porAnio = porCodigo.get(m[1])!;
      if (!porAnio.has(anio)) porAnio.set(anio, new Set());
      porAnio.get(anio)!.add(limpiar(m[2]));
    }
  }

  const salida: Record<string, Record<string, Record<string, string>>> = { federal: {}, local: {} };
  let conflictosMismoAnio = 0;
  for (const tipo of ["federal", "local"] as const) {
    let total = 0;
    for (const [codigo, porAnio] of [...acc[tipo].entries()].sort(([a], [b]) => a.localeCompare(b))) {
      total++;
      const nombres = new Set([...porAnio.values()].flatMap((s) => [...s]));
      if (nombres.size < 2) continue;
      const fila: Record<string, string> = {};
      for (const [anio, set] of [...porAnio.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        // Un código con >1 nombre EN EL MISMO AÑO no debería pasar: se conserva el
        // primero y se reporta.
        if (set.size > 1) conflictosMismoAnio++;
        fila[anio] = [...set][0];
      }
      salida[tipo][codigo] = fila;
    }
    console.log(`${tipo}: ${total} códigos; con >1 nombre entre años: ${Object.keys(salida[tipo]).length}`);
  }
  console.log(`filas con marcador "NO ESTABLECIDO…" en vez de cabecera (excluidas): ${sinNombreReal}`);
  console.log(`códigos con >1 nombre en un mismo año (se conserva el primero): ${conflictosMismoAnio}`);

  const doc = {
    _generado: new Date().toISOString().slice(0, 10),
    _fuente: "sefix/results/federals/pef_dip_2006-2024.csv y sefix/results/locals/**/*_pel_dip_loc_2015-2024.csv (Storage)",
    _nota:
      "Solo códigos con >1 nombre entre años. La identidad de un distrito es (tipo, año, código): el mismo " +
      "código puede ser otro territorio tras una redistritación. Nombres en clave interna (MAYÚSCULAS sin acentos, Ñ/Ü conservadas).",
    federal: salida.federal,
    local: salida.local,
  };

  if (process.argv.includes("--write")) {
    const destino = join(process.cwd(), "lib/geo/cabeceras_historicas.json");
    writeFileSync(destino, JSON.stringify(doc, null, 1) + "\n", "utf8");
    console.log("escrito:", destino);
  } else {
    console.log("(sin --write: no se escribió nada)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
