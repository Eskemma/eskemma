"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WizardStep1Tipo from "@/app/components/centinela/pestel/wizard/WizardStep1Tipo";
import WizardStep2Territorio from "@/app/components/centinela/pestel/wizard/WizardStep2Territorio";
import WizardStep3Variables from "@/app/components/centinela/pestel/wizard/WizardStep3Variables";
import ConfirmReplacePestelModal, {
  type ConfirmReplacePestelSource,
} from "@/app/components/centinela/pestel/ConfirmReplacePestelModal";
import type {
  TipoProyecto,
  Territorio,
  NivelTerritorial,
  PestlDimensionConfig,
} from "@/types/pestel.types";

type WizardData = {
  tipo: TipoProyecto | null;
  nombre: string;
  horizonte: number;
  color: string;
  territorio: Territorio | null;
  dimensions: PestlDimensionConfig[];
  modduloProjectId?: string;
  modduloOrigenEscenario?: "A" | "B";
};

const VALID_TIPOS: TipoProyecto[] = ["electoral", "gubernamental", "legislativo", "ciudadano"];

const STEPS = ["Tipo y nombre", "Territorio", "Variables PESTEL"];

export default function NuevoProyectoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => {
    const tipoParam = searchParams.get("tipo") as TipoProyecto | null;
    const modduloProjectId = searchParams.get("moddulo_project_id") ?? undefined;

    const VALID_NIVELES: NivelTerritorial[] = ["nacional", "estatal", "municipal", "distrito", "distrito_federal", "distrito_local"];
    const nivelParam = searchParams.get("nivel") as NivelTerritorial | null;
    const nivelTerritorio = VALID_NIVELES.includes(nivelParam as NivelTerritorial) ? nivelParam! : null;
    const estadoParam = searchParams.get("estado") ?? "";
    const municipioParam = searchParams.get("municipio") ?? "";
    const paisParam = searchParams.get("pais") ?? "";

    const territorioNombre = [estadoParam, municipioParam].filter(Boolean).join(" › ");
    const territorioInicial: Territorio | null = nivelTerritorio
      ? {
          nivel: nivelTerritorio,
          nombre: territorioNombre || nivelTerritorio,
          ...(paisParam ? { pais: paisParam } : {}),
          ...(estadoParam ? { estado: estadoParam } : {}),
          ...(municipioParam ? { municipio: municipioParam } : {}),
        }
      : null;

    return {
      tipo: VALID_TIPOS.includes(tipoParam as TipoProyecto) ? tipoParam : null,
      nombre: searchParams.get("nombre") ?? "",
      horizonte: Number(searchParams.get("horizonte") ?? 6) || 6,
      color: searchParams.get("color") ?? "#026988",
      territorio: territorioInicial,
      dimensions: [],
      ...(modduloProjectId ? { modduloProjectId, modduloOrigenEscenario: "A" as const } : {}),
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Conflicto detectado por el guard de creación (409: el proyecto Moddulo
  // destino ya tiene un vínculo PESTEL vigente — express o Centinela).
  const [pendingReplace, setPendingReplace] = useState<{ source: ConfirmReplacePestelSource } | null>(null);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);
  // Se guardan para poder reintentar todo el flujo (crear + variables) tras confirmar.
  const [pendingDimensions, setPendingDimensions] = useState<PestlDimensionConfig[] | null>(null);

  function goNext() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFinish(finalDimensions: PestlDimensionConfig[], confirmReplace = false) {
    if (!data.tipo || !data.territorio) return;
    setSaving(true);
    setError(null);

    try {
      // Create project (E1-E2)
      const projectRes = await fetch("/api/centinela/pestel/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: data.nombre,
          tipo: data.tipo,
          territorio: data.territorio,
          horizonte: data.horizonte,
          color: data.color,
          ...(data.modduloProjectId ? {
            modduloProjectId: data.modduloProjectId,
            modduloOrigenEscenario: data.modduloOrigenEscenario,
          } : {}),
          ...(confirmReplace ? { confirmReplace: true } : {}),
        }),
      });

      if (projectRes.status === 409) {
        const err = (await projectRes.json()) as { currentSource?: "centinela" | "express" };
        setPendingDimensions(finalDimensions);
        setPendingReplace({ source: err.currentSource === "centinela" ? "recreate" : "sync" });
        setSaving(false);
        return;
      }

      if (!projectRes.ok) {
        const err = (await projectRes.json()) as { error?: string };
        throw new Error(err.error ?? "Error al crear proyecto");
      }

      const { projectId } = (await projectRes.json()) as { projectId: string };

      // Save variable config (E3)
      const varsRes = await fetch(
        `/api/centinela/pestel/project/${projectId}/variables`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dimensions: finalDimensions }),
        }
      );

      if (!varsRes.ok) {
        const err = (await varsRes.json()) as { error?: string };
        throw new Error(err.error ?? "Error al guardar variables");
      }

      router.push(`/centinela/pestel/${projectId}/datos`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setSaving(false);
    }
  }

  async function handleConfirmReplace() {
    if (!pendingDimensions) return;
    setIsConfirmingReplace(true);
    try {
      await handleFinish(pendingDimensions, true);
    } finally {
      setIsConfirmingReplace(false);
      setPendingReplace(null);
    }
  }

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
          <h1 className="text-2xl font-semibold">Nuevo proyecto de análisis</h1>
          <p className="text-white/80 text-sm mt-1">
            Configura las etapas 1-3 para comenzar tu análisis PESTEL
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                    idx < step
                      ? "bg-bluegreen-eske text-white"
                      : idx === step
                      ? "bg-bluegreen-eske text-white ring-4 ring-bluegreen-eske/20"
                      : "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-70 dark:text-[#9AAEBE]",
                  ].join(" ")}
                >
                  {idx < step ? "✓" : idx + 1}
                </div>
                <span
                  className={[
                    "text-sm font-medium hidden sm:block",
                    idx <= step ? "text-bluegreen-eske dark:text-[#6BA4C6]" : "text-gray-eske-60 dark:text-[#9AAEBE]",
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

        {/* Step content */}
        {step === 0 && (
          <WizardStep1Tipo
            tipo={data.tipo}
            nombre={data.nombre}
            horizonte={data.horizonte}
            color={data.color}
            onChange={(fields) => setData((d) => ({ ...d, ...fields }))}
            onNext={goNext}
          />
        )}
        {step === 1 && (
          <WizardStep2Territorio
            territorio={data.territorio}
            onChange={(territorio) => setData((d) => ({ ...d, territorio }))}
            onNext={goNext}
            onBack={goBack}
            tipoProyecto={data.tipo ?? undefined}
            nombreProyecto={data.nombre}
          />
        )}
        {step === 2 && data.tipo && (
          <WizardStep3Variables
            tipo={data.tipo}
            initialDimensions={data.dimensions}
            saving={saving}
            onBack={goBack}
            onFinish={handleFinish}
          />
        )}

        {error && (
          <p className="mt-4 text-sm text-red-eske dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}
      </div>

      {pendingReplace && (
        <ConfirmReplacePestelModal
          source={pendingReplace.source}
          isConfirming={isConfirmingReplace}
          onCancel={() => setPendingReplace(null)}
          onConfirm={handleConfirmReplace}
        />
      )}
    </div>
  );
}
