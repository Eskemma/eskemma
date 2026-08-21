"use client";

// app/centinela/fontana/FontanaModduloButton.tsx
// Piezas 3/4 del plan de escenarios (b)/(c) (2026-08-19) — CTA hacia Moddulo
// F3 cuando la sesión de Fontana todavía no tiene modduloProjectId. Mismo
// patrón que ModduloButton.tsx (PESTEL→F2): botón primario "Iniciar
// proyecto en Moddulo" + botón secundario "Vincular a proyecto existente"
// (picker). Diferencias deliberadas frente a PESTEL: sin chequeo de tipo
// (Fontana no lo exige, solo territorio informativo) y converge en
// /api/fontana/sesion/[sesionId]/vincular-moddulo en vez de link-moddulo.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FontanaSesion } from "@/types/fontana.types";
import type { ModduloProject } from "@/types/moddulo.types";
import { checkTerritoryMatch, type TerritoryMatch } from "@/lib/moddulo/linkCompatibility";

const TIPO_LABELS: Record<string, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

type PickerProject = ModduloProject & { territoryMatch: TerritoryMatch };

function PickerModal({ sesion, onClose }: { sesion: FontanaSesion; onClose: () => void }) {
  const router = useRouter();
  const [projects, setProjects] = useState<PickerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PickerProject | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/moddulo/projects", { credentials: "include" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { projects: ModduloProject[] };
        const enriched: PickerProject[] = (data.projects ?? [])
          .filter((p) => p.status !== "archived")
          .map((p) => ({ ...p, territoryMatch: checkTerritoryMatch(sesion.territorio, p.territorio) }));
        enriched.sort((a, b) => {
          const score = (m: TerritoryMatch) => (m === "exact" ? 0 : m === "approximate" ? 1 : 2);
          return score(a.territoryMatch) - score(b.territoryMatch);
        });
        setProjects(enriched);
      } catch {
        setFetchError("No se pudieron cargar los proyectos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sesion]);

  async function doLink(target: PickerProject) {
    setLinking(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}/vincular-moddulo`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ modduloProjectId: target.id }),
      });
      if (res.ok) {
        // Punto 4/D (verificación en navegador, 2026-08-19) — a diferencia
        // de Flujo 1 (proyecto siempre nuevo), aquí se vincula a un
        // proyecto YA EXISTENTE que puede estar en cualquier fase — nunca
        // hardcodear un destino. Respaldo explícito por si el campo no
        // llegara en la respuesta por cualquier razón.
        const data = (await res.json()) as { currentPhase?: string };
        const currentPhase = data.currentPhase ?? "proposito";
        router.push(`/moddulo/proyecto/${target.id}/${currentPhase}`);
        return;
      }
      const err = (await res.json()) as { message?: string };
      setLinkError(err.message ?? "No se pudo vincular el proyecto. Intenta de nuevo.");
    } catch {
      setLinkError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLinking(false);
      setConfirmTarget(null);
    }
  }

  // 2026-08-21 — antes, un match exacto de territorio vinculaba de
  // inmediato con un solo clic, sin confirmación (causa real de una
  // sesión vinculada por accidente). Ahora TODO caso pasa por el mismo
  // paso de confirmación explícita, sin excepción — solo cambia el
  // texto (match exacto: sin advertencia de territorio).
  function handleSelect(target: PickerProject) {
    setLinkError(null);
    setConfirmTarget(target);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-eske-20 dark:border-white/10 shrink-0">
          <h3 className="font-semibold text-bluegreen-eske dark:text-blue-eske-20 text-base">Vincular a proyecto existente</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-eske-40 hover:text-gray-eske-70 hover:bg-gray-eske-10 dark:hover:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {!confirmTarget && (
          <p className="px-5 pt-4 text-sm text-black-eske-80 dark:text-[#9AAEBE]">
            Elige el proyecto de Moddulo al que quieres vincular este resultado de Fontana.
          </p>
        )}

        {confirmTarget && (
          <div className="p-5 flex flex-col gap-4">
            {confirmTarget.territoryMatch === "exact" ? (
              <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">
                Vas a vincular esta exploración de Fontana al proyecto
                {" "}<span className="font-semibold text-black-eske dark:text-[#EAF2F8]">"{confirmTarget.name}"</span>.
              </p>
            ) : (
              <div className="flex gap-2.5 p-3 rounded-lg bg-yellow-eske/10 border border-yellow-eske/30 text-sm leading-snug text-[#816000] dark:text-yellow-eske/90">
                <svg className="shrink-0 mt-0.5 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span>
                  {confirmTarget.territoryMatch === "approximate"
                    ? `El territorio de Fontana y "${confirmTarget.territorio?.nombre ?? "este proyecto"}" parecen coincidir, pero no se pudo verificar con un identificador confiable. Revisa que sean el mismo territorio antes de vincular.`
                    : `Fontana está explorando "${sesion.territorio.nombre}", pero el proyecto cubre "${confirmTarget.territorio?.nombre ?? "territorio no especificado"}".`}
                </span>
              </div>
            )}
            {linkError && <p className="text-sm text-red-eske">{linkError}</p>}
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
                onClick={() => doLink(confirmTarget)}
                disabled={linking}
                className="px-4 py-2 text-sm font-medium bg-bluegreen-eske text-white rounded-lg hover:bg-bluegreen-eske-60 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {linking && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {confirmTarget.territoryMatch === "exact" ? "Vincular" : "Vincular de todas formas"}
              </button>
            </div>
          </div>
        )}

        {!confirmTarget && (
          <div className="overflow-y-auto flex-1 p-2">
            {loading && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-bluegreen-eske border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {fetchError && <p className="text-sm text-red-eske text-center py-8">{fetchError}</p>}
            {!loading && !fetchError && projects.length === 0 && (
              <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] text-center py-8">No tienes proyectos en Moddulo todavía.</p>
            )}
            {linkError && (
              <div className="mx-2 mb-2 p-3 rounded-lg bg-red-eske/10 border border-red-eske/20 text-sm text-red-eske">{linkError}</div>
            )}
            {projects.map((p) => {
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  disabled={linking}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-start gap-3 ${linking ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-eske-10 dark:hover:bg-white/5 cursor-pointer"}`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="block font-medium text-sm text-black-eske dark:text-[#EAF2F8] truncate">{p.name}</span>
                    <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-0.5 truncate">
                      {TIPO_LABELS[p.type] ?? p.type}
                      {p.territorio?.nombre ? ` · ${p.territorio.nombre}` : ""}
                    </p>
                  </div>
                  {!linking && (
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

export default function FontanaModduloButton({ sesion }: { sesion: FontanaSesion }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <div className="w-full flex flex-col items-center gap-1.5 sm:w-fit sm:items-end">
        <button
          type="button"
          onClick={() => router.push(`/moddulo/proyecto/nuevo?from=fontana&fontanaSesionId=${sesion.sesionId}`)}
          className="px-5 py-2.5 bg-white text-bluegreen-eske rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors shadow-sm"
        >
          Iniciar proyecto en Moddulo
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="text-xs text-white/80 hover:text-white transition-colors underline underline-offset-2"
        >
          Vincular a proyecto existente
        </button>
      </div>

      {pickerOpen && <PickerModal sesion={sesion} onClose={() => setPickerOpen(false)} />}
    </>
  );
}
