// app/moddulo/proyecto/[projectId]/proposito/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import ModduloChat from "@/app/moddulo/components/ModduloChat";
import PhaseTransitionReview from "@/app/moddulo/components/PhaseTransitionReview";
import PhaseReportView from "@/app/moddulo/components/PhaseReportView";
import { detectRisks } from "@/lib/moddulo/risks";
import type { XPCTO, ProjectType, ChatMessage, PhaseId, Dictamen, Territorio } from "@/types/moddulo.types";
import { PHASE_ORDER } from "@/types/moddulo.types";

// ==========================================
// TIPOS LOCALES
// ==========================================

type XPCTOForm = {
  hito: string;
  sujeto: string;
  capacidades: { financiero: string; humano: string; logistico: string };
  tiempo: { fechaLimite: string; duracionMeses: number };
  justificacion: string;
};

type PageMode = "active" | "completed" | "editing";

const emptyForm = (): XPCTOForm => ({
  hito: "",
  sujeto: "",
  capacidades: { financiero: "", humano: "", logistico: "" },
  tiempo: { fechaLimite: "", duracionMeses: 0 },
  justificacion: "",
});

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function PropositoPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;

  const [form, setForm] = useState<XPCTOForm>(emptyForm());
  const [editForm, setEditForm] = useState<XPCTOForm>(emptyForm());
  const [projectType, setProjectType] = useState<ProjectType>("electoral");
  // A1 — Landing page: metadatos del proyecto
  const [showLanding, setShowLanding] = useState(true);
  const [projectName, setProjectName] = useState<string>("");
  const [projectColor, setProjectColor] = useState<string>("#026988");
  const [projectTerritory, setProjectTerritory] = useState<Territorio | null>(null);
  const [mode, setMode] = useState<PageMode>("active");
  const [reportText, setReportText] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);  // muestra reporte en columna izquierda
  const [isSaving, setIsSaving] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isClosingPhase, setIsClosingPhase] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [propagationWarning, setPropagationWarning] = useState<PhaseId[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [dictamen, setDictamen] = useState<Dictamen | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const prevFormComplete = useRef(false);
  const preEditModeRef = useRef<PageMode>("active");
  const [mobileTab, setMobileTab] = useState<"chat" | "form">("chat");

  // Cargar proyecto al montar
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/moddulo/projects/${projectId}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          console.error(`[proposito] API error ${r.status}:`, await r.text());
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data?.project) return;
        const p = data.project;
        setProjectType(p.type ?? "electoral");
        setProjectName(p.name ?? "");
        setProjectColor(p.color ?? "#026988");
        if (p.territorio) setProjectTerritory(p.territorio);

        // Poblar formulario desde xpcto
        const xpcto = p.xpcto;
        if (xpcto) {
          const loaded: XPCTOForm = {
            hito: xpcto.hito ?? "",
            sujeto: xpcto.sujeto ?? "",
            capacidades: {
              financiero: xpcto.capacidades?.financiero ?? "",
              humano: xpcto.capacidades?.humano ?? "",
              logistico: xpcto.capacidades?.logistico ?? "",
            },
            tiempo: {
              fechaLimite: xpcto.tiempo?.fechaLimite ?? "",
              duracionMeses: xpcto.tiempo?.duracionMeses ?? 0,
            },
            justificacion: xpcto.justificacion ?? "",
          };
          setForm(loaded);
          setEditForm(loaded);
        }

        // Detectar si la fase está completada
        const phaseStatus = p.phases?.proposito?.status;
        if (phaseStatus === "completed") setMode("completed");

        // A1 — Ocultar landing si ya inició o completó la fase
        if (p.phases?.proposito?.started || phaseStatus === "completed") {
          setShowLanding(false);
        }

        // Cargar historial del chat
        const chatHistory = p.phases?.proposito?.chatHistory;
        if (Array.isArray(chatHistory) && chatHistory.length > 0) {
          setChatMessages(chatHistory as ChatMessage[]);
        }

        // Cargar reportText (siempre, no solo cuando está completada)
        // Detectar el caso legacy donde se almacenó el JSON completo como reportText
        const savedDictamen = p.phases?.proposito?.dictamen as Dictamen | undefined;
        const rawSavedReport = p.phases?.proposito?.reportText as string | undefined;
        if (rawSavedReport) {
          try {
            let jsonToParse = rawSavedReport.trim();
            const fenceMatch = jsonToParse.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
            if (fenceMatch) jsonToParse = fenceMatch[1].trim();
            const maybeJson = JSON.parse(jsonToParse) as { reportText?: string; dictamen?: Dictamen };
            if (maybeJson?.reportText && typeof maybeJson.reportText === "string") {
              setReportText(maybeJson.reportText);
              if (!savedDictamen && maybeJson.dictamen) setDictamen(maybeJson.dictamen);
            } else {
              setReportText(rawSavedReport);
            }
          } catch {
            setReportText(rawSavedReport);
          }
        }

        // Cargar dictamen si existe en Firestore por separado
        if (savedDictamen) setDictamen(savedDictamen);
      })
      .catch((err) => console.error("[proposito] fetch error:", err))
      .finally(() => setIsLoaded(true));
  }, [projectId]);

  // Auto-calcular duracionMeses (sólo en modo activo/edicion)
  useEffect(() => {
    if (!form.tiempo.fechaLimite) return;
    const limite = new Date(form.tiempo.fechaLimite);
    const hoy = new Date();
    const meses = Math.max(0, Math.round((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    setForm((prev) => ({ ...prev, tiempo: { ...prev.tiempo, duracionMeses: meses } }));
  }, [form.tiempo.fechaLimite]);

  // Auto-guardar (solo en modo activo, después de que cargaron los datos)
  const autoSave = useCallback(async (formData: XPCTOForm) => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      await fetch(`/api/moddulo/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          xpcto: {
            hito: formData.hito,
            sujeto: formData.sujeto,
            capacidades: formData.capacidades,
            tiempo: formData.tiempo,
            justificacion: formData.justificacion,
          } satisfies Partial<XPCTO>,
        }),
      });
      setLastSaved(new Date());
    } catch {/* silencioso */} finally {
      setIsSaving(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isLoaded || mode !== "active") return;
    const timer = setTimeout(() => autoSave(form), 1500);
    return () => clearTimeout(timer);
  }, [form, autoSave, isLoaded, mode]);

  // A1 — Comenzar F1: marca la fase como iniciada y oculta la landing
  const handleComenzarF1 = () => {
    setShowLanding(false);
    fetch(`/api/moddulo/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phaseData: { phaseId: "proposito", started: true } }),
    }).catch(() => {});
  };

  // Datos del formulario como objeto plano para el chat
  const currentFormData = {
    "xpcto.hito": form.hito,
    "xpcto.sujeto": form.sujeto,
    "xpcto.capacidades.financiero": form.capacidades.financiero,
    "xpcto.capacidades.humano": form.capacidades.humano,
    "xpcto.capacidades.logistico": form.capacidades.logistico,
    "xpcto.tiempo.fechaLimite": form.tiempo.fechaLimite,
    "xpcto.tiempo.duracionMeses": form.tiempo.duracionMeses,
    "xpcto.justificacion": form.justificacion,
  };

  // Extraer datos del chat
  const handleDataExtracted = useCallback((data: Record<string, unknown>) => {
    setForm((prev) => {
      const next = { ...prev };
      if (typeof data["xpcto.hito"] === "string") next.hito = data["xpcto.hito"];
      if (typeof data["xpcto.sujeto"] === "string") next.sujeto = data["xpcto.sujeto"];
      if (typeof data["xpcto.capacidades.financiero"] === "string")
        next.capacidades = { ...next.capacidades, financiero: data["xpcto.capacidades.financiero"] };
      if (typeof data["xpcto.capacidades.humano"] === "string")
        next.capacidades = { ...next.capacidades, humano: data["xpcto.capacidades.humano"] };
      if (typeof data["xpcto.capacidades.logistico"] === "string")
        next.capacidades = { ...next.capacidades, logistico: data["xpcto.capacidades.logistico"] };
      if (typeof data["xpcto.tiempo.fechaLimite"] === "string")
        next.tiempo = { ...next.tiempo, fechaLimite: data["xpcto.tiempo.fechaLimite"] };
      if (typeof data["xpcto.tiempo.duracionMeses"] === "number")
        next.tiempo = { ...next.tiempo, duracionMeses: data["xpcto.tiempo.duracionMeses"] };
      if (typeof data["xpcto.justificacion"] === "string") next.justificacion = data["xpcto.justificacion"];
      return next;
    });
  }, []);

  // Generar reporte diagnóstico via API (usado en activo, edición y cierre)
  const generateReport = async (formData: XPCTOForm): Promise<string | null> => {
    setIsGeneratingReport(true);
    try {
      const r = await fetch(`/api/moddulo/projects/${projectId}/generate-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phaseId: "proposito",
          xpcto: {
            hito: formData.hito,
            sujeto: formData.sujeto,
            capacidades: formData.capacidades,
            tiempo: formData.tiempo,
            justificacion: formData.justificacion,
          },
        }),
      });
      if (!r.ok) return null;
      const data = await r.json();
      if (data.dictamen) setDictamen(data.dictamen);
      return data.reportText ?? null;
    } catch {
      return null;
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Cerrar fase — guarda el reporte y navega a la siguiente fase
  const handleClosePhase = async () => {
    setIsClosingPhase(true);
    try {
      // Usar reporte existente o generar uno nuevo
      let report = reportText ?? extractReportFromMessages(chatMessages);
      if (!report) {
        report = await generateReport(form);
      }

      await fetch(`/api/moddulo/projects/${projectId}/complete-phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phaseId: "proposito", reportText: report ?? undefined }),
      });

      if (report) setReportText(report);
      setShowReview(false);
      // Navegar a la siguiente fase
      router.push(`/moddulo/proyecto/${projectId}/exploracion`);
    } catch {
      /* silencioso */
    } finally {
      setIsClosingPhase(false);
    }
  };

  // Entrar a modo edición
  const handleStartEdit = () => {
    preEditModeRef.current = mode;
    setEditForm({ ...form });
    setMode("editing");
    setShowReport(true);  // el reporte permanece visible durante la edición
  };

  // Cancelar edición sin guardar
  const handleCancelEdit = () => {
    setMode(preEditModeRef.current);
    setShowReport(true);
    setSaveStatus("idle");
  };

  // Guardar cambios del modo edición
  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      // 1. Guardar XPCTO en Firestore inmediatamente (operación rápida)
      const saveRes = await fetch(`/api/moddulo/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          xpcto: {
            hito: editForm.hito,
            sujeto: editForm.sujeto,
            capacidades: editForm.capacidades,
            tiempo: editForm.tiempo,
            justificacion: editForm.justificacion,
          } satisfies Partial<XPCTO>,
        }),
      });

      if (!saveRes.ok) throw new Error("save failed");

      setForm({ ...editForm });
      setLastSaved(new Date());
      setSaveStatus("saved");

      // 2. Volver al modo previo inmediatamente — el usuario ve el reporte (todavía el antiguo)
      setMode(preEditModeRef.current);
      setShowReport(true);
    } catch {
      setSaveStatus("error");
      setIsSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    } finally {
      setIsSaving(false);
    }

    // 3. Regenerar reporte en segundo plano (operación lenta — Claude)
    // El usuario ya ve el feedback de guardado y el reporte anterior mientras espera
    const snapshot = { ...editForm };
    const newReport = await generateReport(snapshot);
    if (newReport) setReportText(newReport);

    // 4. Verificar back-propagation
    const affected = await checkBackPropagation(projectId);
    if (affected.length > 0) setPropagationWarning(affected);

    setTimeout(() => setSaveStatus("idle"), 3000);
  };

  // Detectar cuando se completa el formulario por primera vez en modo activo
  const formComplete = isFormComplete(form);
  useEffect(() => {
    if (mode !== "active" || !isLoaded) return;
    if (formComplete && !prevFormComplete.current) {
      // Primera vez que todos los campos están llenos — notificar en consola
      // (la UI reacciona vía el estado formComplete)
      prevFormComplete.current = true;
    } else if (!formComplete) {
      prevFormComplete.current = false;
    }
  }, [formComplete, mode, isLoaded]);

  const risks = detectRisks(
    { hito: form.hito, sujeto: form.sujeto, capacidades: form.capacidades, tiempo: form.tiempo, justificacion: form.justificacion },
    projectType
  );

  // ==========================================
  // RENDER
  // ==========================================

  // Callback compartido para el botón Ver Resumen
  const handleVerResumen = async () => {
    if (reportText) {
      setShowReport(true);
      setMobileTab("chat"); // el reporte se muestra en la columna de chat
    } else {
      const report = await generateReport(form);
      if (report) {
        setReportText(report);
        setShowReport(true);
        setMobileTab("chat");
      }
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ===== A1 — LANDING DE F1 (primera visita) ===== */}
      {showLanding && isLoaded && (
        <F1LandingView
          projectName={projectName}
          projectType={projectType}
          projectTerritory={projectTerritory}
          onComenzar={handleComenzarF1}
        />
      )}

      {/* ===== HEADER RESPONSIVE ===== */}
      {!showLanding && <div className="shrink-0 px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        {/* Fila 1: título + estado + descarga */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske shrink-0">F1</span>
            <h1 className="text-sm sm:text-base font-bold text-black-eske dark:text-[#EAF2F8] truncate">Propósito</h1>
            {mode === "completed" && (
              <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">
                ✓ Lista
              </span>
            )}
            {mode === "editing" && (
              <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                Editando
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-xs hidden sm:block">
              {saveStatus === "saved" ? (
                <span className="text-green-eske font-medium">✓ Cambios guardados</span>
              ) : saveStatus === "error" ? (
                <span className="text-red-eske font-medium">✗ Error al guardar</span>
              ) : isSaving ? (
                <span className="text-gray-eske-40 dark:text-[#6D8294]">Guardando...</span>
              ) : lastSaved ? (
                <span className="text-gray-eske-40 dark:text-[#6D8294]">✓ {lastSaved.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
              ) : null}
            </span>
            <DownloadButton form={form} reportText={reportText} chatMessages={chatMessages} />
          </div>
        </div>

        {/* Fila 2: 3 botones según estado del EPP */}
        {(() => {
          const btnBase = "px-2.5 py-1.5 border border-bluegreen-eske-60 text-bluegreen-eske-60 bg-transparent rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:bg-bluegreen-eske/5";
          const btnClose = "px-2.5 py-1.5 bg-bluegreen-eske-60 text-white-eske rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors";
          const headerState: "en_progreso" | "lista" | "editando" =
            mode === "editing" ? "editando" :
            (formComplete && reportText !== null) ? "lista" :
            "en_progreso";

          return (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {/* Botón 1: Reporte F1 / Cancelar */}
              {headerState === "editando" ? (
                <button onClick={handleCancelEdit} className={btnBase}>Cancelar</button>
              ) : (
                <button
                  onClick={handleVerResumen}
                  disabled={!formComplete}
                  className={`${btnBase} flex items-center gap-1${isGeneratingReport ? " pointer-events-none" : ""}`}
                >
                  {isGeneratingReport ? (
                    <><div className="w-3 h-3 border-2 border-bluegreen-eske/30 border-t-bluegreen-eske rounded-full animate-spin" aria-hidden="true" /> Generando</>
                  ) : "Reporte F1"}
                </button>
              )}

              {/* Botón 2: Editar variables / Guardar cambios */}
              {headerState === "editando" ? (
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className={btnBase}
                >
                  {isSaving ? "Guardando..." : "Guardar cambios"}
                </button>
              ) : (
                <button
                  onClick={handleStartEdit}
                  disabled={!formComplete}
                  className={btnBase}
                >
                  Editar variables
                </button>
              )}

              {/* Botón 3: Cerrar Fase 1 — requiere reporte generado */}
              <button
                onClick={() => setShowReview(true)}
                disabled={!formComplete || reportText === null}
                className={formComplete && reportText !== null ? btnClose : `${btnBase} border-bluegreen-eske-60`}
              >
                Cerrar Fase 1
              </button>
            </div>
          );
        })()}
      </div>}

      {/* ===== TABS MOBILE (solo < lg) ===== */}
      {!showLanding && <div className="lg:hidden shrink-0 flex border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        <button
          onClick={() => setMobileTab("chat")}
          className={`flex-1 py-2 text-xs font-semibold transition-colors border-b-2 ${
            mobileTab === "chat"
              ? "border-bluegreen-eske text-bluegreen-eske"
              : "border-transparent text-gray-eske-50 dark:text-[#9AAEBE]"
          }`}
        >
          {showReport || mode === "completed" || mode === "editing" ? "📋 Reporte F1" : "💬 Chat"}
        </button>
        <button
          onClick={() => mode === "editing" && setMobileTab("form")}
          disabled={mode !== "editing"}
          className={`flex-1 py-2 text-xs font-semibold transition-colors border-b-2 ${
            mobileTab === "form" && mode === "editing"
              ? "border-bluegreen-eske text-bluegreen-eske"
              : mode !== "editing"
                ? "border-transparent text-gray-eske-40 dark:text-[#6D8294] opacity-50 cursor-not-allowed"
                : "border-transparent text-gray-eske-50 dark:text-[#9AAEBE]"
          }`}
        >
          📝 Variables XPCTO
          {mode !== "editing" && <span className="ml-1 opacity-60">(solo lectura)</span>}
        </button>
      </div>}

      {/* ===== CONTENIDO PRINCIPAL ===== */}
      {!showLanding && <div className="flex-1 flex overflow-hidden">

        {/* Columna izquierda: chat / reporte — visible en mobile solo si tab=chat */}
        <div className={`flex-1 flex-col p-3 sm:p-4 overflow-hidden min-w-0 ${mobileTab === "chat" ? "flex" : "hidden lg:flex"}`}>
          {showReport || mode === "completed" || mode === "editing" ? (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* "Volver al chat" solo en modo activo (no en editing, no en completed) */}
              {showReport && mode === "active" && (
                <button
                  onClick={() => setShowReport(false)}
                  className="shrink-0 mb-3 flex items-center gap-1.5 text-sm font-medium text-bluegreen-eske hover:text-bluegreen-eske/80 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Volver al chat
                </button>
              )}
              <PhaseReportView
                phaseId="proposito"
                reportText={reportText}
                projectId={projectId}
                isCompleted={mode === "completed"}
                onStartEdit={mode !== "editing" ? handleStartEdit : undefined}
                dictamen={dictamen}
                xpcto={form}
                className="flex-1 overflow-hidden"
              />
              {/* Overlay de regeneración del reporte tras guardar cambios */}
              {isGeneratingReport && mode !== "editing" && (
                <div className="absolute inset-0 bg-white-eske/80 dark:bg-[#18324A]/80 flex items-center justify-center rounded-xl">
                  <div className="flex items-center gap-3 bg-white-eske dark:bg-[#18324A] rounded-lg px-4 py-3 shadow-md border border-gray-eske-20 dark:border-white/10">
                    <div className="w-4 h-4 border-2 border-bluegreen-eske/30 border-t-bluegreen-eske rounded-full animate-spin" aria-hidden="true" />
                    <span className="text-sm text-bluegreen-eske font-medium">Actualizando Reporte F1…</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ModduloChat
              key={isLoaded ? "loaded" : "loading"}
              phaseId="proposito"
              projectId={projectId}
              initialMessages={chatMessages}
              currentFormData={currentFormData}
              onDataExtracted={handleDataExtracted}
              onMessagesChange={setChatMessages}
              className="flex-1 overflow-hidden"
            />
          )}
        </div>

        {/* Columna derecha: formulario XPCTO — visible en mobile solo si tab=form */}
        <div className={`flex-col w-full lg:w-80 xl:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-eske-20 dark:border-white/10 overflow-y-auto bg-gray-eske-10/50 dark:bg-[#112230] p-3 sm:p-4 transition-opacity ${
          mode !== "editing" ? "opacity-50 pointer-events-none select-none" : ""
        } ${mobileTab === "form" ? "flex" : "hidden lg:block"}`}>
          <XPCTOFormPanel
            form={mode === "editing" ? editForm : form}
            onChange={mode === "editing" ? setEditForm : (mode === "active" ? setForm : () => {})}
            risks={risks}
            readOnly={mode === "completed"}
          />
        </div>
      </div>}

      {/* Modal revisión de cierre */}
      {showReview && (
        <PhaseTransitionReview
          phaseId="proposito"
          nextPhaseId="exploracion"
          xpcto={form}
          risks={risks}
          onConfirm={handleClosePhase}
          onCancel={() => setShowReview(false)}
          isSubmitting={isClosingPhase}
        />
      )}

      {/* Modal back-propagation */}
      {propagationWarning.length > 0 && (
        <BackPropagationModal
          affectedPhases={propagationWarning}
          onDismiss={() => {
            setPropagationWarning([]);
            setMode("completed");
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// HELPERS
// ==========================================

// ==========================================
// BOTÓN VER RESUMEN
// ==========================================

function VerResumenButton({
  visible,
  hasReport,
  isGenerating,
  onClick,
}: {
  visible: boolean;
  hasReport: boolean;
  isGenerating: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      disabled={isGenerating}
      className="px-4 py-2 border border-bluegreen-eske text-bluegreen-eske rounded-lg text-sm font-medium hover:bg-bluegreen-eske/5 transition-colors disabled:opacity-40 flex items-center gap-2"
    >
      {isGenerating ? (
        <>
          <div className="w-3.5 h-3.5 border-2 border-bluegreen-eske/30 border-t-bluegreen-eske rounded-full animate-spin" />
          Generando...
        </>
      ) : (
        hasReport ? "Ver Resumen" : "Generar Resumen"
      )}
    </button>
  );
}

// ==========================================
// TEXTAREA AUTO-RESIZE
// ==========================================

function AutoResizeTextarea({
  value,
  onChange,
  disabled,
  placeholder,
  minRows = 2,
  maxRows = 10,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
    const minH = lineHeight * minRows + 16; // padding
    const maxH = lineHeight * maxRows + 16;
    el.style.height = Math.min(Math.max(el.scrollHeight, minH), maxH) + "px";
  }, [value, minRows, maxRows]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={minRows}
      className={`resize-none overflow-y-auto ${className}`}
    />
  );
}

// ==========================================
// HELPERS
// ==========================================

// Todos los campos obligatorios del formulario deben estar llenos
function isFormComplete(form: XPCTOForm): boolean {
  return !!(
    form.hito.trim() &&
    form.sujeto.trim() &&
    form.capacidades.financiero.trim() &&
    form.capacidades.humano.trim() &&
    form.capacidades.logistico.trim() &&
    form.tiempo.fechaLimite.trim() &&
    form.justificacion.trim()
  );
}

function extractReportFromMessages(messages: ChatMessage[]): string | null {
  // Buscar el último mensaje del asistente que sea suficientemente largo
  // (el reporte diagnóstico suele ser > 500 caracteres)
  const candidates = messages
    .filter((m) => m.role === "assistant" && m.content.length > 500)
    .reverse();
  return candidates[0]?.content ?? null;
}

async function checkBackPropagation(projectId: string): Promise<PhaseId[]> {
  try {
    const r = await fetch(`/api/moddulo/projects/${projectId}`, { credentials: "include" });
    if (!r.ok) return [];
    const data = await r.json();
    const phases = data.project?.phases ?? {};
    const propositoIndex = PHASE_ORDER.indexOf("proposito");
    return PHASE_ORDER.slice(propositoIndex + 1).filter((phaseId) => {
      const status = phases[phaseId]?.status;
      return status === "in-progress" || status === "completed";
    }) as PhaseId[];
  } catch {
    return [];
  }
}

// ==========================================
// FORMULARIO XPCTO
// ==========================================

function XPCTOFormPanel({
  form,
  onChange,
  risks,
  readOnly = false,
}: {
  form: XPCTOForm;
  onChange: (f: XPCTOForm) => void;
  risks: ReturnType<typeof detectRisks>;
  readOnly?: boolean;
}) {
  const risksByField = risks.reduce<Record<string, (typeof risks)[0]>>(
    (acc, r) => ({ ...acc, [r.field]: r }),
    {}
  );

  const fieldClass = (field: string) =>
    `w-full px-3 py-2 text-sm font-normal rounded-lg border focus:outline-none focus:ring-2 focus:ring-bluegreen-eske/30 focus:border-bluegreen-eske text-black-eske dark:text-[#EAF2F8] bg-white-eske dark:bg-[#112230] disabled:bg-gray-eske-10 dark:disabled:bg-[#21425E] disabled:text-black-eske-10 dark:disabled:text-[#9AAEBE] placeholder:text-gray-eske-60 dark:placeholder:text-[#6D8294] ${
      risksByField[field]
        ? risksByField[field].level === "critical"
          ? "border-red-300 dark:border-red-800"
          : "border-yellow-300 dark:border-yellow-700"
        : "border-gray-eske-20 dark:border-white/10"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-eske-50 dark:text-[#9AAEBE]">Variables XPCTO</h2>
        {readOnly && (
          <span className="text-xs text-gray-eske-40 dark:text-[#6D8294] italic">Solo lectura</span>
        )}
        {!readOnly && (
          <span className="text-xs text-gray-eske-40 dark:text-[#6D8294]">Auto-rellena via chat</span>
        )}
      </div>

      {/* X — Hito */}
      <FormField label="Hito (X)" hint="El resultado concreto e inamovible" risk={risksByField["xpcto.hito"]}>
        <AutoResizeTextarea
          value={form.hito}
          onChange={(v) => !readOnly && onChange({ ...form, hito: v })}
          disabled={readOnly}
          placeholder="¿Qué resultado específico y medible buscas lograr?"
          minRows={3}
          maxRows={10}
          className={fieldClass("xpcto.hito")}
        />
      </FormField>

      {/* P — Sujeto */}
      <FormField label="Sujeto (P)" hint="El actor político del proyecto">
        <AutoResizeTextarea
          value={form.sujeto}
          onChange={(v) => !readOnly && onChange({ ...form, sujeto: v })}
          disabled={readOnly}
          placeholder="Nombre, cargo al que aspira, perfil general..."
          minRows={2}
          maxRows={8}
          className={fieldClass("xpcto.sujeto")}
        />
      </FormField>

      {/* C — Capacidades */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-eske-60 dark:text-[#9AAEBE]">
          Capacidades (C)
          {risksByField["xpcto.capacidades"] && (
            <RiskBadge level={risksByField["xpcto.capacidades"].level} />
          )}
        </p>
        {[
          { key: "financiero" as const, placeholder: "Financiero — presupuesto disponible" },
          { key: "humano" as const, placeholder: "Humano — equipo y estructura" },
          { key: "logistico" as const, placeholder: "Logístico — infraestructura y medios" },
        ].map(({ key, placeholder }) => (
          <input
            key={key}
            type="text"
            value={form.capacidades[key]}
            onChange={(e) => !readOnly && onChange({ ...form, capacidades: { ...form.capacidades, [key]: e.target.value } })}
            disabled={readOnly}
            placeholder={placeholder}
            className={fieldClass(`xpcto.capacidades.${key}`)}
          />
        ))}
      </div>

      {/* T — Tiempo */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-eske-60 dark:text-[#9AAEBE]">
          Tiempo (T)
          {risksByField["xpcto.tiempo"] && <RiskBadge level={risksByField["xpcto.tiempo"].level} />}
        </p>
        <div>
          <label className="text-xs text-gray-eske-40 dark:text-[#6D8294] mb-1 block">Fecha límite inamovible</label>
          <input
            type="date"
            value={form.tiempo.fechaLimite}
            onChange={(e) => !readOnly && onChange({ ...form, tiempo: { ...form.tiempo, fechaLimite: e.target.value } })}
            disabled={readOnly}
            className={fieldClass("xpcto.tiempo.fechaLimite")}
          />
        </div>
        {form.tiempo.duracionMeses > 0 && (
          <p className="text-xs text-gray-eske-50 dark:text-[#6D8294] text-right">
            {form.tiempo.duracionMeses} {form.tiempo.duracionMeses === 1 ? "mes" : "meses"} desde hoy
          </p>
        )}
      </div>

      {/* O — Justificación */}
      <FormField label="Justificación (O)" hint="El propósito ético que legitima el proyecto" risk={risksByField["xpcto.justificacion"]}>
        <AutoResizeTextarea
          value={form.justificacion}
          onChange={(v) => !readOnly && onChange({ ...form, justificacion: v })}
          disabled={readOnly}
          placeholder="¿Por qué este proyecto merece existir más allá de ganar o perder?"
          minRows={3}
          maxRows={10}
          className={fieldClass("xpcto.justificacion")}
        />
      </FormField>
    </div>
  );
}

function FormField({ label, hint, risk, children }: {
  label: string;
  hint?: string;
  risk?: ReturnType<typeof detectRisks>[0];
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs font-semibold text-gray-eske-60 dark:text-[#9AAEBE]">{label}</label>
        {risk && <RiskBadge level={risk.level} />}
      </div>
      {hint && <p className="text-xs text-gray-eske-40 dark:text-[#6D8294] mb-1">{hint}</p>}
      {children}
      {risk && (
        <p className={`text-xs mt-1 ${risk.level === "critical" ? "text-red-600 dark:text-red-400" : "text-yellow-700 dark:text-yellow-400"}`}>
          {risk.title}
        </p>
      )}
    </div>
  );
}

function RiskBadge({ level }: { level: "warning" | "critical" }) {
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
      level === "critical" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
    }`}>
      {level === "critical" ? "⚠" : "○"}
    </span>
  );
}

// ==========================================
// MODAL BACK-PROPAGATION
// ==========================================

function BackPropagationModal({ affectedPhases, onDismiss }: {
  affectedPhases: PhaseId[];
  onDismiss: () => void;
}) {
  const PHASE_NAMES: Record<PhaseId, string> = {
    proposito: "Propósito",
    exploracion: "Exploración",
    investigacion: "Investigación",
    diagnostico: "Diagnóstico",
    estrategia: "Diseño Estratégico",
    tactica: "Diseño Táctico",
    gerencia: "Gerencia",
    seguimiento: "Seguimiento",
    evaluacion: "Evaluación",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-eske/50">
      <div className="bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-gray-eske-80 dark:text-[#EAF2F8]">Cambios con impacto en fases posteriores</h2>
            <p className="text-sm text-gray-eske-60 dark:text-[#C7D6E0] mt-1">
              Las siguientes fases ya tienen trabajo registrado. Los cambios al XPCTO de Propósito pueden afectar las decisiones tomadas en ellas:
            </p>
          </div>
        </div>

        <ul className="space-y-2 mb-5">
          {affectedPhases.map((phaseId) => (
            <li key={phaseId} className="flex items-center gap-2 text-sm text-gray-eske-70 dark:text-[#C7D6E0] bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded-lg">
              <svg className="w-4 h-4 text-orange-500 dark:text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              {PHASE_NAMES[phaseId]}
            </li>
          ))}
        </ul>

        <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mb-5 leading-relaxed">
          Moddulo ha guardado tus cambios. Te recomendamos revisar el trabajo de cada fase afectada para verificar que las decisiones sigan siendo consistentes con el nuevo Propósito.
        </p>

        <button
          onClick={onDismiss}
          className="w-full py-2.5 bg-bluegreen-eske text-white-eske rounded-lg text-sm font-medium hover:bg-bluegreen-eske/90 transition-colors"
        >
          Entendido — revisar las fases afectadas
        </button>
      </div>
    </div>
  );
}

// ==========================================
// LANDING — F1 PROPÓSITO (primera visita)
// ==========================================

const TYPE_LABELS_F1: Record<string, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

const XPCTO_VARIABLES = [
  {
    code: "X",
    title: "Hito",
    desc: "El resultado concreto, medible e inamovible que persigue el proyecto. No es un objetivo ni una aspiración: es el evento que define el éxito o fracaso de la campaña.",
  },
  {
    code: "P",
    title: "Sujeto político",
    desc: "El actor central del proyecto: candidato, funcionario, líder o institución. Define quién lleva el proyecto y cómo se percibe en el entorno.",
  },
  {
    code: "C",
    title: "Capacidades",
    desc: "Los recursos reales disponibles en tres dimensiones: financiero, humano y logístico. Determinan hasta dónde puede llegar la estrategia.",
  },
  {
    code: "T",
    title: "Tiempo",
    desc: "La fecha límite inamovible. Todo el plan se construye en función de ese horizonte temporal. Moddulo calcula automáticamente la duración en meses.",
  },
  {
    code: "O",
    title: "Justificación ética",
    desc: "El propósito que legitima la existencia del proyecto más allá del resultado. La razón ética que sostiene la campaña y la distingue de la mera ambición política.",
  },
];

function F1LandingView({
  projectName,
  projectType,
  projectTerritory,
  onComenzar,
}: {
  projectName: string;
  projectType: ProjectType;
  projectTerritory: Territorio | null;
  onComenzar: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start px-4 py-8 sm:py-12">
      <div className="w-full max-w-xl space-y-6">

        {/* Encabezado del proyecto */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske">F1 — Propósito</span>
          </div>
          {projectName && (
            <h1 className="text-xl sm:text-2xl font-bold text-black-eske dark:text-[#EAF2F8] leading-tight">
              {projectName}
            </h1>
          )}
          <div className="flex flex-wrap gap-1.5">
            {projectType && (
              <span className="px-2 py-0.5 bg-bluegreen-eske/10 text-bluegreen-eske dark:text-[#6BA4C6] rounded-full text-xs font-medium">
                {TYPE_LABELS_F1[projectType] ?? projectType}
              </span>
            )}
            {projectTerritory?.nombre && (
              <span className="px-2 py-0.5 bg-gray-eske-10 dark:bg-white/10 text-gray-eske-70 dark:text-[#C5D8E8] rounded-full text-xs font-medium">
                {projectTerritory.nombre}
              </span>
            )}
          </div>
        </div>

        {/* Descripción de F1 */}
        <p className="text-sm text-black-eske-80 dark:text-[#C5D8E8] leading-relaxed">
          F1 establece el propósito estratégico del proyecto mediante el modelo XPCTO.
          Aquí definirás las cinco variables fundamentales que dan coherencia y dirección
          a todo el trabajo de consultoría: desde quién es el sujeto político hasta cuál
          es la justificación ética que sostiene el proyecto.
        </p>

        {/* Variables XPCTO */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-eske-50 dark:text-[#9AAEBE]">
            Las cinco variables XPCTO
          </p>
          <div className="space-y-2">
            {XPCTO_VARIABLES.map((v) => (
              <div key={v.code}
                className="flex gap-3 p-3 rounded-lg bg-gray-eske-10/60 dark:bg-[#112230] border border-gray-eske-20 dark:border-white/10">
                <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full
                  bg-bluegreen-eske/10 text-bluegreen-eske text-xs font-bold">
                  {v.code}
                </span>
                <div>
                  <p className="text-xs font-semibold text-black-eske dark:text-[#EAF2F8]">{v.title}</p>
                  <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] leading-relaxed mt-0.5">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nota informativa */}
        <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] leading-relaxed border-l-2 border-gray-eske-20 dark:border-white/10 pl-3">
          Las variables XPCTO se construyen en conversación con el asistente de IA.
          El formulario de la derecha se llena automáticamente conforme avanza el chat,
          y puedes editarlo directamente en cualquier momento.
        </p>

        {/* CTA */}
        <button
          onClick={onComenzar}
          className="w-full py-3 rounded-xl bg-bluegreen-eske text-white font-semibold text-sm
            hover:bg-bluegreen-eske/90 active:scale-[0.98] transition-all"
        >
          Comenzar Fase 1
        </button>
      </div>
    </div>
  );
}

// ==========================================
// DESCARGA DE ARCHIVOS — FASE 1
// ==========================================

type DownloadOption = "resumen" | "chat" | "formulario";

function DownloadButton({
  form,
  reportText,
  chatMessages,
}: {
  form: XPCTOForm;
  reportText: string | null;
  chatMessages: ChatMessage[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const download = (content: string, filename: string, mime = "text/plain") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const handleDownload = (option: DownloadOption) => {
    if (option === "resumen" && reportText) {
      download(reportText, "F1-Proposito-Resumen.md");
    } else if (option === "chat") {
      const text = chatMessages
        .map((m) => `[${m.role === "assistant" ? "Moddulo" : "Consultor"}]\n${m.content}`)
        .join("\n\n---\n\n");
      download(text || "(Sin mensajes)", "F1-Proposito-Chat.txt");
    } else if (option === "formulario") {
      const lines = [
        "FORMULARIO XPCTO — FASE 1: PROPÓSITO",
        "=====================================",
        "",
        `HITO (X):\n${form.hito || "(Sin datos)"}`,
        "",
        `SUJETO (P):\n${form.sujeto || "(Sin datos)"}`,
        "",
        "CAPACIDADES (C):",
        `  Financiero: ${form.capacidades.financiero || "(Sin datos)"}`,
        `  Humano: ${form.capacidades.humano || "(Sin datos)"}`,
        `  Logístico: ${form.capacidades.logistico || "(Sin datos)"}`,
        "",
        "TIEMPO (T):",
        `  Fecha límite: ${form.tiempo.fechaLimite || "(Sin datos)"}`,
        `  Duración: ${form.tiempo.duracionMeses} meses`,
        "",
        `JUSTIFICACIÓN (O):\n${form.justificacion || "(Sin datos)"}`,
      ];
      download(lines.join("\n"), "F1-Proposito-Formulario.txt");
    }
  };

  const options: { id: DownloadOption; label: string; available: boolean }[] = [
    { id: "resumen", label: "Resumen diagnóstico (.md)", available: !!reportText },
    { id: "chat", label: "Historial del chat (.txt)", available: chatMessages.length > 0 },
    { id: "formulario", label: "Formulario XPCTO (.txt)", available: !!(form.hito || form.sujeto) },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Descargar archivos de esta fase"
        className="p-1.5 rounded-lg border border-gray-eske-20 dark:border-white/10 text-black-eske-10 dark:text-[#C7D6E0] hover:border-bluegreen-eske hover:text-bluegreen-eske dark:hover:border-bluegreen-eske-40 dark:hover:text-[#6BA4C6] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 rounded-xl shadow-lg z-20 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/50 dark:bg-[#112230]">
            <p className="text-xs font-bold text-black-eske dark:text-[#9AAEBE] uppercase tracking-widest">Descargar</p>
          </div>
          {options.map(({ id, label, available }) => (
            <button
              key={id}
              onClick={() => available && handleDownload(id)}
              disabled={!available}
              className={`w-full text-left px-3 py-2.5 text-xs font-medium flex items-center gap-2 transition-colors ${
                available
                  ? "text-black-eske dark:text-[#C7D6E0] hover:bg-bluegreen-eske/5 dark:hover:bg-white/5 hover:text-bluegreen-eske dark:hover:text-[#6BA4C6]"
                  : "text-gray-eske-40 dark:text-[#6D8294] cursor-not-allowed"
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {label}
              {!available && <span className="ml-auto text-gray-eske-40 dark:text-[#6D8294]">(sin datos)</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
