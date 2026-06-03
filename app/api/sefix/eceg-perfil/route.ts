import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase-admin";
import { ECEG_INDICATORS, ECEG_DENOMINATORS, ECEG_GROUPS } from "@/lib/sefix/ecegConstants";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
const STORAGE_PREFIX = "sefix/eceg_2020";
const CACHE_TTL_MS = 30 * 60 * 1000;

const AVERAGE_COLS = new Set(["GRAPROES", "REL_H_M", "OCUPVIVPAR", "PRO_OCUP_C", "PROM_HNV"]);

function weightField(variable: string): string {
  return variable === "OCUPVIVPAR" || variable === "PRO_OCUP_C" ? "VIVPAR_HAB" : "POBTOT";
}

interface CacheEntry { data: Record<string, Record<string, number>>; expiresAt: number }
const cache = new Map<string, CacheEntry>();

async function fetchFile(path: string): Promise<Record<string, Record<string, number>>> {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expiresAt > now) return hit.data;
  const bucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
  const [exists] = await bucket.file(path).exists();
  if (!exists) throw new Error(`Not found: ${path}`);
  const [buf] = await bucket.file(path).download();
  const data = JSON.parse(buf.toString("utf-8")) as Record<string, Record<string, number>>;
  cache.set(path, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

type NivelResult = {
  numerador: number;
  denominador: number | null;
  porcentaje: number | null;
  valor: number;
};

function capPct(raw: number): number {
  return Math.min(100, Math.round(raw * 10000) / 100);
}

function extract(
  data: Record<string, Record<string, number>>,
  key: string,
  variable: string,
  denominator: string | null
): NivelResult | null {
  const rec = data[key];
  if (!rec) return null;
  const val = rec[variable];
  if (typeof val !== "number") return null;
  const den = denominator ? (rec[denominator] ?? null) : null;
  const pct = typeof den === "number" && den > 0 ? capPct(val / den) : null;
  return { numerador: val, denominador: den, porcentaje: pct, valor: val };
}

function sumRecords(
  data: Record<string, Record<string, number>>,
  keys: string[],
  variable: string,
  denominator: string | null
): NivelResult | null {
  if (AVERAGE_COLS.has(variable)) {
    const wf = weightField(variable);
    let weightedSum = 0;
    let totalWeight = 0;
    for (const k of keys) {
      const rec = data[k];
      if (!rec) continue;
      const v = rec[variable];
      if (typeof v !== "number") continue;
      const w = typeof rec[wf] === "number" ? (rec[wf] as number) : 1;
      weightedSum += v * w;
      totalWeight += w;
    }
    if (totalWeight === 0) return null;
    const avg = Math.round((weightedSum / totalWeight) * 100) / 100;
    return { numerador: avg, denominador: null, porcentaje: null, valor: avg };
  }
  let num = 0;
  let den = 0;
  let found = false;
  for (const k of keys) {
    const rec = data[k];
    if (!rec) continue;
    const v = rec[variable];
    if (typeof v !== "number") continue;
    num += v;
    found = true;
    if (denominator && typeof rec[denominator] === "number") den += rec[denominator] as number;
  }
  if (!found) return null;
  const pct = denominator && den > 0 ? capPct(num / den) : null;
  return { numerador: num, denominador: denominator ? den : null, porcentaje: pct, valor: num };
}

export interface NivelData {
  valor: number | null;
  denominador: number | null;
  porcentaje: number | null;
}

export interface EcegPerfilRow {
  variable: string;
  grupo: string;
  grupoLabel: string;
  label: string;
  unit: string;
  nacional:  NivelData;
  estado:    NivelData | null;
  municipio: NivelData | null;
  distrito:  NivelData | null;
  seccion:   NivelData | null;
}

function toNivel(r: NivelResult | null): NivelData {
  return {
    valor:       r?.valor       ?? null,
    denominador: r?.denominador ?? null,
    porcentaje:  r?.porcentaje  ?? null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const estado_id      = searchParams.get("estado_id") ?? "";
  const municipio_cve  = searchParams.get("municipio_cve") ?? "";
  const distrito_cve   = searchParams.get("distrito_cve") ?? "";
  const seccionesRaw   = searchParams.get("secciones") ?? "";
  const secciones      = seccionesRaw ? seccionesRaw.split(",").filter(Boolean) : [];
  const download       = searchParams.get("download") === "true";
  const scopeNameParam = searchParams.get("scope_name") ?? "";

  const hasEstado    = !!estado_id;
  const hasMunicipio = hasEstado && !!municipio_cve;
  const hasDistrito  = hasEstado && !!distrito_cve && distrito_cve !== "TODOS";
  const hasSeccion   = hasEstado && secciones.length > 0;

  try {
    const estadoKey = estado_id ? estado_id.padStart(2, "0") : "";

    const national = await fetchFile(`${STORAGE_PREFIX}/national.json`);
    let munData:  Record<string, Record<string, number>> | null = null;
    let distData: Record<string, Record<string, number>> | null = null;
    let secData:  Record<string, Record<string, number>> | null = null;

    await Promise.all([
      hasMunicipio
        ? fetchFile(`${STORAGE_PREFIX}/municipios/${estadoKey}.json`).then(d => { munData = d; })
        : Promise.resolve(),
      hasDistrito
        ? fetchFile(`${STORAGE_PREFIX}/distritos/${estadoKey}.json`).then(d => { distData = d; })
        : Promise.resolve(),
      hasSeccion
        ? fetchFile(`${STORAGE_PREFIX}/secciones/${estadoKey}.json`).then(d => { secData = d; })
        : Promise.resolve(),
    ]);

    const allStateKeys = Object.keys(national);
    const secKeys = secciones.map((s) => estadoKey + s.padStart(4, "0"));

    const rows: EcegPerfilRow[] = ECEG_INDICATORS.map((ind) => {
      const denomKey = ECEG_DENOMINATORS[ind.key] ?? null;

      const nacResult = sumRecords(national, allStateKeys, ind.key, denomKey);
      const estResult = hasEstado
        ? extract(national, estadoKey, ind.key, denomKey)
        : null;
      const munResult = hasMunicipio && munData
        ? extract(munData, estadoKey + municipio_cve.padStart(3, "0"), ind.key, denomKey)
        : null;
      const distResult = hasDistrito && distData
        ? extract(distData, estadoKey + distrito_cve.padStart(3, "0"), ind.key, denomKey)
        : null;
      const secResult = hasSeccion && secData
        ? sumRecords(secData, secKeys, ind.key, denomKey)
        : null;

      const grupoLabel = ECEG_GROUPS.find((g) => g.id === ind.group)?.label ?? ind.group;
      return {
        variable:  ind.key,
        grupo:     ind.group,
        grupoLabel,
        label:     ind.label,
        unit:      ind.unit ?? "",
        nacional:  toNivel(nacResult),
        estado:    hasEstado    ? toNivel(estResult)  : null,
        municipio: hasMunicipio ? toNivel(munResult)  : null,
        distrito:  hasDistrito  ? toNivel(distResult) : null,
        seccion:   hasSeccion   ? toNivel(secResult)  : null,
      };
    });

    if (download) {
      const today = new Date().toISOString().slice(0, 10);
      const safeName = scopeNameParam.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      const filename = `eceg_perfil${safeName ? "_" + safeName : ""}_${today}.csv`;

      type LevelKey = "nacional" | "estado" | "municipio" | "distrito" | "seccion";
      const levels: { key: LevelKey; label: string }[] = [
        { key: "nacional",  label: "Nacional" },
        ...(hasEstado    ? [{ key: "estado"    as LevelKey, label: "Estatal" }]     : []),
        ...(hasMunicipio ? [{ key: "municipio" as LevelKey, label: "Municipal" }]   : []),
        ...(hasDistrito  ? [{ key: "distrito"  as LevelKey, label: "Distrital" }]   : []),
        ...(hasSeccion   ? [{ key: "seccion"   as LevelKey, label: "Seccional" }]   : []),
      ];

      const header = [
        "Grupo", "Indicador", "Clave", "Unidad",
        ...levels.flatMap(l => [`Total ${l.label}`, `Valor ${l.label}`, `% ${l.label}`]),
      ].join(",");

      const isIndex = (variable: string) => !ECEG_DENOMINATORS[variable];

      const csvRows = rows.map((r) => [
        `"${r.grupoLabel}"`,
        `"${r.label.replace(/"/g, '""')}"`,
        r.variable,
        `"${r.unit}"`,
        ...levels.flatMap((l) => {
          const d = r[l.key];
          const dec = isIndex(r.variable) ? 2 : 0;
          return [
            d?.denominador != null ? d.denominador : "",
            d?.valor       != null ? (isIndex(r.variable) ? d.valor.toFixed(dec) : Math.round(d.valor)) : "",
            d?.porcentaje  != null ? d.porcentaje.toFixed(2) + "%" : "",
          ];
        }),
      ].join(","));

      const csv = [
        header,
        ...csvRows,
        "",
        '"Fuente: INEGI — Estadísticas Censales a Escalas Geoelectorales (ECEG 2020). Datos del Censo de Población y Vivienda 2020."',
      ].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ rows }, {
      headers: { "Cache-Control": "public, max-age=1800" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.startsWith("Not found:")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[eceg-perfil]", err);
    return NextResponse.json({ error: "Failed to load profile data" }, { status: 500 });
  }
}
