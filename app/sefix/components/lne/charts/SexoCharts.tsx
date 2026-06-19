"use client";

/**
 * Gráficas S1-S4 — Desglose Sexo (Vista Semanal)
 *
 * S1: Pirámide poblacional (hombres izquierda / mujeres derecha por rango etario)
 * S2: LNE por grupos etarios × sexo (barras agrupadas, checkboxes H/M/NB)
 * S3: Proyección H vs M (con proyección separada real/punteada, Restablecer, Metodología)
 * S4: Padrón y LNE por Sexo (H/M por métrica; NB en card separada)
 */

import { useState, Fragment } from "react";
import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useWindowSize } from "@/app/hooks/useWindowSize";
import { useDarkMode } from "@/app/hooks/useDarkMode";

import type { SemanalSerieRow } from "@/app/sefix/hooks/useLneSemanalesSerie";
import type { Ambito } from "@/lib/sefix/seriesUtils";
import { computeSemanalesProyeccion } from "@/lib/sefix/semanalUtils";

const FMT = new Intl.NumberFormat("es-MX");
const fmtK = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${(Math.abs(v) / 1_000_000).toFixed(1)}M`
    : FMT.format(Math.abs(v));

const RANGOS = [
  "18", "19", "20_24", "25_29", "30_34", "35_39",
  "40_44", "45_49", "50_54", "55_59", "60_64", "65_y_mas",
];
const RANGOS_LABELS: Record<string, string> = {
  "18": "18", "19": "19", "20_24": "20-24", "25_29": "25-29",
  "30_34": "30-34", "35_39": "35-39", "40_44": "40-44", "45_49": "45-49",
  "50_54": "50-54", "55_59": "55-59", "60_64": "60-64", "65_y_mas": "65+",
};

const GRUPOS = [
  { id: "jovenes", label: "Jóvenes\n(18–29)", rangos: ["18", "19", "20_24", "25_29"] },
  { id: "adultos", label: "Adultos\n(30–59)", rangos: ["30_34", "35_39", "40_44", "45_49", "50_54", "55_59"] },
  { id: "mayores", label: "Mayores\n(60+)", rangos: ["60_64", "65_y_mas"] },
];

function coloresH(ambito: Ambito, isDark: boolean) {
  if (isDark) return ambito === "extranjero" ? "#4D9DE8" : "#4791B3";
  return ambito === "extranjero" ? "#0163a4" : "var(--color-blue-eske-60)";
}
function coloresM(ambito: Ambito, isDark: boolean) {
  if (isDark) return ambito === "extranjero" ? "#C585F5" : "#E05F7F";
  return ambito === "extranjero" ? "#7206b4" : "var(--color-red-eske-30)";
}
const COL_NB = "#9B59B6";
const COL_NB_DARK = "#C585F5";

// ──────────────────────────────────────────────
// Modal de metodología de proyección (idéntico al de EdadCharts)
// ──────────────────────────────────────────────
function MetodologiaModal({ onClose }: { onClose: () => void }) {
  const modalRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-sexo-metodologia-title"
    >
      <div className="absolute inset-0 bg-black-eske/50" aria-hidden="true" onClick={onClose} />
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        className="relative w-full max-w-md bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-eske-20 dark:border-white/10">
          <h2
            id="modal-sexo-metodologia-title"
            className="text-base font-semibold text-bluegreen-eske flex items-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Metodología de Proyección
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de metodología"
            className="text-black-eske-60 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm text-black-eske dark:text-[#C7D6E0] leading-relaxed max-h-[70vh] overflow-y-auto">
          <p>
            La proyección utiliza un{" "}
            <strong>modelo de tasa de crecimiento semanal compuesto</strong>{" "}
            basado en los cortes semanales disponibles del año en curso.
          </p>
          <div>
            <p className="font-semibold text-bluegreen-eske mb-2">Pasos del cálculo:</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li><strong>Datos base:</strong> Cortes semanales del año actual.</li>
              <li><strong>Tasa de crecimiento:</strong> Tasa semanal compuesta entre el primer y último corte disponibles.</li>
              <li><strong>Proyección:</strong> Se aplica la tasa hasta diciembre.</li>
              <li><strong>Visualización:</strong> Líneas punteadas = valores proyectados.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-bluegreen-eske mb-2">Fórmula:</p>
            <div className="bg-gray-eske-10 dark:bg-[#112230] rounded-lg p-3 border-l-4 border-bluegreen-eske font-mono text-xs space-y-1">
              <p>Tasa = (Valor_final / Valor_inicial)^(1/(n−1)) − 1</p>
              <p>Proyección(i) = Último_valor × (1 + Tasa)^i</p>
            </div>
          </div>
          <div>
            <p className="font-semibold text-orange-eske mb-2 flex items-center gap-1">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              Consideraciones:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Asume una tasa de crecimiento <strong>constante</strong>.</li>
              <li>Es una <strong>proyección determinística</strong>, no un dato oficial.</li>
              <li>Proyecta hasta <strong>diciembre</strong> del año en curso.</li>
              <li>Los datos oficiales del INE prevalecen sobre la proyección.</li>
            </ul>
          </div>
          <p className="text-xs text-black-eske-60 dark:text-[#6D8294] text-center border-t border-gray-eske-20 dark:border-white/10 pt-3">
            Esta es una herramienta de referencia. Los datos oficiales son los publicados por el INE.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-gray-eske-20 dark:border-white/10 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-bluegreen-eske text-white-eske text-sm font-semibold rounded-lg hover:bg-bluegreen-eske-80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-2"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// S1 — Pirámide poblacional
// ──────────────────────────────────────────────
interface DataAmbitoProps {
  data: Record<string, number>;
  ambito?: Ambito;
}

export function S1PyramidChart({ data, ambito = "nacional" }: DataAmbitoProps) {
  const isDark = useDarkMode();
  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill   = isDark ? "#C7D6E0" : "var(--color-black-eske-10)";
  const legendStyle = { fontSize: 12, ...(isDark ? { color: "#C7D6E0" } : {}) };

  const colH   = coloresH(ambito, isDark);
  const colM   = coloresM(ambito, isDark);
  const colNB  = isDark ? COL_NB_DARK : COL_NB;

  const chartData = RANGOS.map((r) => ({
    age: RANGOS_LABELS[r],
    hombres: -(data[`lista_${r}_hombres`] ?? 0),
    mujeres: data[`lista_${r}_mujeres`] ?? 0,
  }));

  const totalPadNB = RANGOS.reduce((s, r) => s + (data[`padron_${r}_no_binario`] ?? data[`padron_${r}_nobinario`] ?? 0), 0);
  const totalLnNB  = RANGOS.reduce((s, r) => s + (data[`lista_${r}_no_binario`]  ?? data[`lista_${r}_nobinario`]  ?? 0), 0);
  const hasNBs1    = totalPadNB > 0 || totalLnNB > 0;
  const [s1NbHovered, setS1NbHovered] = useState(false);

  const nbPerRango = RANGOS.map((r) => ({
    label: RANGOS_LABELS[r],
    pad: (data[`padron_${r}_no_binario`] ?? data[`padron_${r}_nobinario`] ?? 0) as number,
    lne: (data[`lista_${r}_no_binario`]  ?? data[`lista_${r}_nobinario`]  ?? 0) as number,
  }));

  return (
    <div className="relative">
      {hasNBs1 && (
        <div
          className="absolute top-2 left-16 z-10"
          onMouseEnter={() => setS1NbHovered(true)}
          onMouseLeave={() => setS1NbHovered(false)}
        >
          <div
            className="bg-white-eske dark:bg-[#18324A] border border-purple-300 dark:border-purple-800/50 rounded-md px-3 py-2 text-xs shadow-sm cursor-default"
            aria-label="Datos No Binario"
          >
            <p className="font-semibold text-purple-700 dark:text-purple-400 mb-0.5">⚧ No Binario</p>
            <p className="text-black-eske-60 dark:text-[#9AAEBE]">
              Padrón: <span className="font-medium text-black-eske dark:text-[#EAF2F8]">{FMT.format(totalPadNB)}</span>
            </p>
            <p className="text-black-eske-60 dark:text-[#9AAEBE]">
              LNE: <span className="font-medium text-black-eske dark:text-[#EAF2F8]">{FMT.format(totalLnNB)}</span>
            </p>
          </div>
          {s1NbHovered && (
            <div
              className="absolute top-full left-0 mt-1 w-56 bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 rounded-md shadow-lg p-3 text-xs"
              style={{ zIndex: 40 }}
            >
              <p className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-1 border-b border-gray-eske-20 dark:border-white/10 pb-1">
                No Binario — por rango de edad
              </p>
              <div className="grid grid-cols-3 gap-x-2 text-black-eske-60 dark:text-[#9AAEBE] mb-1">
                <span />
                <span className="font-semibold">Padrón</span>
                <span className="font-semibold">LNE</span>
              </div>
              {nbPerRango.map(({ label, pad, lne }) => (
                <div key={label} className="grid grid-cols-3 gap-x-2 text-black-eske-60 dark:text-[#9AAEBE]">
                  <span>{label}</span>
                  <span className="text-black-eske dark:text-[#EAF2F8]">{FMT.format(pad)}</span>
                  <span className="text-black-eske dark:text-[#EAF2F8]">{FMT.format(lne)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={chartData}
        layout="vertical"
        stackOffset="sign"
        margin={{ top: hasNBs1 ? 56 : 8, right: 20, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={fmtK}
          tick={{ fontSize: 10, fill: tickFill }}
        />
        <YAxis
          type="category"
          dataKey="age"
          width={44}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tick={(props: any) => (
            <text
              x={props.x} y={props.y}
              dx={-4}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={10}
              fill={tickFill}
            >
              {props.payload?.value}
            </text>
          )}
        />
        <Tooltip
          cursor={{ fill: "transparent" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-white-eske dark:bg-[#18324A] rounded-md border border-gray-eske-20 dark:border-white/10 shadow-md px-3 py-2 text-xs pointer-events-none">
                <p className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-1.5">{label}</p>
                {payload.map((entry) => {
                  const isH = String(entry.name) === "hombres";
                  return (
                    <div key={String(entry.name)} className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: isH ? colH : colM }}
                        aria-hidden="true"
                      />
                      <span className="text-black-eske-60 dark:text-[#9AAEBE]">
                        {isH ? "LNE Hombres" : "LNE Mujeres"}:{" "}
                        <strong className="text-black-eske dark:text-[#EAF2F8]">{FMT.format(Math.abs(Number(entry.value)))}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          }}
        />
        <Legend
          formatter={(v) => (v === "hombres" ? "LNE Hombres" : "LNE Mujeres")}
          wrapperStyle={legendStyle}
        />
        <Bar dataKey="hombres" fill={colH} radius={[3, 0, 0, 3]} stackId="a" />
        <Bar dataKey="mujeres" fill={colM} radius={[0, 3, 3, 0]} stackId="a" />
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

// ──────────────────────────────────────────────
// S2 — LNE por grupos etarios × sexo (con checkboxes)
// ──────────────────────────────────────────────
export function S2AgeSexChart({ data, ambito = "nacional" }: DataAmbitoProps) {
  const isDark = useDarkMode();
  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill   = isDark ? "#C7D6E0" : "var(--color-black-eske-10)";
  const legendStyle = { fontSize: 12, ...(isDark ? { color: "#C7D6E0" } : {}) };

  const colH  = coloresH(ambito, isDark);
  const colM  = coloresM(ambito, isDark);
  const colNB = isDark ? COL_NB_DARK : COL_NB;

  const SEXOS_S2 = [
    { key: "hombres", label: "Hombres", color: colH },
    { key: "mujeres", label: "Mujeres", color: colM },
  ];

  const [activos, setActivos] = useState(new Set(["hombres", "mujeres"]));

  function toggle(key: string) {
    setActivos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  const sexosActivos = SEXOS_S2.filter((s) => activos.has(s.key));
  const labelMap = Object.fromEntries(SEXOS_S2.map((s) => [s.key, s.label]));

  const chartData = GRUPOS.map((g) => {
    const row: Record<string, string | number> = { grupo: g.label };
    for (const { key } of sexosActivos) {
      row[key] = g.rangos.reduce((s, r) => s + ((data[`lista_${r}_${key}`] as number) ?? 0), 0);
    }
    return row;
  });

  const totalLnNBS2  = GRUPOS.reduce((s, g) => s + g.rangos.reduce((ss, r) => ss + (data[`lista_${r}_no_binario`]  ?? data[`lista_${r}_nobinario`]  ?? 0), 0), 0);
  const [s2NbHovered, setS2NbHovered] = useState(false);
  const nbPerGrupo = GRUPOS.map((g) => ({
    label: g.id === "jovenes" ? "Jóvenes" : g.id === "adultos" ? "Adultos" : "Mayores",
    lne: g.rangos.reduce((s, r) => s + ((data[`lista_${r}_no_binario`] ?? data[`lista_${r}_nobinario`] ?? 0) as number), 0),
  }));

  return (
    <div>
      <div className="mb-4 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10 dark:bg-[#21425E] p-3">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-[11px] font-semibold text-black-eske-60 dark:text-[#9AAEBE]">Mostrar:</p>
          {SEXOS_S2.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1 cursor-pointer text-xs text-black-eske-80 dark:text-[#C7D6E0]">
              <input
                type="checkbox"
                checked={activos.has(key)}
                onChange={() => toggle(key)}
                className="accent-blue-eske"
              />
              {label}
            </label>
          ))}
          <button
            type="button"
            onClick={() => setActivos(new Set(["hombres", "mujeres"]))}
            className="px-2 py-1 text-xs rounded border border-gray-eske-30 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske-60 dark:text-[#9AAEBE] hover:border-blue-eske hover:text-blue-eske whitespace-nowrap"
          >
            ↺ Restablecer
          </button>
        </div>
      </div>
      <div className="relative">
        {totalLnNBS2 > 0 && (
          <div
            className="absolute top-2 right-0 z-10"
            onMouseEnter={() => setS2NbHovered(true)}
            onMouseLeave={() => setS2NbHovered(false)}
          >
            <div
              className="bg-white-eske dark:bg-[#18324A] border border-purple-300 dark:border-purple-800/50 rounded-md px-3 py-2 text-xs shadow-sm cursor-default"
              aria-label="Datos No Binario"
            >
              <p className="font-semibold text-purple-700 dark:text-purple-400 mb-0.5">⚧ No Binario</p>
              <p className="text-black-eske-60 dark:text-[#9AAEBE]">
                LNE: <span className="font-medium text-black-eske dark:text-[#EAF2F8]">{FMT.format(totalLnNBS2)}</span>
              </p>
            </div>
            {s2NbHovered && (
              <div
                className="absolute top-full right-0 mt-1 w-44 bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 rounded-md shadow-lg p-3 text-xs"
                style={{ zIndex: 40 }}
              >
                <p className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-1 border-b border-gray-eske-20 dark:border-white/10 pb-1">
                  No Binario — por grupo etario
                </p>
                {nbPerGrupo.map(({ label, lne }) => (
                  <div key={label} className="flex justify-between text-black-eske-60 dark:text-[#9AAEBE]">
                    <span>{label}</span>
                    <span className="font-medium text-black-eske dark:text-[#EAF2F8] ml-3">{FMT.format(lne)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: totalLnNBS2 > 0 ? 56 : 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="grupo" tick={{ fontSize: 11, fill: tickFill }} />
          <YAxis
            tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
            tick={{ fontSize: 11, fill: tickFill }}
            width={60}
          />
          <Tooltip
            formatter={(v, n) => [FMT.format(Number(v)), labelMap[String(n)] ?? String(n)]}
            labelStyle={{ color: "#2b2b2b" }}
            contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "var(--color-gray-eske-20)" }}
            cursor={{ fill: "transparent" }}
          />
          <Legend formatter={(v) => labelMap[v] ?? v} wrapperStyle={legendStyle} />
          {sexosActivos.map(({ key, color }) => (
            <Bar key={key} dataKey={key} fill={color} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// S3 — Serie temporal por sexo (con proyección)
// ──────────────────────────────────────────────
interface S3Props {
  serie: SemanalSerieRow[];
  ambito: Ambito;
  dataSexo: Record<string, number>;
}

type SexoConfig = {
  key: "hombres" | "mujeres";
  label: string;
  colorPad: string;
  colorLne: string;
};

function getSexosS3(ambito: Ambito, isDark: boolean): SexoConfig[] {
  const isExt = ambito === "extranjero";
  if (isDark) {
    return [
      { key: "hombres", label: "Hombres", colorPad: isExt ? "#4D9DE8" : "#4791B3", colorLne: isExt ? "#87baf0" : "#6BA4C6" },
      { key: "mujeres", label: "Mujeres", colorPad: isExt ? "#C585F5" : "#E05F7F", colorLne: isExt ? "#dbb4f9" : "#F4839D" },
    ];
  }
  return [
    { key: "hombres", label: "Hombres", colorPad: isExt ? "#0163a4" : "#003F8A", colorLne: isExt ? "#2480d4" : "#001A5E" },
    { key: "mujeres", label: "Mujeres", colorPad: isExt ? "#7206b4" : "#C0306A", colorLne: isExt ? "#8b2bd6" : "#8B1A3D" },
  ];
}

function fmtFechaSexo(iso: string): string {
  const [, m, d] = iso.split("-");
  const meses = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10)]}`;
}

export function S3SexoSerieChart({ serie, ambito, dataSexo }: S3Props) {
  const isDark = useDarkMode();
  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill   = isDark ? "#C7D6E0" : "var(--color-black-eske-10)";
  const legendStyle = { fontSize: 11, ...(isDark ? { color: "#C7D6E0" } : {}) };

  const { isMobile } = useWindowSize();
  const SEXOS_S3 = getSexosS3(ambito, isDark);
  const [activos, setActivos] = useState<Set<string>>(new Set(["hombres", "mujeres"]));
  const [showModal, setShowModal] = useState(false);

  const nbPadron = (dataSexo["padron_no_binario"] as number) ?? 0;
  const nbLista = (dataSexo["lista_no_binario"] as number) ?? 0;
  const FMT_NB = new Intl.NumberFormat("es-MX");

  function toggle(key: string) {
    setActivos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  if (serie.length < 2) {
    return (
      <p className="text-sm text-black-eske-60 dark:text-[#6D8294] text-center py-6">
        Sin datos de serie temporal suficientes para proyección.
      </p>
    );
  }

  const sexosAct = SEXOS_S3.filter(({ key }) => activos.has(key));
  const proyMap = new Map<string, ReturnType<typeof computeSemanalesProyeccion>>();
  for (const { key } of sexosAct) {
    proyMap.set(key, computeSemanalesProyeccion(serie, `padron_${key}`, `lista_${key}`));
  }

  const pRef = proyMap.get(sexosAct[0]?.key ?? "hombres") ?? [];
  const chartData = pRef.map((p, idx) => {
    const point: Record<string, number | string | undefined> = {
      label: fmtFechaSexo(p.fecha),
    };
    for (const { key } of sexosAct) {
      const proy = proyMap.get(key)!;
      const pt = proy[idx];
      if (!pt) continue;
      if (!pt.proyectado) {
        point[`pad_${key}`] = pt.padron;
        point[`lne_${key}`] = pt.lista;
      } else {
        point[`padProy_${key}`] = pt.padron;
        point[`lneProy_${key}`] = pt.lista;
      }
    }
    return point;
  });

  const fmtM = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : FMT.format(v);

  const allNumeric = chartData.flatMap((p) =>
    Object.values(p).filter((v): v is number => typeof v === "number" && v > 0)
  );
  const yMin = allNumeric.length > 0 ? Math.floor(Math.min(...allNumeric) * 0.97) : 0;

  return (
    <div>
      {showModal && <MetodologiaModal onClose={() => setShowModal(false)} />}
      <div className="mb-4 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10 dark:bg-[#21425E] p-3">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-[11px] font-semibold text-black-eske-60 dark:text-[#9AAEBE]">Mostrar:</p>
          {SEXOS_S3.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1 cursor-pointer text-xs text-black-eske-80 dark:text-[#C7D6E0]">
              <input
                type="checkbox"
                checked={activos.has(key)}
                onChange={() => toggle(key)}
                className="accent-blue-eske"
              />
              {label}
            </label>
          ))}
          <button
            type="button"
            onClick={() => setActivos(new Set(["hombres", "mujeres"]))}
            className="px-2 py-1 text-xs rounded border border-gray-eske-30 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske-60 dark:text-[#9AAEBE] hover:border-blue-eske hover:text-blue-eske whitespace-nowrap"
          >
            ↺ Restablecer
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-bluegreen-eske dark:text-bluegreen-eske-30 border border-bluegreen-eske-30 rounded hover:bg-bluegreen-eske-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske whitespace-nowrap"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Metodología
          </button>
          <span className="ml-auto text-xs text-black-eske-60 dark:text-[#9AAEBE] border-l border-gray-eske-30 dark:border-white/10 pl-3">
            <span className="font-semibold" style={{ color: isDark ? COL_NB_DARK : COL_NB }}>No Binario:</span>{" "}
            Padrón <strong>{FMT_NB.format(nbPadron)}</strong> · LNE <strong>{FMT_NB.format(nbLista)}</strong>
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: tickFill }}
            interval={6}
          />
          <YAxis
            tickFormatter={fmtM}
            tick={{ fontSize: 11, fill: tickFill }}
            width={64}
            domain={[yMin, "auto"]}
          />
          <Tooltip
            formatter={(v, name) => [FMT.format(Number(v)), String(name)]}
            itemSorter={(item) => -(item.value as number)}
            labelStyle={{ color: "#2b2b2b" }}
            contentStyle={{ fontSize: 11, borderRadius: 6, borderColor: "var(--color-gray-eske-20)" }}
          />
          <Legend wrapperStyle={{ ...legendStyle, ...(isMobile ? { display: "none" } : {}) }} />
          {sexosAct.map(({ key, label, colorPad, colorLne }) => (
            <Fragment key={key}>
              <Line dataKey={`pad_${key}`} name={`Padrón ${label}`} stroke={colorPad} strokeWidth={2.5} dot={false} connectNulls={false} />
              <Line dataKey={`lne_${key}`} name={`LNE ${label}`} stroke={colorLne} strokeWidth={2.5} dot={false} connectNulls={false} />
              <Line dataKey={`padProy_${key}`} name={`Proy. Padrón ${label}`} stroke={colorPad} strokeWidth={2} strokeDasharray="6 3" strokeOpacity={0.7} dot={false} connectNulls={false} />
              <Line dataKey={`lneProy_${key}`} name={`Proy. LNE ${label}`} stroke={colorLne} strokeWidth={2} strokeDasharray="6 3" strokeOpacity={0.7} dot={false} connectNulls={false} />
            </Fragment>
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] text-center mt-1">
        Líneas punteadas = proyección estimada hasta diciembre.
      </p>

      {/* Leyenda colapsable — solo mobile */}
      <details className="sm:hidden mt-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10 dark:bg-[#21425E] text-[11px]">
        <summary className="px-3 py-2 cursor-pointer text-bluegreen-eske font-medium flex items-center gap-1.5 select-none list-none">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Ver leyenda
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-1.5">
          {sexosAct.map(({ key, label, colorPad, colorLne }) => (
            <Fragment key={key}>
              <div className="flex items-center gap-2"><span style={{ display: "inline-block", width: 16, height: 3, background: colorPad }} /><span>Padrón {label}</span></div>
              <div className="flex items-center gap-2"><span style={{ display: "inline-block", width: 16, height: 3, background: colorLne }} /><span>LNE {label}</span></div>
            </Fragment>
          ))}
        </div>
      </details>
    </div>
  );
}

// ──────────────────────────────────────────────
// S4 — Padrón y LNE por Sexo (H/M agrupados; NB en card)
// ──────────────────────────────────────────────
export function S4ParticipacionChart({ data, ambito = "nacional" }: DataAmbitoProps) {
  const isDark = useDarkMode();
  const gridStroke = isDark ? "rgba(255,255,255,0.07)" : "var(--color-gray-eske-20)";
  const tickFill   = isDark ? "#C7D6E0" : "var(--color-black-eske-10)";
  const legendStyle = { fontSize: 12, ...(isDark ? { color: "#C7D6E0" } : {}) };

  const colH = coloresH(ambito, isDark);
  const colM = coloresM(ambito, isDark);
  const [nbHovered, setNbHovered] = useState(false);

  const nbPadron = (data.padron_no_binario as number) ?? 0;
  const nbLista = (data.lista_no_binario as number) ?? 0;
  const hasNb = nbPadron > 0 || nbLista > 0;

  // X = métrica (Lista Nominal / Padrón Electoral), series = H y M
  const chartData = [
    { metrica: "Lista Nominal", hombres: data.lista_hombres ?? 0, mujeres: data.lista_mujeres ?? 0 },
    { metrica: "Padrón Electoral", hombres: data.padron_hombres ?? 0, mujeres: data.padron_mujeres ?? 0 },
  ];

  return (
    <div className="relative">
      {/* Card No Binario — posicionada en esquina superior izquierda sin tapar eje Y */}
      {hasNb && (
        <div
          className="absolute top-2 left-16 z-10"
          onMouseEnter={() => setNbHovered(true)}
          onMouseLeave={() => setNbHovered(false)}
        >
          <div
            className="bg-white-eske dark:bg-[#18324A] border border-purple-300 dark:border-purple-800/50 rounded-md px-3 py-2 text-xs shadow-sm cursor-default"
            aria-label="Datos No Binario"
          >
            <p className="font-semibold text-purple-700 dark:text-purple-400 mb-0.5">⚧ No Binario</p>
            <p className="text-black-eske-60 dark:text-[#9AAEBE]">
              Padrón: <span className="font-medium text-black-eske dark:text-[#EAF2F8]">{FMT.format(nbPadron)}</span>
            </p>
            <p className="text-black-eske-60 dark:text-[#9AAEBE]">
              LNE: <span className="font-medium text-black-eske dark:text-[#EAF2F8]">{FMT.format(nbLista)}</span>
            </p>
          </div>
          {/* Popover de tasa cuando se hace hover */}
          {nbHovered && (nbPadron > 0 || nbLista > 0) && (
            <div
              className="absolute top-full left-0 mt-1 w-48 bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 rounded-md shadow-lg p-3 text-xs"
              style={{ zIndex: 40 }}
            >
              <p className="font-semibold text-black-eske dark:text-[#EAF2F8] mb-1 border-b border-gray-eske-20 dark:border-white/10 pb-1">No Binario — detalle</p>
              <p className="text-black-eske-60 dark:text-[#9AAEBE]">
                Tasa inclusión:{" "}
                <span className="font-medium text-black-eske dark:text-[#EAF2F8]">
                  {nbPadron > 0 ? `${((nbLista / nbPadron) * 100).toFixed(2)}%` : "—"}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          margin={{ top: hasNb ? 56 : 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="metrica" tick={{ fontSize: 11, fill: tickFill }} />
          <YAxis
            tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
            tick={{ fontSize: 11, fill: tickFill }}
            width={60}
          />
          <Tooltip
            formatter={(v, n) => [FMT.format(Number(v)), n === "hombres" ? "Hombres" : "Mujeres"]}
            labelStyle={{ color: "#2b2b2b" }}
            contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "var(--color-gray-eske-20)" }}
            cursor={{ fill: "transparent" }}
          />
          <Legend
            formatter={(v) => (v === "hombres" ? "Hombres" : "Mujeres")}
            wrapperStyle={legendStyle}
          />
          <Bar dataKey="hombres" fill={colH} radius={[3, 3, 0, 0]} />
          <Bar dataKey="mujeres" fill={colM} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
