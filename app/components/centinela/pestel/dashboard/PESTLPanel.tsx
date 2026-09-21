"use client";

import {useState} from "react";
import type {PESTLAnalysis, DimensionPESTL, Factor} from "@/types/pestel.types";

// ── Configuración de dimensiones ─────────────────────────────

type DimensionKey = keyof PESTLAnalysis;

const DIMENSIONS: {key: DimensionKey; label: string; icon: string}[] = [
  {key: "politico",    label: "Político",    icon: "🏛️"},
  {key: "economico",   label: "Económico",   icon: "📊"},
  {key: "social",      label: "Social",      icon: "👥"},
  {key: "tecnologico", label: "Tecnológico", icon: "💡"},
  {key: "legal",       label: "Legal",       icon: "⚖️"},
];

// ── Helpers ───────────────────────────────────────────────────

function impactoStyles(impacto: Factor["impacto"]) {
  switch (impacto) {
  case "alto":   return {dot: "bg-red-eske",    badge: "bg-red-eske/20 dark:bg-red-eske/30 text-red-eske-60 dark:text-red-eske-20"};
  case "medio":  return {dot: "bg-yellow-eske", badge: "bg-yellow-eske/20 dark:bg-yellow-eske/30 text-brown-eske-60 dark:text-yellow-eske"};
  case "bajo":   return {dot: "bg-gray-eske-40 dark:bg-[#9AAEBE]",   badge: "bg-gray-eske-10 dark:bg-[#21425E] text-black-eske-10 dark:text-[#9AAEBE]"};
  }
}

function tendenciaStyles(t: DimensionPESTL["tendencia"]) {
  switch (t) {
  case "creciente":   return {cls: "bg-orange-eske/20 dark:bg-orange-eske/30 text-orange-eske-70 dark:text-orange-eske-20", label: "↑ Creciente"};
  case "decreciente": return {cls: "bg-blue-eske/20 dark:bg-blue-eske/30 text-blue-eske-70 dark:text-blue-eske-30",     label: "↓ Decreciente"};
  case "estable":     return {cls: "bg-green-eske/20 dark:bg-green-eske/30 text-green-eske-70 dark:text-green-eske-30",   label: "→ Estable"};
  }
}

function extractUrl(fuente: string): string | null {
  const m = fuente.match(/https?:\/\/\S+/);
  return m ? m[0] : null;
}

// Extrae el nombre del medio de la cadena '"Título" — https://...'
function extractMedium(fuente: string): string {
  try {
    const url = extractUrl(fuente);
    if (!url) return fuente.slice(0, 60);
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return fuente.slice(0, 60);
  }
}

// ── Barra de sentimiento ──────────────────────────────────────

function SentimentDot({value}: {value: number}) {
  const clamped = Math.max(-1, Math.min(1, value));
  const pct = ((clamped + 1) / 2) * 100;
  const color =
    clamped < -0.25 ? "bg-red-eske-20" :
      clamped > 0.25  ? "bg-green-eske" : "bg-yellow-eske";
  return (
    <div className="flex items-center gap-1.5 w-28 shrink-0">
      <span className="text-[10px] text-gray-eske-90 dark:text-[#6D8294]">−</span>
      <div className="relative flex-1 h-1 bg-gray-eske-20 dark:bg-white/10 rounded-full">
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-2 h-2
            rounded-full ${color} shadow-sm`}
          style={{left: `calc(${pct}% - 4px)`}}
        />
      </div>
      <span className="text-[10px] text-gray-eske-90 dark:text-[#6D8294]">+</span>
    </div>
  );
}

// ── Factor card ───────────────────────────────────────────────

function FactorCard({factor}: {factor: Factor}) {
  const styles = impactoStyles(factor.impacto);
  const url = extractUrl(factor.fuente);
  const medium = factor.fuente ? extractMedium(factor.fuente) : null;

  return (
    <div className="bg-white dark:bg-[#21425E] rounded-lg border border-gray-eske-10 dark:border-white/10 px-4 py-3
      hover:border-gray-eske-20 dark:hover:border-white/20 hover:shadow-sm transition-all duration-150">
      {/* Título + badge impacto */}
      <div className="flex items-start gap-2 mb-2">
        <span
          className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${styles.dot}`}
        />
        <p className="text-sm text-black-eske dark:text-[#C7D6E0] leading-snug flex-1">
          {factor.descripcion}
        </p>
        <span
          className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5
            rounded-full ${styles.badge}`}
        >
          {factor.impacto}
        </span>
      </div>

      {/* Sentimiento + fuente */}
      <div className="flex items-center justify-between gap-3 pl-4">
        <SentimentDot value={factor.sentiment} />
        {medium && url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-bluegreen-eske hover:underline
              flex items-center gap-0.5 min-w-0 truncate"
          >
            <svg
              className="w-3 h-3 shrink-0 opacity-70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0
                  002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            <span className="truncate">{medium}</span>
          </a>
        )}
        {medium && !url && (
          <span className="text-[11px] text-gray-eske-90 dark:text-[#6D8294] truncate min-w-0">
            {medium}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Contenido de una dimensión ────────────────────────────────

function DimensionContent({dimension}: {dimension: DimensionPESTL}) {
  const {label: tendLabel, cls: tendCls} = tendenciaStyles(dimension.tendencia);
  const factores = dimension.factores ?? [];

  // Extraer viñetas del contexto (frases separadas por punto)
  const bullets = dimension.contexto
    ? dimension.contexto
      .split(/\.\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20)
      .slice(0, 4)
    : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado de dimensión */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full
            ${tendCls}`}
        >
          {tendLabel}
        </span>
        <span className="text-xs text-gray-eske-90 dark:text-[#6D8294]">
          {factores.length} factor{factores.length !== 1 ? "es" : ""}
          {" "}analizados
        </span>
      </div>

      {/* Resumen ejecutivo */}
      {bullets.length > 0 && (
        <div className="bg-bluegreen-eske/5 dark:bg-[#112230] border border-bluegreen-eske/15 dark:border-white/10
          rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide
            text-bluegreen-eske-60 dark:text-[#6BA4C6] mb-2">
            Resumen
          </p>
          <ul className="flex flex-col gap-1.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-black-eske-30 dark:text-[#C7D6E0]">
                <span className="text-bluegreen-eske shrink-0 mt-0.5">•</span>
                <span>{b}.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Factores — 2 columnas en desktop */}
      {factores.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {factores.map((f, i) => (
            <FactorCard key={i} factor={f} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-eske-90 dark:text-[#6D8294] italic">
          Sin factores identificados en esta dimensión.
        </p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

interface PESTLPanelProps {
  pestl: PESTLAnalysis;
}

export default function PESTLPanel({pestl}: PESTLPanelProps) {
  const [activeKey, setActiveKey] = useState<DimensionKey>("politico");

  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-eske-10 dark:border-white/10 overflow-x-auto">
        {DIMENSIONS.map(({key, label, icon}) => {
          const count = pestl[key].factores?.length ?? 0;
          const isActive = activeKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveKey(key)}
              className={`flex-1 min-w-[90px] flex flex-col items-center
                gap-0.5 px-3 py-3 text-center transition-colors duration-150
                border-b-2 whitespace-nowrap
                ${isActive
                  ? "border-bluegreen-eske bg-bluegreen-eske/5 dark:bg-bluegreen-eske/10 text-bluegreen-eske dark:text-[#6BA4C6]"
                  : "border-transparent text-black-eske-10 dark:text-[#9AAEBE] hover:text-black-eske-30 dark:hover:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
                }`}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {icon}
              </span>
              <span className="text-xs font-semibold">{label}</span>
              <span
                className={`text-[10px] ${isActive ? "text-bluegreen-eske/70 dark:text-[#4791B3]" : "text-gray-eske-90 dark:text-[#6D8294]"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contenido de la dimensión activa */}
      <div className="p-5">
        <DimensionContent dimension={pestl[activeKey]} />
      </div>
    </div>
  );
}
