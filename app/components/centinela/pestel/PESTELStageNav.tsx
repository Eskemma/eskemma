// app/components/centinela/pestel/PESTELStageNav.tsx
// Horizontal stepper showing E1-E8 PESTEL stage progress.
// Placed just below the page header in each of the E4-E8 pages.
"use client";

import { useRouter } from "next/navigation";

interface PESTELStageNavProps {
  projectId: string;
  /** Highest stage the user has reached (project.currentStage). */
  currentStage: number;
  /** Stage number of the current page (4–8). */
  activeStage: number;
}

interface StageNode {
  /** Stage number used for comparison logic. Config group = 3 (always completed in E4+). */
  stageNum: number;
  label: string;
  shortLabel: string;
  route: string | null; // null = not navigable
}

const STAGES: StageNode[] = [
  { stageNum: 3,  label: "Configuración", shortLabel: "Config.", route: null },
  { stageNum: 4,  label: "Datos",          shortLabel: "Datos",   route: "datos" },
  { stageNum: 5,  label: "Análisis",        shortLabel: "Análisis", route: "analisis" },
  { stageNum: 6,  label: "Interpretación",  shortLabel: "Interpr.", route: "interpretacion" },
  { stageNum: 7,  label: "Informes",        shortLabel: "Informes", route: "informes" },
  { stageNum: 8,  label: "Monitoreo",       shortLabel: "Centinela",  route: "monitoreo" },
];

type NodeStatus = "completed" | "active" | "pending";

function getStatus(
  stageNum: number,
  currentStage: number,
  activeStage: number,
): NodeStatus {
  if (stageNum === activeStage) return "active";
  if (stageNum <= currentStage) return "completed";
  return "pending";
}

export default function PESTELStageNav({
  projectId,
  currentStage,
  activeStage,
}: PESTELStageNavProps) {
  const router = useRouter();

  return (
    <div className="bg-white-eske dark:bg-[#18324A] border-b border-gray-eske-20 dark:border-white/10">
      <div className="max-w-4xl mx-auto px-6 py-3">
        <nav aria-label="Progreso de etapas PESTEL">
          <ol className="flex items-center">
            {STAGES.map((stage, idx) => {
              const status = getStatus(stage.stageNum, currentStage, activeStage);
              const isClickable =
                status === "completed" && stage.route !== null;
              const isActive = status === "active";
              const isPending = status === "pending";

              const bubbleBase =
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors";
              const bubbleClass = [
                bubbleBase,
                isActive
                  ? "bg-bluegreen-eske text-white ring-4 ring-bluegreen-eske/20"
                  : status === "completed"
                  ? "bg-bluegreen-eske text-white"
                  : "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-60 dark:text-[#9AAEBE]",
              ].join(" ");

              const lineClass = [
                "flex-1 h-0.5 mx-2",
                status === "completed" || isActive
                  ? "bg-bluegreen-eske"
                  : "bg-gray-eske-20 dark:bg-[#21425E]",
              ].join(" ");

              const labelClass = [
                "text-xs font-medium hidden sm:block ml-2 truncate max-w-[80px]",
                isActive
                  ? "text-bluegreen-eske"
                  : status === "completed"
                  ? "text-bluegreen-eske-60"
                  : "text-gray-eske-60 dark:text-[#9AAEBE]",
              ].join(" ");

              const nodeContent = (
                <>
                  <span className={bubbleClass} aria-hidden="true">
                    {status === "completed" ? "✓" : stage.stageNum === 3 ? "1-3" : stage.stageNum}
                  </span>
                  <span className={labelClass}>{stage.shortLabel}</span>
                </>
              );

              return (
                <li
                  key={stage.stageNum}
                  className="flex items-center flex-1 last:flex-none"
                  aria-current={isActive ? "step" : undefined}
                >
                  <div className="flex items-center shrink-0">
                    {isClickable ? (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/centinela/pestel/${projectId}/${stage.route}`,
                          )
                        }
                        className="flex items-center hover:opacity-80 transition-opacity
                          focus-visible:outline-none focus-visible:ring-2
                          focus-visible:ring-bluegreen-eske rounded-full"
                        aria-label={`Ir a etapa ${stage.label}`}
                      >
                        {nodeContent}
                      </button>
                    ) : (
                      <div
                        className={[
                          "flex items-center",
                          isPending ? "opacity-50" : "",
                        ].join(" ")}
                        aria-label={
                          isPending
                            ? `Etapa ${stage.label} — pendiente`
                            : `Etapa ${stage.label} — ${isActive ? "actual" : "completada"}`
                        }
                      >
                        {nodeContent}
                      </div>
                    )}
                  </div>

                  {/* Connector line (not after last node) */}
                  {idx < STAGES.length - 1 && (
                    <div className={lineClass} aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
