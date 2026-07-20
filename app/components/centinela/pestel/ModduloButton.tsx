"use client";

// app/components/centinela/pestel/ModduloButton.tsx
// CTA toward Moddulo F2. When the PESTEL project is not yet linked, shows
// "Iniciar proyecto en Moddulo" (primary) + "Vincular a proyecto existente" (picker).
// When already linked, shows "Regresar a Moddulo F2 con resultados".

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PESTELProject, Territorio } from "@/types/pestel.types";
import type { ModduloProject } from "@/types/moddulo.types";

// ==========================================
// TERRITORY COMPATIBILITY
// ==========================================

type TerritoryMatch = "exact" | "approximate" | "mismatch";

const TIPO_LABELS: Record<string, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

function checkTerritoryMatch(
  p: Territorio,
  m: Territorio | undefined
): TerritoryMatch {
  if (!m) return "approximate";
  if (p.nivel !== m.nivel) return "mismatch";
  if (p.pais && m.pais && p.pais !== m.pais) return "mismatch";
  if (p.estado && m.estado && p.estado !== m.estado) return "mismatch";

  const isDistrito = ["distrito_federal", "distrito_local", "distrito"].includes(p.nivel);
  if (isDistrito) {
    if (p.cve_distrito && m.cve_distrito) {
      return p.cve_distrito === m.cve_distrito ? "exact" : "mismatch";
    }
    if (p.municipio && m.municipio && p.municipio !== m.municipio) return "mismatch";
    return "approximate";
  }

  if (p.nivel === "municipal") {
    if (p.municipio && m.municipio && p.municipio !== m.municipio) return "mismatch";
    return "approximate";
  }

  return "exact";
}

// ==========================================
// PICKER MODAL
// ==========================================

type PickerProject = ModduloProject & {
  tipoOk: boolean;
  territoryMatch: TerritoryMatch;
};

function PickerModal({
  pestelProject,
  projectId,
  analysisId,
  onClose,
  onLinked,
}: {
  pestelProject: PESTELProject;
  projectId: string;
  analysisId: string | undefined;
  onClose: () => void;
  onLinked: () => void;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<PickerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PickerProject | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Load Moddulo projects on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/moddulo/projects", { credentials: "include" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { projects: ModduloProject[] };
        const enriched: PickerProject[] = (data.projects ?? [])
          .filter((p) => p.status !== "archived")
          .map((p) => ({
            ...p,
            tipoOk: p.type === pestelProject.tipo,
            territoryMatch: checkTerritoryMatch(pestelProject.territorio, p.territorio),
          }));
        // Sort: exact-compatible first, then approximate, then mismatch, then tipo-incompatible
        enriched.sort((a, b) => {
          const scoreA = !a.tipoOk ? 3 : a.territoryMatch === "exact" ? 0 : a.territoryMatch === "approximate" ? 1 : 2;
          const scoreB = !b.tipoOk ? 3 : b.territoryMatch === "exact" ? 0 : b.territoryMatch === "approximate" ? 1 : 2;
          return scoreA - scoreB;
        });
        setProjects(enriched);
      } catch {
        setFetchError("No se pudieron cargar los proyectos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [pestelProject]);

  async function doLink(target: PickerProject, force: boolean) {
    setLinking(true);
    setLinkError(null);
    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/link-moddulo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ modduloProjectId: target.id, forceLink: force }),
        }
      );

      if (res.ok) {
        const data = (await res.json()) as { sourceAnalysisId?: string };
        onClose();
        onLinked();
        // Navigate to F2 of the newly linked project
        const pestAnalysisId = data.sourceAnalysisId ?? analysisId;
        router.push(
          `/moddulo/proyecto/${target.id}/exploracion${
            pestAnalysisId ? `?pest_analysis_id=${pestAnalysisId}` : ""
          }`
        );
        return;
      }

      const err = (await res.json()) as { error?: string; message?: string };
      if (res.status === 409) {
        setLinkError(
          err.message ??
            "Este proyecto de Moddulo ya está vinculado a otro análisis PESTEL. Para cambiar la vinculación, contacta soporte."
        );
      } else {
        setLinkError(err.message ?? "No se pudo vincular el proyecto. Intenta de nuevo.");
      }
    } catch {
      setLinkError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLinking(false);
      setConfirmTarget(null);
    }
  }

  function handleSelect(target: PickerProject) {
    if (!target.tipoOk) return;
    setLinkError(null);
    if (target.territoryMatch === "exact") {
      doLink(target, false);
    } else {
      setConfirmTarget(target);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-eske-20 dark:border-white/10 shrink-0">
          <h3 className="font-semibold text-gray-eske-80 dark:text-[#C7D6E0] text-base">
            Vincular a proyecto existente
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-eske-40
              hover:text-gray-eske-70 hover:bg-gray-eske-10 dark:hover:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Confirmation step */}
        {confirmTarget && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex gap-2.5 p-3 rounded-lg bg-yellow-eske/10 border border-yellow-eske/30 text-sm leading-snug text-yellow-eske-80 dark:text-yellow-eske/90">
              <svg className="shrink-0 mt-0.5 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>
                {confirmTarget.territoryMatch === "approximate"
                  ? `Los territorios de "${pestelProject.territorio.nombre}" y "${confirmTarget.territorio?.nombre ?? "este proyecto"}" parecen coincidir, pero no se pudo verificar con un identificador confiable. Revisa que sean el mismo territorio antes de vincular.`
                  : `El análisis es de "${pestelProject.territorio.nombre}", pero el proyecto cubre "${confirmTarget.territorio?.nombre ?? "territorio no especificado"}". Los datos PESTEL son del territorio del análisis.`}
              </span>
            </div>
            {linkError && (
              <p className="text-sm text-red-eske">{linkError}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setConfirmTarget(null); setLinkError(null); }}
                disabled={linking}
                className="px-4 py-2 text-sm font-medium text-gray-eske-60 hover:text-gray-eske-80 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => doLink(confirmTarget, true)}
                disabled={linking}
                className="px-4 py-2 text-sm font-medium bg-orange-eske text-white rounded-lg
                  hover:bg-orange-eske-60 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {linking && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Vincular de todas formas
              </button>
            </div>
          </div>
        )}

        {/* Project list */}
        {!confirmTarget && (
          <div className="overflow-y-auto flex-1 p-2">
            {loading && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-bluegreen-eske border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {fetchError && (
              <p className="text-sm text-red-eske text-center py-8">{fetchError}</p>
            )}
            {!loading && !fetchError && projects.length === 0 && (
              <p className="text-sm text-gray-eske-50 dark:text-[#9AAEBE] text-center py-8">
                No tienes proyectos en Moddulo todavía.
              </p>
            )}
            {linkError && (
              <div className="mx-2 mb-2 p-3 rounded-lg bg-red-eske/10 border border-red-eske/20 text-sm text-red-eske">
                {linkError}
              </div>
            )}
            {projects.map((p) => {
              const disabled = !p.tipoOk || linking;
              const showWarning = p.tipoOk && p.territoryMatch !== "exact";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  disabled={disabled}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-start gap-3
                    ${disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-gray-eske-10 dark:hover:bg-white/5 cursor-pointer"
                    }`}
                  title={
                    !p.tipoOk
                      ? `Tipo incompatible: el análisis es "${TIPO_LABELS[pestelProject.tipo] ?? pestelProject.tipo}" y el proyecto es "${TIPO_LABELS[p.type] ?? p.type}"`
                      : undefined
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium text-sm text-gray-eske-80 dark:text-[#C7D6E0] truncate">
                        {p.name}
                      </span>
                      {showWarning && (
                        <span className="shrink-0 text-yellow-eske text-xs" aria-label="Diferencia de territorio">⚠</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mt-0.5 truncate">
                      {TIPO_LABELS[p.type] ?? p.type}
                      {p.territorio?.nombre ? ` · ${p.territorio.nombre}` : ""}
                    </p>
                    {!p.tipoOk && (
                      <p className="text-xs text-gray-eske-40 mt-0.5">
                        Tipo incompatible con este análisis
                      </p>
                    )}
                  </div>
                  {p.tipoOk && !linking && (
                    <svg className="shrink-0 mt-0.5 w-4 h-4 text-gray-eske-30 dark:text-[#9AAEBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function ModduloButton({
  project,
  projectId,
  analysisId,
  onLinked,
}: {
  project: PESTELProject | null;
  projectId: string;
  analysisId: string | undefined;
  onLinked?: () => void;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!project) return null;

  // Branch A: Already linked
  if (project.modduloProjectId) {
    const href = `/moddulo/proyecto/${project.modduloProjectId}/exploracion${
      analysisId ? `?pest_analysis_id=${analysisId}` : ""
    }`;
    return (
      <button
        type="button"
        onClick={() => router.push(href)}
        className="px-5 py-2.5 border border-bluegreen-eske text-bluegreen-eske
          rounded-lg text-sm font-semibold hover:bg-bluegreen-eske/10
          transition-colors"
      >
        Regresar a Moddulo F2 con resultados
      </button>
    );
  }

  // Branch B: Not yet linked
  const params = new URLSearchParams({
    from: "pestel",
    pestelProjectId: projectId,
    pestelProjectName: project.nombre,
    pestelProjectType: project.tipo,
    ...(analysisId ? { pestAnalysisId: analysisId } : {}),
  });

  return (
    <>
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => router.push(`/moddulo/proyecto/nuevo?${params.toString()}`)}
          className="px-5 py-2.5 bg-orange-eske text-white
            rounded-lg text-sm font-semibold hover:bg-orange-eske-60
            transition-colors shadow-sm"
        >
          Iniciar proyecto en Moddulo
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="text-xs text-bluegreen-eske/70 hover:text-bluegreen-eske transition-colors underline underline-offset-2"
        >
          Vincular a proyecto existente
        </button>
      </div>

      {pickerOpen && (
        <PickerModal
          pestelProject={project}
          projectId={projectId}
          analysisId={analysisId}
          onClose={() => setPickerOpen(false)}
          onLinked={onLinked ?? (() => {})}
        />
      )}
    </>
  );
}
