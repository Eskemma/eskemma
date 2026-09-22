// app/moddulo/redactor/components/ConfigWizard.tsx
"use client";

import React, { useState } from "react";
import type { ProjectContext, ProjectConfiguration, ElectoralConfig, GovernmentalConfig } from "@/types/redactor.types";

interface ConfigWizardProps {
  onComplete: (config: Partial<ProjectConfiguration>) => void;
  onClose: () => void;
}

type WizardStep = "context" | "country" | "electoral-details" | "governmental-details";

export default function ConfigWizard({ onComplete, onClose }: ConfigWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("context");
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [country, setCountry] = useState<string>("");
  
  // Electoral state
  const [electoralConfig, setElectoralConfig] = useState<Partial<ElectoralConfig>>({
    electionType: "federal",
    electionYear: new Date().getFullYear(),
    candidate: {
      name: "",
      party: "",
      coalition: [],
      slogan: "",
    },
    electionCalendar: {
      campaignStart: new Date(),
      campaignEnd: new Date(),
      electionDay: new Date(),
      currentPhase: "pre-campaña",
    },
    compliance: {
      enableINEValidation: true,
      enableSpendingTracking: false,
      requireDisclaimers: true,
    },
  });
  
  // Governmental state
  const [governmentalConfig, setGovernmentalConfig] = useState<Partial<GovernmentalConfig>>({
    governmentLevel: "federal",
    administration: {
      name: "",
      head: "",
      headName: "",
      term: {
        start: new Date(),
        end: new Date(),
      },
    },
    communicationType: "institucional",
    compliance: {
      requireNeutralLanguage: true,
      requireLegalDisclaimers: true,
      requireAccessibility: true,
      prohibitPartisanContent: true,
    },
  });

  const handleContextSelect = (selectedContext: ProjectContext) => {
    setContext(selectedContext);
    setCurrentStep("country");
  };

  const handleCountrySelect = (selectedCountry: string) => {
    setCountry(selectedCountry);
    setCurrentStep(context === "electoral" ? "electoral-details" : "governmental-details");
  };

  const handleComplete = () => {
    const config: Partial<ProjectConfiguration> = {
      context: context!,
      country,
      ...(context === "electoral" && { electoral: electoralConfig as ElectoralConfig }),
      ...(context === "governmental" && { governmental: governmentalConfig as GovernmentalConfig }),
    };
    
    onComplete(config);
  };

  const canProceed = () => {
    if (currentStep === "electoral-details") {
      return electoralConfig.candidate?.name && electoralConfig.position;
    }
    if (currentStep === "governmental-details") {
      return governmentalConfig.administration?.name;
    }
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-eske/50">
      <div className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-bluegreen-eske text-white-eske p-6 rounded-t-lg">
          <h2 className="text-2xl font-bold">Configuración Inicial</h2>
          <p className="text-sm opacity-90 mt-1">
            Configura tu proyecto para comenzar a generar contenido
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* PASO 0: CONTEXTO */}
          {currentStep === "context" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-bluegreen-eske mb-4">
                  ¿Qué tipo de comunicación realizarás?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Electoral */}
                  <button
                    onClick={() => handleContextSelect("electoral")}
                    className="group relative bg-blue-eske/10 dark:bg-blue-eske/20 hover:bg-blue-eske/20 dark:hover:bg-blue-eske/30 border-2 border-blue-eske/40 hover:border-blue-eske rounded-lg p-6 text-left transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-eske-60 rounded-lg flex items-center justify-center shrink-0">
                        <svg
                          className="w-7 h-7 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-blue-eske-90 dark:text-blue-eske-30 mb-1">
                          🗳️ Campaña Electoral
                        </h4>
                        <p className="text-sm text-blue-eske-80 dark:text-blue-eske-40">
                          Comunicación para candidato o partido en proceso electoral
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Gubernamental */}
                  <button
                    onClick={() => handleContextSelect("governmental")}
                    className="group relative bg-green-eske/10 dark:bg-green-eske/20 hover:bg-green-eske/20 dark:hover:bg-green-eske/30 border-2 border-green-eske/40 hover:border-green-eske rounded-lg p-6 text-left transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-green-eske-60 rounded-lg flex items-center justify-center shrink-0">
                        <svg
                          className="w-7 h-7 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-green-eske-90 dark:text-green-eske-20 mb-1">
                          🏛️ Comunicación Gubernamental
                        </h4>
                        <p className="text-sm text-green-eske-80 dark:text-green-eske-30">
                          Comunicación institucional de gobierno fuera de proceso electoral
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 1: PAÍS */}
          {currentStep === "country" && (
            <div className="space-y-6">
              <div>
                <button
                  onClick={() => setCurrentStep("context")}
                  className="text-sm text-bluegreen-eske hover:underline mb-4"
                >
                  ← Atrás
                </button>
                <h3 className="text-lg font-bold text-bluegreen-eske mb-4">
                  Selecciona tu país
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { code: "mexico", name: "México", flag: "🇲🇽" },
                    { code: "colombia", name: "Colombia", flag: "🇨🇴" },
                    { code: "chile", name: "Chile", flag: "🇨🇱" },
                    { code: "espana", name: "España", flag: "🇪🇸" },
                  ].map((countryOption) => (
                    <button
                      key={countryOption.code}
                      onClick={() => handleCountrySelect(countryOption.code)}
                      className="flex items-center gap-3 p-4 bg-white-eske-40 dark:bg-[#21425E] hover:bg-blue-eske/10 dark:hover:bg-blue-eske/20 border-2 border-gray-eske-40 dark:border-white/10 hover:border-blue-eske rounded-lg transition-all text-left"
                    >
                      <span className="text-3xl">{countryOption.flag}</span>
                      <span className="font-semibold text-black-eske dark:text-[#EAF2F8]">{countryOption.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PASO 2A: ELECTORAL DETAILS */}
          {currentStep === "electoral-details" && (
            <div className="space-y-6">
              <button
                onClick={() => setCurrentStep("country")}
                className="text-sm text-bluegreen-eske hover:underline mb-4"
              >
                ← Atrás
              </button>
              <h3 className="text-lg font-bold text-bluegreen-eske mb-4">
                Configuración Electoral
              </h3>

              {/* Tipo de elección */}
              <div>
                <label className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  Tipo de elección
                </label>
                <div className="flex gap-2">
                  {["federal", "estatal", "municipal"].map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setElectoralConfig({
                          ...electoralConfig,
                          electionType: type as any,
                        })
                      }
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                        electoralConfig.electionType === type
                          ? "bg-blue-eske-60 text-white"
                          : "bg-gray-eske-10 dark:bg-[#21425E] text-black-eske-40 dark:text-[#C7D6E0] hover:bg-gray-eske-20 dark:hover:bg-[#2C5273]"
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  Cargo en disputa *
                </label>
                <input
                  type="text"
                  value={electoralConfig.position || ""}
                  onChange={(e) =>
                    setElectoralConfig({ ...electoralConfig, position: e.target.value })
                  }
                  placeholder="Ej: Presidencia, Gubernatura, Alcaldía"
                  className="w-full px-4 py-2 border-2 border-gray-eske-40 dark:border-white/10 rounded-lg focus:border-blue-eske focus:outline-none bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] placeholder:text-gray-eske-70 dark:placeholder:text-[#6D8294]"
                />
              </div>

              {/* Candidato */}
              <div>
                <label className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  Nombre del candidato/a *
                </label>
                <input
                  type="text"
                  value={electoralConfig.candidate?.name || ""}
                  onChange={(e) =>
                    setElectoralConfig({
                      ...electoralConfig,
                      candidate: { ...electoralConfig.candidate!, name: e.target.value },
                    })
                  }
                  placeholder="Ej: María López García"
                  className="w-full px-4 py-2 border-2 border-gray-eske-40 dark:border-white/10 rounded-lg focus:border-blue-eske focus:outline-none bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] placeholder:text-gray-eske-70 dark:placeholder:text-[#6D8294]"
                />
              </div>

              {/* Partido */}
              <div>
                <label className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  Partido político
                </label>
                <input
                  type="text"
                  value={electoralConfig.candidate?.party || ""}
                  onChange={(e) =>
                    setElectoralConfig({
                      ...electoralConfig,
                      candidate: { ...electoralConfig.candidate!, party: e.target.value },
                    })
                  }
                  placeholder="Ej: Movimiento Ciudadano"
                  className="w-full px-4 py-2 border-2 border-gray-eske-40 dark:border-white/10 rounded-lg focus:border-blue-eske focus:outline-none bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] placeholder:text-gray-eske-70 dark:placeholder:text-[#6D8294]"
                />
              </div>

              {/* Eslogan */}
              <div>
                <label className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  Eslogan de campaña
                </label>
                <input
                  type="text"
                  value={electoralConfig.candidate?.slogan || ""}
                  onChange={(e) =>
                    setElectoralConfig({
                      ...electoralConfig,
                      candidate: { ...electoralConfig.candidate!, slogan: e.target.value },
                    })
                  }
                  placeholder="Ej: Educación y transparencia para México"
                  className="w-full px-4 py-2 border-2 border-gray-eske-40 dark:border-white/10 rounded-lg focus:border-blue-eske focus:outline-none bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] placeholder:text-gray-eske-70 dark:placeholder:text-[#6D8294]"
                />
              </div>
            </div>
          )}

          {/* PASO 2B: GOVERNMENTAL DETAILS */}
          {currentStep === "governmental-details" && (
            <div className="space-y-6">
              <button
                onClick={() => setCurrentStep("country")}
                className="text-sm text-bluegreen-eske hover:underline mb-4"
              >
                ← Atrás
              </button>
              <h3 className="text-lg font-bold text-bluegreen-eske mb-4">
                Configuración Gubernamental
              </h3>

              {/* Nivel de gobierno */}
              <div>
                <label className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  Nivel de gobierno
                </label>
                <div className="flex gap-2">
                  {["federal", "estatal", "municipal"].map((level) => (
                    <button
                      key={level}
                      onClick={() =>
                        setGovernmentalConfig({
                          ...governmentalConfig,
                          governmentLevel: level as any,
                        })
                      }
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                        governmentalConfig.governmentLevel === level
                          ? "bg-green-eske-60 text-white"
                          : "bg-gray-eske-10 dark:bg-[#21425E] text-black-eske-40 dark:text-[#C7D6E0] hover:bg-gray-eske-20 dark:hover:bg-[#2C5273]"
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Administración */}
              <div>
                <label className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  Nombre de la administración *
                </label>
                <input
                  type="text"
                  value={governmentalConfig.administration?.name || ""}
                  onChange={(e) =>
                    setGovernmentalConfig({
                      ...governmentalConfig,
                      administration: {
                        ...governmentalConfig.administration!,
                        name: e.target.value,
                      },
                    })
                  }
                  placeholder="Ej: Gobierno de México, Gobierno de Jalisco"
                  className="w-full px-4 py-2 border-2 border-gray-eske-40 dark:border-white/10 rounded-lg focus:border-green-eske-60 focus:outline-none bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] placeholder:text-gray-eske-70 dark:placeholder:text-[#6D8294]"
                />
              </div>

              {/* Cargo del titular */}
              <div>
                <label className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  Cargo del titular
                </label>
                <input
                  type="text"
                  value={governmentalConfig.administration?.head || ""}
                  onChange={(e) =>
                    setGovernmentalConfig({
                      ...governmentalConfig,
                      administration: {
                        ...governmentalConfig.administration!,
                        head: e.target.value,
                      },
                    })
                  }
                  placeholder="Ej: Presidenta, Gobernador, Alcalde"
                  className="w-full px-4 py-2 border-2 border-gray-eske-40 dark:border-white/10 rounded-lg focus:border-green-eske-60 focus:outline-none bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] placeholder:text-gray-eske-70 dark:placeholder:text-[#6D8294]"
                />
              </div>

              {/* Tipo de comunicación */}
              <div>
                <label className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2">
                  Tipo de comunicación
                </label>
                <select
                  value={governmentalConfig.communicationType}
                  onChange={(e) =>
                    setGovernmentalConfig({
                      ...governmentalConfig,
                      communicationType: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2 border-2 border-gray-eske-40 dark:border-white/10 rounded-lg focus:border-green-eske-60 focus:outline-none bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] placeholder:text-gray-eske-70 dark:placeholder:text-[#6D8294]"
                >
                  <option value="institucional">Institucional (general)</option>
                  <option value="rendicion-cuentas">Rendición de cuentas</option>
                  <option value="programa-social">Programa social</option>
                  <option value="emergencia">Emergencia</option>
                  <option value="participacion">Participación ciudadana</option>
                  <option value="servicios">Servicios y trámites</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white-eske-40 dark:bg-[#112230] px-6 py-4 rounded-b-lg flex justify-between items-center">
          <button
            onClick={onClose}
            className="text-black-eske-20 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] font-medium text-sm"
          >
            Cancelar
          </button>

          {(currentStep === "electoral-details" || currentStep === "governmental-details") && (
            <button
              onClick={handleComplete}
              disabled={!canProceed()}
              className="bg-bluegreen-eske text-white px-6 py-2 rounded-lg font-semibold text-sm hover:bg-bluegreen-eske/90 disabled:bg-gray-eske-40 disabled:cursor-not-allowed transition-all"
            >
              Completar Configuración
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
