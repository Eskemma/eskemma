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

export interface EcegPerfilRow {
  variable: string;
  grupo: string;
  grupoLabel: string;
  label: string;
  unit: string;
  localValor: number | null;
  localDenominador: number | null;
  localPorcentaje: number | null;
  superiorValor: number | null;
  superiorDenominador: number | null;
  superiorPorcentaje: number | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const estado_id    = searchParams.get("estado_id") ?? "";
  const municipio_cve = searchParams.get("municipio_cve") ?? "";
  const distrito_cve  = searchParams.get("distrito_cve") ?? "";
  const seccionesRaw  = searchParams.get("secciones") ?? "";
  const secciones     = seccionesRaw ? seccionesRaw.split(",").filter(Boolean) : [];
  const download      = searchParams.get("download") === "true";
  const scopeNameParam = searchParams.get("scope_name") ?? "";

  try {
    const estadoKey = estado_id ? estado_id.padStart(2, "0") : "";

    // Fetch all necessary files in parallel
    const national = await fetchFile(`${STORAGE_PREFIX}/national.json`);
    let munData: Record<string, Record<string, number>> | null = null;
    let distData: Record<string, Record<string, number>> | null = null;
    let secData: Record<string, Record<string, number>> | null = null;

    await Promise.all([
      estadoKey && municipio_cve
        ? fetchFile(`${STORAGE_PREFIX}/municipios/${estadoKey}.json`).then(d => { munData = d; })
        : Promise.resolve(),
      estadoKey && distrito_cve && distrito_cve !== "TODOS"
        ? fetchFile(`${STORAGE_PREFIX}/distritos/${estadoKey}.json`).then(d => { distData = d; })
        : Promise.resolve(),
      estadoKey && secciones.length > 0
        ? fetchFile(`${STORAGE_PREFIX}/secciones/${estadoKey}.json`).then(d => { secData = d; })
        : Promise.resolve(),
    ]);

    const rows: EcegPerfilRow[] = ECEG_INDICATORS.map((ind) => {
      const denomKey = ECEG_DENOMINATORS[ind.key] ?? null;
      let local: NivelResult | null = null;
      let superior: NivelResult | null = null;

      if (secciones.length > 0 && secData) {
        const secKeys = secciones.map((s) => estadoKey + s.padStart(4, "0"));
        local = sumRecords(secData, secKeys, ind.key, denomKey);
        if (municipio_cve && munData) {
          superior = extract(munData, estadoKey + municipio_cve.padStart(3, "0"), ind.key, denomKey);
        } else if (distrito_cve && distData) {
          superior = extract(distData, estadoKey + distrito_cve.padStart(3, "0"), ind.key, denomKey);
        } else if (estadoKey) {
          superior = extract(national, estadoKey, ind.key, denomKey);
        }
      } else if (municipio_cve && munData) {
        local = extract(munData, estadoKey + municipio_cve.padStart(3, "0"), ind.key, denomKey);
        superior = extract(national, estadoKey, ind.key, denomKey);
      } else if (distrito_cve && distData) {
        local = extract(distData, estadoKey + distrito_cve.padStart(3, "0"), ind.key, denomKey);
        superior = extract(national, estadoKey, ind.key, denomKey);
      } else if (estadoKey) {
        local = extract(national, estadoKey, ind.key, denomKey);
        superior = sumRecords(national, Object.keys(national), ind.key, denomKey);
      } else {
        local = sumRecords(national, Object.keys(national), ind.key, denomKey);
        superior = null;
      }

      const grupoLabel = ECEG_GROUPS.find((g) => g.id === ind.group)?.label ?? ind.group;
      return {
        variable: ind.key,
        grupo: ind.group,
        grupoLabel,
        label: ind.label,
        unit: ind.unit ?? "",
        localValor:       local?.valor ?? null,
        localDenominador: local?.denominador ?? null,
        localPorcentaje:  local?.porcentaje ?? null,
        superiorValor:       superior?.valor ?? null,
        superiorDenominador: superior?.denominador ?? null,
        superiorPorcentaje:  superior?.porcentaje ?? null,
      };
    });

    if (download) {
      const today = new Date().toISOString().slice(0, 10);
      const safeName = scopeNameParam.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      const filename = `eceg_perfil${safeName ? "_" + safeName : ""}_${today}.csv`;
      const hasSup = rows.some((r) => r.superiorValor !== null);

      const header = [
        "Grupo", "Indicador", "Clave", "Unidad",
        "Valor local", "% local", "Denominador local",
        ...(hasSup ? ["Valor superior", "% superior", "Denominador superior"] : []),
      ].join(",");

      const csvRows = rows.map((r) => [
        `"${r.grupoLabel}"`,
        `"${r.label.replace(/"/g, '""')}"`,
        r.variable,
        `"${r.unit}"`,
        r.localValor !== null ? r.localValor : "",
        r.localPorcentaje !== null ? r.localPorcentaje.toFixed(2) + "%" : "",
        r.localDenominador !== null ? r.localDenominador : "",
        ...(hasSup ? [
          r.superiorValor !== null ? r.superiorValor : "",
          r.superiorPorcentaje !== null ? r.superiorPorcentaje.toFixed(2) + "%" : "",
          r.superiorDenominador !== null ? r.superiorDenominador : "",
        ] : []),
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
