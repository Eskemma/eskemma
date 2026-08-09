"use client";

import { useState } from "react";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import type {
  DVSF2,
  ContrasteXPCTO,
  ActorVetoF2,
  IncertidumbreF2,
  PIPItem,
  HEIF2,
} from "@/types/moddulo.types";

// ── Types ──────────────────────────────────────────────────────────────────────

type MotorId = "M2" | "M3" | "M4" | "M5";
type MotorState = "active" | "approved" | "locked";

interface MotorAprobaciones {
  M2?: boolean;
  M3?: boolean;
  M4?: boolean;
  M5?: boolean;
}

export interface MotoresSequentialViewProps {
  projectId: string;
  draftDVS: DVSF2 | null;
  motorAprobaciones: MotorAprobaciones;
  isGenerating: boolean;
  generationError?: string | null;
  onRetry?: () => void;
  /** Texto del botón de reintento — distingue regeneración completa de actualización parcial */
  retryLabel?: string;
  onApprove: (motor: MotorId) => void;
  onDraftChange: (updated: DVSF2) => void;
  onSaveEdit?: (motor: MotorId) => void;
  /** Cuando true, todos los motores arrancan expandidos y editables sin aprobación previa */
  editMode?: boolean;
}

// ── Motor metadata ─────────────────────────────────────────────────────────────

const MOTORS: { id: MotorId; label: string; description: string; tooltip?: string }[] = [
  {
    id: "M2",
    label: "Contraste XPCTO–Entorno",
    description: "Veredicto por cada variable del XPCTO frente al análisis PESTEL.",
    tooltip: "Este motor compara cada variable XPCTO contra el entorno PESTEL detectado, para verificar si el proyecto es coherente con el contexto real. Revisa cada elemento para marcarlo como 'Coherente', 'Requiere ajuste' o 'Requiere investigación' y decide si tu estrategia necesita adaptarse antes de aprobar.",
  },
  {
    id: "M3",
    label: "Semáforo de Veto",
    description: "Actores con capacidad de bloqueo y nivel de riesgo.",
    tooltip: "Este motor identifica actores con capacidad real de bloquear tu objetivo y clasifica el riesgo que representan. Revisa cada actor, ajusta su nivel de riesgo si no coincide con tu conocimiento del terreno, y aprueba cuando el semáforo refleje fielmente el panorama de oposición y bloqueo que enfrentas.",
  },
  {
    id: "M4",
    label: "Mapa de Incertidumbres",
    description: "Incertidumbres priorizadas por urgencia y destino de resolución.",
    tooltip: "Este motor señala vacíos de información (preguntas sin resolver que podrían cambiar tu estrategia si se contestan). No son afirmaciones, son brechas. Revísalas y aprueba cuando confirmes que reflejan las dudas reales que aún tienes sobre el proyecto.",
  },
  {
    id: "M5",
    label: "Hipótesis + PIP",
    description: "Hipótesis Estratégica Inicial y Programa de Investigación Profunda.",
    tooltip: "Este motor propone una Hipótesis Estratégica Inicial (la apuesta central de tu proyecto) y un Programa de Investigación Profunda (las preguntas que Fase 3 deberá resolver). Revisa la tensión central, el contexto y las condiciones favorables/adversas; ajusta o agrega preguntas de investigación antes de aprobar y cerrar la Fase 2.",
  },
];

const ORDER: MotorId[] = ["M2", "M3", "M4", "M5"];

const APPROVE_LABEL: Record<MotorId, string> = {
  M2: "Aprobar contraste",
  M3: "Aprobar semáforo",
  M4: "Aprobar incertidumbres",
  M5: "Finalizar análisis",
};

function getMotorState(id: MotorId, aprobaciones: MotorAprobaciones): MotorState {
  const idx = ORDER.indexOf(id);
  if (aprobaciones[id]) return "approved";
  const allPreviousApproved = ORDER.slice(0, idx).every((m) => aprobaciones[m]);
  return allPreviousApproved ? "active" : "locked";
}

function getMotorSummary(id: MotorId, dvs: DVSF2): string {
  switch (id) {
    case "M2": {
      const c = dvs.contrasteXPCTO.filter((x) => x.veredicto === "coherente").length;
      const a = dvs.contrasteXPCTO.filter((x) => x.veredicto === "requiere_ajuste").length;
      const r = dvs.contrasteXPCTO.filter((x) => x.veredicto === "requiere_investigacion").length;
      return [c && `${c} coherente${c > 1 ? "s" : ""}`, a && `${a} requiere${a > 1 ? "n" : ""} ajuste`, r && `${r} requiere${r > 1 ? "n" : ""} investigación`].filter(Boolean).join(" · ");
    }
    case "M3": {
      const n = dvs.semaforo.length;
      const rojo = dvs.semaforo.filter((a) => a.nivelRiesgo === "rojo").length;
      return `${n} actor${n !== 1 ? "es" : ""}${rojo ? ` · ${rojo} veto inmediato` : ""}`;
    }
    case "M4": {
      const n = dvs.incertidumbres.length;
      const altas = dvs.incertidumbres.filter((i) => i.urgencia === "alta").length;
      return `${n} incertidumbre${n !== 1 ? "s" : ""}${altas ? ` · ${altas} de urgencia alta` : ""}`;
    }
    case "M5": {
      const n = dvs.pip.length;
      const tension = dvs.hei.tensionCentral.slice(0, 55) + (dvs.hei.tensionCentral.length > 55 ? "…" : "");
      return `${n} pregunta${n !== 1 ? "s" : ""} · ${tension}`;
    }
  }
}

// ── Shared field helpers ───────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE] mb-1">{children}</p>;
}

function DescTwoLines({ text, className }: { text: string; className: string }) {
  const dotIdx = text.indexOf(". ");
  if (dotIdx === -1) return <p className={className}>{text}</p>;
  return (
    <p className={className}>
      <span className="block">{text.slice(0, dotIdx + 1)}</span>
      <span className="block">{text.slice(dotIdx + 2)}</span>
    </p>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4 9.732-9.732a2 2 0 012.828 0l.904.904a2 2 0 010 2.828L9 13z" />
    </svg>
  );
}

function InlineEdit({
  value,
  onChange,
  placeholder = "",
  rows = 2,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const [editing, setEditing] = useState(value === "");
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={rows}
          autoFocus
          placeholder={placeholder}
          className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-bluegreen-eske dark:border-bluegreen-eske/60 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-white placeholder:text-gray-eske-80 focus:outline-none focus:ring-1 focus:ring-bluegreen-eske resize-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { onChange(draft); setEditing(false); }}
            className="text-xs px-2.5 py-1 bg-bluegreen-eske text-white rounded-lg font-semibold hover:bg-bluegreen-eske/90 transition-colors"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs px-2.5 py-1 border border-gray-eske-20 dark:border-white/10 text-gray-eske-60 dark:text-[#9AAEBE] rounded-lg hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex items-start gap-1.5 ${className}`}>
      <p className="flex-1 text-sm text-black-eske dark:text-[#C5D8E8] leading-relaxed">
        {value || <span className="text-gray-eske-80 italic">{placeholder}</span>}
      </p>
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        aria-label="Editar campo"
        className="shrink-0 mt-0.5 text-gray-eske-60 dark:text-[#9AAEBE] hover:text-bluegreen-eske dark:hover:text-bluegreen-eske-20 transition-colors cursor-pointer"
      >
        <PencilIcon />
      </button>
    </div>
  );
}

function SelectField<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full max-w-full text-xs font-semibold px-2 py-1 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-white focus:outline-none focus:ring-1 focus:ring-bluegreen-eske cursor-pointer"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── M2 ────────────────────────────────────────────────────────────────────────

const XPCTO_LABELS: Record<string, string> = {
  X: "Hito (X)", P: "Sujeto político (P)", C: "Capacidades (C)", T: "Tiempo (T)", O: "Justificación (O)",
};

const VEREDICTO_OPTS = [
  { value: "coherente" as const,              label: "Coherente" },
  { value: "requiere_ajuste" as const,        label: "Requiere ajuste" },
  { value: "requiere_investigacion" as const, label: "Requiere investigación" },
];

const VEREDICTO_DESC: Record<ContrasteXPCTO["veredicto"], string> = {
  coherente:              "El entorno apoya esta variable. No genera necesidades de investigación en F3.",
  requiere_ajuste:        "Hay fricción moderada. F3 investigará cómo gestionarla.",
  requiere_investigacion: "Riesgo importante o información insuficiente. F3 priorizará esta variable.",
};

const VEREDICTO_BADGE = {
  coherente:              "bg-transparent border border-green-eske-60 text-green-eske-80 dark:border-[#7BC47C] dark:text-[#7BC47C]",
  // text-black-eske (no amarillo): amarillo sobre fondo transparente no alcanza 4.5:1 (WCAG AA).
  requiere_ajuste:        "bg-transparent border border-yellow-eske-60 text-black-eske dark:border-yellow-eske-40 dark:text-yellow-eske-70",
  requiere_investigacion: "bg-transparent border border-red-eske-60 text-red-eske-80 dark:border-orange-eske dark:text-orange-eske",
} as const;

function M2Panel({ items, editable, onChange }: {
  items: ContrasteXPCTO[];
  editable: boolean;
  onChange: (updated: ContrasteXPCTO[]) => void;
}) {
  const update = (i: number, patch: Partial<ContrasteXPCTO>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  if (!items.length)
    return <p className="text-sm text-gray-eske-50 italic text-center py-4">Generando contraste XPCTO…</p>;

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.dimension} className="bg-white-eske dark:bg-[#1A3347] rounded-lg p-3 border border-gray-eske-20 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-black-eske dark:text-white">
              {XPCTO_LABELS[item.dimension] ?? item.dimension}
            </span>
            {editable ? (
              <SelectField
                value={item.veredicto}
                onChange={(v) => update(i, { veredicto: v })}
                options={VEREDICTO_OPTS}
              />
            ) : (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm shrink-0 ${VEREDICTO_BADGE[item.veredicto]}`}>
                {VEREDICTO_OPTS.find((o) => o.value === item.veredicto)?.label}
              </span>
            )}
          </div>
          {/* Description spans full card width — two lines split at period */}
          <DescTwoLines text={VEREDICTO_DESC[item.veredicto]} className="text-xs text-bluegreen-eske dark:text-blue-eske-20 text-right" />
          {editable ? (
            <InlineEdit
              value={item.argumentacion}
              onChange={(v) => update(i, { argumentacion: v })}
              placeholder="Argumentación del veredicto…"
              rows={3}
            />
          ) : (
            <p className="text-sm text-black-eske-80 dark:text-[#C5D8E8] leading-relaxed">{item.argumentacion}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── M3 ────────────────────────────────────────────────────────────────────────

const NIVEL_RIESGO_OPTS = [
  { value: "rojo" as const,  label: "Veto inmediato" },
  { value: "ambar" as const, label: "Riesgo condicional" },
  { value: "verde" as const, label: "Riesgo bajo" },
];

const NIVEL_RIESGO_DESC: Record<ActorVetoF2["nivelRiesgo"], string> = {
  rojo:  "Alta probabilidad de bloqueo. Requiere estrategia de neutralización antes de avanzar.",
  ambar: "Puede activarse bajo ciertas condiciones. Requiere monitoreo activo en F3.",
  verde: "Posición no amenazante en este momento. Sin acción urgente.",
};

const NIVEL_DOT = { rojo: "bg-red-eske", ambar: "bg-yellow-eske-70", verde: "bg-green-eske-60" } as const;

function M3Panel({ actores, editable, onChange }: {
  actores: ActorVetoF2[];
  editable: boolean;
  onChange: (updated: ActorVetoF2[]) => void;
}) {
  const update = (i: number, patch: Partial<ActorVetoF2>) => {
    const next = [...actores];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...actores, { actorId: crypto.randomUUID(), nombre: "", tipo: "", nivelRiesgo: "ambar", capacidadVeto: "", motivacion: "", requiereInvestigacion: false }]);
  const remove = (i: number) => onChange(actores.filter((_, idx) => idx !== i));

  if (!actores.length && !editable)
    return <p className="text-sm text-gray-eske-50 italic text-center py-4">Sin actores de veto identificados.</p>;

  return (
    <div className="space-y-3">
      {actores.map((actor, i) => (
        <div key={actor.actorId ?? i} className="bg-white-eske dark:bg-[#1A3347] rounded-lg p-3 border border-gray-eske-20 dark:border-white/10 space-y-2">
          {editable ? (
            <>
              {/* Two-column layout: dot+nombre LEFT, select+X+desc RIGHT */}
              <div className="flex items-start gap-2">
                {/* LEFT: dot + nombre */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${NIVEL_DOT[actor.nivelRiesgo]}`} aria-hidden />
                  <input
                    type="text"
                    value={actor.nombre}
                    onChange={(e) => update(i, { nombre: e.target.value })}
                    placeholder="Nombre del actor"
                    className="flex-1 text-sm font-semibold bg-transparent border-b border-gray-eske-20 dark:border-white/20 focus:outline-none py-0.5 text-black-eske dark:text-white placeholder:font-normal placeholder:text-gray-eske-40"
                  />
                </div>
                {/* RIGHT: select + delete button */}
                <div className="flex items-center gap-1 shrink-0">
                  <SelectField value={actor.nivelRiesgo} onChange={(v) => update(i, { nivelRiesgo: v })} options={NIVEL_RIESGO_OPTS} />
                  <button type="button" onClick={() => remove(i)} aria-label="Eliminar actor" className="text-gray-eske-60 dark:text-[#9AAEBE] hover:text-red-eske dark:hover:text-red-eske transition-colors cursor-pointer shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Description at full card width — two lines split at period */}
              <DescTwoLines text={NIVEL_RIESGO_DESC[actor.nivelRiesgo]} className="text-[10px] text-bluegreen-eske dark:text-blue-eske-20 text-right" />
            </>
          ) : (
            <>
              {/* Row 1 (lectura): descripción de nivel */}
              <DescTwoLines text={NIVEL_RIESGO_DESC[actor.nivelRiesgo]} className="text-[10px] text-gray-eske-50 dark:text-[#6D8294] leading-snug" />
              {/* Row 2 (lectura): dot + nombre + tipo */}
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${NIVEL_DOT[actor.nivelRiesgo]}`} aria-hidden />
                <span className="text-sm font-semibold text-black-eske dark:text-white">{actor.nombre}</span>
                <span className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">{actor.tipo}</span>
              </div>
            </>
          )}
          {editable ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={actor.tipo}
                onChange={(e) => update(i, { tipo: e.target.value })}
                placeholder="Tipo de actor (ej. Partido político, Sindicato…)"
                className="w-full text-xs bg-transparent border-b border-gray-eske-20 dark:border-white/20 focus:outline-none py-0.5 text-black-eske dark:text-white placeholder:text-gray-eske-40"
              />
              <InlineEdit value={actor.capacidadVeto} onChange={(v) => update(i, { capacidadVeto: v })} placeholder="Capacidad de veto…" rows={2} />
              <InlineEdit value={actor.motivacion}    onChange={(v) => update(i, { motivacion: v })}    placeholder="Motivación…"          rows={2} />
              <label className="flex items-center gap-2 text-xs text-gray-eske-60 dark:text-[#9AAEBE] cursor-pointer">
                <input type="checkbox" checked={actor.requiereInvestigacion} onChange={(e) => update(i, { requiereInvestigacion: e.target.checked })} className="w-3.5 h-3.5 accent-bluegreen-eske" />
                Requiere investigación de campo
              </label>
            </div>
          ) : (
            <>
              <p className="text-xs text-black-eske-80 dark:text-[#C5D8E8]"><span className="font-medium">Capacidad:</span> {actor.capacidadVeto}</p>
              <p className="text-xs text-gray-eske-70 dark:text-[#9AAEBE]"><span className="font-medium">Motivación:</span> {actor.motivacion}</p>
              {actor.requiereInvestigacion && (
                <span className="inline-block text-xs px-2 py-0.5 bg-orange-eske-10 text-orange-eske-80 rounded-full dark:bg-orange-eske/20">Requiere investigación de campo</span>
              )}
            </>
          )}
        </div>
      ))}
      {editable && (
        <button type="button" onClick={add} className="text-xs font-semibold text-bluegreen-eske dark:text-blue-eske-20 hover:text-bluegreen-eske/80 flex items-center gap-1 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
          </svg>
          Añadir actor
        </button>
      )}
    </div>
  );
}

// ── M4 ────────────────────────────────────────────────────────────────────────

const URGENCIA_OPTS = [
  { value: "alta" as const, label: "Alta" },
  { value: "media" as const, label: "Media" },
  { value: "baja" as const, label: "Baja" },
];
const RESOLUCION_OPTS = URGENCIA_OPTS;

const DESTINO_OPTS = [
  { value: "F3" as const,  label: "F3 — Investigación" },
  { value: "SIP" as const, label: "SIP (largo plazo)" },
];

const URGENCIA_DESC: Record<IncertidumbreF2["urgencia"], string> = {
  alta:  "Bloquea el avance. Debe resolverse al inicio de F3.",
  media: "Importante pero no inmediato. Puede abordarse durante F3.",
  baja:  "Deseable conocer, pero no crítico para este ciclo.",
};

const RESOLUCION_DESC: Record<IncertidumbreF2["resolucion"], string> = {
  alta:  "El equipo puede obtenerla directamente en campo.",
  media: "Requiere acceso específico o fuentes especializadas.",
  baja:  "Difícil de resolver — requiere tiempo o acceso privilegiado.",
};

const DESTINO_DESC: Record<IncertidumbreF2["destino"], string> = {
  F3:  "Esta incertidumbre será resuelta en la fase de investigación.",
  SIP: "Esta incertidumbre amerita formar parte del Sistema de Investigación Permanente.",
};

const NIVEL_BADGE = {
  alta:  "bg-transparent border border-red-eske-60 text-red-eske-80 dark:border-orange-eske dark:text-orange-eske",
  // text-black-eske (no amarillo): amarillo sobre fondo transparente no alcanza 4.5:1 (WCAG AA).
  media: "bg-transparent border border-yellow-eske-60 text-black-eske dark:border-yellow-eske-40 dark:text-yellow-eske-70",
  baja:  "bg-transparent border border-green-eske-60 text-green-eske-80 dark:border-green-eske-40 dark:text-green-eske-40",
} as const;

function M4Panel({ items, editable, onChange }: {
  items: IncertidumbreF2[];
  editable: boolean;
  onChange: (updated: IncertidumbreF2[]) => void;
}) {
  const update = (i: number, patch: Partial<IncertidumbreF2>) => {
    const next = [...items]; next[i] = { ...next[i], ...patch }; onChange(next);
  };
  const add    = () => onChange([...items, { descripcion: "", urgencia: "media", resolucion: "media", destino: "F3" }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  if (!items.length && !editable)
    return <p className="text-sm text-gray-eske-50 italic text-center py-4">Sin incertidumbres registradas.</p>;

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="relative bg-white-eske dark:bg-[#1A3347] rounded-lg p-3 border border-gray-eske-20 dark:border-white/10 space-y-2">
          {editable && (
            <button type="button" onClick={() => remove(i)} aria-label="Eliminar incertidumbre" className="absolute top-2 right-2 text-gray-eske-60 dark:text-[#9AAEBE] hover:text-red-eske dark:hover:text-red-eske transition-colors cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {editable ? (
            <>
              <InlineEdit value={item.descripcion} onChange={(v) => update(i, { descripcion: v })} placeholder="Descripción de la incertidumbre…" rows={2} className="w-full pr-5" />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-gray-eske-50 dark:text-[#6D8294] mb-1">Urgencia</p>
                  <SelectField value={item.urgencia}   onChange={(v) => update(i, { urgencia: v })}   options={URGENCIA_OPTS} />
                  <DescTwoLines text={URGENCIA_DESC[item.urgencia]} className="text-[10px] text-bluegreen-eske dark:text-blue-eske-20 mt-1" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-eske-50 dark:text-[#6D8294] mb-1">Resolución</p>
                  <SelectField value={item.resolucion} onChange={(v) => update(i, { resolucion: v })} options={RESOLUCION_OPTS} />
                  <DescTwoLines text={RESOLUCION_DESC[item.resolucion]} className="text-[10px] text-bluegreen-eske dark:text-blue-eske-20 mt-1" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-eske-50 dark:text-[#6D8294] mb-1">Destino</p>
                  <SelectField value={item.destino}    onChange={(v) => update(i, { destino: v })}    options={DESTINO_OPTS} />
                  <DescTwoLines text={DESTINO_DESC[item.destino]} className="text-[10px] text-bluegreen-eske dark:text-blue-eske-20 mt-1" />
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-black-eske dark:text-white">{item.descripcion}</p>
              <div className="flex flex-wrap gap-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${NIVEL_BADGE[item.urgencia]}`}>Urgencia {item.urgencia}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${NIVEL_BADGE[item.resolucion]}`}>Resolución {item.resolucion}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.destino === "F3" ? "bg-green-eske-10 text-green-eske-80 dark:bg-green-eske/20 dark:text-[#7BC47C]" : "bg-gray-eske-20 text-gray-eske-70 dark:bg-white/10 dark:text-[#9AAEBE]"}`}>
                  → {item.destino === "F3" ? "F3 — Investigación" : "SIP (largo plazo)"}
                </span>
              </div>
            </>
          )}
        </div>
      ))}
      {editable && (
        <button type="button" onClick={add} className="text-xs font-semibold text-bluegreen-eske dark:text-blue-eske-20 hover:text-bluegreen-eske/80 flex items-center gap-1 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
          </svg>
          Añadir incertidumbre
        </button>
      )}
    </div>
  );
}

// ── M5 ────────────────────────────────────────────────────────────────────────

function M5Panel({ hei, pip, editable, onHEIChange, onPIPChange }: {
  hei: HEIF2; pip: PIPItem[]; editable: boolean;
  onHEIChange: (h: HEIF2) => void; onPIPChange: (p: PIPItem[]) => void;
}) {
  const updatePIP   = (i: number, patch: Partial<PIPItem>) => { const n = [...pip]; n[i] = { ...n[i], ...patch }; onPIPChange(n); };
  const addPIP      = () => onPIPChange([...pip, { pipItemId: crypto.randomUUID(), numero: pip.length + 1, pregunta: "", metodo: "", vinculoHito: "", orden: pip.length + 1, profundidad: "exploratoria" }]);
  const removePIP   = (i: number) => onPIPChange(pip.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, numero: idx + 1 })));

  const isEmpty = !hei.tensionCentral && !hei.contexto && pip.length === 0;

  if (isEmpty && !editable) {
    return (
      <div className="rounded-xl border border-yellow-eske-60 dark:border-yellow-eske-40 bg-yellow-eske-10/40 dark:bg-yellow-eske/5 p-4 text-sm text-black-eske-80 dark:text-[#C5D8E8]">
        No se generó contenido para este motor. Puedes llenarlo manualmente aquí o relanzar el análisis completo desde el principio.
      </div>
    );
  }

  return (
    <>
    {isEmpty && editable && (
      <div className="rounded-xl border border-yellow-eske-60 dark:border-yellow-eske-40 bg-yellow-eske-10/40 dark:bg-yellow-eske/5 px-4 py-3 mb-3 text-sm text-black-eske-80 dark:text-[#C5D8E8]">
        No se generó contenido para este motor. Puedes llenarlo manualmente aquí o relanzar el análisis completo desde el principio.
      </div>
    )}
    <div className="space-y-4">
      {/* HEI */}
      <div className="rounded-xl p-4 bg-bluegreen-eske-10/60 border-l-4 border-bluegreen-eske dark:bg-bluegreen-eske/10 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-bluegreen-eske-70 dark:text-blue-eske-20">Hipótesis Estratégica Inicial</p>
        {editable ? (
          <>
            <div><FieldLabel>Tensión central</FieldLabel>
              <InlineEdit value={hei.tensionCentral} onChange={(v) => onHEIChange({ ...hei, tensionCentral: v })} placeholder="La tensión política central del escenario…" rows={2} />
            </div>
            <div><FieldLabel>Contexto</FieldLabel>
              <InlineEdit value={hei.contexto} onChange={(v) => onHEIChange({ ...hei, contexto: v })} placeholder="Descripción del entorno inmediato…" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Condiciones favorables</FieldLabel>
                <ul className="space-y-1 mb-1">
                  {hei.condicionesFavorables.map((c, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-green-eske-70 shrink-0 select-none">•</span>
                      <input
                        value={c}
                        onChange={(e) => { const a = [...hei.condicionesFavorables]; a[i] = e.target.value; onHEIChange({ ...hei, condicionesFavorables: a }); }}
                        className="flex-1 text-xs bg-transparent border-b border-gray-eske-20 dark:border-white/10 focus:outline-none focus:border-bluegreen-eske text-black-eske dark:text-[#C5D8E8] py-0.5"
                      />
                      <button type="button" onClick={() => onHEIChange({ ...hei, condicionesFavorables: hei.condicionesFavorables.filter((_, j) => j !== i) })} aria-label="Eliminar" className="text-gray-eske-60 dark:text-[#9AAEBE] hover:text-red-eske dark:hover:text-red-eske shrink-0 transition-colors cursor-pointer">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => onHEIChange({ ...hei, condicionesFavorables: [...hei.condicionesFavorables, ""] })} className="text-xs text-bluegreen-eske dark:text-blue-eske-20 hover:underline">+ Añadir condición</button>
              </div>
              <div>
                <FieldLabel>Condiciones adversas</FieldLabel>
                <ul className="space-y-1 mb-1">
                  {hei.condicionesAdversas.map((c, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-red-eske-70 dark:text-orange-eske shrink-0 select-none">•</span>
                      <input
                        value={c}
                        onChange={(e) => { const a = [...hei.condicionesAdversas]; a[i] = e.target.value; onHEIChange({ ...hei, condicionesAdversas: a }); }}
                        className="flex-1 text-xs bg-transparent border-b border-gray-eske-20 dark:border-white/10 focus:outline-none focus:border-bluegreen-eske text-black-eske dark:text-[#C5D8E8] py-0.5"
                      />
                      <button type="button" onClick={() => onHEIChange({ ...hei, condicionesAdversas: hei.condicionesAdversas.filter((_, j) => j !== i) })} aria-label="Eliminar" className="text-gray-eske-60 dark:text-[#9AAEBE] hover:text-red-eske dark:hover:text-red-eske shrink-0 transition-colors cursor-pointer">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => onHEIChange({ ...hei, condicionesAdversas: [...hei.condicionesAdversas, ""] })} className="text-xs text-bluegreen-eske dark:text-blue-eske-20 hover:underline">+ Añadir condición</button>
              </div>
            </div>
            <div><FieldLabel>Premisa estratégica</FieldLabel>
              <InlineEdit value={hei.premisaEstrategica} onChange={(v) => onHEIChange({ ...hei, premisaEstrategica: v })} placeholder="Si X… entonces Y es posible porque…" rows={2} />
            </div>
          </>
        ) : (
          <>
            <p className="font-semibold text-sm text-black-eske dark:text-white">{hei.tensionCentral}</p>
            <p className="text-sm text-black-eske-80 dark:text-[#C5D8E8]">{hei.contexto}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-semibold text-green-eske-70 dark:text-[#7BC47C] mb-1">Condiciones favorables</p>
                <ul className="space-y-1 list-disc list-inside">{hei.condicionesFavorables.map((c, i) => <li key={i} className="text-black-eske-80 dark:text-[#C5D8E8]">{c}</li>)}</ul>
              </div>
              <div>
                <p className="font-semibold text-red-eske-70 dark:text-orange-eske mb-1">Condiciones adversas</p>
                <ul className="space-y-1 list-disc list-inside">{hei.condicionesAdversas.map((c, i) => <li key={i} className="text-black-eske-80 dark:text-[#C5D8E8]">{c}</li>)}</ul>
              </div>
            </div>
            <p className="text-xs italic text-black-eske-70 dark:text-[#9AAEBE] border-t border-bluegreen-eske/30 pt-2">{hei.premisaEstrategica}</p>
          </>
        )}
      </div>

      {/* PIP */}
      <div className="rounded-xl p-4 bg-gray-eske-10 dark:bg-[#1A3347] border-t-2 border-bluegreen-eske">
        <p className="text-xs font-bold uppercase tracking-wider text-bluegreen-eske-70 dark:text-blue-eske-20 mb-3">Programa de Investigación Profunda → F3</p>
        <ol className="space-y-3">
          {pip.map((item, i) => (
            <li key={item.numero} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-bluegreen-eske text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{item.numero}</span>
              <div className="flex-1 min-w-0 space-y-1.5">
                {editable ? (
                  <>
                    <InlineEdit value={item.pregunta}    onChange={(v) => updatePIP(i, { pregunta: v })}    placeholder="Pregunta de investigación específica…" rows={2} />
                    <InlineEdit value={item.metodo}      onChange={(v) => updatePIP(i, { metodo: v })}      placeholder="Método (ej. Encuesta, Entrevistas…)"   rows={1} />
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <InlineEdit value={item.vinculoHito} onChange={(v) => updatePIP(i, { vinculoHito: v })} placeholder="Vínculo al hito XPCTO…" rows={1} />
                      </div>
                      <button type="button" onClick={() => removePIP(i)} aria-label="Eliminar pregunta" className="text-gray-eske-60 dark:text-[#9AAEBE] hover:text-red-eske dark:hover:text-red-eske transition-colors cursor-pointer shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <select
                      value={item.profundidad ?? "exploratoria"}
                      onChange={(e) => updatePIP(i, { profundidad: e.target.value as PIPItem["profundidad"] })}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-white focus:outline-none focus:ring-1 focus:ring-bluegreen-eske"
                    >
                      <option value="exploratoria">Exploratoria</option>
                      <option value="confirmatoria">Confirmatoria</option>
                      <option value="descriptiva">Descriptiva</option>
                    </select>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium text-black-eske dark:text-white leading-snug">{item.pregunta}</p>
                      {item.profundidad && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-bluegreen-eske-10 text-bluegreen-eske-70 dark:bg-bluegreen-eske-80/20 dark:text-blue-eske-20 shrink-0">
                          {item.profundidad}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-black-eske-80 dark:text-white">Método: {item.metodo}</p>
                    <p className="text-xs text-bluegreen-eske-70 dark:text-white">Vínculo: {item.vinculoHito}</p>
                    {item.orden !== undefined && item.orden !== item.numero && (
                      <p className="text-xs text-orange-eske-60 dark:text-orange-eske-40">
                        Prioridad de ejecución: {item.orden}
                      </p>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
        {editable && (
          <button type="button" onClick={addPIP} className="mt-3 text-xs font-semibold text-bluegreen-eske dark:text-blue-eske-20 hover:text-bluegreen-eske/80 flex items-center gap-1 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
            </svg>
            Añadir pregunta
          </button>
        )}
      </div>
    </div>
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

const MOTOR_LABELS = ["M2 — Contraste XPCTO", "M3 — Semáforo de Veto", "M4 — Incertidumbres", "M5 — Hipótesis + PIP"];

function GeneratingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-bluegreen-eske animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">Generando análisis por motores con Claude…</p>
      </div>
      {MOTOR_LABELS.map((label, i) => (
        <div key={i} className="rounded-xl border border-gray-eske-20 dark:border-white/10 p-4 animate-pulse">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-eske-20 dark:bg-white/10 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 w-8 bg-gray-eske-20 dark:bg-white/10 rounded" />
              <p className="text-xs text-gray-eske-40 dark:text-[#6D8294]">{label}</p>
            </div>
          </div>
          <div className="space-y-2 ml-[22px]">
            <div className="h-3 bg-gray-eske-20 dark:bg-white/10 rounded w-full" />
            <div className="h-3 bg-gray-eske-20 dark:bg-white/10 rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MotoresSequentialView({
  projectId,
  draftDVS,
  motorAprobaciones,
  isGenerating,
  generationError,
  onRetry,
  retryLabel = "Reintentar análisis",
  onApprove,
  onDraftChange,
  onSaveEdit,
  editMode = false,
}: MotoresSequentialViewProps) {
  // Accordion: in editMode all start expanded; otherwise M2 only
  const [expanded, setExpanded] = useState<Record<MotorId, boolean>>(
    editMode
      ? { M2: true, M3: true, M4: true, M5: true }
      : { M2: true, M3: false, M4: false, M5: false }
  );
  // Re-editing: tracks which approved motors are open for editing (not used in editMode)
  const [reEditing, setReEditing] = useState<Partial<Record<MotorId, boolean>>>({});

  const handleApprove = (motor: MotorId) => {
    const idx = ORDER.indexOf(motor);
    const next = ORDER[idx + 1] as MotorId | undefined;
    setExpanded((prev) => ({ ...prev, [motor]: false, ...(next ? { [next]: true } : {}) }));
    onApprove(motor);
  };

  const handleStartReEdit = (motor: MotorId) => {
    setReEditing((prev) => ({ ...prev, [motor]: true }));
    setExpanded((prev) => ({ ...prev, [motor]: true }));
  };

  const handleSaveReEdit = (motor: MotorId) => {
    setReEditing((prev) => ({ ...prev, [motor]: false }));
    setExpanded((prev) => ({ ...prev, [motor]: false }));
    onSaveEdit?.(motor);
  };

  const toggleExpand = (motor: MotorId, state: MotorState) => {
    if (state === "locked") return;
    setExpanded((prev) => ({ ...prev, [motor]: !prev[motor] }));
  };

  // Sin draft previo (primer análisis): pantalla completa de carga/error —
  // no hay nada que mostrar mientras tanto.
  if (!draftDVS) {
    if (isGenerating) return <GeneratingSkeleton />;
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        {generationError ? (
          <>
            <div className="w-10 h-10 rounded-full bg-red-eske-10 dark:bg-red-eske/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-eske-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-black-eske dark:text-white mb-1">Error al generar los motores</p>
              <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] max-w-xs">{generationError}</p>
            </div>
            {onRetry && (
              <button type="button" onClick={onRetry} className="px-4 py-2 bg-bluegreen-eske text-white rounded-lg text-sm font-semibold hover:bg-bluegreen-eske/90 transition-colors">
                {retryLabel}
              </button>
            )}
          </>
        ) : <GeneratingSkeleton />}
      </div>
    );
  }

  // Hay un draft previo (de un M1 anterior o de un intento previo): se
  // mantiene visible y usable mientras se regenera o si la regeneración
  // falla — nunca se blanquea la pantalla teniendo contenido válido que mostrar.
  return (
    <div className="space-y-2 pb-4">
      {isGenerating && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-bluegreen-eske-30 dark:border-bluegreen-eske/40 bg-bluegreen-eske/5 dark:bg-bluegreen-eske/10 text-xs text-bluegreen-eske-70 dark:text-blue-eske-20">
          <span className="w-3.5 h-3.5 border-2 border-bluegreen-eske border-t-transparent rounded-full animate-spin shrink-0" />
          Actualizando análisis… lo que ves abajo es la última versión válida.
        </div>
      )}
      {!isGenerating && generationError && (
        <div className="flex items-start justify-between gap-3 px-4 py-2.5 rounded-xl border border-red-eske-30 dark:border-red-eske/30 bg-red-eske-10 dark:bg-red-eske/10 text-xs text-red-eske-70 dark:text-red-eske-40">
          <span className="min-w-0">
            No se pudo actualizar: {generationError} Lo que ves abajo es la última versión válida.
          </span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="shrink-0 font-semibold hover:underline whitespace-nowrap">
              {retryLabel}
            </button>
          )}
        </div>
      )}
      {MOTORS.map((motor) => {
        const state      = getMotorState(motor.id, motorAprobaciones);
        const isActive   = !editMode && state === "active";
        const isApproved = state === "approved";
        const isLocked   = !editMode && state === "locked";
        const isExpanded = expanded[motor.id];
        const isReEditing = !editMode && isApproved && !!reEditing[motor.id];

        // Border/background per state
        const containerCls = editMode
          ? "border-bluegreen-eske-30 dark:border-bluegreen-eske/40"
          : isLocked
            ? "border-gray-eske-20 dark:border-white/5 opacity-50"
            : isApproved
              ? "border-green-eske-30 dark:border-green-eske/30"
              : "border-bluegreen-eske-30 dark:border-bluegreen-eske/40";

        return (
          <div key={motor.id} className={`rounded-xl border transition-all ${containerCls}`}>
            {/* ── Accordion header ── */}
            {/* div en vez de button para permitir button anidado (badge "Aprobado") */}
            <div
              role="button"
              tabIndex={isLocked ? -1 : 0}
              aria-expanded={isExpanded}
              aria-disabled={isLocked}
              onClick={() => toggleExpand(motor.id, state)}
              onKeyDown={(e) => {
                if (!isLocked && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  toggleExpand(motor.id, state);
                }
              }}
              className={`w-full px-4 py-3 flex items-start justify-between gap-3 text-left transition-colors rounded-xl ${
                isLocked ? "cursor-default" : "hover:bg-gray-eske-10/50 dark:hover:bg-white/[0.03] cursor-pointer"
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {/* State dot */}
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
                  isApproved ? "bg-green-eske-60" : isActive ? "bg-bluegreen-eske" : "bg-gray-eske-30 dark:bg-white/20"
                }`} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-eske-50 dark:text-[#6D8294]">{motor.id}</p>
                  <div className={`text-sm font-semibold leading-snug flex items-center gap-1.5 ${isLocked ? "text-gray-eske-40 dark:text-[#6D8294]" : "text-black-eske dark:text-white"}`}>
                    {motor.label}
                    {motor.tooltip && (
                      <span onClick={(e) => e.stopPropagation()}>
                        <InfoTooltip content={motor.tooltip} />
                      </span>
                    )}
                  </div>
                  {/* Summary — shown when collapsed and approved/active */}
                  {!isExpanded && !isLocked && (
                    <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5 truncate max-w-sm">
                      {getMotorSummary(motor.id, draftDVS)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!editMode && isActive && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-transparent border border-brown-eske-60 text-brown-eske-80 dark:border-yellow-eske-40 dark:text-yellow-eske-40">
                    Aprobación pendiente
                  </span>
                )}
                {!editMode && isApproved && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-transparent border border-green-eske-60 text-green-eske-80 dark:border-green-eske-40 dark:text-green-eske-40">
                    Aprobado
                  </span>
                )}
                {!editMode && isApproved && !isReEditing && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleStartReEdit(motor.id); }}
                    aria-label={`Editar ${motor.label}`}
                    className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-bluegreen-eske text-white hover:bg-bluegreen-eske/90 transition-colors"
                  >
                    Editar
                  </button>
                )}
                {!editMode && isApproved && isReEditing && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSaveReEdit(motor.id); }}
                    aria-label={`Guardar cambios en ${motor.label}`}
                    className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-bluegreen-eske text-white hover:bg-bluegreen-eske/90 transition-colors"
                  >
                    Guardar
                  </button>
                )}
                {!isLocked && (
                  <svg
                    className={`w-4 h-4 text-gray-eske-40 dark:text-[#6D8294] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
            </div>

            {/* ── Accordion body ── */}
            {isExpanded && !isLocked && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-eske-20/60 dark:border-white/5 pt-3">
                {!editMode && !isApproved && (
                  <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">{motor.description}</p>
                )}
                {!editMode && isReEditing && (
                  <p className="text-xs text-orange-eske-60 dark:text-orange-eske-40">
                    Editando motor aprobado — los motores posteriores no se actualizan automáticamente.
                  </p>
                )}

                {motor.id === "M2" && (
                  <M2Panel
                    items={draftDVS.contrasteXPCTO}
                    editable={editMode || isActive || isReEditing}
                    onChange={(updated) => onDraftChange({ ...draftDVS, contrasteXPCTO: updated })}
                  />
                )}
                {motor.id === "M3" && (
                  <M3Panel
                    actores={draftDVS.semaforo}
                    editable={editMode || isActive || isReEditing}
                    onChange={(updated) => onDraftChange({ ...draftDVS, semaforo: updated })}
                  />
                )}
                {motor.id === "M4" && (
                  <M4Panel
                    items={draftDVS.incertidumbres}
                    editable={editMode || isActive || isReEditing}
                    onChange={(updated) => onDraftChange({ ...draftDVS, incertidumbres: updated })}
                  />
                )}
                {motor.id === "M5" && (
                  <M5Panel
                    hei={draftDVS.hei}
                    pip={draftDVS.pip}
                    editable={editMode || isActive || isReEditing}
                    onHEIChange={(h) => onDraftChange({ ...draftDVS, hei: h })}
                    onPIPChange={(p) => onDraftChange({ ...draftDVS, pip: p })}
                  />
                )}

                {isActive && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleApprove(motor.id)}
                      className="px-5 py-1.5 bg-bluegreen-eske text-white rounded-full text-sm font-semibold hover:bg-bluegreen-eske/90 transition-colors"
                    >
                      {APPROVE_LABEL[motor.id]}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
