// app/api/sefix/serie-semanal/route.ts
// Sirve un CSV pre-agregado de semanal_series/ como JSON.
// Lee UN solo archivo pequeño desde Storage — respuesta en ~200ms.
// Parámetros: tipo=sexo|edad|origen  ambito=nacional|extranjero  corte=YYYY-MM-DD  entidad=NOMBRE

import { NextRequest, NextResponse } from "next/server";
import { adminApp } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";
import {
  getSemanalSeccionesSerie,
  type SemanalTipo,
  type SemanalGeoFilter,
} from "@/lib/sefix/storage";

export const dynamic = "force-dynamic";

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;

// Module-level cache for entity series JSON (avoids re-downloading on every request)
type EntitySeriesData = Record<string, { nacional: Record<string, number>[]; extranjero: Record<string, number>[] }>;
const entitySeriesCache = new Map<string, EntitySeriesData>();

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = (values[i] ?? "").trim();
    }
    return row;
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tipo    = searchParams.get("tipo");
  const ambito  = searchParams.get("ambito") ?? "nacional";
  const corte   = searchParams.get("corte");
  const todas   = searchParams.get("todas") === "true";
  const entidad = searchParams.get("entidad");

  // Sub-state geo filter
  const cveDistrito  = searchParams.get("cvd")       ?? undefined;
  const cveMunicipio = searchParams.get("cvm")       ?? undefined;
  const seccionesRaw = searchParams.get("secciones") ?? "";
  const secciones    = seccionesRaw ? seccionesRaw.split(",").filter(Boolean) : undefined;

  if (!tipo || !["sexo", "edad", "origen"].includes(tipo)) {
    return NextResponse.json(
      { error: "Parámetro 'tipo' inválido. Usar: sexo | edad | origen" },
      { status: 400 }
    );
  }

  if (!["nacional", "extranjero"].includes(ambito)) {
    return NextResponse.json(
      { error: "Parámetro 'ambito' inválido. Usar: nacional | extranjero" },
      { status: 400 }
    );
  }

  try {
    // Section-series path: when sub-state geo filter is active
    const hasGeoFilter = !!(cveDistrito || cveMunicipio || secciones?.length);
    if (entidad && todas && hasGeoFilter) {
      const geo: SemanalGeoFilter = { cveDistrito, cveMunicipio, secciones };
      const result = await getSemanalSeccionesSerie(
        entidad,
        tipo as SemanalTipo,
        ambito as "nacional" | "extranjero",
        geo
      );
      if (result) {
        return NextResponse.json(
          { serie: result.serie, availableFechas: result.availableFechas },
          { headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" } }
        );
      }
      // Fall through to entity-level series if section series not yet generated
    }

    // Entity-series path: read pre-generated JSON for entity-level time series
    if (entidad && todas) {
      const jsonPath = `sefix/pdln/semanal_agg/serie_entidades_${tipo}.json`;
      let entityData = entitySeriesCache.get(tipo!);
      if (!entityData) {
        const bucket = getStorage(adminApp).bucket(BUCKET);
        const [contents] = await bucket.file(jsonPath).download();
        entityData = JSON.parse(contents.toString("utf-8")) as EntitySeriesData;
        entitySeriesCache.set(tipo!, entityData);
      }
      const ambitoKey = ambito as "nacional" | "extranjero";
      const entidadRows = entityData[entidad]?.[ambitoKey] ?? [];
      if (entidadRows.length === 0) {
        return NextResponse.json(
          { error: `Sin datos de serie para entidad "${entidad}" (${ambito})` },
          { status: 404 }
        );
      }
      const serie = entidadRows.map((row) => {
        const { fecha, ...rest } = row as Record<string, number | string>;
        const nums: Record<string, number> = {};
        for (const [k, v] of Object.entries(rest)) {
          const n = parseFloat(String(v));
          if (!isNaN(n)) nums[k] = n;
        }
        return { fecha: String(fecha ?? ""), ...nums };
      });
      const availableFechas = serie.map((r) => r.fecha).filter(Boolean).reverse();
      return NextResponse.json(
        { serie, availableFechas },
        { headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" } }
      );
    }

    const path = `sefix/pdln/semanal_series/serie_${ambito}_${tipo}.csv`;
    const bucket = getStorage(adminApp).bucket(BUCKET);
    const [contents] = await bucket.file(path).download();
    const text = contents.toString("utf-8");

    const rows = parseCsv(text);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: `No se encontraron datos en ${path}` },
        { status: 404 }
      );
    }

    // Fechas disponibles — descendente (más reciente primero)
    const availableFechas = rows
      .map((r) => r.fecha)
      .filter(Boolean)
      .reverse();

    // Modo series completas: devolver todas las filas como array
    if (todas) {
      const serie = rows.map((row) => {
        const { fecha, ...rest } = row;
        const nums: Record<string, number> = {};
        for (const [k, v] of Object.entries(rest)) {
          const n = parseFloat(v);
          if (!isNaN(n)) nums[k] = n;
        }
        return { fecha: fecha ?? "", ...nums };
      });
      // Sin corte → datos "latest", se revalidan en background para detectar nuevos cortes.
      // Con corte específico → datos inmutables, cache larga.
      const cc = corte
        ? "public, max-age=1800, stale-while-revalidate=3600"
        : "public, max-age=0, stale-while-revalidate=600";
      return NextResponse.json(
        { serie, availableFechas },
        { headers: { "Cache-Control": cc } }
      );
    }

    // Seleccionar fila del corte solicitado o la más reciente
    const targetRow = corte
      ? (rows.find((r) => r.fecha === corte) ?? rows[rows.length - 1])
      : rows[rows.length - 1];

    // Convertir columnas numéricas
    const { fecha, ...rest } = targetRow;
    const data: Record<string, number> = {};
    for (const [k, v] of Object.entries(rest)) {
      const n = parseFloat(v);
      if (!isNaN(n)) data[k] = n;
    }

    // Sin corte → "latest": max-age=0 + stale-while-revalidate para detectar nuevos cortes.
    // Con corte específico → datos inmutables: cache larga.
    const cacheControl = corte
      ? "public, max-age=1800, stale-while-revalidate=3600"
      : "public, max-age=0, stale-while-revalidate=600";

    return NextResponse.json(
      { data, fecha: fecha ?? "", availableFechas },
      { headers: { "Cache-Control": cacheControl } }
    );
  } catch (error) {
    console.error("[serie-semanal] Error:", error);
    return NextResponse.json(
      { error: "No se pudo leer el archivo de series" },
      { status: 500 }
    );
  }
}
