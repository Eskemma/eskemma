"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import PESTELStageNav from "@/app/components/centinela/pestel/PESTELStageNav";
import { useParams, useRouter } from "next/navigation";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import type {
  PESTELProject,
  CoverageStatus,
  DimensionCode,
  ReliabilityLevel,
} from "@/types/pestel.types";

const DIMENSION_LABELS: Record<DimensionCode, string> = {
  P: "Político",
  E: "Económico",
  S: "Social",
  T: "Tecnológico",
  L: "Legal / Ambiental",
};

const RELIABILITY_LABELS: Record<ReliabilityLevel, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

type StatusIndicator = "green" | "yellow" | "red";

const STATUS_CONFIG: Record<
  StatusIndicator,
  { label: string; color: string; bg: string; icon: string }
> = {
  green: {
    label: "Cobertura buena",
    color: "text-green-eske",
    bg: "bg-green-eske/10",
    icon: "🟢",
  },
  yellow: {
    label: "Fuentes automáticas",
    color: "text-black-eske",
    bg: "bg-yellow-eske/10",
    icon: "🟡",
  },
  red: {
    label: "Datos con baja confiabilidad",
    color: "text-red-eske",
    bg: "bg-red-eske/10",
    icon: "🔴",
  },
};

export default function DatosPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<PESTELProject | null>(null);
  const [coverage, setCoverage] = useState<CoverageStatus[]>([]);
  const [canTrigger, setCanTrigger] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual data form
  const [inputTab, setInputTab] = useState<"text" | "file">("text");
  const [manualContent, setManualContent] = useState("");
  const [manualDimension, setManualDimension] = useState<DimensionCode>("P");
  const [manualSource, setManualSource] = useState("");
  const [manualReliability, setManualReliability] =
    useState<ReliabilityLevel>("MEDIUM");
  const [savingManual, setSavingManual] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState("");
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch("/api/centinela/pestel/project");
      if (!res.ok) throw new Error("Error al cargar proyectos");
      const data = (await res.json()) as {
        projects: (PESTELProject & { id: string })[];
      };
      const found = data.projects.find((p) => p.id === projectId);
      if (found) setProject(found);
    } catch {
      setError("No se pudo cargar el proyecto.");
    }
  }, [projectId]);

  const loadCoverage = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/coverage`
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        coverage: CoverageStatus[];
        canTriggerAnalysis: boolean;
      };
      setCoverage(data.coverage);
      setCanTrigger(data.canTriggerAnalysis);
    } catch {
      // Silent — coverage is non-blocking
    }
  }, [projectId]);

  useEffect(() => {
    Promise.all([loadProject(), loadCoverage()]).finally(() =>
      setLoading(false)
    );
  }, [loadProject, loadCoverage]);

  async function handleSaveManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualContent.trim()) return;

    setSavingManual(true);
    setManualSuccess(false);

    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/data-source`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: manualContent.trim(),
            dimensionCode: manualDimension,
            source: manualSource.trim() || "Carga manual",
            reliabilityLevel: manualReliability,
          }),
        }
      );

      if (!res.ok) throw new Error("Error al guardar");

      setManualContent("");
      setManualSource("");
      setManualSuccessMsg("✓ Dato guardado. El semáforo ha sido actualizado.");
      setManualSuccess(true);
      setTimeout(() => setManualSuccess(false), 3000);
      // Refresh coverage after adding data
      await loadCoverage();
    } catch {
      setError("No se pudo guardar el dato.");
    } finally {
      setSavingManual(false);
    }
  }

  async function handleUploadFile(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setSavingManual(true);
    setManualSuccess(false);
    setFileError(null);

    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("dimensionCode", manualDimension);
      form.append("source", manualSource.trim() || selectedFile.name);
      form.append("reliabilityLevel", manualReliability);

      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/upload-source`,
        { method: "POST", body: form }
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Error al procesar archivo");
      }

      const data = (await res.json()) as {
        extractedLength: number;
        method: "text" | "vision";
      };
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setManualSource("");
      const visionNote =
        data.method === "vision"
          ? " Las páginas con gráficas e imágenes fueron interpretadas con IA."
          : "";
      setManualSuccessMsg(
        `✓ Archivo guardado correctamente. Será incluido como fuente en el análisis.${visionNote}`
      );
      setManualSuccess(true);
      setTimeout(() => setManualSuccess(false), 6000);
      await loadCoverage();
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : "Error al procesar archivo"
      );
    } finally {
      setSavingManual(false);
    }
  }

  async function handleTrigger() {
    if (!canTrigger || triggering) return;
    setTriggering(true);
    setError(null);

    try {
      const res = await fetch("/api/centinela/pestel/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) throw new Error("Error al iniciar análisis");
      const { jobId } = (await res.json()) as { jobId: string };
      router.push(`/centinela/pestel/${projectId}/analisis?jobId=${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setTriggering(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-bluegreen-eske border-t-transparent
          rounded-full animate-spin" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      {/* Header */}
      <div className="bg-bluegreen-eske text-white px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push("/centinela/pestel")}
            className="text-sm text-white/70 hover:text-white mb-2 flex items-center
              gap-1 transition-colors"
            aria-label="Volver a PESTEL"
          >
            ← PESTEL
          </button>
          <h1 className="text-2xl font-semibold">
            {project?.nombre ?? "Proyecto"}
          </h1>
          <p className="text-white/80 text-sm mt-1">
            Etapa 4 — Recolección de datos
          </p>
        </div>
      </div>

      {/* Navegación de etapas */}
      {project && (
        <PESTELStageNav
          projectId={projectId}
          currentStage={project.currentStage ?? 4}
          activeStage={4}
        />
      )}

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Coverage semaphore */}
        <section aria-labelledby="coverage-heading">
          <h2
            id="coverage-heading"
            className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-4 flex items-center gap-2"
          >
            Semáforo de cobertura
            <InfoTooltip
              content="El semáforo indica si cada dimensión PEST-L tiene suficientes datos para un análisis confiable. 🟢 Verde (≥60% confianza): la dimensión puede analizarse. 🟡 Amarillo (30-59%): se recomienda agregar más fuentes. 🔴 Rojo (<30%): cobertura insuficiente, el análisis no puede ejecutarse hasta alcanzar el mínimo. La columna 'Confianza' refleja la calidad y cantidad de fuentes disponibles, ponderada por su nivel de confiabilidad."
              placement="right"
            />
          </h2>
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 overflow-hidden">
            {coverage.length === 0 ? (
              <div className="p-6 text-sm text-black-eske dark:text-[#9AAEBE] text-center">
                Sin datos aún. Agrega fuentes para ver el estado de cobertura.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-eske-10 dark:border-white/10 bg-gray-eske-10 dark:bg-[#112230]">
                    <th className="text-left px-4 py-3 font-medium text-black-eske dark:text-[#C7D6E0]">
                      Dimensión
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-black-eske dark:text-[#C7D6E0]">
                      Estado
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-black-eske dark:text-[#C7D6E0]">
                      Fuentes
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-black-eske dark:text-[#C7D6E0]">
                      Confianza
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((c) => {
                    const config = STATUS_CONFIG[c.status];
                    return (
                      <tr
                        key={c.code}
                        className="border-b border-gray-eske-10 dark:border-white/10 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-black-eske dark:text-[#C7D6E0]">
                          <span className="text-xs text-bluegreen-eske font-bold mr-2">
                            {c.code}
                          </span>
                          {DIMENSION_LABELS[c.code]}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                              "text-xs font-medium",
                              config.bg,
                              config.color,
                            ].join(" ")}
                          >
                            <span aria-hidden="true">{config.icon}</span>
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-black-eske dark:text-[#C7D6E0]">
                          {c.variablesWithData}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-eske-20 dark:bg-[#21425E] rounded-full max-w-24">
                              <div
                                className={[
                                  "h-1.5 rounded-full transition-all",
                                  c.confidence >= 60
                                    ? "bg-green-eske"
                                    : c.confidence >= 40
                                    ? "bg-yellow-eske"
                                    : "bg-red-eske",
                                ].join(" ")}
                                style={{ width: `${c.confidence}%` }}
                                role="progressbar"
                                aria-valuenow={c.confidence}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                            <span className="text-xs text-black-eske dark:text-[#C7D6E0] w-10">
                              {c.confidence}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Manual data form */}
        <section aria-labelledby="manual-heading">
          <h2
            id="manual-heading"
            className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-4"
          >
            Agregar dato manualmente
          </h2>
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-6">
            <p className="text-sm text-black-eske dark:text-[#C7D6E0] mb-5">
              Encuestas propias, notas de campo, entrevistas u otros datos
              que la IA no puede recopilar automáticamente.
            </p>
            <form
              onSubmit={inputTab === "text" ? handleSaveManual : handleUploadFile}
              className="flex flex-col gap-4"
            >
              {/* Input mode tabs */}
              <div>
                <label className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5 mb-2">
                  Contenido
                  <InfoTooltip
                    content="Información que tú o tu equipo recopilaron en campo y que la IA no puede obtener automáticamente. Se integra al análisis con la ponderación que asignes."
                    example="42% aprueba la gestión del alcalde — Encuesta telefónica, n=300, marzo 2026"
                  />
                </label>
                {/* Tabs */}
                <div className="flex border-b border-gray-eske-20 dark:border-white/10 mb-3" role="tablist">
                  {(["text", "file"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={inputTab === tab}
                      onClick={() => {
                        setInputTab(tab);
                        setFileError(null);
                      }}
                      className={[
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                        inputTab === tab
                          ? "border-bluegreen-eske text-bluegreen-eske"
                          : "border-transparent text-gray-eske-60 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8]",
                      ].join(" ")}
                    >
                      {tab === "text" ? "Texto" : "Archivo"}
                    </button>
                  ))}
                </div>

                {/* Text tab */}
                {inputTab === "text" && (
                  <textarea
                    id="manual-content"
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder="Pega aquí el texto de la encuesta, nota de campo o entrevista…"
                    rows={4}
                    className="w-full px-3 py-2.5 border border-gray-eske-30 dark:border-white/10 rounded-lg
                      text-sm focus:outline-none focus-visible:ring-2
                      focus-visible:ring-bluegreen-eske placeholder:text-gray-eske-50 dark:placeholder-[#6D8294]
                      bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
                      resize-none"
                    required={inputTab === "text"}
                  />
                )}

                {/* File tab */}
                {inputTab === "file" && (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="file-upload"
                      className={[
                        "flex flex-col items-center justify-center gap-2",
                        "border-2 border-dashed rounded-lg px-4 py-6 cursor-pointer",
                        "transition-colors text-center",
                        selectedFile
                          ? "border-bluegreen-eske bg-bluegreen-eske/5 dark:bg-bluegreen-eske/10"
                          : "border-gray-eske-30 dark:border-white/10 hover:border-bluegreen-eske/60",
                      ].join(" ")}
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {selectedFile ? "📄" : "⬆️"}
                      </span>
                      {selectedFile ? (
                        <span className="text-sm font-medium text-bluegreen-eske">
                          {selectedFile.name}
                          <span className="ml-2 text-xs text-black-eske dark:text-[#9AAEBE] font-normal">
                            ({(selectedFile.size / 1024).toFixed(0)} KB)
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-black-eske dark:text-[#C7D6E0]">
                          Arrastra un archivo o{" "}
                          <span className="text-bluegreen-eske font-medium underline">
                            haz clic para seleccionar
                          </span>
                        </span>
                      )}
                      <span className="text-xs text-black-eske dark:text-[#9AAEBE]">
                        PDF, Word (.docx) o texto plano — máx. 10 MB
                      </span>
                      <input
                        id="file-upload"
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.md"
                        className="sr-only"
                        onChange={(e) => {
                          setSelectedFile(e.target.files?.[0] ?? null);
                          setFileError(null);
                        }}
                        required={inputTab === "file"}
                      />
                    </label>
                    {fileError && (
                      <p className="text-xs text-red-eske">{fileError}</p>
                    )}
                    {selectedFile && (
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-gray-eske-60 hover:text-red-eske
                          transition-colors self-start"
                      >
                        ✕ Quitar archivo
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="manual-dim"
                    className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5"
                  >
                    Dimensión
                    <InfoTooltip
                      content="Indica a qué dimensión PEST-L pertenece este dato para que el sistema lo incorpore en el análisis correcto."
                      example="Una encuesta de seguridad → Dimensión S (Social)"
                    />
                  </label>
                  <select
                    id="manual-dim"
                    value={manualDimension}
                    onChange={(e) =>
                      setManualDimension(e.target.value as DimensionCode)
                    }
                    className="px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
                      bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
                  >
                    {(["P", "E", "S", "T", "L"] as DimensionCode[]).map(
                      (code) => (
                        <option key={code} value={code}>
                          {code} — {DIMENSION_LABELS[code]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="manual-source"
                    className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5"
                  >
                    Fuente
                    <InfoTooltip
                      content="Nombre de la fuente para que el análisis pueda citarla en las narrativas."
                      example="Encuesta telefónica interna, n=300, marzo 2026"
                    />
                  </label>
                  <input
                    id="manual-source"
                    type="text"
                    value={manualSource}
                    onChange={(e) => setManualSource(e.target.value)}
                    placeholder="ej. Encuesta propia, Entrevista…"
                    className="px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
                      placeholder:text-gray-eske-50 dark:placeholder-[#6D8294]
                      bg-white dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="manual-reliability"
                    className="text-sm font-medium text-black-eske dark:text-[#C7D6E0] flex items-center gap-1.5"
                  >
                    Confiabilidad
                    <InfoTooltip
                      content="Alta = datos propios verificados. Media = estimaciones o fuentes secundarias. Baja = rumores o datos sin verificar. Afecta el semáforo de cobertura."
                      example="Datos de INEGI → Alta; percepción de un informante clave → Baja"
                    />
                  </label>
                  <select
                    id="manual-reliability"
                    value={manualReliability}
                    onChange={(e) =>
                      setManualReliability(e.target.value as ReliabilityLevel)
                    }
                    className="px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
                      bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
                  >
                    {(["HIGH", "MEDIUM", "LOW"] as ReliabilityLevel[]).map(
                      (level) => (
                        <option key={level} value={level}>
                          {RELIABILITY_LABELS[level]}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {manualSuccess && (
                <p className="text-sm text-green-eske bg-green-eske/10 px-3 py-2 rounded-lg">
                  {manualSuccessMsg}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={
                    savingManual ||
                    (inputTab === "text" && !manualContent.trim()) ||
                    (inputTab === "file" && !selectedFile)
                  }
                  className="px-5 py-2.5 bg-bluegreen-eske text-white rounded-lg
                    text-sm font-medium hover:bg-bluegreen-eske-60 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingManual
                    ? inputTab === "file"
                      ? selectedFile?.name.endsWith(".pdf")
                        ? "Analizando con IA…"
                        : "Procesando…"
                      : "Guardando…"
                    : inputTab === "file"
                    ? "Extraer y guardar"
                    : "Guardar dato"}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Automatic sources info */}
        <section aria-labelledby="auto-heading">
          <h2
            id="auto-heading"
            className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-4"
          >
            Fuentes automáticas
          </h2>
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-6">
            <p className="text-sm text-black-eske dark:text-[#C7D6E0] mb-3">
              Al ejecutar el análisis, PESTEL recopila automáticamente datos
              de las siguientes fuentes públicas para el territorio configurado:
            </p>
            <ul className="text-sm text-black-eske dark:text-[#C7D6E0] list-none flex flex-col gap-1.5">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-bluegreen-eske shrink-0" aria-hidden="true" />
                Google News — noticias recientes del territorio
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-bluegreen-eske shrink-0" aria-hidden="true" />
                DOF — Diario Oficial de la Federación (decretos, normas)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-bluegreen-eske shrink-0" aria-hidden="true" />
                INEGI — indicadores económicos y sociales
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-bluegreen-eske shrink-0" aria-hidden="true" />
                INE — resultados de elecciones y datos del Padrón y LNE
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-bluegreen-eske shrink-0" aria-hidden="true" />
                Banxico — series financieras y monetarias
              </li>
            </ul>
            <p className="text-xs text-bluegreen-eske mt-3 font-medium">
              Puedes ejecutar el análisis con solo estas fuentes automáticas.
              Los datos que agregues manualmente enriquecen el análisis,
              pero no son obligatorios.
            </p>
          </div>
        </section>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-eske dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Trigger */}
        <div className="flex flex-col items-center gap-3 py-4">
          {!canTrigger && coverage.length > 0 && (
            <p className="text-sm text-red-eske text-center max-w-md">
              Una o más dimensiones tienen datos con baja confiabilidad (&lt;40%).
              Revisa o elimina esos datos antes de continuar.
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTrigger}
              disabled={!canTrigger || triggering}
              className="px-8 py-3 bg-orange-eske text-white rounded-xl text-base
                font-semibold hover:bg-orange-eske-60 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {triggering ? "Iniciando análisis…" : "Ejecutar análisis IA"}
            </button>
            <InfoTooltip
              content="Inicia el análisis con IA usando todas las fuentes disponibles. El proceso tarda 2-8 minutos y no se puede cancelar una vez iniciado."
            />
          </div>
          <p className="text-xs text-black-eske dark:text-[#9AAEBE] text-center max-w-sm">
            El análisis puede tardar 2-8 minutos. Serás redirigido
            automáticamente al completarse.
          </p>
        </div>
      </div>
    </div>
  );
}
