// app/moddulo/proyecto/nuevo/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import TerritorySelector from "@/app/components/shared/TerritorySelector";
import { PROJECT_TYPE_LABELS, PROJECT_TYPE_DESCRIPTIONS } from "@/types/moddulo.types";
import type { ProjectType, Territorio } from "@/types/moddulo.types";

type Step = 1 | 2 | 3;

function NuevoProyectoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pieza 3 (2026-08-19) — Flujo 1 de Fontana ("Iniciar proyecto en
  // Moddulo"): a diferencia de PESTEL, no hay type/name que prellenar (la
  // sesión de Fontana no tiene noción de esos campos) — solo se necesita
  // vincular el proyecto recién creado a la sesión, tras crearlo.
  const [vinculandoFontana, setVinculandoFontana] = useState(false);
  const [fontanaLinkError, setFontanaLinkError] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProjectType | null>(null);
  const [color, setColor] = useState("#026988");
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [customHex, setCustomHex] = useState("");
  const [territory, setTerritory] = useState<Territorio | null>(null);

  // PESTEL integration — query params
  const pestelProjectId = searchParams.get("pestelProjectId");
  const pestelProjectName = searchParams.get("pestelProjectName");
  const pestelProjectType = searchParams.get("pestelProjectType") as ProjectType | null;
  const pestAnalysisId = searchParams.get("pestAnalysisId");
  const fromPESTEL = searchParams.get("from") === "pestel" && !!pestelProjectId;

  // Fontana integration (Pieza 3, Flujo 1) — query params
  const fontanaSesionId = searchParams.get("fontanaSesionId");
  const fromFontana = searchParams.get("from") === "fontana" && !!fontanaSesionId;

  // Pre-fill if coming from PESTEL
  useEffect(() => {
    if (fromPESTEL) {
      if (pestelProjectName) setName(pestelProjectName);
      const validTypes: ProjectType[] = ["electoral", "gubernamental", "legislativo", "ciudadano"];
      if (pestelProjectType && validTypes.includes(pestelProjectType)) {
        setType(pestelProjectType);
      }
    }
  }, [fromPESTEL, pestelProjectName, pestelProjectType]);

  const projectTypes: ProjectType[] = ["electoral", "gubernamental", "legislativo", "ciudadano"];
  const canAdvanceStep1 = name.trim().length >= 3 && type !== null;
  const canAdvanceStep2 = territory !== null;

  const handleCreate = async () => {
    if (!type || !name.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/moddulo/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: name.trim(),
          description: description.trim(),
          color,
          territorio: territory,
          pestelProjectId: fromPESTEL ? pestelProjectId : undefined,
          pestAnalysisId: fromPESTEL && pestAnalysisId ? pestAnalysisId : undefined,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al crear el proyecto");
        return;
      }

      if (fromPESTEL && pestAnalysisId) {
        router.push(`/moddulo/proyecto/${data.project.id}/exploracion?pest_analysis_id=${pestAnalysisId}`);
        return;
      }

      if (fromFontana) {
        setCreatedProjectId(data.project.id);
        await vincularFontana(data.project.id);
        return;
      }

      router.push(`/moddulo/proyecto/${data.project.id}/proposito`);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsCreating(false);
    }
  };

  // Pieza 3 — el proyecto YA existe cuando esto se llama; un fallo aquí
  // nunca lo pierde. Punto 2 (verificación en navegador, 2026-08-19) —
  // corregido: un proyecto recién creado SIEMPRE nace en F1-Propósito
  // (lib/moddulo/project.ts) — nunca se salta a F3 directo (eso dejaba
  // el proyecto en un estado roto: "Sin HEI disponible", 0 tareas del
  // PIP, porque F1/F2 nunca se completaron). El marcador fontanaPendiente
  // ya quedó escrito en el proyecto por vincular-moddulo antes de
  // redirigir — el banner de F3 lo detecta solo cuando el usuario
  // complete F1/F2 y llegue ahí por el camino normal, sin depender de
  // ningún query param en esta redirección.
  async function vincularFontana(projectId: string) {
    if (!fontanaSesionId) return;
    setVinculandoFontana(true);
    setFontanaLinkError(null);
    try {
      const res = await fetch(`/api/fontana/sesion/${fontanaSesionId}/vincular-moddulo`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ modduloProjectId: projectId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFontanaLinkError(d.message ?? "El proyecto se creó, pero no se pudo vincular tu resultado de Fontana.");
        return;
      }
      router.push(`/moddulo/proyecto/${projectId}/proposito`);
    } catch {
      setFontanaLinkError("El proyecto se creó, pero no se pudo vincular tu resultado de Fontana.");
    } finally {
      setVinculandoFontana(false);
    }
  }

  const STEP_LABELS = ["Nombre y tipo", "Territorio", "Confirmación"];

  return (
    <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      {/* Header */}
      <div className="bg-bluegreen-eske text-white-eske py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link
            href="/moddulo"
            className="text-white-eske/70 hover:text-white-eske text-sm flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Mis Proyectos
          </Link>
          <span className="text-white-eske/40">/</span>
          <span className="font-medium text-sm">Nuevo Proyecto</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {/* Banner PESTEL */}
        {fromPESTEL && (
          <div className="mb-6 flex items-start gap-3 bg-bluegreen-eske/10 border border-bluegreen-eske/30
            rounded-xl px-4 py-3">
            <span className="text-lg shrink-0" aria-hidden="true">🛡️</span>
            <div>
              <p className="text-sm font-semibold text-bluegreen-eske-60">
                Proyecto vinculado a PESTEL
              </p>
              <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5">
                El análisis PESTEL de{" "}
                <strong>{pestelProjectName ?? "tu proyecto PESTEL"}</strong>{" "}
                estará disponible para importar en la Fase 2 — Exploración.
              </p>
            </div>
          </div>
        )}

        {/* Indicador de pasos */}
        <div className="flex items-center gap-2 mb-8">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step >= s
                    ? "bg-bluegreen-eske text-white-eske"
                    : "bg-gray-eske-20 dark:bg-[#21425E] text-gray-eske-50 dark:text-[#9AAEBE]"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-12 transition-colors ${
                    step > s ? "bg-bluegreen-eske" : "bg-gray-eske-20 dark:bg-[#21425E]"
                  }`}
                />
              )}
            </div>
          ))}
          <span className="ml-2 text-sm text-gray-eske-50 dark:text-[#9AAEBE]">
            {STEP_LABELS[step - 1]}
          </span>
        </div>

        {/* Step 1: Nombre, tipo y color */}
        {step === 1 && (
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 p-6">
            <h1 className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mb-1">
              Nuevo proyecto estratégico
            </h1>
            <p className="text-black-eske-10 dark:text-[#C7D6E0] font-medium text-sm mb-6">
              Define el nombre y el tipo de proyecto político que vas a desarrollar.
            </p>

            {/* Nombre */}
            <div className="mb-5">
              <label htmlFor="project-name" className="block text-sm font-medium text-black-eske-10 dark:text-[#C7D6E0] mb-2">
                Nombre del proyecto <span className="text-red-eske">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Campaña Municipal Guadalajara 2027"
                className="w-full px-4 py-3 rounded-lg border border-gray-eske-20 dark:border-white/10
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske/30
                  focus-visible:border-bluegreen-eske bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] text-sm"
                maxLength={100}
                autoFocus={!fromPESTEL}
              />
              <p className="text-xs text-gray-eske-40 dark:text-[#6D8294] mt-1">{name.length}/100</p>
            </div>

            {/* Descripción */}
            <div className="mb-6">
              <label htmlFor="project-description" className="block text-sm font-medium text-black-eske-10 dark:text-[#C7D6E0] mb-2">
                Descripción breve <span className="text-gray-eske-40">(opcional)</span>
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Un párrafo que contextualice el proyecto..."
                rows={2}
                className="w-full px-4 py-3 rounded-lg border border-gray-eske-20 dark:border-white/10
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske/30
                  focus-visible:border-bluegreen-eske bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] text-sm resize-none"
                maxLength={300}
              />
            </div>

            {/* Color del proyecto */}
            <div className="mb-6">
              <p className="text-sm font-medium text-black-eske-10 dark:text-[#C7D6E0] mb-3">
                Color del proyecto
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {["#026988", "#248cc1", "#ffa366", "#649941", "#ffd14a", "#d10f3f", "#474747"].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => { setColor(hex); setShowCustomColor(false); }}
                    aria-label={`Color ${hex}`}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === hex && !showCustomColor
                        ? "border-black-eske dark:border-white-eske scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustomColor((v) => !v)}
                  aria-label="Color personalizado"
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-colors ${
                    showCustomColor
                      ? "border-bluegreen-eske bg-bluegreen-eske/10 text-bluegreen-eske"
                      : "border-gray-eske-20 dark:border-white/20 text-gray-eske-50 dark:text-[#9AAEBE] hover:border-gray-eske-40"
                  }`}
                >
                  +
                </button>
                <div
                  className="w-6 h-6 rounded-full border border-gray-eske-20 dark:border-white/10 ml-1"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
              </div>
              {showCustomColor && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => { setColor(e.target.value); setCustomHex(e.target.value); }}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-eske-20"
                    aria-label="Selector de color"
                  />
                  <input
                    type="text"
                    value={customHex || color}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomHex(v);
                      if (/^#[0-9A-Fa-f]{6}$/.test(v)) setColor(v);
                    }}
                    placeholder="#026988"
                    maxLength={7}
                    className="w-28 px-3 py-1.5 rounded border border-gray-eske-20 dark:border-white/10
                      bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8] text-sm
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske/30"
                  />
                  <span className="text-xs text-gray-eske-50 dark:text-[#9AAEBE]">Hex</span>
                </div>
              )}
            </div>

            {/* Tipo de proyecto */}
            <div className="mb-6">
              <p className="text-sm font-medium text-black-eske-10 dark:text-[#C7D6E0] mb-3">
                Tipo de proyecto <span className="text-red-eske">*</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projectTypes.map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setType(pt)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      type === pt
                        ? "border-bluegreen-eske bg-bluegreen-eske/5"
                        : "border-gray-eske-20 dark:border-white/10 hover:border-gray-eske-40 dark:hover:border-white/20"
                    }`}
                  >
                    <div className="font-bold text-black-eske dark:text-[#EAF2F8] text-sm mb-1">
                      {PROJECT_TYPE_LABELS[pt]}
                    </div>
                    <div className="text-xs text-black-eske-10 dark:text-[#9AAEBE] font-medium leading-relaxed">
                      {PROJECT_TYPE_DESCRIPTIONS[pt]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canAdvanceStep1}
              className="w-full py-3 bg-bluegreen-eske text-white-eske rounded-lg font-medium
                text-sm disabled:opacity-40 disabled:cursor-not-allowed
                hover:bg-bluegreen-eske/90 transition-colors"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step 2: Territorio */}
        {step === 2 && (
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 p-6">
            <TerritorySelector
              territorio={territory}
              onChange={setTerritory}
              onNext={() => { if (canAdvanceStep2) setStep(3); }}
              onBack={() => setStep(1)}
              label="¿Cuál es el territorio de tu proyecto?"
              tipoProyecto={type ?? undefined}
              nombreProyecto={name}
              descripcionProyecto={description}
            />
          </div>
        )}

        {/* Step 3: Confirmación */}
        {step === 3 && (
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 p-6">
            <h1 className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mb-1">
              Confirma tu proyecto
            </h1>
            {fromPESTEL && pestAnalysisId ? (
              <p className="text-black-eske-10 dark:text-[#C7D6E0] font-medium text-sm mb-6">
                Al crear el proyecto irás directo a la Fase 2 — Exploración con el análisis PESTEL ya importado. Puedes completar la Fase 1 — Propósito después.
              </p>
            ) : (
              <p className="text-black-eske-10 dark:text-[#C7D6E0] font-medium text-sm mb-6">
                Al crear el proyecto, Moddulo te guiará a través de la Fase 1 — Propósito,
                donde definirás las variables XPCTO del proyecto.
              </p>
            )}

            {/* Resumen */}
            <div className="bg-gray-eske-10 dark:bg-[#112230] rounded-lg p-4 mb-6 space-y-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-eske-40 dark:text-[#6D8294]">Nombre</span>
                <p className="text-black-eske dark:text-[#EAF2F8] font-medium mt-0.5">{name}</p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-eske-40 dark:text-[#6D8294]">Tipo</span>
                <p className="text-black-eske dark:text-[#EAF2F8] font-medium mt-0.5">
                  {type && PROJECT_TYPE_LABELS[type]}
                </p>
                <p className="text-gray-eske-50 dark:text-[#9AAEBE] text-xs mt-0.5">
                  {type && PROJECT_TYPE_DESCRIPTIONS[type]}
                </p>
              </div>
              {territory && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-eske-40 dark:text-[#6D8294]">Territorio</span>
                  <p className="text-black-eske dark:text-[#EAF2F8] font-medium mt-0.5">{territory.nombre}</p>
                  <p className="text-gray-eske-50 dark:text-[#9AAEBE] text-xs mt-0.5 capitalize">{territory.nivel}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-eske-40 dark:text-[#6D8294]">Color</span>
                <div
                  className="w-5 h-5 rounded-full border border-gray-eske-20 dark:border-white/10"
                  style={{ backgroundColor: color }}
                  aria-label={`Color: ${color}`}
                />
                <span className="text-xs text-gray-eske-50 dark:text-[#9AAEBE]">{color}</span>
              </div>
              {description && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-eske-40 dark:text-[#6D8294]">Descripción</span>
                  <p className="text-black-eske-10 dark:text-[#C7D6E0] text-sm mt-0.5">{description}</p>
                </div>
              )}
              {fromPESTEL && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-eske-40 dark:text-[#6D8294]">Vinculado a PESTEL</span>
                  <p className="text-bluegreen-eske text-sm font-medium mt-0.5">
                    {pestelProjectName ?? pestelProjectId}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-eske/10 border border-red-eske/30 rounded-lg text-red-eske text-sm">
                {error}
              </div>
            )}

            {fontanaLinkError && createdProjectId && (
              <div className="mb-4 p-3 bg-yellow-eske/10 border border-yellow-eske/30 rounded-lg text-sm text-black-eske dark:text-[#EAF2F8] space-y-2">
                <p>{fontanaLinkError}</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => vincularFontana(createdProjectId)}
                    disabled={vinculandoFontana}
                    className="text-bluegreen-eske font-medium hover:underline disabled:opacity-50"
                  >
                    {vinculandoFontana ? "Reintentando…" : "Reintentar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/moddulo/proyecto/${createdProjectId}/proposito`)}
                    className="text-gray-eske-60 dark:text-[#9AAEBE] hover:underline"
                  >
                    Continuar de todas formas
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={isCreating}
                className="flex-1 py-3 border border-gray-eske-20 dark:border-white/10 text-gray-eske-60 dark:text-[#C7D6E0] rounded-lg
                  font-medium text-sm hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                Regresar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-[2] py-3 bg-bluegreen-eske text-white-eske rounded-lg font-medium
                  text-sm disabled:opacity-60 hover:bg-bluegreen-eske/90 transition-colors
                  flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white-eske/30 border-t-white-eske rounded-full animate-spin" aria-hidden="true" />
                    Creando proyecto...
                  </>
                ) : (
                  "Crear proyecto y comenzar"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NuevoProyectoPage() {
  return (
    <Suspense>
      <NuevoProyectoContent />
    </Suspense>
  );
}
