// app/moddulo/proyecto/[projectId]/exploracion/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ModduloChat from "@/app/moddulo/components/ModduloChat";
import PhaseTransitionReview from "@/app/moddulo/components/PhaseTransitionReview";
import DVSView from "./components/DVSView";
import MotoresSequentialView from "./components/MotoresSequentialView";
import type {
  XPCTO,
  ProjectType,
  ChatMessage,
  PhaseId,
  ExplorationForm,
  VetoActor,
  DVSF2,
  MapaPESTEL,
  F2DimensionPESTEL,
  Territorio,
} from "@/types/moddulo.types";
import { PHASE_ORDER, emptyExplorationForm } from "@/types/moddulo.types";
import { evaluarCriteriosDVS, type CriterioDVS } from "@/lib/moddulo/dvs-criteria";

// ==========================================
// TIPOS SEFIX
// ==========================================

interface SefixResultados {
  estado: string;
  cargo: string;
  anio: number;
  totalVotos: number;
  lne: number;
  participacion: number;
  partidos: { partido: string; votos: number; porcentaje: number }[];
  fuente: string;
}

interface SefixPadron {
  estado: string;
  corte: string;
  listaNominal: number;
  padronElectoral: number;
  padronHombres: number;
  padronMujeres: number;
  fuente: string;
}

interface SefixData {
  estado: string;
  resultados: SefixResultados | null;
  padron: SefixPadron | null;
  gubernatura?: SefixResultados | null;
  nivel?: string;
}

// ==========================================
// TIPOS LOCALES
// ==========================================

type PageMode = "active" | "completed" | "editing";

type PestlSection =
  | "politico"
  | "economico"
  | "social"
  | "tecnologico"
  | "ecologico"
  | "legal";

const PESTL_SECTIONS: { id: PestlSection; label: string; short: string; dimCode?: string }[] = [
  { id: "politico",    label: "Político",      short: "P",  dimCode: "P" },
  { id: "economico",   label: "Económico",     short: "E",  dimCode: "E" },
  { id: "social",      label: "Social",        short: "S",  dimCode: "S" },
  { id: "tecnologico", label: "Tecnológico",   short: "T",  dimCode: "T" },
  { id: "ecologico",   label: "Ecológico",     short: "Ec", dimCode: "Ec" },
  { id: "legal",       label: "Legal",         short: "L",  dimCode: "L" },
];

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function ExploracionPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;

  const [form, setForm] = useState<ExplorationForm>(emptyExplorationForm());
  const [editForm, setEditForm] = useState<ExplorationForm>(emptyExplorationForm());
  const [xpcto, setXpcto] = useState<XPCTO | null>(null);
  const [projectType, setProjectType] = useState<ProjectType>("electoral");
  const [activeSection, setActiveSection] = useState<PestlSection>("politico");
  const [mode, setMode] = useState<PageMode>("active");
  const [reportText, setReportText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isClosingPhase, setIsClosingPhase] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [propagationWarning, setPropagationWarning] = useState<PhaseId[]>([]);
  const [mobileTab, setMobileTab] = useState<"chat" | "form">("chat");
  const [sefixData, setSefixData] = useState<SefixData | null>(null);

  // DVS y MapaPESTEL (C2, C3, C4)
  const [dvs, setDvs] = useState<DVSF2 | null>(null);
  const [generandoDVS, setGenerandoDVS] = useState(false);
  const [mapaPESTEL, setMapaPESTEL] = useState<MapaPESTEL | null>(null);
  const [showReporte, setShowReporte] = useState(false);
  // Nuevo flujo de motores secuenciales (Iter 2+)
  const [draftDVS, setDraftDVS] = useState<DVSF2 | null>(null);
  const [motorAprobaciones, setMotorAprobaciones] = useState<{
    M2?: boolean; M3?: boolean; M4?: boolean; M5?: boolean;
  }>({});
  const [isGeneratingMotors, setIsGeneratingMotors] = useState(false);
  const [motorGenerationError, setMotorGenerationError] = useState<string | null>(null);
  const [dvsChecklist, setDvsChecklist] = useState<CriterioDVS[]>([]);

  // RDA heredado de F1 (C8)
  const [rdaActivo, setRdaActivo] = useState(false);
  const [rdaItems, setRdaItems] = useState<string[]>([]);

  // A1 — Landing page: metadatos del proyecto
  const [showLanding, setShowLanding] = useState(true);
  const [projectName, setProjectName] = useState<string>("");
  const [projectColor, setProjectColor] = useState<string>("#026988");
  const [projectTerritory, setProjectTerritory] = useState<Territorio | null>(null);

  // A7 — rastrear si el usuario eligió la vía PESTEL desde el chat
  const [pestlVia, setPestlVia] = useState<"pestel" | null>(null);
  // ID del proyecto PESTEL vinculado (si ya exportó desde Centinela)
  const [pestProjectId, setPestProjectId] = useState<string | null>(null);
  // ID del análisis PESTEL vinculado (para resolver pestProjectId cuando falta)
  const [pestAnalysisId, setPestAnalysisId] = useState<string | null>(null);

  // Máquina de estados del header (C2)
  const headerState: "en_progreso" | "lista" | "editando" =
    mode === "editing" ? "editando" :
    dvs !== null ? "lista" :
    "en_progreso";

  // C7 — Abrir PESTEL con pre-llenado completo
  function handleAbrirPESTEL() {
    setPestlVia("pestel");
    const meses = calcularMesesAlHito(xpcto?.tiempo?.fechaLimite);

    const params: Record<string, string> = {
      moddulo_project_id: projectId,
      tipo: projectType ?? "",
      horizonte: String(meses),
      nombre: projectName,
      color: projectColor,
    };

    if (projectTerritory) {
      params.nivel = projectTerritory.nivel;
      if (projectTerritory.estado) params.estado = projectTerritory.estado;
      if (projectTerritory.municipio) params.municipio = projectTerritory.municipio;
      if (projectTerritory.pais) params.pais = projectTerritory.pais;
    }

    router.push(`/centinela/pestel/nuevo?${new URLSearchParams(params).toString()}`);
  }

  // Cargar proyecto al montar
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/moddulo/projects/${projectId}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          console.error(`[exploracion] API error ${r.status}:`, await r.text());
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

        if (p.xpcto) setXpcto(p.xpcto);

        const phaseData = p.phases?.exploracion?.data;
        if (phaseData && Object.keys(phaseData).length > 0) {
          const loaded = mergePhaseData(emptyExplorationForm(), phaseData);
          setForm(loaded);
          setEditForm(loaded);
        }

        const phaseStatus = p.phases?.exploracion?.status;
        if (phaseStatus === "completed") setMode("completed");

        const savedReport = p.phases?.exploracion?.reportText;
        if (savedReport) setReportText(savedReport);

        // Cargar DVS si existe
        const savedDvs = p.phases?.exploracion?.dvs;
        if (savedDvs) {
          setDvs(savedDvs as DVSF2);
          setShowLanding(false);
          setShowReporte(true);
        }

        // Cargar draftDVS y motorAprobaciones (nuevo flujo de motores)
        const savedDraftDVS = p.phases?.exploracion?.draftDVS;
        if (savedDraftDVS) setDraftDVS(savedDraftDVS as DVSF2);
        const savedMotorAprobaciones = p.phases?.exploracion?.motorAprobaciones;
        if (savedMotorAprobaciones) setMotorAprobaciones(
          savedMotorAprobaciones as { M2?: boolean; M3?: boolean; M4?: boolean; M5?: boolean }
        );

        // Cargar MapaPESTEL si existe
        const savedMapa = p.phases?.exploracion?.mapaPESTEL;
        if (savedMapa) setMapaPESTEL(savedMapa as MapaPESTEL);

        // Cargar referencia al proyecto PESTEL vinculado
        const savedPestProjectId = p.phases?.exploracion?.pestProjectId;
        const savedPestAnalysisId = p.phases?.exploracion?.pestAnalysisId;
        if (savedPestAnalysisId) setPestAnalysisId(savedPestAnalysisId as string);
        if (savedPestProjectId) {
          setPestProjectId(savedPestProjectId as string);
          setPestlVia("pestel");
        } else if (savedPestAnalysisId || savedMapa) {
          // Proyecto vinculado antes de que se guardara pestProjectId
          setPestlVia("pestel");
        }

        // A1 — Ocultar landing si ya inició la fase
        if (p.phases?.exploracion?.started || phaseStatus === "completed") {
          setShowLanding(false);
        }

        // Cargar RDA de F1 (C8)
        const rda = p.phases?.proposito?.rda;
        if (rda?.activo) {
          setRdaActivo(true);
          setRdaItems(rda.items ?? []);
        }
      })
      .catch((err) => console.error("[exploracion] fetch error:", err))
      .finally(() => setIsLoaded(true));
  }, [projectId]);

  // C7 — Auto-import PESTEL al regresar con pest_analysis_id en URL
  useEffect(() => {
    if (!isLoaded || !projectId) return;
    const urlParams = new URLSearchParams(window.location.search);
    const pestId = urlParams.get("pest_analysis_id");
    if (!pestId || mapaPESTEL) return; // skip if already imported

    fetch("/api/moddulo/f2/import-pestel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, pestAnalysisId: pestId }),
    })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        if (data.mapaPESTEL) setMapaPESTEL(data.mapaPESTEL as MapaPESTEL);
        if (data.pestProjectId) {
          setPestProjectId(data.pestProjectId as string);
          setPestlVia("pestel");
        }
      })
      .catch(() => {});
  }, [isLoaded, projectId, mapaPESTEL]);

  // C7b — Resolver pestProjectId cuando existe pestAnalysisId pero no pestProjectId
  useEffect(() => {
    if (!isLoaded || !projectId || pestProjectId || !pestAnalysisId) return;
    fetch("/api/moddulo/f2/import-pestel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, pestAnalysisId }),
    })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        if (data.pestProjectId) setPestProjectId(data.pestProjectId as string);
      })
      .catch(() => {});
  }, [isLoaded, projectId, pestAnalysisId, pestProjectId]);

  // Cargar datos Sefix
  useEffect(() => {
    if (!isLoaded || !["electoral", "gubernamental"].includes(projectType)) return;
    // Preferir estado del territorio del proyecto; fallback a detección por XPCTO
    const estadoSefix = projectTerritory?.estado ?? (xpcto ? detectEstadoFromXpcto(xpcto) : null);
    if (!estadoSefix) return;

    const fetchSefix = async () => {
      try {
        const [resR, padR, gobR] = await Promise.all([
          fetch(`/api/sefix/resultados?estado=${encodeURIComponent(estadoSefix)}&cargo=diputados`, { credentials: "include" }),
          fetch(`/api/sefix/padron?estado=${encodeURIComponent(estadoSefix)}`, { credentials: "include" }),
          fetch(`/api/sefix/resultados?estado=${encodeURIComponent(estadoSefix)}&cargo=gobernador`, { credentials: "include" }),
        ]);
        const resJson = resR.ok ? await resR.json() : null;
        const padJson = padR.ok ? await padR.json() : null;
        const gobJson = gobR.ok ? await gobR.json() : null;
        setSefixData({
          estado: estadoSefix,
          resultados: resJson?.resultados ?? null,
          padron: padJson?.padron ?? null,
          gubernatura: gobJson?.resultados ?? null,
          nivel: projectTerritory?.nivel ?? undefined,
        });
      } catch { /* no-op */ }
    };
    fetchSefix();
  }, [isLoaded, xpcto, projectType, projectTerritory]);

  // Auto-guardar (solo en modo activo, después de cargar)
  const autoSave = useCallback(async (formData: ExplorationForm) => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      await fetch(`/api/moddulo/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phaseData: { phaseId: "exploracion", data: formData } }),
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

  // Auto-generar draftDVS cuando mapaPESTEL llega y no hay draft ni DVS final
  useEffect(() => {
    if (mapaPESTEL !== null && draftDVS === null && dvs === null && isLoaded) {
      generarDraftDVS();
    }
  // generarDraftDVS es estable (useCallback sin deps que cambien en runtime)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapaPESTEL, isLoaded]);

  // Datos planos del formulario para el chat
  const currentFormData: Record<string, unknown> = {
    activeSection,
    "pestl.politico.contexto": form.pestl.politico.contexto,
    "pestl.politico.actoresClave": form.pestl.politico.actoresClave,
    "pestl.politico.actoresVeto": form.pestl.politico.actoresVeto,
    "pestl.politico.senalesCriticas": form.pestl.politico.senalesCriticas,
    "pestl.economico.contexto": form.pestl.economico.contexto,
    "pestl.economico.senalesCriticas": form.pestl.economico.senalesCriticas,
    "pestl.social.contexto": form.pestl.social.contexto,
    "pestl.social.senalesCriticas": form.pestl.social.senalesCriticas,
    "pestl.tecnologico.contexto": form.pestl.tecnologico.contexto,
    "pestl.tecnologico.senalesCriticas": form.pestl.tecnologico.senalesCriticas,
    "pestl.ecologico.contexto": form.pestl.ecologico.contexto,
    "pestl.ecologico.senalesCriticas": form.pestl.ecologico.senalesCriticas,
    "pestl.legal.contexto": form.pestl.legal.contexto,
    "pestl.legal.senalesCriticas": form.pestl.legal.senalesCriticas,
    "semaforo.resumen": form.semaforo.resumen,
    "semaforo.actores": form.semaforo.actores,
    "hipotesis.enunciado": form.hipotesis.enunciado,
    "hipotesis.premisas": form.hipotesis.premisas,
    "hipotesis.implicaciones": form.hipotesis.implicaciones,
  };

  // XPCTO como contexto para el chat
  const xpctoContext = xpcto
    ? {
        hito: xpcto.hito,
        sujeto: xpcto.sujeto,
        capacidades: xpcto.capacidades,
        tiempo: xpcto.tiempo,
        justificacion: xpcto.justificacion,
        tipoProyecto: projectType,
        ...(sefixData
          ? {
              sefix: {
                estado: sefixData.estado,
                resultados: sefixData.resultados
                  ? {
                      anio: sefixData.resultados.anio,
                      cargo: sefixData.resultados.cargo,
                      totalVotos: sefixData.resultados.totalVotos,
                      lne: sefixData.resultados.lne,
                      participacion: sefixData.resultados.participacion,
                      top4: sefixData.resultados.partidos.slice(0, 4),
                      fuente: sefixData.resultados.fuente,
                    }
                  : null,
                padron: sefixData.padron
                  ? {
                      corte: sefixData.padron.corte,
                      listaNominal: sefixData.padron.listaNominal,
                      padronElectoral: sefixData.padron.padronElectoral,
                      padronHombres: sefixData.padron.padronHombres,
                      padronMujeres: sefixData.padron.padronMujeres,
                      fuente: sefixData.padron.fuente,
                    }
                  : null,
              },
            }
          : {}),
      }
    : undefined;

  // Extracción de datos del chat → formulario
  const handleDataExtracted = useCallback((data: Record<string, unknown>) => {
    setForm((prev) => {
      const next = structuredClone(prev);
      if (typeof data["pestl.politico.contexto"] === "string")       next.pestl.politico.contexto = data["pestl.politico.contexto"];
      if (typeof data["pestl.politico.actoresClave"] === "string")   next.pestl.politico.actoresClave = data["pestl.politico.actoresClave"];
      if (typeof data["pestl.politico.actoresVeto"] === "string")    next.pestl.politico.actoresVeto = data["pestl.politico.actoresVeto"];
      if (typeof data["pestl.politico.senalesCriticas"] === "string") next.pestl.politico.senalesCriticas = data["pestl.politico.senalesCriticas"];
      if (typeof data["pestl.economico.contexto"] === "string")      next.pestl.economico.contexto = data["pestl.economico.contexto"];
      if (typeof data["pestl.economico.senalesCriticas"] === "string") next.pestl.economico.senalesCriticas = data["pestl.economico.senalesCriticas"];
      if (typeof data["pestl.social.contexto"] === "string")         next.pestl.social.contexto = data["pestl.social.contexto"];
      if (typeof data["pestl.social.senalesCriticas"] === "string")  next.pestl.social.senalesCriticas = data["pestl.social.senalesCriticas"];
      if (typeof data["pestl.tecnologico.contexto"] === "string")    next.pestl.tecnologico.contexto = data["pestl.tecnologico.contexto"];
      if (typeof data["pestl.tecnologico.senalesCriticas"] === "string") next.pestl.tecnologico.senalesCriticas = data["pestl.tecnologico.senalesCriticas"];
      if (typeof data["pestl.ecologico.contexto"] === "string")      next.pestl.ecologico.contexto = data["pestl.ecologico.contexto"];
      if (typeof data["pestl.ecologico.senalesCriticas"] === "string") next.pestl.ecologico.senalesCriticas = data["pestl.ecologico.senalesCriticas"];
      if (typeof data["pestl.legal.contexto"] === "string")          next.pestl.legal.contexto = data["pestl.legal.contexto"];
      if (typeof data["pestl.legal.senalesCriticas"] === "string")   next.pestl.legal.senalesCriticas = data["pestl.legal.senalesCriticas"];
      if (typeof data["semaforo.resumen"] === "string")              next.semaforo.resumen = data["semaforo.resumen"];
      if (Array.isArray(data["semaforo.actores"]))                   next.semaforo.actores = data["semaforo.actores"] as VetoActor[];
      if (typeof data["hipotesis.enunciado"] === "string")           next.hipotesis.enunciado = data["hipotesis.enunciado"];
      if (typeof data["hipotesis.premisas"] === "string")            next.hipotesis.premisas = data["hipotesis.premisas"];
      if (typeof data["hipotesis.implicaciones"] === "string")       next.hipotesis.implicaciones = data["hipotesis.implicaciones"];
      return next;
    });
  }, []);

  // Genera draftDVS a partir del mapaPESTEL actual (PESTEL app path o express path)
  const generarDraftDVS = useCallback(async () => {
    setIsGeneratingMotors(true);
    setMotorGenerationError(null);
    try {
      const r = await fetch("/api/moddulo/f2/generate-dvs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, saveas: "draft" }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        const motor = (err as { motor?: string }).motor;
        setMotorGenerationError(
          motor
            ? `Error al generar ${motor}. Intenta de nuevo.`
            : "No se pudo generar el análisis. Intenta de nuevo."
        );
        return;
      }
      const data = await r.json();
      if (data.dvs) setDraftDVS(data.dvs as DVSF2);
    } catch {
      setMotorGenerationError("Error de red. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setIsGeneratingMotors(false);
    }
  }, [projectId]);

  // C5 — Express path: genera mapaPESTEL con Claude, luego draft DVS
  const handleGenerarDVS = async () => {
    setGenerandoDVS(true);
    try {
      // Si ya hay mapaPESTEL (PESTEL app path), solo generar draft
      if (mapaPESTEL !== null) {
        await generarDraftDVS();
        return;
      }
      // Express path: generar mapaPESTEL primero
      const mR = await fetch("/api/moddulo/f2/generate-m1-express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (!mR.ok) return;
      const mData = await mR.json();
      if (mData.mapaPESTEL) {
        setMapaPESTEL(mData.mapaPESTEL as MapaPESTEL);
        // generarDraftDVS se ejecuta via useEffect cuando mapaPESTEL cambia
      }
    } catch {/* silencioso */} finally {
      setGenerandoDVS(false);
    }
  };

  // Abre el modal de cierre evaluando los 10 criterios DVS
  const handleOpenReview = () => {
    if (dvs) setDvsChecklist(evaluarCriteriosDVS(dvs));
    setShowReview(true);
  };

  // C6 — Cerrar Fase 2 con propagación de PIP e incertidumbres
  const handleClosePhase = async () => {
    setIsClosingPhase(true);
    try {
      await fetch(`/api/moddulo/projects/${projectId}/complete-phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phaseId: "exploracion",
          reportText: reportText ?? undefined,
        }),
      });

      // Propagar PIP e incertidumbres a F3 (fire-and-forget)
      if (dvs) {
        fetch(`/api/moddulo/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            phaseData: {
              phaseId: "exploracion",
              data: { aprobadoEn: new Date().toISOString() },
            },
            f3Seed: {
              pip: dvs.pip,
              incertidumbres: dvs.incertidumbres,
            },
          }),
        }).catch(() => {});
      }

      setShowReview(false);
      router.push(`/moddulo/proyecto/${projectId}/investigacion`);
    } catch {/* silencioso */} finally { setIsClosingPhase(false); }
  };

  // A1 — Iniciar F2: oculta landing y persiste flag
  const handleComenzarF2 = () => {
    setShowLanding(false);
    fetch(`/api/moddulo/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phaseData: { phaseId: "exploracion", started: true } }),
    }).catch(() => {});
  };

  // Aprobación secuencial de motores M2→M5
  const handleApproveMotor = async (motor: "M2" | "M3" | "M4" | "M5") => {
    // Actualización optimista
    setMotorAprobaciones((prev) => ({ ...prev, [motor]: true }));

    if (motor !== "M5") {
      // Persistir aprobación parcial
      fetch("/api/moddulo/f2/approve-motor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, motor }),
      }).catch(() => {});
      return;
    }

    // M5: finalizar — promueve draftDVS → dvs
    try {
      const r = await fetch("/api/moddulo/f2/finalize-dvs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, draftDVS }),
      });
      if (!r.ok) return;
      const data = await r.json();
      if (data.dvs) {
        setDvs(data.dvs as DVSF2);
        setDraftDVS(null);
        setMotorAprobaciones({});
        setShowReporte(true);
        if (mode !== "completed") setMode("completed");
      }
    } catch {/* silencioso */}
  };

  const handleStartEdit = () => { setEditForm(structuredClone(form)); setMode("editing"); };
  const handleCancelEdit = () => { setMode(dvs ? "completed" : "active"); if (dvs) setShowReporte(true); };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/moddulo/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phaseData: { phaseId: "exploracion", data: editForm } }),
      });
      setForm(structuredClone(editForm));
      setLastSaved(new Date());

      // Re-generar DVS con los nuevos datos
      setGenerandoDVS(true);
      const r = await fetch("/api/moddulo/f2/generate-dvs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.dvs) {
          setDvs(data.dvs as DVSF2);
          setShowReporte(true);
        }
      }

      const affected = await checkBackPropagation(projectId);
      if (affected.length > 0) setPropagationWarning(affected);
      else { setMode("completed"); setShowReporte(true); }
    } catch {/* silencioso */} finally {
      setIsSaving(false);
      setGenerandoDVS(false);
    }
  };

  const activeForm = mode === "editing" ? editForm : form;
  const setActiveForm = mode === "editing" ? setEditForm : (mode === "active" ? setForm : () => {});

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ===== HEADER ===== */}
      <div className="shrink-0 px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        {/* Fila 1: título + badge + descarga */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske shrink-0">F2</span>
            <h1 className="text-sm sm:text-base font-bold text-black-eske dark:text-[#EAF2F8] truncate">Exploración</h1>
            {dvs !== null && mode !== "editing" && (
              <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Lista</span>
            )}
            {mode === "editing" && (
              <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">Editando</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-xs hidden sm:block">
              {isSaving || generandoDVS ? (
                <span className="text-gray-eske-40 dark:text-[#6D8294]">{generandoDVS ? "Generando..." : "Guardando..."}</span>
              ) : lastSaved ? (
                <span className="text-gray-eske-40 dark:text-[#6D8294]">✓ {lastSaved.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
              ) : null}
            </span>
            <DownloadButton form={form} reportText={reportText} chatMessages={chatMessages} />
          </div>
        </div>

        {/* Fila 2: 3 chips — idéntico a F1 */}
        {(() => {
          const btnBase = "px-2.5 py-1.5 border border-bluegreen-eske-60 text-bluegreen-eske-60 bg-transparent rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:bg-bluegreen-eske/5";
          const btnClose = "px-2.5 py-1.5 bg-bluegreen-eske-60 text-white-eske rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

          return (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {/* Chip 1: Reporte F2 / Cancelar */}
              {headerState === "editando" ? (
                <button onClick={handleCancelEdit} className={btnBase}>Cancelar</button>
              ) : (
                <button
                  onClick={() => setShowReporte(true)}
                  disabled={headerState === "en_progreso"}
                  className={btnBase}
                >
                  Reporte F2
                </button>
              )}

              {/* Chip 2: Editar análisis / Guardar cambios */}
              {headerState === "editando" ? (
                <button onClick={handleSaveEdit} disabled={isSaving || generandoDVS} className={btnBase}>
                  {isSaving || generandoDVS ? "Guardando..." : "Guardar cambios"}
                </button>
              ) : (
                <button onClick={handleStartEdit} disabled={headerState === "en_progreso"} className={btnBase}>
                  Editar análisis
                </button>
              )}

              {/* Chip 3: Cerrar Fase 2 */}
              <button
                onClick={handleOpenReview}
                disabled={headerState !== "lista"}
                className={headerState === "lista" ? btnClose : btnBase}
              >
                Cerrar Fase 2
              </button>
            </div>
          );
        })()}
      </div>

      {/* C8 — Alerta RDA heredada de F1 */}
      {rdaActivo && (
        <div
          role="alert"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-purple-50 border-l-4 border-purple-400 text-sm dark:bg-yellow-eske/10 dark:border-yellow-eske"
        >
          <svg className="w-4 h-4 shrink-0 text-purple-600 dark:text-yellow-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-black-eske dark:text-white">
            <strong>Deficiencias activas de F1</strong> —{" "}
            {rdaItems.length > 0 ? `${rdaItems.length} pendientes` : "sin resolver"} en el Propósito.
          </span>
          <Link
            href={`/moddulo/proyecto/${projectId}/proposito`}
            className="ml-auto text-bluegreen-eske underline text-xs shrink-0 hover:text-bluegreen-eske-60"
          >
            Ver RDA de F1
          </Link>
        </div>
      )}

      {/* ===== TABS MOBILE (solo cuando no está en landing) ===== */}
      {!showLanding && (
        <div className="lg:hidden shrink-0 flex border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
          {[
            { id: "chat" as const, label: showReporte && dvs !== null && mode !== "editing" ? "Reporte F2" : mapaPESTEL !== null && dvs === null && mode !== "editing" ? "Motores" : "Chat" },
            { id: "form" as const, label: "Análisis PESTEL" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setMobileTab(id)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors border-b-2 ${
                mobileTab === id ? "border-bluegreen-eske text-bluegreen-eske" : "border-transparent text-gray-eske-50 dark:text-[#9AAEBE]"
              }`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ===== CONTENIDO PRINCIPAL ===== */}
      <div className="flex-1 flex overflow-hidden">

        {/* A1 — Landing page de F2 */}
        {showLanding && isLoaded && (
          <F2LandingView
            projectName={projectName}
            projectType={projectType}
            projectTerritory={projectTerritory}
            onComenzar={handleComenzarF2}
          />
        )}

        {/* Columnas de trabajo (ocultas cuando se muestra la landing) */}
        {!showLanding && (<>
        <div className={`flex-1 flex-col p-3 sm:p-4 overflow-hidden min-w-0 ${mobileTab === "chat" ? "flex" : "hidden lg:flex"}`}>

          {/* Reporte F2 — DVS finalizado */}
          {showReporte && dvs !== null && mode !== "editing" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <button
                onClick={() => setShowReporte(false)}
                className="shrink-0 mb-3 flex items-center gap-1.5 text-sm font-medium text-bluegreen-eske hover:text-bluegreen-eske/80 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver al chat
              </button>
              <div className="flex-1 overflow-y-auto">
                <DVSView dvs={dvs} />
              </div>
            </div>

          /* Estado B — mapaPESTEL disponible, DVS aún no finalizado */
          ) : mapaPESTEL !== null && dvs === null && mode !== "editing" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-black-eske dark:text-white">
                    Análisis por motores
                  </p>
                  <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE]">
                    Revisa y aprueba cada sección antes de generar el DVS final.
                  </p>
                </div>
                {pestlVia === "pestel" && pestProjectId && (
                  <button
                    onClick={() => router.push(`/centinela/pestel/${pestProjectId}/analisis`)}
                    className="shrink-0 px-3 py-1.5 border border-bluegreen-eske-60 text-bluegreen-eske-60 dark:border-[#6BA4C6] dark:text-[#6BA4C6] rounded-lg text-xs font-semibold hover:bg-bluegreen-eske/5 transition-colors"
                  >
                    Regresar a PESTEL →
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                <MotoresSequentialView
                  projectId={projectId}
                  draftDVS={draftDVS}
                  motorAprobaciones={motorAprobaciones}
                  isGenerating={isGeneratingMotors}
                  generationError={motorGenerationError}
                  onRetry={generarDraftDVS}
                  onApprove={handleApproveMotor}
                  onDraftChange={setDraftDVS}
                />
              </div>
            </div>

          /* Estado A — chat (sin mapaPESTEL o en modo edición) */
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden gap-3">
              <ModduloChat
                phaseId="exploracion"
                projectId={projectId}
                currentFormData={currentFormData}
                xpctoContext={xpctoContext}
                onDataExtracted={handleDataExtracted}
                onMessagesChange={setChatMessages}
                className="flex-1 overflow-hidden"
                renderAfterWelcome={
                  headerState === "en_progreso" ? (
                    <div className="flex justify-start mt-2 ml-10">
                      <button
                        onClick={handleGenerarDVS}
                        disabled={generandoDVS}
                        className="flex items-center gap-1.5 text-sm font-semibold rounded-full px-4 py-1.5 bg-bluegreen-eske text-white hover:bg-bluegreen-eske/90 transition-colors disabled:opacity-50"
                      >
                        {generandoDVS ? (
                          <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />Generando DVS…</>
                        ) : "Generar DVS"}
                      </button>
                    </div>
                  ) : null
                }
              />
              {/* Botón PESTEL — posición inferior */}
              {(dvs === null || pestlVia === "pestel") && mode !== "editing" && (
                <div className="shrink-0 flex justify-end">
                  <button
                    onClick={pestlVia === "pestel" && pestProjectId
                      ? () => router.push(`/centinela/pestel/${pestProjectId}/analisis`)
                      : handleAbrirPESTEL}
                    className="px-3 py-2 border border-bluegreen-eske-60 text-bluegreen-eske-60 dark:border-[#6BA4C6] dark:text-[#6BA4C6] rounded-lg text-xs font-semibold hover:bg-bluegreen-eske/5 transition-colors"
                  >
                    {pestlVia === "pestel" && pestProjectId ? "Regresar a PESTEL →" : "Abrir PESTEL"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna derecha: formulario PEST-L */}
        <div className={`flex-col w-full lg:w-80 xl:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-eske-20 dark:border-white/10 overflow-hidden bg-gray-eske-10/50 dark:bg-[#112230] ${mobileTab === "form" ? "flex" : "hidden lg:flex"}`}>
          <ExplorationFormPanel
            form={activeForm}
            onChange={setActiveForm}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            readOnly={mode === "completed"}
            projectType={projectType}
            sefixData={sefixData}
            mapaPESTEL={mapaPESTEL}
          />
        </div>
        </>)}
      </div>

      {/* Modal de revisión al cerrar */}
      {showReview && (
        <PhaseTransitionReview
          phaseId="exploracion"
          nextPhaseId="investigacion"
          xpcto={xpcto ?? {}}
          risks={[]}
          onConfirm={handleClosePhase}
          onCancel={() => setShowReview(false)}
          isSubmitting={isClosingPhase}
          dvsChecklist={dvsChecklist.length > 0 ? dvsChecklist : undefined}
        />
      )}

      {/* Modal back-propagation */}
      {propagationWarning.length > 0 && (
        <BackPropagationModal
          affectedPhases={propagationWarning}
          onDismiss={() => { setPropagationWarning([]); setMode("completed"); }}
        />
      )}
    </div>
  );
}

// ==========================================
// PANEL DEL FORMULARIO PEST-L
// ==========================================

function ExplorationFormPanel({
  form, onChange, activeSection, onSectionChange, readOnly, projectType, sefixData, mapaPESTEL,
}: {
  form: ExplorationForm;
  onChange: (f: ExplorationForm) => void;
  activeSection: PestlSection;
  onSectionChange: (s: PestlSection) => void;
  readOnly: boolean;
  projectType: ProjectType;
  sefixData: SefixData | null;
  mapaPESTEL: MapaPESTEL | null;
}) {
  const fieldClass =
    "w-full px-3 py-2 text-sm font-normal rounded-lg border border-gray-eske-20 dark:border-white/10 " +
    "focus:outline-none focus:ring-2 focus:ring-bluegreen-eske/30 focus:border-bluegreen-eske " +
    "text-black-eske dark:text-[#EAF2F8] bg-white-eske dark:bg-[#112230] " +
    "disabled:bg-gray-eske-10 dark:disabled:bg-[#21425E] disabled:text-black-eske-10 dark:disabled:text-[#9AAEBE] " +
    "placeholder:text-gray-eske-40 dark:placeholder:text-[#6D8294] resize-none";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A] flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-eske-50 dark:text-[#9AAEBE]">Análisis PESTEL</h2>
        <span className="text-xs text-gray-eske-40 dark:text-[#6D8294]">{readOnly ? "Solo lectura" : "Auto-rellena via chat"}</span>
      </div>

      {/* Tabs de secciones */}
      <div className="shrink-0 flex overflow-x-auto border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        {PESTL_SECTIONS.map((sec) => {
          const filled = isSectionFilled(form, sec.id);
          const hasSignals = sec.dimCode && mapaPESTEL?.[sec.dimCode];
          return (
            <button key={sec.id} onClick={() => onSectionChange(sec.id)}
              className={`shrink-0 px-3 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1 ${
                activeSection === sec.id
                  ? "border-bluegreen-eske text-bluegreen-eske"
                  : "border-transparent text-gray-eske-50 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8]"
              }`}>
              <span className="hidden sm:inline">{sec.label}</span>
              <span className="sm:hidden">{sec.short}</span>
              {hasSignals && <span className="w-1.5 h-1.5 rounded-full bg-orange-eske shrink-0" title="Señales PESTEL importadas" />}
              {!hasSignals && filled && <span className="w-1.5 h-1.5 rounded-full bg-bluegreen-eske shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Contenido de la sección */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeSection === "politico" && (
          mapaPESTEL?.["P"] ? (
            <TripartiteSignalsPanel dim={mapaPESTEL["P"]} />
          ) : (
            <PoliticoSection form={form} onChange={onChange} readOnly={readOnly} fieldClass={fieldClass} projectType={projectType} sefixData={sefixData} />
          )
        )}
        {activeSection === "economico" && (
          mapaPESTEL?.["E"] ? (
            <TripartiteSignalsPanel dim={mapaPESTEL["E"]} />
          ) : (
            <SimpleDimSection
              title="Entorno Económico"
              hint={projectType === "gubernamental"
                ? "Recursos públicos, presupuesto, condiciones que afectan la gestión"
                : "Condiciones económicas que impactan la viabilidad y el electorado"}
              contexto={form.pestl.economico.contexto}
              senales={form.pestl.economico.senalesCriticas}
              onCtx={(v) => onChange({ ...form, pestl: { ...form.pestl, economico: { ...form.pestl.economico, contexto: v } } })}
              onSen={(v) => onChange({ ...form, pestl: { ...form.pestl, economico: { ...form.pestl.economico, senalesCriticas: v } } })}
              readOnly={readOnly} fieldClass={fieldClass}
            />
          )
        )}
        {activeSection === "social" && (
          mapaPESTEL?.["S"] ? (
            <TripartiteSignalsPanel dim={mapaPESTEL["S"]} />
          ) : (
            <SimpleDimSection
              title="Entorno Social"
              hint={projectType === "electoral"
                ? "Demografía, preferencias e identidades del electorado"
                : projectType === "ciudadano"
                ? "Bases sociales, capacidad de movilización, tejido asociativo"
                : "Percepción ciudadana, demandas sociales y cohesión"}
              contexto={form.pestl.social.contexto}
              senales={form.pestl.social.senalesCriticas}
              onCtx={(v) => onChange({ ...form, pestl: { ...form.pestl, social: { ...form.pestl.social, contexto: v } } })}
              onSen={(v) => onChange({ ...form, pestl: { ...form.pestl, social: { ...form.pestl.social, senalesCriticas: v } } })}
              readOnly={readOnly} fieldClass={fieldClass}
            />
          )
        )}
        {activeSection === "tecnologico" && (
          mapaPESTEL?.["T"] ? (
            <TripartiteSignalsPanel dim={mapaPESTEL["T"]} />
          ) : (
            <SimpleDimSection
              title="Entorno Tecnológico"
              hint="Infraestructura digital, redes sociales dominantes, herramientas disponibles"
              contexto={form.pestl.tecnologico.contexto}
              senales={form.pestl.tecnologico.senalesCriticas}
              onCtx={(v) => onChange({ ...form, pestl: { ...form.pestl, tecnologico: { ...form.pestl.tecnologico, contexto: v } } })}
              onSen={(v) => onChange({ ...form, pestl: { ...form.pestl, tecnologico: { ...form.pestl.tecnologico, senalesCriticas: v } } })}
              readOnly={readOnly} fieldClass={fieldClass}
            />
          )
        )}
        {activeSection === "ecologico" && (
          mapaPESTEL?.["Ec"] ? (
            <TripartiteSignalsPanel dim={mapaPESTEL["Ec"]} />
          ) : (
            <SimpleDimSection
              title="Entorno Ecológico"
              hint="Riesgos ambientales, normativa ecológica, impacto en territorio y comunidades"
              contexto={form.pestl.ecologico.contexto}
              senales={form.pestl.ecologico.senalesCriticas}
              onCtx={(v) => onChange({ ...form, pestl: { ...form.pestl, ecologico: { ...form.pestl.ecologico, contexto: v } } })}
              onSen={(v) => onChange({ ...form, pestl: { ...form.pestl, ecologico: { ...form.pestl.ecologico, senalesCriticas: v } } })}
              readOnly={readOnly} fieldClass={fieldClass}
            />
          )
        )}
        {activeSection === "legal" && (
          mapaPESTEL?.["L"] ? (
            <TripartiteSignalsPanel dim={mapaPESTEL["L"]} />
          ) : (
            <SimpleDimSection
              title="Entorno Legal"
              hint={projectType === "legislativo"
                ? "Marco normativo, bloques parlamentarios, requisitos de coalición o mayoría"
                : "Marco jurídico electoral, plazos legales, restricciones y oportunidades normativas"}
              contexto={form.pestl.legal.contexto}
              senales={form.pestl.legal.senalesCriticas}
              onCtx={(v) => onChange({ ...form, pestl: { ...form.pestl, legal: { ...form.pestl.legal, contexto: v } } })}
              onSen={(v) => onChange({ ...form, pestl: { ...form.pestl, legal: { ...form.pestl.legal, senalesCriticas: v } } })}
              readOnly={readOnly} fieldClass={fieldClass}
            />
          )
        )}
      </div>
    </div>
  );
}

// ==========================================
// SEÑALES TRIPARTITAS (C4)
// ==========================================

function TripartiteSignalsPanel({ dim }: { dim: F2DimensionPESTEL }) {
  const CLASIF_COLORS: Record<string, string> = {
    OPORTUNIDAD: "bg-green-eske-20 text-green-eske-80 dark:bg-green-eske/20",
    NEUTRAL: "bg-[#FFF2CC] text-[#816000] dark:bg-yellow-eske/20 dark:text-yellow-eske",
    AMENAZA: "bg-red-eske-20 text-red-eske-80 dark:bg-red-eske/20",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-black-eske dark:text-white">{dim.label}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CLASIF_COLORS[dim.clasificacion] ?? CLASIF_COLORS.NEUTRAL}`}>
          {dim.clasificacion}
        </span>
        {dim.confidence !== undefined && (
          <span className="text-xs text-gray-eske-50 dark:text-[#9AAEBE]">
            {dim.confidence}% conf.
          </span>
        )}
      </div>
      {dim.narrativa && (
        <div className="text-xs text-black-eske-80 dark:text-[#C5D8E8] space-y-2">
          {dim.narrativa.split("\n\n").filter(Boolean).map((para, i) => (
            <p key={i}>{para.trim()}</p>
          ))}
        </div>
      )}

      <SignalGroup
        title="Señales favorables"
        signals={dim.senalesFavorables}
        colorClass="text-green-eske-70 dark:text-[#7BC47C]"
        summaryClass="border border-green-eske-30 dark:border-green-eske/20"
      />
      <SignalGroup
        title="Señales adversas"
        signals={dim.senalesAdversas}
        colorClass="text-red-eske-70 dark:text-[#E07070]"
        summaryClass="border border-red-eske-20 dark:border-red-eske/20"
      />
      <SignalGroup
        title="Señales inciertas"
        signals={dim.senalesInciertas}
        colorClass="text-purple-700 dark:text-yellow-eske"
        summaryClass="border border-purple-200 dark:border-yellow-eske/20"
      />
    </div>
  );
}

function SignalGroup({
  title, signals, colorClass, summaryClass,
}: {
  title: string;
  signals: F2DimensionPESTEL["senalesFavorables"];
  colorClass: string;
  summaryClass: string;
}) {
  if (signals.length === 0) return null;
  return (
    <details className={`rounded-lg overflow-hidden ${summaryClass}`}>
      <summary className={`px-3 py-2 text-xs font-semibold cursor-pointer list-none flex items-center justify-between ${colorClass}`}>
        {title} <span className="text-gray-eske-50">({signals.length})</span>
      </summary>
      <ul className="divide-y divide-gray-eske-20 dark:divide-white/5">
        {signals.map((s, i) => (
          <li key={i} className="px-3 py-2 space-y-0.5">
            <p className="text-xs text-black-eske dark:text-[#EAF2F8]">{s.descripcion}</p>
            <div className="flex items-center gap-2 text-xs text-gray-eske-50 dark:text-[#9AAEBE]">
              <span>{s.fuente}</span>
              {s.fechaCorte && <span>· {s.fechaCorte}</span>}
              {s.origenInternacional && (
                <span className="px-1.5 py-0.5 bg-bluegreen-eske-10 text-bluegreen-eske-70 rounded text-xs dark:bg-bluegreen-eske/20">
                  Intl.
                </span>
              )}
              <span className={`ml-auto px-1.5 py-0.5 rounded text-xs ${
                s.nivelConfianza === "alto" ? "bg-green-eske-10 text-green-eske-70" :
                s.nivelConfianza === "bajo" ? "bg-red-eske-10 text-red-eske-70" :
                "bg-gray-eske-10 text-gray-eske-60"
              }`}>
                {s.nivelConfianza}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ==========================================
// SECCIÓN POLÍTICO
// ==========================================

function PoliticoSection({ form, onChange, readOnly, fieldClass, projectType, sefixData }: {
  form: ExplorationForm; onChange: (f: ExplorationForm) => void;
  readOnly: boolean; fieldClass: string; projectType: ProjectType;
  sefixData: SefixData | null;
}) {
  const hint = projectType === "legislativo"
    ? "Bloques parlamentarios, presidencias de comisión, alianzas y oposición"
    : projectType === "electoral"
    ? "Partidos, coaliciones, figuras clave y estructura de la competencia electoral"
    : "Actores gubernamentales, grupos de presión y dinámica de poder institucional";

  const upd = (patch: Partial<ExplorationForm["pestl"]["politico"]>) =>
    onChange({ ...form, pestl: { ...form.pestl, politico: { ...form.pestl.politico, ...patch } } });

  return (
    <div className="space-y-3">
      {sefixData && <SefixWidget data={sefixData} projectType={projectType} />}
      <SectionField label="Contexto político general" hint={hint}>
        <AutoResizeTextarea value={form.pestl.politico.contexto}
          onChange={(v) => upd({ contexto: v })} disabled={readOnly}
          placeholder="Describe el panorama político del territorio y su relevancia para el proyecto..."
          minRows={3} maxRows={8} className={fieldClass} />
      </SectionField>
      <SectionField label="Actores clave">
        <AutoResizeTextarea value={form.pestl.politico.actoresClave}
          onChange={(v) => upd({ actoresClave: v })} disabled={readOnly}
          placeholder="¿Quiénes tienen influencia política real en este proyecto? (personas, partidos, organizaciones)"
          minRows={2} maxRows={6} className={fieldClass} />
      </SectionField>
      <SectionField label="Actores de veto" hint="Actores con capacidad real de bloqueo">
        <AutoResizeTextarea value={form.pestl.politico.actoresVeto}
          onChange={(v) => upd({ actoresVeto: v })} disabled={readOnly}
          placeholder="¿Quiénes pueden bloquear el proyecto y por qué razón?"
          minRows={2} maxRows={6} className={fieldClass} />
      </SectionField>
      <SectionField label="Señales críticas">
        <AutoResizeTextarea value={form.pestl.politico.senalesCriticas}
          onChange={(v) => upd({ senalesCriticas: v })} disabled={readOnly}
          placeholder="Alertas u oportunidades políticas identificadas en el entorno..."
          minRows={2} maxRows={5} className={fieldClass} />
      </SectionField>
    </div>
  );
}

// ==========================================
// SECCIÓN GENÉRICA (E, S, T, Ec, L)
// ==========================================

function SimpleDimSection({ title, hint, contexto, senales, onCtx, onSen, readOnly, fieldClass }: {
  title: string; hint: string; contexto: string; senales: string;
  onCtx: (v: string) => void; onSen: (v: string) => void;
  readOnly: boolean; fieldClass: string;
}) {
  return (
    <div className="space-y-3">
      <SectionField label={title} hint={hint}>
        <AutoResizeTextarea value={contexto} onChange={onCtx} disabled={readOnly}
          placeholder={`Describe el contexto de ${title.toLowerCase()} y su impacto en el proyecto...`}
          minRows={4} maxRows={10} className={fieldClass} />
      </SectionField>
      <SectionField label="Señales críticas">
        <AutoResizeTextarea value={senales} onChange={onSen} disabled={readOnly}
          placeholder="Alertas u oportunidades identificadas en esta dimensión..."
          minRows={2} maxRows={5} className={fieldClass} />
      </SectionField>
    </div>
  );
}

// ==========================================
// COMPONENTES DE UTILIDAD
// ==========================================

function SectionField({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-eske-60 dark:text-[#9AAEBE] block mb-1">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-eske-40 dark:text-[#6D8294] mb-1">{hint}</p>}
      {children}
    </div>
  );
}

function AutoResizeTextarea({ value, onChange, disabled, placeholder, minRows = 2, maxRows = 10, className = "" }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
  placeholder?: string; minRows?: number; maxRows?: number; className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lh = parseInt(getComputedStyle(el).lineHeight) || 20;
    el.style.height = Math.min(Math.max(el.scrollHeight, lh * minRows + 16), lh * maxRows + 16) + "px";
  }, [value, minRows, maxRows]);

  return (
    <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)}
      disabled={disabled} placeholder={placeholder} rows={minRows}
      className={`resize-none overflow-y-auto ${className}`} />
  );
}

// ==========================================
// MODAL BACK-PROPAGATION
// ==========================================

function BackPropagationModal({ affectedPhases, onDismiss }: {
  affectedPhases: PhaseId[]; onDismiss: () => void;
}) {
  const NAMES: Record<PhaseId, string> = {
    proposito: "Propósito", exploracion: "Exploración", investigacion: "Investigación",
    diagnostico: "Diagnóstico", estrategia: "Diseño Estratégico", tactica: "Diseño Táctico",
    gerencia: "Gerencia", seguimiento: "Seguimiento", evaluacion: "Evaluación",
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
            <h2 className="font-bold text-black-eske dark:text-[#EAF2F8]">Cambios con impacto en fases posteriores</h2>
            <p className="text-sm text-black-eske-10 dark:text-[#C7D6E0] mt-1">Los cambios en la Exploración pueden afectar las decisiones tomadas en las siguientes fases:</p>
          </div>
        </div>
        <ul className="space-y-2 mb-5">
          {affectedPhases.map((id) => (
            <li key={id} className="flex items-center gap-2 text-sm text-black-eske-10 dark:text-[#C7D6E0] bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded-lg">
              <svg className="w-4 h-4 text-orange-500 dark:text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              {NAMES[id]}
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mb-5 leading-relaxed">
          Moddulo ha guardado los cambios. Revisa el trabajo de cada fase afectada para asegurarte de que las decisiones sigan siendo consistentes con el nuevo análisis.
        </p>
        <button onClick={onDismiss}
          className="w-full py-2.5 bg-bluegreen-eske text-white-eske rounded-lg text-sm font-medium hover:bg-bluegreen-eske/90 transition-colors">
          Entendido — revisar las fases afectadas
        </button>
      </div>
    </div>
  );
}

// ==========================================
// BOTÓN DE DESCARGA
// ==========================================

function DownloadButton({ form, reportText, chatMessages }: {
  form: ExplorationForm; reportText: string | null; chatMessages: ChatMessage[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dl = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const pestlText = [
    "ANÁLISIS PESTEL — FASE 2: EXPLORACIÓN",
    "======================================", "",
    "[ P ] POLÍTICO",
    `Contexto: ${form.pestl.politico.contexto || "(sin datos)"}`,
    `Actores clave: ${form.pestl.politico.actoresClave || "(sin datos)"}`,
    `Actores de veto: ${form.pestl.politico.actoresVeto || "(sin datos)"}`,
    `Señales críticas: ${form.pestl.politico.senalesCriticas || "(sin datos)"}`, "",
    "[ E ] ECONÓMICO", `Contexto: ${form.pestl.economico.contexto || "(sin datos)"}`,
    `Señales críticas: ${form.pestl.economico.senalesCriticas || "(sin datos)"}`, "",
    "[ S ] SOCIAL", `Contexto: ${form.pestl.social.contexto || "(sin datos)"}`,
    `Señales críticas: ${form.pestl.social.senalesCriticas || "(sin datos)"}`, "",
    "[ T ] TECNOLÓGICO", `Contexto: ${form.pestl.tecnologico.contexto || "(sin datos)"}`,
    `Señales críticas: ${form.pestl.tecnologico.senalesCriticas || "(sin datos)"}`, "",
    "[ Ec ] ECOLÓGICO", `Contexto: ${form.pestl.ecologico.contexto || "(sin datos)"}`,
    `Señales críticas: ${form.pestl.ecologico.senalesCriticas || "(sin datos)"}`, "",
    "[ L ] LEGAL", `Contexto: ${form.pestl.legal.contexto || "(sin datos)"}`,
    `Señales críticas: ${form.pestl.legal.senalesCriticas || "(sin datos)"}`, "",
    "SEMÁFORO DE VETO",
    ...(form.semaforo.actores.length
      ? form.semaforo.actores.map((a) => `  • ${a.nombre} [${a.nivel.toUpperCase()}]: ${a.descripcion}`)
      : ["  (Sin actores registrados)"]),
    `Síntesis: ${form.semaforo.resumen || "(sin datos)"}`, "",
    "HIPÓTESIS ESTRATÉGICA INICIAL",
    `Enunciado: ${form.hipotesis.enunciado || "(sin datos)"}`,
    `Premisas: ${form.hipotesis.premisas || "(sin datos)"}`,
    `Implicaciones: ${form.hipotesis.implicaciones || "(sin datos)"}`,
  ].join("\n");

  const options = [
    { label: "Reporte exploratorio (.md)", available: !!reportText, action: () => reportText && dl(reportText, "F2-Exploracion-Resultado.md") },
    { label: "Historial del chat (.txt)", available: chatMessages.length > 0, action: () => {
      dl(chatMessages.map((m) => `[${m.role === "assistant" ? "Moddulo" : "Consultor"}]\n${m.content}`).join("\n\n---\n\n"), "F2-Exploracion-Chat.txt");
    }},
    { label: "Análisis PESTEL (.txt)", available: !!(form.pestl.politico.contexto || form.hipotesis.enunciado), action: () => dl(pestlText, "F2-Exploracion-PESTL.txt") },
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} title="Descargar archivos de esta fase"
        className="p-1.5 rounded-lg border border-gray-eske-20 dark:border-white/10 text-black-eske-10 dark:text-[#C7D6E0] hover:border-bluegreen-eske hover:text-bluegreen-eske dark:hover:border-bluegreen-eske-40 dark:hover:text-[#6BA4C6] transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-60 bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 rounded-xl shadow-lg z-20 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/50 dark:bg-[#112230]">
            <p className="text-xs font-bold text-black-eske dark:text-[#9AAEBE] uppercase tracking-widest">Descargar</p>
          </div>
          {options.map(({ label, available, action }) => (
            <button key={label} onClick={() => available && action()} disabled={!available}
              className={`w-full text-left px-3 py-2.5 text-xs font-medium flex items-center gap-2 transition-colors ${
                available ? "text-black-eske dark:text-[#C7D6E0] hover:bg-bluegreen-eske/5 dark:hover:bg-white/5 hover:text-bluegreen-eske dark:hover:text-[#6BA4C6]" : "text-gray-eske-40 dark:text-[#6D8294] cursor-not-allowed"
              }`}>
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

// ==========================================
// SEFIX WIDGET
// ==========================================

function SefixWidget({ data, projectType }: { data: SefixData; projectType?: ProjectType }) {
  const { resultados, padron, gubernatura, nivel } = data;
  if (!resultados && !padron && !gubernatura) return null;

  const isElectoral = !projectType || projectType === "electoral";
  const esNivelEstatal = nivel === "Estatal";
  const esNivelMunicipal = ["Municipal", "Local", "Distrital"].includes(nivel ?? "");

  // Para proyectos estatales: gubernatura es el primario, diputados es el contraste
  // Para proyectos municipales: padrón es primario; gubernatura + diputados son contraste
  // Para proyectos federales / default: diputados es primario; gubernatura es contraste
  const labelPrimario = esNivelEstatal
    ? "DATOS ELECTORALES — ESTATAL"
    : esNivelMunicipal
    ? `DATOS ELECTORALES — MUNICIPAL`
    : `DATOS SEFIX — ${data.estado.toUpperCase()}`;

  const labelContraste = esNivelEstatal
    ? "CONTRASTE — FEDERAL"
    : "CONTRASTE — GUBERNATURA";

  const contextLabel = isElectoral ? null : "Contexto electoral de referencia";

  const fmtN = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : String(n);

  const top3primary = (esNivelEstatal ? gubernatura : resultados)?.partidos.slice(0, 3) ?? [];
  const primaryEleccion = esNivelEstatal ? gubernatura : resultados;
  const contrasteEleccion = esNivelEstatal ? resultados : gubernatura;

  return (
    <div className="space-y-2">
      {/* Sección primaria */}
      <div className="rounded-lg border border-bluegreen-eske/20 bg-bluegreen-eske/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske">
            {contextLabel ?? labelPrimario}
          </p>
          <span className="text-xs text-gray-eske-40 dark:text-[#6D8294]">INE · DERFE</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {padron && (
            <>
              <div className="bg-white-eske dark:bg-[#21425E] rounded-lg px-2.5 py-2">
                <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mb-0.5">Lista Nominal</p>
                <p className="text-sm font-bold text-black-eske dark:text-[#EAF2F8]">{fmtN(padron.listaNominal)}</p>
                <p className="text-xs text-gray-eske-40 dark:text-[#6D8294]">al {padron.corte}</p>
              </div>
              <div className="bg-white-eske dark:bg-[#21425E] rounded-lg px-2.5 py-2">
                <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mb-0.5">Padrón Electoral</p>
                <p className="text-sm font-bold text-black-eske dark:text-[#EAF2F8]">{fmtN(padron.padronElectoral)}</p>
                <p className="text-xs text-gray-eske-40 dark:text-[#6D8294]">
                  H: {fmtN(padron.padronHombres)} · M: {fmtN(padron.padronMujeres)}
                </p>
              </div>
            </>
          )}
          {primaryEleccion && (
            <div className="col-span-2 bg-white-eske dark:bg-[#21425E] rounded-lg px-2.5 py-2">
              <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mb-1">
                Última elección — {primaryEleccion.cargo} {primaryEleccion.anio}
              </p>
              <div className="flex gap-3 flex-wrap">
                {top3primary.map((p) => (
                  <div key={p.partido} className="text-xs">
                    <span className="font-bold text-black-eske dark:text-[#EAF2F8]">{p.partido}</span>
                    <span className="ml-1 text-gray-eske-50 dark:text-[#9AAEBE]">{p.porcentaje}%</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-eske-40 dark:text-[#6D8294] mt-1">
                Participación: {primaryEleccion.participacion}% · {fmtN(primaryEleccion.totalVotos)} votos
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sección contraste — solo si hay datos */}
      {contrasteEleccion && (
        <div className="rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/50 dark:bg-[#112230] p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-eske-50 dark:text-[#9AAEBE]">
            {labelContraste}
          </p>
          <div className="bg-white-eske dark:bg-[#21425E] rounded-lg px-2.5 py-2">
            <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mb-1">
              {contrasteEleccion.cargo} {contrasteEleccion.anio}
            </p>
            <div className="flex gap-3 flex-wrap">
              {contrasteEleccion.partidos.slice(0, 3).map((p) => (
                <div key={p.partido} className="text-xs">
                  <span className="font-bold text-black-eske dark:text-[#EAF2F8]">{p.partido}</span>
                  <span className="ml-1 text-gray-eske-50 dark:text-[#9AAEBE]">{p.porcentaje}%</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-eske-40 dark:text-[#6D8294] mt-1">
              Participación: {contrasteEleccion.participacion}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// HELPERS
// ==========================================

function isSectionFilled(form: ExplorationForm, section: PestlSection): boolean {
  const dim = form.pestl[section as keyof ExplorationForm["pestl"]];
  return dim ? dim.contexto.trim().length > 0 : false;
}

function mergePhaseData(base: ExplorationForm, data: Record<string, unknown>): ExplorationForm {
  const merged = structuredClone(base);
  if (data.pestl && typeof data.pestl === "object") {
    const pestl = data.pestl as Record<string, unknown>;
    for (const dim of ["politico", "economico", "social", "tecnologico", "ecologico", "legal"] as const) {
      if (pestl[dim] && typeof pestl[dim] === "object") Object.assign(merged.pestl[dim], pestl[dim]);
    }
  }
  if (data.semaforo && typeof data.semaforo === "object") Object.assign(merged.semaforo, data.semaforo);
  if (data.hipotesis && typeof data.hipotesis === "object") Object.assign(merged.hipotesis, data.hipotesis);
  return merged;
}

function calcularMesesAlHito(fechaLimite?: string): number {
  if (!fechaLimite) return 12;
  const target = new Date(fechaLimite);
  const now = new Date();
  const months = (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(1, months);
}

const ESTADOS_MEXICO = [
  "aguascalientes", "baja california sur", "baja california",
  "campeche", "chiapas", "chihuahua", "coahuila", "colima",
  "ciudad de mexico", "cdmx", "durango", "estado de mexico",
  "guanajuato", "guerrero", "hidalgo", "jalisco", "michoacan",
  "morelos", "nayarit", "nuevo leon", "oaxaca", "puebla",
  "queretaro", "quintana roo", "san luis potosi", "sinaloa",
  "sonora", "tabasco", "tamaulipas", "tlaxcala", "veracruz",
  "yucatan", "zacatecas",
];

function detectEstadoFromXpcto(xpcto: XPCTO): string | null {
  const text = `${xpcto.hito ?? ""} ${xpcto.sujeto ?? ""} ${xpcto.justificacion ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const sorted = [...ESTADOS_MEXICO].sort((a, b) => b.length - a.length);
  for (const estado of sorted) {
    const normalized = estado.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (text.includes(normalized)) return estado;
  }
  return null;
}

// ==========================================
// A1 — LANDING PAGE F2
// ==========================================

const TYPE_LABELS: Record<string, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

const F2_MOTORS = [
  {
    code: "M1",
    title: "Escaneo PESTEL situado",
    desc: "Análisis de las seis dimensiones del entorno: Político, Económico, Social, Tecnológico, Ecológico y Legal.",
  },
  {
    code: "M2",
    title: "Contraste XPCTO-Entorno",
    desc: "Veredicto por cada variable del proyecto frente a las señales del entorno.",
  },
  {
    code: "M3",
    title: "Semáforo de Riesgo de Veto",
    desc: "Identificación de actores con poder de bloqueo y su nivel de riesgo.",
  },
  {
    code: "M4",
    title: "Mapa de Incertidumbres Estratégicas",
    desc: "Clasificación de lo que no sabemos por urgencia y posibilidad de resolución.",
  },
  {
    code: "M5",
    title: "Hipótesis Estratégica Inicial",
    desc: "Síntesis interpretativa del entorno que F3 validará, ajustará o refutará.",
  },
];

function F2LandingView({
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
            <span className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske">F2 — Exploración</span>
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

        {/* Descripción de F2 */}
        <p className="text-sm text-black-eske-80 dark:text-[#C5D8E8] leading-relaxed">
          F2 establece el mapa situacional del entorno del proyecto mediante el modelo PESTEL,
          contrasta las señales del entorno con las variables XPCTO definidas en F1,
          y produce el Programa de Investigación Profunda que guiará la Fase 3.
        </p>

        {/* Los cinco motores */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-eske-50 dark:text-[#9AAEBE]">
            Los cinco motores de F2
          </p>
          <div className="space-y-2">
            {F2_MOTORS.map((m) => (
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

        {/* Nota informativa */}
        <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] leading-relaxed border-l-2 border-gray-eske-20 dark:border-white/10 pl-3">
          Los resultados de F2 son editables en cualquier momento. Cualquier cambio actualiza
          automáticamente el DVS y puede impactar las fases anteriores y posteriores.
        </p>

        {/* CTA */}
        <button
          onClick={onComenzar}
          className="w-full py-3 rounded-xl bg-bluegreen-eske text-white font-semibold text-sm
            hover:bg-bluegreen-eske/90 active:scale-[0.98] transition-all"
        >
          Comenzar Fase 2
        </button>
      </div>
    </div>
  );
}

async function checkBackPropagation(projectId: string): Promise<PhaseId[]> {
  try {
    const r = await fetch(`/api/moddulo/projects/${projectId}`, { credentials: "include" });
    if (!r.ok) return [];
    const data = await r.json();
    const phases = data.project?.phases ?? {};
    const idx = PHASE_ORDER.indexOf("exploracion");
    return PHASE_ORDER.slice(idx + 1).filter((id) => {
      const s = phases[id]?.status;
      return s === "in-progress" || s === "completed";
    }) as PhaseId[];
  } catch { return []; }
}
