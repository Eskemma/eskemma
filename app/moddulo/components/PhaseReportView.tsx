// app/moddulo/components/PhaseReportView.tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PhaseId, Dictamen, XPCTO } from "@/types/moddulo.types";
import { PHASE_NAMES } from "@/types/moddulo.types";
import { evaluarCriterios, getCriterioDeficiencia } from "@/lib/moddulo/criterios";

interface PhaseReportViewProps {
  phaseId: PhaseId;
  reportText: string | null;
  projectId: string;
  /** Si es false (borrador), muestra el banner de siguiente paso. Default: true */
  isCompleted?: boolean;
  onStartEdit?: () => void;
  className?: string;
  /** Dictamen de Coherencia XPCTO — solo F1 */
  dictamen?: Dictamen | null;
  /** Variables XPCTO actuales — solo F1 */
  xpcto?: Partial<XPCTO> | null;
}

function getReportLabel(phaseId: PhaseId): string {
  const labels: Partial<Record<PhaseId, string>> = {
    proposito: "Reporte de Propósito F1",
    exploracion: "Resultado Exploratorio",
    investigacion: "Reporte de Investigación",
    diagnostico: "Dictamen Diagnóstico",
    estrategia: "Diseño Estratégico",
    tactica: "Plan Táctico",
    gerencia: "Reporte de Gerencia",
    seguimiento: "Seguimiento de KPIs",
    evaluacion: "Evaluación Final",
  };
  return labels[phaseId] ?? PHASE_NAMES[phaseId];
}

function getNextStep(phaseId: PhaseId): { action: string; next: string } {
  const steps: Partial<Record<PhaseId, { action: string; next: string }>> = {
    exploracion: { action: "Cerrar Fase 2", next: "Fase 3 — Investigación" },
    investigacion: { action: "Cerrar Fase 3", next: "Fase 4 — Diagnóstico" },
    diagnostico: { action: "Cerrar Fase 4", next: "Fase 5 — Estrategia" },
    estrategia: { action: "Cerrar Fase 5", next: "Fase 6 — Táctica" },
    tactica: { action: "Cerrar Fase 6", next: "Fase 7 — Gerencia" },
  };
  return steps[phaseId] ?? { action: `Cerrar ${PHASE_NAMES[phaseId]}`, next: "la siguiente fase" };
}

function getFooterText(phaseId: PhaseId): string {
  const texts: Partial<Record<PhaseId, string>> = {
    proposito: "Documento rector de la Fase 1. Úsalo como referencia para las siguientes fases.",
    exploracion: "Resultado exploratorio de la Fase 2. Documenta el escaneo situacional PEST-L del proyecto.",
    investigacion: "Reporte de investigación de campo. Valida o refuta la hipótesis planteada en F2.",
    diagnostico: "Dictamen diagnóstico de la Fase 4. Base para el diseño estratégico.",
    estrategia: "Diseño estratégico de la Fase 5. Define la narrativa y posicionamiento del proyecto.",
  };
  return texts[phaseId] ?? `Documento de referencia — ${PHASE_NAMES[phaseId]}.`;
}

// ==========================================
// SECCIÓN A — DICTAMEN DE COHERENCIA XPCTO
// ==========================================

function DictamenSection({ dictamen }: { dictamen: Dictamen | null | undefined }) {
  return (
    <div className="mt-6 pt-5 border-t border-gray-eske-20 dark:border-white/10">
      <h2 className="text-sm font-bold text-black-eske dark:text-[#EAF2F8] mb-4 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-bluegreen-eske/20 text-bluegreen-eske text-xs flex items-center justify-center font-bold shrink-0">A</span>
        Dictamen de Coherencia XPCTO
      </h2>
      {!dictamen?.cruces?.length ? (
        <p className="text-sm text-gray-eske-50 dark:text-[#9AAEBE] italic">
          Dictamen no disponible. Genera el reporte para calcularlo.
        </p>
      ) : (
        <div className="space-y-3">
          {dictamen.cruces.map((cruce) => (
            <div
              key={cruce.id}
              className="rounded-lg border border-gray-eske-20 dark:border-white/10 p-4 bg-gray-eske-10/40 dark:bg-[#112230]/40"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {cruce.veredicto === "coherente" ? (
                    <svg className="w-5 h-5 text-green-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Coherente">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-yellow-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Requiere ajuste">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-bluegreen-eske dark:text-[#6BA4C6]">{cruce.etiqueta}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      cruce.veredicto === "coherente"
                        ? "bg-green-eske/15 text-green-eske"
                        : "bg-yellow-eske/20 text-yellow-eske"
                    }`}>
                      {cruce.veredicto === "coherente" ? "Coherente" : "Requiere ajuste"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] italic mb-2">{cruce.pregunta}</p>
                  <p className="text-sm text-gray-eske-70 dark:text-[#C7D6E0] leading-relaxed">{cruce.argumentacion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// SECCIÓN B — CRITERIOS DE SUFICIENCIA
// ==========================================

function CriteriosSection({
  xpcto,
  dictamen,
  isCompleted,
}: {
  xpcto: Partial<XPCTO> | null | undefined;
  dictamen: Dictamen | null | undefined;
  isCompleted: boolean;
}) {
  const criterios = evaluarCriterios(xpcto, dictamen, isCompleted);

  return (
    <div className="mt-6 pt-5 border-t border-gray-eske-20 dark:border-white/10">
      <h2 className="text-sm font-bold text-black-eske dark:text-[#EAF2F8] mb-4 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-bluegreen-eske/20 text-bluegreen-eske text-xs flex items-center justify-center font-bold shrink-0">B</span>
        Panel de Criterios de Suficiencia
      </h2>
      <div className="space-y-2">
        {criterios.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-eske-10/40 dark:bg-[#112230]/40 border border-gray-eske-20/60 dark:border-white/5"
          >
            <span className="shrink-0 text-xs text-gray-eske-40 dark:text-[#6D8294] w-4 text-right">{c.id}</span>
            <span className="flex-1 text-sm text-gray-eske-70 dark:text-[#C7D6E0]">{c.nombre}</span>
            <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
              c.nivel === "Prioritario"
                ? "bg-bluegreen-eske/10 text-bluegreen-eske"
                : "bg-gray-eske-20 text-gray-eske-60 dark:text-[#9AAEBE]"
            }`}>
              {c.nivel}
            </span>
            <span className={`shrink-0 text-xs font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full ${
              c.estado === "resuelto"
                ? "bg-green-eske/15 text-green-eske"
                : c.nivel === "Prioritario"
                  ? "bg-red-eske/15 text-red-eske"
                  : "bg-yellow-eske/20 text-yellow-eske"
            }`}>
              {c.estado === "resuelto" ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  Resuelto
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                  Pendiente
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// SECCIÓN C — REGISTRO DE DEFICIENCIAS ACTIVAS (RDA)
// ==========================================

function RDASection({
  xpcto,
  dictamen,
  isCompleted,
}: {
  xpcto: Partial<XPCTO> | null | undefined;
  dictamen: Dictamen | null | undefined;
  isCompleted: boolean;
}) {
  const criterios = evaluarCriterios(xpcto, dictamen, isCompleted);
  const pendientes = criterios.filter((c) => c.estado === "pendiente");

  if (!pendientes.length) return null;

  return (
    <div className="mt-6 pt-5 border-t border-gray-eske-20 dark:border-white/10">
      <h2 className="text-sm font-bold text-black-eske dark:text-[#EAF2F8] mb-4 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-red-eske/20 text-red-eske text-xs flex items-center justify-center font-bold shrink-0">C</span>
        Registro de Deficiencias Activas (RDA)
      </h2>
      <div className="space-y-3">
        {pendientes.map((c) => {
          const def = getCriterioDeficiencia(c.id);
          return (
            <div
              key={c.id}
              className={`rounded-lg border p-4 ${
                c.nivel === "Prioritario"
                  ? "border-red-eske/30 bg-red-eske/5"
                  : "border-yellow-eske/30 bg-yellow-eske/5"
              }`}
            >
              <p className={`text-xs font-bold mb-1 ${c.nivel === "Prioritario" ? "text-red-eske" : "text-yellow-eske"}`}>
                Criterio {c.id} — {c.nombre}
              </p>
              <p className="text-sm text-gray-eske-70 dark:text-[#C7D6E0] mb-2">{def.descripcion}</p>
              <p className="text-xs text-bluegreen-eske dark:text-[#6BA4C6] font-medium">
                ↳ {def.rutaResolucion}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function PhaseReportView({
  phaseId,
  reportText,
  isCompleted = true,
  onStartEdit,
  className = "",
  dictamen,
  xpcto,
}: PhaseReportViewProps) {
  if (!reportText) {
    return (
      <div className={`flex flex-col bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 overflow-hidden ${className}`}>
        <div className="shrink-0 px-4 py-3 border-b border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/50 dark:bg-[#112230]/50 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-eske-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-gray-eske-60 dark:text-[#9AAEBE]">Reporte de {PHASE_NAMES[phaseId]}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-eske-10 dark:bg-[#112230] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-eske-30" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-eske-70 dark:text-[#9AAEBE] mb-2">Reporte no disponible</h3>
          <p className="text-sm text-gray-eske-50 dark:text-[#9AAEBE] mb-6 max-w-xs leading-relaxed">
            Esta fase fue cerrada sin un reporte diagnóstico guardado. Puedes editar las variables para continuar trabajando con Moddulo.
          </p>
          {onStartEdit && (
            <button
              onClick={onStartEdit}
              className="px-5 py-2.5 border border-bluegreen-eske text-bluegreen-eske rounded-lg text-sm font-medium hover:bg-bluegreen-eske/5 transition-colors"
            >
              Editar variables y continuar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 overflow-hidden ${className}`}>
      {/* Header del reporte */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-eske-20 dark:border-white/10 flex items-center justify-between bg-green-50 dark:bg-green-900/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-green-800 dark:text-green-300">{getReportLabel(phaseId)}</span>
        </div>
        <span className="text-xs text-green-600 font-medium">
          {isCompleted ? "Fase completada" : "Borrador generado"}
        </span>
      </div>

      {/* Contenido del reporte — scrollable */}
      <div className="flex-1 overflow-y-auto p-5 min-h-0">
        <div className="prose prose-sm max-w-none text-gray-800 dark:text-[#C7D6E0]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-base font-bold text-gray-900 dark:text-[#C7D6E0] mt-4 mb-2 first:mt-0 pb-1 border-b border-gray-200 dark:border-white/10">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-sm font-bold text-gray-800 dark:text-[#C7D6E0] mt-4 mb-2 first:mt-0">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-semibold text-bluegreen-eske dark:text-[#6BA4C6] mt-3 mb-1 first:mt-0">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="text-sm text-gray-700 dark:text-[#C7D6E0] leading-relaxed mb-3 last:mb-0">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-gray-900 dark:text-[#C7D6E0]">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-gray-600 dark:text-[#9AAEBE]">{children}</em>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-700 dark:text-[#C7D6E0]">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-gray-700 dark:text-[#C7D6E0]">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              hr: () => <hr className="border-gray-200 dark:border-white/10 my-4" />,
              table: ({ children }) => (
                <div className="overflow-x-auto my-3">
                  <table className="text-xs border-collapse w-full">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-gray-300 dark:border-white/10 px-3 py-1.5 bg-gray-100 dark:bg-[#112230] font-semibold text-gray-700 dark:text-[#C7D6E0] text-left">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border border-gray-300 dark:border-white/10 px-3 py-1.5 text-gray-700 dark:text-[#C7D6E0]">{children}</td>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-bluegreen-eske/40 pl-4 italic text-gray-600 dark:text-[#9AAEBE] my-3">{children}</blockquote>
              ),
            }}
          >
            {reportText}
          </ReactMarkdown>
        </div>

        {/* Banner de siguiente paso — solo cuando la fase aún no está cerrada */}
        {!isCompleted && phaseId !== "proposito" && (() => {
          const { action, next } = getNextStep(phaseId);
          return (
            <div className="mt-5 p-4 bg-bluegreen-eske/5 border border-bluegreen-eske/25 rounded-lg">
              <p className="text-xs font-bold uppercase tracking-wide text-bluegreen-eske mb-1">Siguiente paso</p>
              <p className="text-sm text-gray-700 dark:text-[#C7D6E0] leading-relaxed">
                Revisa el resultado. Cuando estés conforme, pulsa{" "}
                <strong className="text-black-eske dark:text-[#C7D6E0]">{action}</strong>{" "}
                en la parte superior para consolidar el análisis y avanzar a la{" "}
                <strong className="text-black-eske dark:text-[#C7D6E0]">{next}</strong>.
              </p>
            </div>
          );
        })()}

        {/* Secciones del EPP — solo para F1 Propósito */}
        {phaseId === "proposito" && (
          <>
            <DictamenSection dictamen={dictamen} />
            <CriteriosSection xpcto={xpcto} dictamen={dictamen} isCompleted={isCompleted} />
            <RDASection xpcto={xpcto} dictamen={dictamen} isCompleted={isCompleted} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/30 dark:bg-[#112230]/30 flex items-center justify-between">
        <p className="text-xs text-gray-eske-40 dark:text-[#6D8294]">
          {getFooterText(phaseId)}
        </p>
        {onStartEdit && (
          <button
            onClick={onStartEdit}
            className="text-xs font-medium text-bluegreen-eske hover:underline"
          >
            Editar variables
          </button>
        )}
      </div>
    </div>
  );
}
