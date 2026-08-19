"use client";

// app/centinela/pestel/[projectId]/configurar/page.tsx
// E1-E3 edit page — loads existing project data and allows updating
// type, name, territory, horizon, color, and PEST-L variables.

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import WizardStep1Tipo from "@/app/components/centinela/pestel/wizard/WizardStep1Tipo";
import WizardStep2Territorio from "@/app/components/centinela/pestel/wizard/WizardStep2Territorio";
import WizardStep3Variables from "@/app/components/centinela/pestel/wizard/WizardStep3Variables";
import PESTELStageNav from "@/app/components/centinela/pestel/PESTELStageNav";
import type {
  PESTELProject,
  TipoProyecto,
  Territorio,
  PestlDimensionConfig,
} from "@/types/pestel.types";

type StepData = {
  tipo: TipoProyecto | null;
  nombre: string;
  horizonte: number;
  color: string;
  territorio: Territorio | null;
  dimensions: PestlDimensionConfig[];
};

const STEPS = ["Tipo y nombre", "Territorio", "Variables PESTEL"];

export default function ConfigurarPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [project, setProject] = useState<PESTELProject | null>(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<StepData>({
    tipo: null,
    nombre: "",
    horizonte: 6,
    color: "#026988",
    territorio: null,
    dimensions: [],
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const [projRes, varsRes] = await Promise.all([
        fetch(`/api/centinela/pestel/project/${projectId}`),
        fetch(`/api/centinela/pestel/project/${projectId}/variable-configs`),
      ]);

      if (!projRes.ok) throw new Error("No se pudo cargar el proyecto.");

      const projData = (await projRes.json()) as { project: PESTELProject & { id: string } };
      const proj = projData.project;
      setProject(proj);

      let dims: PestlDimensionConfig[] = [];
      if (varsRes.ok) {
        const varsData = (await varsRes.json()) as { configs?: PestlDimensionConfig[] };
        dims = varsData.configs ?? [];
      }

      setData({
        tipo: proj.tipo,
        nombre: proj.nombre,
        horizonte: proj.horizonte,
        color: proj.color ?? "#026988",
        territorio: proj.territorio,
        dimensions: dims,
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  async function handleFinish(finalDimensions: PestlDimensionConfig[]) {
    if (!data.tipo || !data.territorio) return;
    setSaving(true);
    setSaveError(null);

    try {
      const [patchRes, varsRes] = await Promise.all([
        fetch(`/api/centinela/pestel/project/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: data.nombre,
            tipo: data.tipo,
            territorio: data.territorio,
            horizonte: data.horizonte,
            color: data.color,
          }),
        }),
        fetch(`/api/centinela/pestel/project/${projectId}/variables`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dimensions: finalDimensions }),
        }),
      ]);

      if (!patchRes.ok) {
        const err = (await patchRes.json()) as { error?: string };
        throw new Error(err.error ?? "Error al actualizar proyecto");
      }
      if (!varsRes.ok) {
        const err = (await varsRes.json()) as { error?: string };
        throw new Error(err.error ?? "Error al guardar variables");
      }

      router.push(`/centinela/pestel/${projectId}/datos`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error desconocido");
      setSaving(false);
    }
  }

  // ── Loading / Error states ──────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center">
        <div
          className="w-8 h-8 border-4 border-bluegreen-eske border-t-transparent rounded-full animate-spin"
          aria-label="Cargando"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center px-6">
        <div className="bg-white-eske dark:bg-[#18324A] rounded-xl p-8 max-w-md text-center shadow-sm">
          <p className="font-semibold text-red-eske">{loadError}</p>
          <button
            onClick={() => router.push("/centinela/pestel")}
            className="mt-4 px-4 py-2 bg-bluegreen-eske text-white rounded-lg text-sm"
          >
            Volver a PESTEL
          </button>
        </div>
      </div>
    );
  }

  // ── Page ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      {/* Header */}
      <div className="bg-bluegreen-eske text-white px-6 py-5">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.push("/centinela/pestel")}
            className="text-sm text-white/70 hover:text-white mb-2 flex items-center gap-1 transition-colors"
            aria-label="Volver a PESTEL"
          >
            ← PESTEL
          </button>
          <h1 className="text-2xl font-semibold">
            {project?.nombre ?? "Proyecto"}
          </h1>
          <p className="text-white/80 text-sm mt-0.5">
            {project?.territorio?.nombre ?? ""} ·{" "}
            <span className="capitalize">{project?.tipo ?? ""}</span>
            {" · "}
            <span className="font-medium">Etapa 1 — Configuración</span>
          </p>
        </div>
      </div>

      {/* Stage nav */}
      <PESTELStageNav
        projectId={projectId}
        currentStage={project?.currentStage ?? 3}
        activeStage={3}
      />

      {/* Stepper + content */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => idx < step && setStep(idx)}
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors",
                    idx < step
                      ? "bg-bluegreen-eske text-white hover:opacity-80 cursor-pointer"
                      : idx === step
                      ? "bg-bluegreen-eske-80 text-white ring-4 ring-bluegreen-eske/20"
                      : "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-70 dark:text-[#9AAEBE] cursor-default",
                  ].join(" ")}
                  aria-current={idx === step ? "step" : undefined}
                  disabled={idx > step}
                >
                  {idx < step ? "✓" : idx + 1}
                </button>
                <span
                  className={[
                    "text-sm font-medium hidden sm:block",
                    idx === step
                      ? "text-bluegreen-eske-80 font-semibold dark:text-[#6BA4C6]"
                      : idx < step
                      ? "text-bluegreen-eske dark:text-[#6BA4C6]"
                      : "text-gray-eske-60 dark:text-[#9AAEBE]",
                  ].join(" ")}
                >
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={[
                    "flex-1 h-0.5 mx-3",
                    idx < step ? "bg-bluegreen-eske" : "bg-gray-eske-20 dark:bg-[#21425E]",
                  ].join(" ")}
                />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <WizardStep1Tipo
            tipo={data.tipo}
            nombre={data.nombre}
            horizonte={data.horizonte}
            color={data.color}
            onChange={(fields) => setData((d) => ({ ...d, ...fields }))}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <WizardStep2Territorio
            territorio={data.territorio}
            onChange={(territorio) => setData((d) => ({ ...d, territorio }))}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            tipoProyecto={data.tipo ?? undefined}
            nombreProyecto={data.nombre}
          />
        )}
        {step === 2 && data.tipo && (
          <WizardStep3Variables
            tipo={data.tipo}
            initialDimensions={data.dimensions}
            saving={saving}
            onBack={() => setStep(1)}
            onFinish={handleFinish}
          />
        )}

        {saveError && (
          <p className="mt-4 text-sm text-red-eske dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
            {saveError}
          </p>
        )}
      </div>
    </div>
  );
}
