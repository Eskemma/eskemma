// F3Onboarding.tsx — landing de F3, clon del patrón F1LandingView/F2LandingView.
"use client";

import type { ProjectType, Territorio } from "@/types/moddulo.types";

const TYPE_LABELS: Record<ProjectType, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

const MOTORES = [
  { code: "M1", title: "Gestor de tareas de investigación", desc: "Traduce el Programa de Investigación Profunda (PIP) heredado de F2 en un tablero de tareas concretas, y propone el canal más adecuado para cada una." },
  { code: "M2", title: "Receptor y validador de resultados", desc: "Organiza los resultados que van llegando por cada canal y los presenta para tu revisión y aprobación antes de que entren a la síntesis." },
  { code: "M3", title: "Síntesis de hallazgos", desc: "Cruza los resultados aprobados: identifica convergencias, contradicciones y vacíos residuales, y construye los insumos de FODA Propio y FODA de Adversarios." },
  { code: "M4", title: "Veredicto sobre la Hipótesis Estratégica Inicial", desc: "Contrasta la HEI de F2 con la evidencia acumulada y emite un veredicto: validada, ajustada o refutada." },
];

export default function F3Onboarding({
  projectName, projectType, projectTerritory, onComenzar,
}: {
  projectName: string;
  projectType: ProjectType;
  projectTerritory: Territorio | null;
  onComenzar: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start px-4 py-8 sm:py-12">
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske">F3 — Investigación</span>
          </div>
          {projectName && (
            <h1 className="text-xl sm:text-2xl font-bold text-black-eske dark:text-[#EAF2F8] leading-tight">
              {projectName}
            </h1>
          )}
          <div className="flex flex-wrap gap-1.5">
            {projectType && (
              <span className="px-2 py-0.5 bg-bluegreen-eske/10 text-bluegreen-eske dark:text-[#6BA4C6] rounded-full text-xs font-medium">
                {TYPE_LABELS[projectType] ?? projectType}
              </span>
            )}
            {projectTerritory?.nombre && (
              <span className="px-2 py-0.5 bg-gray-eske-10 dark:bg-white/10 text-gray-eske-70 dark:text-[#C5D8E8] rounded-full text-xs font-medium">
                {projectTerritory.nombre}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-black-eske-80 dark:text-[#C5D8E8] leading-relaxed">
          F3 es el gestor de investigación de Moddulo. No investiga directamente: coordina,
          distribuye, recibe y procesa. Traduce el Programa de Investigación Profunda (PIP) de
          F2 en tareas concretas, las asigna a los canales disponibles, sintetiza los resultados
          y emite el veredicto que F4 necesita para construir el diagnóstico estratégico.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-eske-50 dark:text-[#9AAEBE]">
            Los cuatro motores
          </p>
          <div className="space-y-2">
            {MOTORES.map((m) => (
              <div key={m.code}
                className="flex gap-3 p-3 rounded-lg bg-gray-eske-10/60 dark:bg-[#112230] border border-gray-eske-20 dark:border-white/10">
                <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full
                  bg-bluegreen-eske/10 text-bluegreen-eske text-xs font-bold">
                  {m.code}
                </span>
                <div>
                  <p className="text-xs font-semibold text-black-eske dark:text-[#EAF2F8]">{m.title}</p>
                  <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] leading-relaxed mt-0.5">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] leading-relaxed border-l-2 border-gray-eske-20 dark:border-white/10 pl-3">
          M1 propone qué apps del ecosistema activar, cuándo pedirte carga manual o vincular una
          fuente externa — siempre con tu aprobación explícita antes de activar cada canal.
        </p>

        <button
          onClick={onComenzar}
          className="w-full py-3 rounded-xl bg-bluegreen-eske text-white font-semibold text-sm
            hover:bg-bluegreen-eske/90 active:scale-[0.98] transition-all"
        >
          Comenzar Fase 3
        </button>
      </div>
    </div>
  );
}
