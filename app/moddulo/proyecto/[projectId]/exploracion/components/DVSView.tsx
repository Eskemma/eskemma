"use client";

// DVSView.tsx — Documento de Viabilidad Situacional (F2)
// Muestra HEI + sub-tabs M2/M3/M4 + PIP
// Se renderiza en el panel izquierdo cuando headerState === "lista"

import { useState } from "react";
import type { DVSF2, ContrasteXPCTO, ActorVetoF2, IncertidumbreF2, PIPItem } from "@/types/moddulo.types";

interface DVSViewProps {
  dvs: DVSF2;
}

type SubTab = "M2" | "M3" | "M4";

// ── Veredicto badge ────────────────────────────────────────────

function VeredictoM2Badge({ v }: { v: ContrasteXPCTO["veredicto"] }) {
  const map = {
    coherente: { label: "Coherente", classes: "bg-green-eske-20 text-green-eske-80" },
    requiere_ajuste: { label: "Requiere ajuste", classes: "bg-yellow-eske-20 text-black-eske" },
    requiere_investigacion: { label: "Requiere investigación", classes: "bg-red-eske-20 text-red-eske-80" },
  } as const;
  const { label, classes } = map[v];
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${classes}`}>
      {label}
    </span>
  );
}

// ── Nivel de riesgo badge + círculo ───────────────────────────

function NivelRiesgoBadge({ nivel }: { nivel: ActorVetoF2["nivelRiesgo"] }) {
  const map = {
    rojo: { dot: "bg-red-eske", label: "Veto inmediato" },
    ambar: { dot: "bg-yellow-eske-70", label: "Riesgo condicional" },
    verde: { dot: "bg-green-eske-60", label: "Riesgo bajo" },
  } as const;
  const { dot, label } = map[nivel];
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-full shrink-0 ${dot}`} aria-hidden />
      <span className="text-xs text-gray-eske-70 dark:text-[#9AAEBE]">{label}</span>
    </span>
  );
}

// ── Urgencia / Resolución badge ────────────────────────────────

function NivelBadge({ level, label }: { level: "alta" | "media" | "baja"; label: string }) {
  const colors = {
    alta: "bg-red-eske-20 text-red-eske-80",
    media: "bg-yellow-eske-20 text-black-eske",
    baja: "bg-green-eske-20 text-green-eske-80",
  } as const;
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${colors[level]}`}>
      {label} {level}
    </span>
  );
}

// ── Sub-tabs ───────────────────────────────────────────────────

function M2Panel({ items }: { items: ContrasteXPCTO[] }) {
  const DIM_LABELS: Record<string, string> = {
    X: "Hito (X)",
    P: "Sujeto (P)",
    C: "Capacidades (C)",
    T: "Tiempo (T)",
    O: "Justificación (O)",
  };

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.dimension}
          className="bg-white-eske dark:bg-[#1A3347] rounded-lg p-3 border border-gray-eske-20 dark:border-white/10"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="font-semibold text-sm text-black-eske dark:text-white">
              {DIM_LABELS[item.dimension] ?? item.dimension}
            </span>
            <VeredictoM2Badge v={item.veredicto} />
          </div>
          <p className="text-sm text-black-eske-80 dark:text-[#C5D8E8] mb-2">
            {item.argumentacion}
          </p>
          {item.senalesPESTEL.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.senalesPESTEL.map((s, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 bg-bluegreen-eske-10 text-bluegreen-eske-80 rounded-full dark:bg-bluegreen-eske/20 dark:text-[#6BA4C6]"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function M3Panel({ actores }: { actores: ActorVetoF2[] }) {
  return (
    <div className="space-y-3">
      {actores.length === 0 && (
        <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] text-center py-4">
          Sin actores de veto identificados.
        </p>
      )}
      {actores.map((actor, i) => (
        <div
          key={i}
          className="bg-white-eske dark:bg-[#1A3347] rounded-lg p-3 border border-gray-eske-20 dark:border-white/10"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <span className="font-semibold text-sm text-black-eske dark:text-white">
                {actor.nombre}
              </span>
              <span className="ml-1.5 text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
                {actor.tipo}
              </span>
            </div>
            <NivelRiesgoBadge nivel={actor.nivelRiesgo} />
          </div>
          <p className="text-xs text-black-eske-80 dark:text-[#C5D8E8] mb-1">
            <span className="font-medium">Capacidad de veto:</span> {actor.capacidadVeto}
          </p>
          <p className="text-xs text-gray-eske-70 dark:text-[#9AAEBE]">
            <span className="font-medium">Motivación:</span> {actor.motivacion}
          </p>
          {actor.requiereInvestigacion && (
            <span className="inline-block mt-1.5 text-xs px-2 py-0.5 bg-orange-eske-10 text-orange-eske-80 rounded-full dark:bg-orange-eske/20">
              Requiere investigación de campo
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function M4Panel({ items }: { items: IncertidumbreF2[] }) {
  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] text-center py-4">
          Sin incertidumbres registradas.
        </p>
      )}
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-white-eske dark:bg-[#1A3347] rounded-lg p-3 border border-gray-eske-20 dark:border-white/10"
        >
          <p className="text-sm text-black-eske dark:text-white mb-2">{item.descripcion}</p>
          <div className="flex flex-wrap gap-2 mb-1">
            <NivelBadge level={item.urgencia} label="Urgencia" />
            <NivelBadge level={item.resolucion} label="Resolución" />
          </div>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              item.destino === "F3"
                ? "bg-bluegreen-eske-10 text-bluegreen-eske-80 dark:bg-bluegreen-eske/20"
                : "bg-gray-eske-20 text-gray-eske-70 dark:bg-white/10 dark:text-[#9AAEBE]"
            }`}
          >
            → {item.destino === "F3" ? "F3 — Investigación" : "SIP (largo plazo)"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function DVSView({ dvs }: DVSViewProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("M2");

  const SUB_TABS: { id: SubTab; label: string; count?: number }[] = [
    { id: "M2", label: "Contraste XPCTO", count: dvs.contrasteXPCTO.length },
    { id: "M3", label: "Semáforo de Veto", count: dvs.semaforo.length },
    { id: "M4", label: "Incertidumbres", count: dvs.incertidumbres.length },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-4 px-1">
      {/* HEI — Hipótesis Estratégica Inicial */}
      <div
        className="rounded-xl p-4 border-l-4 border-bluegreen-eske"
        style={{ backgroundColor: "rgba(var(--color-bluegreen-eske-10, 2 105 136) / 0.15)" }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-bluegreen-eske-70 dark:text-[#6BA4C6] mb-1">
          Hipótesis Estratégica Inicial
        </p>
        <p className="font-semibold text-sm text-black-eske dark:text-white mb-2">
          {dvs.hei.tensionCentral}
        </p>
        <p className="text-sm text-black-eske-80 dark:text-[#C5D8E8] mb-3">
          {dvs.hei.contexto}
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
          <div>
            <p className="font-semibold text-green-eske-70 dark:text-[#7BC47C] mb-1">
              Condiciones favorables
            </p>
            <ul className="space-y-1">
              {dvs.hei.condicionesFavorables.map((c, i) => (
                <li key={i} className="text-black-eske-80 dark:text-[#C5D8E8]">
                  + {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-red-eske-70 dark:text-[#E07070] mb-1">
              Condiciones adversas
            </p>
            <ul className="space-y-1">
              {dvs.hei.condicionesAdversas.map((c, i) => (
                <li key={i} className="text-black-eske-80 dark:text-[#C5D8E8]">
                  − {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-xs italic text-black-eske-70 dark:text-[#9AAEBE] border-t border-bluegreen-eske/30 pt-2">
          {dvs.hei.premisaEstrategica}
        </p>
      </div>

      {/* Sub-tabs M2 / M3 / M4 */}
      <div>
        <div
          className="flex border-b border-gray-eske-20 dark:border-white/10 mb-3"
          role="tablist"
          aria-label="Secciones del DVS"
        >
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-bluegreen-eske text-bluegreen-eske dark:text-[#6BA4C6]"
                  : "border-transparent text-gray-eske-60 dark:text-[#9AAEBE] hover:text-bluegreen-eske",
              ].join(" ")}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 text-gray-eske-50">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "M2" && <M2Panel items={dvs.contrasteXPCTO} />}
        {activeTab === "M3" && <M3Panel actores={dvs.semaforo} />}
        {activeTab === "M4" && <M4Panel items={dvs.incertidumbres} />}
      </div>

      {/* PIP — Programa de Investigación Profunda (fixed, not collapsible) */}
      <div className="rounded-xl p-4 bg-gray-eske-10 dark:bg-[#1A3347] border-t-2 border-bluegreen-eske">
        <p className="text-xs font-bold uppercase tracking-wider text-bluegreen-eske-70 dark:text-[#6BA4C6] mb-3">
          Programa de Investigación Profunda → F3
        </p>
        <ol className="space-y-3">
          {dvs.pip.map((item: PIPItem) => (
            <li key={item.numero} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-bluegreen-eske text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {item.numero}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-black-eske dark:text-white leading-snug">
                  {item.pregunta}
                </p>
                <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5">
                  Método: {item.metodo}
                </p>
                <p className="text-xs text-bluegreen-eske-70 dark:text-[#6BA4C6] mt-0.5">
                  Vínculo: {item.vinculoHito}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
