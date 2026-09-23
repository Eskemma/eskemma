"use client";

/**
 * Gráficas O1-O3 — Desglose Origen (Vista Semanal)
 *
 * O1: Heatmap 2D LNE (Origen × Receptor)
 * O2: Heatmap 2D Padrón / LNE / Diferencial con toggle
 * O3: Evolución semanal LNE o Padrón para una combinación Origen × Receptor
 */

import React, { useState, useMemo, Fragment, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { useGeoTerritorios } from "@/app/sefix/hooks/useLneSemanal";
import { useLneSemanalesSerie } from "@/app/sefix/hooks/useLneSemanalesSerie";
import { ESTADOS_LIST } from "@/lib/sefix/constants";
import { ESTADOS, ESTADOS_ALFABETICOS, claveEstadoSnake } from "@/lib/geo/estados";
import { CODIGO_ESTADO_POR_SNAKE } from "@/lib/geo/abreviaturasEstado";
import type { Ambito } from "@/lib/sefix/seriesUtils";
import {
  AZULES,
  ROJOS,
  MORADOS,
  AZULES_EXT,
  VERDES,
  COLOR_PAD_NAC,
  COLOR_LNE_NAC,
  COLOR_PAD_EXT,
  COLOR_LNE_EXT,
  getDarkPalette,
  COLOR_PAD_NAC_DARK,
  COLOR_LNE_NAC_DARK,
  COLOR_PAD_EXT_DARK,
  COLOR_LNE_EXT_DARK,
} from "@/lib/sefix/semanalUtils";
import { useDarkMode } from "@/app/hooks/useDarkMode";

const FMT = new Intl.NumberFormat("es-MX");
const fmtM = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : FMT.format(v);

// ─── Mapas de estados ────────────────────────────────────────────────────────
// Código compacto por llave "snake" (display SOLAMENTE). Las llaves y su orden
// (`RECEPTOR_ORDER`, `ORIGIN_SUFFIXES`) son el contrato con las columnas de datos
// `ln_<estado>`: vienen de lib/geo/abreviaturasEstado.ts y no cambian. "MEX" es el
// país; el Estado de México es EDOMEX.
const ABREV: Record<string, string> = CODIGO_ESTADO_POR_SNAKE;

// Nombre a mostrar por llave "snake" del estado — derivado del catálogo central
// (antes una copia escrita a mano de los 32).
const NOMBRES: Record<string, string> = Object.fromEntries(
  ESTADOS.map((e) => [claveEstadoSnake(e.clave), e.nombre])
);

const RECEPTOR_ORDER = Object.keys(ABREV);

// Entidades cuyo sufijo de columna CSV difiere de su clave canónica
const ORIGIN_COL_SUFFIX: Record<string, string> = {
  ciudad_de_mexico: "cdmx",
};

function originColSuffix(key: string): string {
  return ORIGIN_COL_SUFFIX[key] ?? key;
}

function origAbrev(key: string): string {
  if (key === "87") return "LN87";
  if (key === "88") return "LN88";
  return ABREV[key] ?? key.toUpperCase().slice(0, 5);
}

function origLabel(key: string): string {
  if (key === "87") return "Mexicanos nacidos en el extranjero (LN87)";
  if (key === "88") return "Ciudadanos naturalizados (LN88)";
  return NOMBRES[key] ?? key;
}

// ─── Interpolación de color ──────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function scaleColor(palette: string[], ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const lo = hexToRgb(palette[palette.length - 1]);
  const hi = hexToRgb(palette[0]);
  const r = Math.round(lo[0] + (hi[0] - lo[0]) * t);
  const g = Math.round(lo[1] + (hi[1] - lo[1]) * t);
  const b = Math.round(lo[2] + (hi[2] - lo[2]) * t);
  return `rgb(${r},${g},${b})`;
}

// ─── Matrix builder ──────────────────────────────────────────────────────────
type HeatmapMatrix = {
  origins: string[];
  receptors: string[];
  lneMatrix: number[][];
  padMatrix: number[][];
  maxLne: number;
  maxPad: number;
  maxDif: number;
};

const ORIGIN_SUFFIXES = [...RECEPTOR_ORDER, "87", "88"];

function buildMatrix(
  porEntidad: Record<string, { nacional: Record<string, number>; extranjero: Record<string, number> }>,
  ambito: Ambito,
  topN: number,
): HeatmapMatrix {
  const receptors = RECEPTOR_ORDER.filter((r) => r in porEntidad);

  const lnTotals: Record<string, number> = {};
  for (const sfx of ORIGIN_SUFFIXES) {
    const col = sfx === "87" ? "ln87" : sfx === "88" ? "ln88" : `ln_${originColSuffix(sfx)}`;
    let total = 0;
    for (const rec of receptors) total += porEntidad[rec]?.[ambito]?.[col] ?? 0;
    lnTotals[sfx] = total;
  }

  const sorted = ORIGIN_SUFFIXES
    .filter((s) => (lnTotals[s] ?? 0) > 0)
    .sort((a, b) => lnTotals[b] - lnTotals[a])
    .slice(0, topN > 0 ? topN : 34);

  const lneMatrix = sorted.map((sfx) => {
    const col = sfx === "87" ? "ln87" : sfx === "88" ? "ln88" : `ln_${originColSuffix(sfx)}`;
    return receptors.map((rec) => porEntidad[rec]?.[ambito]?.[col] ?? 0);
  });

  const padMatrix = sorted.map((sfx) => {
    const col = sfx === "87" ? "pad87" : sfx === "88" ? "pad88" : `pad_${originColSuffix(sfx)}`;
    return receptors.map((rec) => porEntidad[rec]?.[ambito]?.[col] ?? 0);
  });

  const flatLne = lneMatrix.flat();
  const flatPad = padMatrix.flat();
  const flatDif = padMatrix.flatMap((row, i) => row.map((v, j) => v - lneMatrix[i][j]));

  return {
    origins: sorted,
    receptors,
    lneMatrix,
    padMatrix,
    maxLne: flatLne.length ? Math.max(...flatLne) : 1,
    maxPad: flatPad.length ? Math.max(...flatPad) : 1,
    maxDif: flatDif.length ? Math.max(...flatDif) : 1,
  };
}

// ─── HeatmapGrid ─────────────────────────────────────────────────────────────
interface GridProps {
  matrix: HeatmapMatrix;
  palette: string[];
  dataKey: "lne" | "pad" | "dif";
  label?: string;
  isDark: boolean;
}

function rowLabel(key: string, dk: "lne" | "pad" | "dif"): string {
  if (key === "87") return dk === "pad" ? "PAD87" : dk === "lne" ? "LN87" : "87";
  if (key === "88") return dk === "pad" ? "PAD88" : dk === "lne" ? "LN88" : "88";
  return ABREV[key] ?? key.toUpperCase().slice(0, 5);
}

function HeatmapGrid({ matrix, palette, dataKey, label, isDark }: GridProps) {
  const { origins, receptors, lneMatrix, padMatrix, maxLne, maxPad, maxDif } = matrix;
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const axisColor = isDark ? "#C7D6E0" : "var(--color-black-eske-20)";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "var(--color-gray-eske-20)";
  const singleCol = receptors.length <= 1;

  return (
    <div>
      {label && (
        <p className="text-xs font-semibold text-black-eske-20 dark:text-[#9AAEBE] mb-1 text-center">{label}</p>
      )}

      {/* React hover tooltip — fixed position */}
      {tooltip && (
        <div
          className="pointer-events-none whitespace-nowrap rounded px-2 py-1 text-xs shadow-md bg-white dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 text-black-eske dark:text-[#C7D6E0]"
          style={{ position: "fixed", left: tooltip.x, top: tooltip.y - 8, transform: "translate(-50%, -100%)", zIndex: 50 }}
        >
          {tooltip.text}
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Label Y — izquierda, rotado, centrado en el área de datos */}
        <div
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: 9,
            color: axisColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            userSelect: "none",
            paddingTop: 70,
            flexShrink: 0,
            alignSelf: "stretch",
          }}
        >
          Entidad de Origen
        </div>

        {/* Grid + label X */}
        <div className="flex-1 min-w-0">
          <div style={{ overflowX: singleCol ? "visible" : "auto" }}>
            <div
              style={{
                display: "grid",
                // 48px (antes 44): EDOMEX mide 39.02px a 9px (Arimo, medido en Chrome) y la columna
                // dejaba exactamente 39px útiles (44 − 5 de padding) → cero margen.
                gridTemplateColumns: `48px repeat(${receptors.length}, minmax(22px, 1fr))`,
                width: singleCol ? "100%" : "max-content",
              }}
            >
              {/* Header row */}
              <div style={{ height: 70 }} />
              {receptors.map((r) => (
                <div
                  key={r}
                  style={{
                    height: 70,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: 3,
                  }}
                >
                  <span
                    style={{
                      writingMode: "vertical-lr",
                      transform: "rotate(180deg)",
                      fontSize: 9,
                      color: axisColor,
                      lineHeight: 1,
                    }}
                  >
                    {ABREV[r] ?? r}
                  </span>
                </div>
              ))}

              {/* Data rows */}
              {origins.map((orig, i) => (
                <Fragment key={orig}>
                  <div
                    style={{
                      height: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      paddingRight: 5,
                      fontSize: 9,
                      color: axisColor,
                      borderBottom: `1px solid ${borderColor}`,
                      borderRight: `1px solid ${borderColor}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rowLabel(orig, dataKey)}
                  </div>
                  {receptors.map((rec, j) => {
                    let rawVal: number;
                    let maxVal: number;
                    if (dataKey === "lne") { rawVal = lneMatrix[i][j]; maxVal = maxLne; }
                    else if (dataKey === "pad") { rawVal = padMatrix[i][j]; maxVal = maxPad; }
                    else { rawVal = padMatrix[i][j] - lneMatrix[i][j]; maxVal = maxDif; }
                    const ratio = maxVal > 0 ? rawVal / maxVal : 0;
                    const tooltipText = `${origLabel(orig)} → ${NOMBRES[rec] ?? rec}: ${FMT.format(rawVal)}`;
                    return (
                      <div
                        key={rec}
                        style={{
                          height: 22,
                          backgroundColor: scaleColor(palette, ratio),
                          borderBottom: "1px solid rgba(255,255,255,0.3)",
                          borderRight: "1px solid rgba(255,255,255,0.3)",
                          cursor: "default",
                        }}
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setTooltip({ text: tooltipText, x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Label X — abajo, centrado */}
          <p
            style={{
              fontSize: 9,
              color: axisColor,
              textAlign: "center",
              marginTop: 4,
              userSelect: "none",
            }}
          >
            Entidad Receptora
          </p>
        </div>

        {/* Leyenda de escala — lado derecho, vertical */}
        <div
          className="flex flex-col items-center gap-1 shrink-0"
          style={{ paddingTop: 70 }}
        >
          <span className="text-[9px] text-black-eske-10 dark:text-[#6D8294] leading-none">Mayor</span>
          <div
            style={{
              width: 10,
              height: Math.max(40, origins.length * 22 * 0.6),
              background: `linear-gradient(to bottom, ${palette[0]}, ${palette[palette.length - 1]})`,
              borderRadius: 2,
            }}
          />
          <span className="text-[9px] text-black-eske-10 dark:text-[#6D8294] leading-none">Menor</span>
        </div>
      </div>
    </div>
  );
}

// ─── O1 ──────────────────────────────────────────────────────────────────────
interface HeatmapProps {
  porEntidad: Record<string, { nacional: Record<string, number>; extranjero: Record<string, number> }>;
  topN?: number;
  ambito?: Ambito;
}

export function O1HeatmapChart({ porEntidad, topN = 5, ambito = "nacional" }: HeatmapProps) {
  const isDark = useDarkMode();
  const [showNota, setShowNota] = useState(false);
  const matrix = useMemo(() => buildMatrix(porEntidad, ambito, topN), [porEntidad, ambito, topN]);
  const basePalette = ambito === "extranjero" ? AZULES_EXT : ROJOS;
  const palette = isDark ? getDarkPalette(basePalette) : basePalette;

  if (!matrix.origins.length) {
    return (
      <p className="text-sm text-black-eske-10 dark:text-[#6D8294] text-center py-6">
        Sin datos de origen disponibles.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <HeatmapGrid matrix={matrix} palette={palette} dataKey="lne" isDark={isDark} />
      {matrix.receptors.length > 1 && (
        <p className="text-[11px] text-black-eske-10 dark:text-[#6D8294] text-center sm:hidden">
          ← Desliza horizontalmente para ver todas las entidades →
        </p>
      )}
      <p className="text-[10px] text-black-eske-10 dark:text-[#6D8294] leading-relaxed text-center">
        <strong>LN87</strong>: ciudadanos mexicanos nacidos en el extranjero (código especial INE).{" "}
        <strong>LN88</strong>: ciudadanos naturalizados mexicanos (código especial INE).
      </p>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowNota((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-bluegreen-eske hover:text-bluegreen-eske-80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske rounded"
          aria-expanded={showNota}
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showNota ? "Ocultar nota" : "¿Cómo leer esta gráfica?"}
        </button>
      </div>
      {showNota && (
        <p className="text-[10px] text-black-eske-10 dark:text-[#6D8294] leading-relaxed text-center bg-gray-eske-10 dark:bg-[#21425E] rounded-lg px-3 py-2 border border-gray-eske-20 dark:border-white/10">
          Cada celda muestra la LNE de ciudadanos cuyo origen es la entidad de la fila y que residen en la entidad receptora de la columna.
          El análisis textual lateral reporta los totales nacionales por entidad de origen (suma de todas las entidades receptoras).
        </p>
      )}
    </div>
  );
}

// ─── O2 ──────────────────────────────────────────────────────────────────────
type O2Vista = "pad" | "lne" | "dif";

const O2_VISTAS: { id: O2Vista; label: string }[] = [
  { id: "pad", label: "Padrón" },
  { id: "lne", label: "LNE" },
  { id: "dif", label: "Diferencial" },
];

export function O2PadronLneChart({ porEntidad, topN = 5, ambito = "nacional" }: HeatmapProps) {
  const isDark = useDarkMode();
  const [vista, setVista] = useState<O2Vista>("dif");
  const [showNota, setShowNota] = useState(false);
  const matrix = useMemo(() => buildMatrix(porEntidad, ambito, topN), [porEntidad, ambito, topN]);

  if (!matrix.origins.length) {
    return (
      <p className="text-sm text-black-eske-10 dark:text-[#6D8294] text-center py-6">
        Sin datos de origen disponibles.
      </p>
    );
  }

  const lnePalette = ambito === "extranjero" ? AZULES_EXT : ROJOS;
  const padPalette = ambito === "extranjero" ? MORADOS : AZULES;

  const baseActivePalette =
    vista === "lne" ? lnePalette :
      vista === "pad" ? padPalette :
        VERDES;

  const activePalette = isDark ? getDarkPalette(baseActivePalette) : baseActivePalette;

  const vistaLabel =
    vista === "lne" ? "Lista Nominal Electoral" :
      vista === "pad" ? "Padrón Electoral" :
        "Diferencial (Padrón − LNE)";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {O2_VISTAS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={[
              "px-3 py-1 text-xs font-medium rounded-full transition-colors border",
              vista === v.id
                ? "bg-blue-eske text-white-eske border-blue-eske"
                : "bg-white-eske dark:bg-[#112230] text-black-eske-20 dark:text-[#9AAEBE] border-gray-eske-30 dark:border-white/10 hover:border-blue-eske hover:text-blue-eske",
            ].join(" ")}
          >
            {v.label}
          </button>
        ))}
      </div>

      <HeatmapGrid
        matrix={matrix}
        palette={activePalette}
        dataKey={vista}
        label={vistaLabel}
        isDark={isDark}
      />
      {matrix.receptors.length > 1 && (
        <p className="text-[11px] text-black-eske-10 dark:text-[#6D8294] text-center sm:hidden">
          ← Desliza horizontalmente para ver todas las entidades →
        </p>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowNota((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-bluegreen-eske hover:text-bluegreen-eske-80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske rounded"
          aria-expanded={showNota}
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showNota ? "Ocultar nota" : "¿Qué significa PAD87-PAD88 / LN87-LN88?"}
        </button>
      </div>
      {showNota && (
        <p className="text-[10px] text-black-eske-10 dark:text-[#6D8294] leading-relaxed text-center bg-gray-eske-10 dark:bg-[#21425E] rounded-lg px-3 py-2 border border-gray-eske-20 dark:border-white/10">
          <strong>PAD87 / LN87</strong>: Padrón o LNE de ciudadanos mexicanos nacidos en el extranjero.{" "}
          <strong>PAD88 / LN88</strong>: Padrón o LNE de ciudadanos naturalizados mexicanos.
        </p>
      )}
    </div>
  );
}

// ─── O3 — Evolución por Origen × Receptor (con filtros propios) ───────────────
// Los 32 estados (orden alfabético, como ESTADOS_LIST) salen del catálogo central;
// LN87/LN88 no son estados y se agregan al final.
const ESTADOS_ORIGEN_KEYS: { key: string; label: string }[] = [
  ...ESTADOS_ALFABETICOS.map((e) => ({ key: claveEstadoSnake(e.clave), label: e.nombre })),
  { key: "87", label: "LN87 — Nacidos en el extranjero" },
  { key: "88", label: "LN88 — Naturalizados" },
];

function fmtFechaOrigen(iso: string): string {
  const [, m, d] = iso.split("-");
  const meses = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10)]}`;
}

const SEL_CLS =
  "text-xs border border-gray-eske-30 dark:border-white/10 rounded px-2 py-1 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-eske " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

type CommittedO3 = {
  entidad: string;
  distrito: string;
  distritoDisplay: string;
  municipio: string;
  municipioDisplay: string;
  secciones: string[];
  origenKey: string;
  vistaO3: "lne" | "pad";
};

const fmtPct = (n: number) => n.toFixed(2) + "%";

function downloadO3Csv(
  rows: { label: string; lne: number; pad: number; tasa: number }[],
  committed: CommittedO3,
  ambito: string,
) {
  const csv = [
    "semana,padron_electoral,lista_nominal,tasa_inclusion",
    ...rows.map((r) => `${r.label},${r.pad},${r.lne},${r.tasa.toFixed(2)}`),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `origen_${committed.origenKey}_${committed.entidad || "nacional"}_${ambito}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Multi-select de secciones (replica el popover del filtro inicial) ────────
interface SeccionMultiSelectProps {
  secciones: { cve: string; nombre: string }[];
  isLoading: boolean;
  value: string[];
  onChange: (secs: string[]) => void;
  disabled?: boolean;
}

function SeccionMultiSelect({ secciones, isLoading, value, onChange, disabled }: SeccionMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setSearch(""); setOpen(false); }, [secciones]);

  const available = secciones.filter(
    (s) => !value.includes(s.cve) && (search === "" || s.cve.includes(search) || s.nombre.toLowerCase().includes(search.toLowerCase())),
  );

  const add = useCallback((cve: string) => {
    onChange([...value, cve]);
    setSearch("");
    inputRef.current?.focus();
  }, [value, onChange]);

  const remove = useCallback((cve: string) => {
    onChange(value.filter((c) => c !== cve));
  }, [value, onChange]);

  return (
    <div ref={containerRef} className="relative">
      <div
        role="group"
        aria-label="Secciones seleccionadas"
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
        className={[
          "border border-gray-eske-30 dark:border-white/10 rounded-md bg-white-eske dark:bg-[#112230] min-h-[30px] px-2 py-1",
          "flex flex-wrap gap-1 items-center cursor-text",
          disabled ? "opacity-40 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {value.map((cve) => (
          <span key={cve} className="flex items-center gap-0.5 bg-blue-eske text-white-eske text-xs px-1.5 py-0.5 rounded">
            {cve}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(cve); }}
              className="opacity-80 hover:opacity-100 ml-0.5 text-sm leading-none"
              aria-label={`Quitar sección ${cve}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={search}
          disabled={disabled}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && search === "" && value.length > 0) remove(value[value.length - 1]);
            if (e.key === "Escape") setOpen(false);
          }}
          className="outline-none text-xs min-w-[28px] flex-1 bg-transparent text-black-eske dark:text-[#EAF2F8]"
          placeholder={value.length === 0 ? "Todas" : ""}
          aria-label="Buscar sección"
          aria-expanded={open}
          aria-haspopup="listbox"
        />
      </div>
      {open && !isLoading && !disabled && (
        <div
          role="listbox"
          aria-label="Secciones disponibles"
          className="absolute top-full left-0 z-50 mt-1 w-full min-w-[160px] border border-gray-eske-30 dark:border-white/10 rounded-md bg-white-eske dark:bg-[#18324A] shadow-lg overflow-y-auto max-h-[140px]"
        >
          {value.length > 0 && (
            <button
              type="button" role="option" aria-selected={false}
              onClick={() => { onChange([]); setSearch(""); setOpen(false); }}
              className="w-full text-left px-2 py-1 text-xs text-black-eske-20 dark:text-[#9AAEBE] italic hover:bg-gray-eske-10 dark:hover:bg-white/5 border-b border-gray-eske-10 dark:border-white/5"
            >
              Todas (limpiar selección)
            </button>
          )}
          {available.length === 0 ? (
            <p className="text-xs text-black-eske-40 dark:text-[#6D8294] px-2 py-1 italic">
              {value.length === 0 ? "Sin secciones" : "Todas seleccionadas"}
            </p>
          ) : (
            available.map((s) => (
              <button
                key={s.cve}
                type="button" role="option" aria-selected={false}
                onClick={() => add(s.cve)}
                className="w-full text-left px-2 py-0.5 text-xs text-black-eske dark:text-[#C7D6E0] hover:bg-blue-eske/10 hover:text-blue-eske"
              >
                {s.nombre}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface O3Props {
  ambito: Ambito;
}

export function O3OrigenSerieChart({ ambito }: O3Props) {
  const isDark = useDarkMode();
  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill   = isDark ? "#C7D6E0" : "var(--color-black-eske-10)";
  const legendStyle = { fontSize: 11, ...(isDark ? { color: "#C7D6E0" } : {}) };

  // Draft state — updated immediately (drives cascading dropdowns)
  const [receptorEntidad, setReceptorEntidad] = useState("");
  const [receptorDistrito, setReceptorDistrito] = useState("");
  const [receptorMunicipio, setReceptorMunicipio] = useState("");
  const [receptorSecciones, setReceptorSecciones] = useState<string[]>([]);
  const [origenKey, setOrigenKey] = useState("88");
  const [vistaO3, setVistaO3] = useState<"lne" | "pad">("lne");

  // Committed state — updated only on "Consultar" click
  const [committed, setCommitted] = useState<CommittedO3>({
    entidad: "", distrito: "", distritoDisplay: "", municipio: "", municipioDisplay: "",
    secciones: [], origenKey: "88", vistaO3: "lne",
  });

  // Cascading geo options — each level depends on the previous
  const { opciones: distritos, isLoading: distritosLoading } = useGeoTerritorios("distrito", receptorEntidad || undefined, undefined, undefined, undefined, "semanal");
  const { opciones: municipios, isLoading: municipiosLoading } = useGeoTerritorios("municipio", receptorEntidad || undefined, receptorDistrito || undefined, undefined, undefined, "semanal");
  // Secciones filtradas por entidad + distrito + municipio
  const { opciones: secciones, isLoading: seccionesLoading } = useGeoTerritorios("seccion", receptorEntidad || undefined, receptorDistrito || undefined, receptorMunicipio || undefined, undefined, "semanal");

  function resetCascade(level: "entidad" | "distrito" | "municipio") {
    if (level === "entidad") { setReceptorDistrito(""); setReceptorMunicipio(""); setReceptorSecciones([]); }
    if (level === "distrito") { setReceptorMunicipio(""); setReceptorSecciones([]); }
    if (level === "municipio") { setReceptorSecciones([]); }
  }

  function handleConsultar() {
    const foundDistrito = distritos.find((d) => d.cve === receptorDistrito);
    const foundMunicipio = municipios.find((m) => m.cve === receptorMunicipio);
    setCommitted({
      entidad: receptorEntidad,
      distrito: receptorDistrito,
      distritoDisplay: receptorDistrito
        ? (foundDistrito?.nombre ?? receptorDistrito)
        : "",
      municipio: receptorMunicipio,
      municipioDisplay: receptorMunicipio
        ? (foundMunicipio?.nombre ?? receptorMunicipio)
        : "",
      secciones: receptorSecciones,
      origenKey,
      vistaO3,
    });
  }

  // Serie uses committed state
  const seccArr = committed.secciones.length > 0 ? committed.secciones : undefined;
  const { serie, isLoading, error } = useLneSemanalesSerie(
    "origen", ambito,
    committed.entidad || null,
    undefined,
    committed.distrito || undefined,
    committed.municipio || undefined,
    seccArr,
  );

  // tableData: both lne and pad always computed (independent of vista)
  const tableData = useMemo(() => {
    const lneCol =
      committed.origenKey === "87" ? "ln87" :
        committed.origenKey === "88" ? "ln88" :
          `ln_${originColSuffix(committed.origenKey)}`;
    const padCol =
      committed.origenKey === "87" ? "pad87" :
        committed.origenKey === "88" ? "pad88" :
          `pad_${originColSuffix(committed.origenKey)}`;
    return serie.map((row) => {
      const lne = (row[lneCol] as number) ?? 0;
      const pad = (row[padCol] as number) ?? 0;
      return {
        label: fmtFechaOrigen(row.fecha as string),
        lne,
        pad,
        tasa: pad > 0 ? (lne / pad) * 100 : 0,
      };
    });
  }, [serie, committed.origenKey]);

  // chartData: single column for the graph
  const chartData = useMemo(() => {
    return tableData.map((row) => ({
      label: row.label,
      valor: committed.vistaO3 === "lne" ? row.lne : row.pad,
    }));
  }, [tableData, committed.vistaO3]);

  const values = chartData.map((d) => d.valor).filter((v) => v > 0);
  const yMin = values.length > 0 ? Math.floor(Math.min(...values) * 0.97) : 0;
  const hasData = values.length > 0;

  const colLine = isDark
    ? committed.vistaO3 === "lne"
      ? (ambito === "extranjero" ? COLOR_LNE_EXT_DARK : COLOR_LNE_NAC_DARK)
      : (ambito === "extranjero" ? COLOR_PAD_EXT_DARK : COLOR_PAD_NAC_DARK)
    : committed.vistaO3 === "lne"
      ? (ambito === "extranjero" ? COLOR_LNE_EXT : COLOR_LNE_NAC)
      : (ambito === "extranjero" ? COLOR_PAD_EXT : COLOR_PAD_NAC);

  const yLabel = committed.vistaO3 === "lne" ? "Lista Nominal Electoral" : "Padrón Electoral";
  const axisLabelColor = isDark ? "#C7D6E0" : "var(--color-black-eske-20)";

  // Scope label with full human-readable format
  const o3ScopeLabel = useMemo(() => {
    const entidadPart = `Entidad Receptora: ${committed.entidad || "Nacional"}`;
    const distritoPart = committed.distrito
      ? `Distrito: ${committed.distritoDisplay}`
      : "Distrito: Todos";
    const municipioPart = committed.municipio
      ? `Municipio: ${committed.municipioDisplay}`
      : "Municipio: Todos";
    const seccionPart = committed.secciones.length > 0
      ? `Sección: ${committed.secciones.join(", ")}`
      : "Sección: Todas";
    const origenRaw = ESTADOS_ORIGEN_KEYS.find((k) => k.key === committed.origenKey)?.label ?? committed.origenKey;
    const origenClean = origenRaw.replace(/\s*—\s*/, " ");
    return `${entidadPart} — ${distritoPart} — ${municipioPart} — ${seccionPart} — Entidad de Origen: ${origenClean}`;
  }, [committed]);

  // Subtitle for the DataTable header
  const fechaCorte = serie.length > 0 ? (serie[serie.length - 1].fecha as string) : "";

  return (
    <div className="space-y-4">
      {/* Filtros geo propios del O3 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">Entidad receptora</label>
          <select
            className={SEL_CLS}
            value={receptorEntidad}
            onChange={(e) => { setReceptorEntidad(e.target.value); resetCascade("entidad"); }}
          >
            <option value="">Nacional</option>
            {ESTADOS_LIST.map(({ key, nombre }) => (
              <option key={key} value={nombre}>{nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
            Distrito{" "}
            {distritosLoading && <span className="text-red-eske">(cargando…)</span>}
          </label>
          <select
            className={SEL_CLS}
            value={receptorDistrito}
            disabled={!receptorEntidad || distritosLoading}
            onChange={(e) => { setReceptorDistrito(e.target.value); resetCascade("distrito"); }}
          >
            <option value="">Todos</option>
            {distritos.map((op) => (
              <option key={op.cve} value={op.cve}>{op.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
            Municipio{" "}
            {municipiosLoading && <span className="text-red-eske">(cargando…)</span>}
          </label>
          <select
            className={SEL_CLS}
            value={receptorMunicipio}
            disabled={!receptorDistrito || municipiosLoading}
            onChange={(e) => { setReceptorMunicipio(e.target.value); resetCascade("municipio"); }}
          >
            <option value="">Todos</option>
            {municipios.map((op) => (
              <option key={op.cve} value={op.cve}>{op.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
            Sección{" "}
            {seccionesLoading && <span className="text-red-eske">(cargando…)</span>}
            {receptorSecciones.length > 0 && (
              <span className="ml-1 text-blue-eske font-medium">({receptorSecciones.length} sel.)</span>
            )}
          </p>
          <SeccionMultiSelect
            secciones={secciones}
            isLoading={seccionesLoading}
            value={receptorSecciones}
            onChange={setReceptorSecciones}
            disabled={!receptorMunicipio || seccionesLoading}
          />
        </div>
      </div>

      {/* Entidad de origen + toggle Vista + Consultar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <label htmlFor="o3-origen" className="text-xs font-semibold text-black-eske-20 dark:text-[#9AAEBE]">
            Entidad de origen:
          </label>
          <select
            id="o3-origen"
            value={origenKey}
            onChange={(e) => setOrigenKey(e.target.value)}
            className={SEL_CLS + " w-full sm:w-auto sm:min-w-[200px]"}
          >
            {ESTADOS_ORIGEN_KEYS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-black-eske-20 dark:text-[#9AAEBE]">Vista:</span>
          {(["lne", "pad"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVistaO3(v)}
              className={[
                "px-3 py-1 text-xs font-medium rounded-full transition-colors border",
                vistaO3 === v
                  ? "bg-blue-eske text-white-eske border-blue-eske"
                  : "bg-white-eske dark:bg-[#112230] text-black-eske-20 dark:text-[#9AAEBE] border-gray-eske-30 dark:border-white/10 hover:border-blue-eske hover:text-blue-eske",
              ].join(" ")}
            >
              {v === "lne" ? "Lista Nominal Electoral" : "Padrón Electoral"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleConsultar}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-eske text-white-eske hover:bg-blue-eske-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske w-full sm:w-auto sm:ml-auto"
        >
          Consultar
        </button>
      </div>

      {/* Scope label del O3 */}
      <p className="text-[11px] text-black-eske-10 dark:text-[#6D8294] text-center">{o3ScopeLabel}</p>

      {/* Gráfica */}
      {isLoading ? (
        <div className="h-[300px] flex items-center justify-center">
          <span className="text-sm text-black-eske-10 dark:text-[#6D8294]">Cargando datos…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-red-eske text-center py-6">{error}</p>
      ) : !hasData ? (
        <p className="text-sm text-black-eske-10 dark:text-[#6D8294] text-center py-6">
          Sin datos para la combinación seleccionada.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: tickFill }}
              interval={6}
            />
            <YAxis
              tickFormatter={fmtM}
              tick={{ fontSize: 11, fill: tickFill }}
              width={72}
              domain={[yMin, "auto"]}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { fontSize: 9, fill: axisLabelColor },
              }}
            />
            <Tooltip
              formatter={(v) => [FMT.format(Number(v)), yLabel]}
              labelStyle={{ color: "#2b2b2b" }}
              contentStyle={{ fontSize: 11, borderRadius: 6, borderColor: "var(--color-gray-eske-20)" }}
            />
            <Legend wrapperStyle={legendStyle} />
            <Line
              dataKey="valor"
              name={yLabel}
              stroke={colLine}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Footnotes dinámicas */}
      {committed.origenKey === "87" && (
        <p className="text-[10px] text-black-eske-10 dark:text-[#6D8294] text-center">
          {committed.vistaO3 === "lne"
            ? "LN87: Lista Nominal de ciudadanos mexicanos nacidos en el extranjero y que residen en la entidad."
            : "PAD87: Padrón Electoral de ciudadanos mexicanos nacidos en el extranjero y que residen en la entidad."}
        </p>
      )}
      {committed.origenKey === "88" && (
        <p className="text-[10px] text-black-eske-10 dark:text-[#6D8294] text-center">
          {committed.vistaO3 === "lne"
            ? "LN88: Lista Nominal de ciudadanos naturalizados y que residen en la entidad."
            : "PAD88: Padrón Electoral de ciudadanos naturalizados y que residen en la entidad."}
        </p>
      )}
      <p className="text-[10px] text-black-eske-20 dark:text-[#9AAEBE] text-center">
        Fuente: INE. Estadística de Padrón Electoral y Lista Nominal del Electorado.
      </p>

      {/* DataTable inline */}
      {tableData.length > 0 && (
        <div className="mt-6 rounded-lg border border-gray-eske-20 dark:border-white/10 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-eske-20 dark:border-white/10 text-center bg-gray-eske-10 dark:bg-[#21425E]">
            <h4 className="text-sm font-bold text-black-eske dark:text-[#EAF2F8]">
              Tabla de Datos — Evolución por Entidad de Origen y Receptora
            </h4>
            <p className="text-[12px] text-blue-eske font-semibold mt-0.5">
              Ámbito:{" "}
              <span className="font-bold">{ambito === "nacional" ? "Nacional" : "Extranjero"}</span>
              {fechaCorte && (
                <span className="text-black-eske-10 dark:text-[#6D8294] font-normal ml-2">— Corte: {fechaCorte}</span>
              )}
            </p>
            <p className="text-[12px] text-black-eske dark:text-[#C7D6E0] font-medium mt-0.5">{o3ScopeLabel}</p>
          </div>

          {/* Tabla */}
          <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0">
                <tr>
                  {(["Semana", "Padrón Electoral", "Lista Nominal Electoral", "Tasa de Inclusión"] as const).map((h) => (
                    <th
                      key={h}
                      style={{ background: "var(--color-bluegreen-eske-60)", color: "white" }}
                      className="px-3 py-2 text-center font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white-eske dark:bg-[#18324A]" : "bg-gray-eske-10 dark:bg-[#21425E]"}>
                    <td className="px-3 py-1.5 text-black-eske-20 dark:text-[#9AAEBE] text-center">{row.label}</td>
                    <td className="px-3 py-1.5 text-black-eske dark:text-[#C7D6E0] text-right font-medium">{FMT.format(row.pad)}</td>
                    <td className="px-3 py-1.5 text-black-eske dark:text-[#C7D6E0] text-right font-medium">{FMT.format(row.lne)}</td>
                    <td className="px-3 py-1.5 text-black-eske dark:text-[#C7D6E0] text-right">{fmtPct(row.tasa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botón descarga — mismo estilo que SemanalDataTable, centrado */}
          <div className="flex justify-center py-4 border-t border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
            <button
              type="button"
              onClick={() => downloadO3Csv(tableData, committed, ambito)}
              className="flex items-center gap-2 px-5 py-2 bg-bluegreen-eske text-white-eske text-sm font-semibold rounded-lg hover:bg-bluegreen-eske-80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-2"
            >
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Descargar CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
