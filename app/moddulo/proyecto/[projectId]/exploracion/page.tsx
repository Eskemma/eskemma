// app/moddulo/proyecto/[projectId]/exploracion/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ModduloChat from "@/app/moddulo/components/ModduloChat";
import PhaseTransitionReview from "@/app/moddulo/components/PhaseTransitionReview";
import DVSView from "./components/DVSView";
import MotoresSequentialView from "./components/MotoresSequentialView";
import OrphanRecoveryView from "./components/OrphanRecoveryView";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import ConfirmReplacePestelModal from "@/app/components/centinela/pestel/ConfirmReplacePestelModal";
import PhaseDownloadMenu from "@/app/components/moddulo/PhaseDownloadMenu";
import { formatF2Report, formatPestelAnalysis } from "@/lib/moddulo/reportFormatters";
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
import { detectForwardStaleness, type PropagationDiff } from "@/lib/moddulo/phasePropagation";
import { matchDistrito, formatDistritoCabecera } from "@/lib/sefix/districtMatching";
import { checkTerritoryMatch, type TerritoryMatch } from "@/lib/moddulo/linkCompatibility";
import { isMexico } from "@/lib/centinela/pestel/utils/country";
import type { WebContextResult } from "@/lib/search/SearchProvider";

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
  listaNominalHombres?: number;
  listaNominalMujeres?: number;
  padronElectoral: number;
  padronHombres: number;
  padronMujeres: number;
  granularidadReal?: string;
  fuente: string;
}

type FedKey  = "diputados" | "senadores" | "presidencia";
type LocKey  = "gubernatura" | "dip_loc" | "ayun";
type ElecKey = FedKey | LocKey;
type SefixScope = "entidad" | "nacional";

interface SefixContrasteEntry { key: ElecKey; scope: SefixScope }

interface SefixEleccion {
  key: ElecKey;
  label: string;
  resultados: SefixResultados | null;
  granularity: string;
}

interface SefixData {
  estado: string;
  padronLabel: string;
  nivel: string;
  padron: SefixPadron | null;
  primary: SefixEleccion;
  contraste: SefixEleccion[];
}

const ELEC_LABELS: Record<ElecKey, string> = {
  diputados:   "Diputados Federales",
  senadores:   "Senadores",
  presidencia: "Presidencia",
  gubernatura: "Gubernatura",
  dip_loc:     "Diputados Locales",
  ayun:        "Ayuntamiento",
};

const CONTRASTE_BY_PRIMARY: Record<ElecKey, SefixContrasteEntry[]> = {
  diputados:   [{ key: "presidencia", scope: "nacional" }, { key: "senadores", scope: "entidad" }, { key: "gubernatura", scope: "entidad" }],
  senadores:   [{ key: "presidencia", scope: "nacional" }, { key: "diputados", scope: "entidad" }, { key: "gubernatura", scope: "entidad" }],
  presidencia: [{ key: "senadores", scope: "nacional" }, { key: "diputados", scope: "nacional" }],
  gubernatura: [{ key: "dip_loc", scope: "entidad" }, { key: "ayun", scope: "entidad" }, { key: "diputados", scope: "entidad" }],
  dip_loc:     [{ key: "gubernatura", scope: "entidad" }, { key: "ayun", scope: "entidad" }, { key: "diputados", scope: "entidad" }],
  ayun:        [{ key: "dip_loc", scope: "entidad" }, { key: "gubernatura", scope: "entidad" }],
};

function getPrimaryKey(tipo: string, nivel: string): ElecKey {
  if (tipo === "electoral") {
    if (nivel === "nacional") return "presidencia";
    if (nivel === "estatal") return "gubernatura";
    if (nivel === "municipal") return "ayun";
    // "distrito" es alias legacy de distrito_federal
    if (nivel === "distrito_federal" || nivel === "distrito") return "diputados";
    if (nivel === "distrito_local") return "dip_loc";
  }
  if (tipo === "gubernamental") return "gubernatura";
  if (tipo === "legislativo") {
    if (nivel === "estatal") return "senadores";
    if (nivel === "municipal" || nivel === "distrito_local") return "dip_loc";
  }
  return "diputados";
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
// STALENESS DETECTION — F1 → F2
// ==========================================

// M1 (escaneo PESTEL) se lee "desde la posición del proyecto: ¿qué significa
// esta variable para este sujeto, con este hito, en esta escala?" (FAT 2.0,
// Fase 2 · M1). Sujeto e Hito enmarcan el escaneo — Capacidades, Tiempo y
// Justificación solo alimentan M2 (contraste XPCTO-Entorno), que opera sobre
// el M1 ya generado sin necesidad de rescanearlo. Clasificación específica
// de este par F1→F2 — no vive en el motor genérico (lib/moddulo/phasePropagation.ts).
const FULL_REGEN_FIELDS = new Set([
  "Sujeto",
  "Hito",
]);

function getRegenerationType(diffs: PropagationDiff[]): "full" | "partial" {
  return diffs.some((d) => FULL_REGEN_FIELDS.has(d.field)) ? "full" : "partial";
}

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
  // Antes, un fallo de red/servidor en "Guardar cambios" quedaba en
  // silencio: el botón volvía a su estado normal sin ninguna señal, y el
  // usuario asumía que su edición (ej. una pregunta nueva del PIP) se
  // había persistido cuando en realidad no. Ver docs de la investigación
  // de propagación PIP→tablero F3.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [propagationWarning, setPropagationWarning] = useState<PhaseId[]>([]);
  const [showConfirmReanalisis, setShowConfirmReanalisis] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "form">("chat");
  const [sefixData, setSefixData] = useState<SefixData | null>(null);
  const [webElectoralData, setWebElectoralData] = useState<WebContextResult | null>(null);
  const [webElectoralLoading, setWebElectoralLoading] = useState(false);

  // DVS y MapaPESTEL (C2, C3, C4)
  const [dvs, setDvs] = useState<DVSF2 | null>(null);
  const [generandoDVS, setGenerandoDVS] = useState(false);
  const [isExpressAnalyzing, setIsExpressAnalyzing] = useState(false);
  const [expressStartTime, setExpressStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expressError, setExpressError] = useState<string | null>(null);
  const [mapaPESTEL, setMapaPESTEL] = useState<MapaPESTEL | null>(null);
  // Mirror de mapaPESTEL en ref — permite leer el valor vigente dentro de
  // generarDraftDVS sin agregarlo a sus deps (se mantiene estable).
  const mapaPESTELRef = useRef<MapaPESTEL | null>(null);
  useEffect(() => { mapaPESTELRef.current = mapaPESTEL; }, [mapaPESTEL]);
  // Serializado del mapaPESTEL que corresponde al draftDVS actualmente
  // válido — el auto-generate effect solo regenera si el contenido de
  // mapaPESTEL difiere de este marcador, no solo su referencia de objeto.
  const lastGeneratedMapaRef = useRef<string | null>(null);
  const [showReporte, setShowReporte] = useState(false);
  // Nuevo flujo de motores secuenciales (Iter 2+)
  const [draftDVS, setDraftDVS] = useState<DVSF2 | null>(null);
  const [motorAprobaciones, setMotorAprobaciones] = useState<{
    M2?: boolean; M3?: boolean; M4?: boolean; M5?: boolean;
  }>({});
  const [isGeneratingMotors, setIsGeneratingMotors] = useState(false);
  const [motorGenerationError, setMotorGenerationError] = useState<string | null>(null);
  // Distingue si la generación de M2-M5 en curso acompaña un M1 nuevo/reemplazado
  // ("full") o es solo una actualización de contraste sobre el mismo M1 ("partial")
  // — determina el texto del botón de reintento si falla.
  const [regenKind, setRegenKind] = useState<"full" | "partial">("full");
  const [dvsChecklist, setDvsChecklist] = useState<CriterioDVS[]>([]);
  const [xpctoStaleChanges, setXpctoStaleChanges] = useState<PropagationDiff[]>([]);

  // Orphan recovery: Moddulo project was hard-deleted
  const [projectNotFound, setProjectNotFound] = useState(false);
  // F1 banner: phase proposito status for F2 landing warning
  const [phaseStatusF1, setPhaseStatusF1] = useState<string | null>(null);

  // A1 — Landing page: metadatos del proyecto
  const [showLanding, setShowLanding] = useState(true);
  const [projectName, setProjectName] = useState<string>("");
  const [projectColor, setProjectColor] = useState<string>("#026988");
  const [projectTerritory, setProjectTerritory] = useState<Territorio | null>(null);
  const esMexico = isMexico(projectTerritory?.pais);

  // A7 — rastrear si el usuario eligió la vía PESTEL desde el chat
  const [pestlVia, setPestlVia] = useState<"pestel" | null>(null);
  // ID del proyecto PESTEL vinculado (si ya exportó desde Centinela)
  const [pestProjectId, setPestProjectId] = useState<string | null>(null);
  // ID del análisis PESTEL vinculado (para resolver pestProjectId cuando falta)
  const [pestAnalysisId, setPestAnalysisId] = useState<string | null>(null);
  // currentStage del proyecto PESTEL — always fetched fresh, never cached
  const [pestCurrentStage, setPestCurrentStage] = useState<number | null>(null);
  const [pestStageLoading, setPestStageLoading] = useState(false);
  // Guarda el pestAnalysisId previo a desvincular — habilita el botón
  // "Vincular de nuevo" (deshacer) sin tener que pasar por el picker.
  const [lastUnlinkedPestAnalysisId, setLastUnlinkedPestAnalysisId] = useState<string | null>(null);
  // Conflicto detectado por import-pestel (409): mapaPESTEL existente viene
  // de una fuente distinta. Se resuelve con confirmación explícita del
  // usuario antes de reintentar con confirmReplace: true.
  const [pendingReplaceConfirm, setPendingReplaceConfirm] = useState<{ pestAnalysisId: string; source: "relink" | "sync" } | null>(null);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);

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
          if (r.status === 404) {
            setProjectNotFound(true);
          } else {
            console.error(`[exploracion] API error ${r.status}:`, await r.text());
          }
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

        // Read mapaPESTEL first — needed to decide showReporte default
        const savedLinkedSource = p.phases?.exploracion?.linkedSource;
        const savedMapa = savedLinkedSource?.payload;

        // Cargar DVS si existe
        const savedDvs = p.phases?.exploracion?.dvs;
        if (savedDvs) {
          setDvs(savedDvs as DVSF2);
          setShowLanding(false);
          // If mapaPESTEL exists, Estado B is the default view (motors first).
          // Without mapaPESTEL, auto-show DVSView (legacy flow).
          if (!savedMapa) {
            setShowReporte(true);
          }
        }

        // Cargar draftDVS y motorAprobaciones (nuevo flujo de motores)
        // Descartar draftDVS si M5 está vacío: estado inválido, forzar regeneración completa
        const savedDraftDVS = p.phases?.exploracion?.draftDVS as Record<string, unknown> | undefined;
        const draftHei = savedDraftDVS?.hei as Record<string, unknown> | undefined;
        const draftM5Valid = !!(draftHei?.tensionCentral || draftHei?.contexto || (Array.isArray(savedDraftDVS?.pip) && (savedDraftDVS.pip as unknown[]).length > 0));
        if (savedDraftDVS && draftM5Valid) {
          setDraftDVS(savedDraftDVS as unknown as DVSF2);
        }
        // Baseline del auto-generate effect: marca que savedMapa ya generó
        // un DVS — sin importar si el proyecto sigue en borrador (draftDVS)
        // o ya finalizó (dvs, con draftDVS borrado por finalize-dvs). Antes
        // esto solo se primaba dentro del `if` de arriba, así que cualquier
        // proyecto F2 ya cerrado (sin draftDVS en Firestore) perdía el
        // baseline y disparaba una regeneración completa en cada carga.
        if (savedMapa) lastGeneratedMapaRef.current = JSON.stringify(savedMapa);
        const savedMotorAprobaciones = p.phases?.exploracion?.motorAprobaciones;
        if (savedMotorAprobaciones) setMotorAprobaciones(
          savedMotorAprobaciones as { M2?: boolean; M3?: boolean; M4?: boolean; M5?: boolean }
        );

        if (savedMapa) setMapaPESTEL(savedMapa as MapaPESTEL);

        // Detect F1→F2 staleness: compare XPCTO used at generation vs. current.
        // Applies regardless of M1 origin (express or Centinela PESTEL) — both
        // paths capture xpctoSnapshotAtGeneration since the snapshot/redirect fix.
        // Vía el motor genérico de propagación (lib/moddulo/phasePropagation.ts).
        const staleDiffs = detectForwardStaleness("exploracion", p);
        if (staleDiffs && staleDiffs.length > 0) setXpctoStaleChanges(staleDiffs);

        // Cargar referencia al proyecto PESTEL vinculado — kind "T22" es el
        // único que representa un vínculo real de Centinela (express también
        // puebla linkedSource, pero su sourceId es el propio proyecto Moddulo).
        const savedPestProjectId = savedLinkedSource?.kind === "T22" ? savedLinkedSource.sourceId : undefined;
        const savedPestAnalysisId = savedLinkedSource?.sourceAnalysisId;
        const savedLastUnlinked = p.phases?.exploracion?.lastUnlinkedLinkedSource?.sourceAnalysisId;
        if (savedLastUnlinked) setLastUnlinkedPestAnalysisId(savedLastUnlinked as string);
        if (savedPestAnalysisId) setPestAnalysisId(savedPestAnalysisId as string);
        if (savedPestProjectId) {
          setPestProjectId(savedPestProjectId as string);
          setPestlVia("pestel");
          // Happy path: fetch fresh currentStage — never use a cached value
          setPestStageLoading(true);
          fetch(`/api/moddulo/f2/find-linked-pestel?pestel_project_id=${savedPestProjectId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data: { found: boolean; currentStage?: number } | null) => {
              if (data?.found) setPestCurrentStage(data.currentStage ?? 3);
            })
            .catch(() => { /* non-fatal — button falls back to /datos */ })
            .finally(() => setPestStageLoading(false));
        } else if (savedPestAnalysisId || savedMapa) {
          // Proyecto vinculado antes de que se guardara pestProjectId
          setPestlVia("pestel");
        } else {
          // Fallback: check Centinela side in case write-back failed
          fetch(`/api/moddulo/f2/find-linked-pestel?moddulo_project_id=${projectId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data: { found: boolean; sourceId?: string; currentStage?: number } | null) => {
              if (data?.found && data.sourceId) {
                setPestProjectId(data.sourceId);
                setPestlVia("pestel");
                setPestCurrentStage(data.currentStage ?? 3);
              }
            })
            .catch(() => { /* non-fatal */ });
        }

        // A1 — Ocultar landing si ya inició la fase
        if (p.phases?.exploracion?.started || phaseStatus === "completed") {
          setShowLanding(false);
        }

        // Track F1 status for the F2 landing banner
        const f1Status = p.phases?.proposito?.status as string | undefined;
        if (f1Status) setPhaseStatusF1(f1Status);
      })
      .catch((err) => console.error("[exploracion] fetch error:", err))
      .finally(() => setIsLoaded(true));
  }, [projectId]);

  // Helper compartido: importa/re-sincroniza un análisis de Centinela PESTEL.
  // Usado por el efecto C7 (automático, al regresar con ?pest_analysis_id=),
  // "Vincular de nuevo ↺" (handleRelinkPestel), y la confirmación de
  // reemplazo (handleConfirmReplace) — un solo lugar para el manejo de
  // éxito/conflicto en vez de triplicar la lógica.
  //
  // Devuelve { ok: true } en éxito (incluye el idempotente), o
  // { ok: false, conflict: boolean } — conflict: true significa que el
  // backend rechazó con 409 porque mapaPESTEL viene de otra fuente; el
  // llamador decide si ofrece confirmación (confirmReplace: true) o no.
  const importPestel = useCallback(
    async (pestAnalysisId: string, confirmReplace = false): Promise<{ ok: boolean; conflict: boolean }> => {
      try {
        const r = await fetch("/api/moddulo/f2/import-pestel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ projectId, pestAnalysisId, confirmReplace }),
        });
        if (r.status === 409) return { ok: false, conflict: true };
        if (!r.ok) return { ok: false, conflict: false };

        const data = await r.json();
        const linkedSource = data.linkedSource as { sourceId?: string; payload?: MapaPESTEL } | undefined;
        if (linkedSource?.payload) setMapaPESTEL(linkedSource.payload);
        if (linkedSource?.sourceId) {
          setPestProjectId(linkedSource.sourceId);
          setPestlVia("pestel");
        }
        setPestAnalysisId(pestAnalysisId);
        // M1 pudo haberse refrescado (análisis renovado, restaurado, o
        // reemplazando un express) — M2-M5 aprobados contra el M1 anterior
        // quedarían obsoletos, se fuerza re-aprobación. draftDVS NO se limpia
        // aquí: el auto-generate effect dispara la regeneración y solo lo
        // sobreescribe si tiene éxito.
        setRegenKind("full");
        setMotorAprobaciones({});
        setXpctoStaleChanges([]);
        setLastUnlinkedPestAnalysisId(null);

        // Limpia el query param — evita que el efecto C7 vuelva a disparar
        // este mismo import (aunque sea idempotente) en visitas futuras.
        if (window.location.search.includes("pest_analysis_id")) {
          const url = new URL(window.location.href);
          url.searchParams.delete("pest_analysis_id");
          router.replace(url.pathname + url.search, { scroll: false });
        }
        return { ok: true, conflict: false };
      } catch {
        return { ok: false, conflict: false };
      }
    },
    [projectId, router]
  );

  // C7 — Auto-import PESTEL al regresar con pest_analysis_id en URL.
  // Se re-dispara cuando el pestId de la URL difiere del ya importado —
  // cubre el caso de regreso tras regenerar el análisis en Centinela
  // (mismo proyecto PESTEL vinculado, análisis renovado). Si el backend
  // responde 409 (mapaPESTEL de otra fuente — p.ej. reemplazando un express
  // tras "Analizar con PESTEL"), pide confirmación explícita en vez de
  // sobrescribir o ignorar en silencio.
  useEffect(() => {
    if (!isLoaded || !projectId) return;
    const urlParams = new URLSearchParams(window.location.search);
    const pestId = urlParams.get("pest_analysis_id");
    if (!pestId) return;
    if (mapaPESTEL && pestId === pestAnalysisId) return; // ya sincronizado

    importPestel(pestId).then((result) => {
      if (!result.ok && result.conflict) {
        setPendingReplaceConfirm({ pestAnalysisId: pestId, source: "sync" });
      }
    });
  }, [isLoaded, projectId, mapaPESTEL, pestAnalysisId, importPestel]);

  // C7b — Resolver pestProjectId cuando existe pestAnalysisId pero no pestProjectId.
  // Si M1 ya existe, usa analysis-meta (solo lectura) para evitar sobreescribir mapaPESTEL.
  // Si M1 no existe, la importación anterior no se completó — relanzar import completo.
  useEffect(() => {
    if (!isLoaded || !projectId || pestProjectId || !pestAnalysisId) return;

    if (mapaPESTEL) {
      fetch(`/api/centinela/pestel/analysis-meta?analysis_id=${pestAnalysisId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: { pestelProjectId?: string } | null) => {
          if (data?.pestelProjectId) setPestProjectId(data.pestelProjectId);
        })
        .catch((err) => console.error("[C7b] analysis-meta falló para pestAnalysisId:", pestAnalysisId, err));
    } else {
      fetch("/api/moddulo/f2/import-pestel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, pestAnalysisId }),
      })
        .then(async (r) => {
          if (!r.ok) return;
          const data = await r.json();
          const linkedSource = data.linkedSource as { sourceId?: string; payload?: MapaPESTEL } | undefined;
          if (linkedSource?.sourceId) setPestProjectId(linkedSource.sourceId);
          if (linkedSource?.payload) setMapaPESTEL(linkedSource.payload);
        })
        .catch((err) => console.error("[C7b] import-pestel falló para pestAnalysisId:", pestAnalysisId, err));
    }
  }, [isLoaded, projectId, pestAnalysisId, pestProjectId, mapaPESTEL]);

  // Cargar datos Sefix (solo México)
  useEffect(() => {
    if (!isLoaded || !["electoral", "gubernamental", "legislativo"].includes(projectType)) return;
    if (!esMexico) return;
    const estadoSefix = projectTerritory?.estado ?? (xpcto ? detectEstadoFromXpcto(xpcto) : null);
    if (!estadoSefix) return;

    const fetchSefix = async () => {
      try {
        const tipo = projectType ?? "electoral";
        const nivel = projectTerritory?.nivel ?? "estatal";
        const primaryKey = getPrimaryKey(tipo, nivel);
        const primaryScope: SefixScope = primaryKey === "presidencia" ? "nacional" : "entidad";
        const contrasteEntries = CONTRASTE_BY_PRIMARY[primaryKey];

        const padronParams = new URLSearchParams({ estado: estadoSefix });
        if (projectTerritory) {
          const niv = projectTerritory.nivel;
          if (niv === "distrito_federal" || niv === "distrito") {
            const cve = parseCveDistritoFed(projectTerritory);
            if (cve) padronParams.set("cveDistrito", cve);
          } else if (niv === "distrito_local") {
            if (projectTerritory.cve_distrito) {
              padronParams.set("cabeceraLocal", projectTerritory.cve_distrito);
            }
          } else if (niv === "municipal" && projectTerritory.municipio) {
            padronParams.set("municipioNombre", projectTerritory.municipio.toUpperCase());
          }
        }

        const [padR, primaryResult, ...contrasteResults] = await Promise.allSettled([
          fetch("/api/sefix/padron?" + padronParams, { credentials: "include" })
            .then(r => r.ok ? r.json() : null),
          fetchSefixEleccion(estadoSefix, primaryKey, true, primaryScope, projectTerritory),
          ...contrasteEntries.map(({ key, scope }) =>
            fetchSefixEleccion(estadoSefix, key, false, scope, projectTerritory)
          ),
        ]);

        const padJson = padR.status === "fulfilled" ? padR.value : null;
        const primary = primaryResult.status === "fulfilled"
          ? primaryResult.value
          : { key: primaryKey, label: ELEC_LABELS[primaryKey], resultados: null, granularity: "" };
        const contraste = contrasteResults.map((r, i) =>
          r.status === "fulfilled"
            ? r.value
            : { key: contrasteEntries[i].key, label: ELEC_LABELS[contrasteEntries[i].key], resultados: null, granularity: "" }
        );

        setSefixData({
          estado: estadoSefix,
          padronLabel: buildPadronLabel(projectTerritory ?? null, estadoSefix),
          nivel: projectTerritory?.nivel ?? "estatal",
          padron: padJson?.padron ?? null,
          primary,
          contraste,
        });
      } catch { /* no-op */ }
    };
    fetchSefix();
  }, [isLoaded, xpcto, projectType, projectTerritory, esMexico]);

  // Cargar contexto electoral web (proyectos no-México)
  useEffect(() => {
    if (esMexico) return;
    if (!isLoaded || !["electoral", "gubernamental", "legislativo"].includes(projectType)) return;
    if (!projectTerritory) return;
    setWebElectoralLoading(true);
    fetch("/api/moddulo/f2/web-context", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "electoral", territorio: projectTerritory }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<WebContextResult>) : null))
      .then((data) => setWebElectoralData(data))
      .catch(() => setWebElectoralData(null))
      .finally(() => setWebElectoralLoading(false));
  }, [isLoaded, esMexico, projectType, projectTerritory]);

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

  // Contador de segundos para el estado de carga express
  useEffect(() => {
    if (!isExpressAnalyzing || !expressStartTime) {
      setElapsedSeconds(0);
      return;
    }
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - expressStartTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isExpressAnalyzing, expressStartTime]);

  // Auto-generate draftDVS cuando mapaPESTEL cambia de CONTENIDO (no de
  // referencia) durante la sesión — cubre primer análisis, re-sync tras
  // regenerar en Centinela, restauración de vínculo, o upgrade
  // express→Centinela. No exige draftDVS === null: si ya había un draft
  // previo (de un M1 anterior), se deja intacto mientras se regenera —
  // generarDraftDVS solo lo sobreescribe si la llamada tiene éxito, así que
  // un fallo no deja al usuario sin nada que ver.
  //
  // La comparación es por contenido serializado (lastGeneratedMapaRef), no
  // por igualdad de referencia: un re-import idempotente (mismo análisis, ya
  // sincronizado) deserializa un objeto NUEVO con el mismo contenido, y
  // comparar por referencia disparaba una regeneración real de sobra en cada
  // visita — ver bug reportado 2026-07-17.
  useEffect(() => {
    if (mapaPESTEL === null || !isLoaded) return;
    const serialized = JSON.stringify(mapaPESTEL);
    if (serialized === lastGeneratedMapaRef.current) return;
    generarDraftDVS();
  // generarDraftDVS es estable (useCallback con dep projectId que no cambia en runtime)
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
                resultados: sefixData.primary.resultados
                  ? {
                      anio: sefixData.primary.resultados.anio,
                      cargo: sefixData.primary.resultados.cargo,
                      totalVotos: sefixData.primary.resultados.totalVotos,
                      lne: sefixData.primary.resultados.lne,
                      participacion: sefixData.primary.resultados.participacion,
                      top4: sefixData.primary.resultados.partidos.slice(0, 4),
                      fuente: sefixData.primary.resultados.fuente,
                    }
                  : null,
                padron: sefixData.padron
                  ? {
                      corte: sefixData.padron.corte,
                      listaNominal: sefixData.padron.listaNominal,
                      listaNominalHombres: sefixData.padron.listaNominalHombres,
                      listaNominalMujeres: sefixData.padron.listaNominalMujeres,
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

  // Stable ref to handleGenerarDVS — allows handleDataExtracted to call it without ordering issues
  const handleGenerarDVSRef = useRef<() => void>(() => {});

  // Extracción de datos del chat → formulario
  const handleDataExtracted = useCallback((data: Record<string, unknown>) => {
    // When Claude confirms express path, trigger the express analysis automatically
    if (data["__action"] === "start_express") {
      handleGenerarDVSRef.current();
      return;
    }
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

  // Ref para prevenir doble llamada concurrente (evita stale closure en useCallback)
  const generatingRef = useRef(false);

  // Genera draftDVS a partir del mapaPESTEL actual (PESTEL app path o express path)
  const generarDraftDVS = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
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
      if (data.dvs) {
        setDraftDVS(data.dvs as DVSF2);
        // Marca el mapaPESTEL vigente como el que generó este draft — el
        // auto-generate effect no vuelve a disparar hasta que cambie de verdad.
        lastGeneratedMapaRef.current = JSON.stringify(mapaPESTELRef.current);
      }
    } catch {
      setMotorGenerationError("Error de red. Verifica tu conexión e intenta de nuevo.");
    } finally {
      generatingRef.current = false;
      setIsGeneratingMotors(false);
    }
  }, [projectId]);

  // Express path: generate mapaPESTEL with Claude.
  // On success, setMapaPESTEL triggers the auto-generate useEffect → generarDraftDVS.
  // Identical handoff pattern as the Centinela import-pestel path.
  const handleGenerarDVS = useCallback(async () => {
    setIsExpressAnalyzing(true);
    setExpressStartTime(new Date());
    setExpressError(null);
    try {
      const mR = await fetch("/api/moddulo/f2/generate-m1-express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (!mR.ok) {
        setExpressError("El análisis express no pudo completarse. Intenta de nuevo.");
        return;
      }
      const mData = await mR.json();
      if (mData.mapaPESTEL) {
        setMapaPESTEL(mData.mapaPESTEL as MapaPESTEL);
      } else {
        setExpressError("El análisis no devolvió datos válidos. Intenta de nuevo.");
      }
    } catch {
      setExpressError("Error de red. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setIsExpressAnalyzing(false);
      setExpressStartTime(null);
    }
  }, [projectId]);

  // Keep the ref in sync so handleDataExtracted can call it without stale closure
  useEffect(() => { handleGenerarDVSRef.current = handleGenerarDVS; }, [handleGenerarDVS]);

  const [isUnlinkingPestel, setIsUnlinkingPestel] = useState(false);
  const [showConfirmUnlink, setShowConfirmUnlink] = useState(false);
  const [isRelinkingPestel, setIsRelinkingPestel] = useState(false);
  const [showLinkExistingPicker, setShowLinkExistingPicker] = useState(false);

  // Desvincula el proyecto de su análisis de Centinela PESTEL: limpia
  // pestAnalysisId/pestProjectId/mapaPESTEL en el servidor (que además
  // conserva el pestAnalysisId anterior para poder deshacer) y resetea el
  // estado local para que el usuario pueda regenerar vía express de inmediato.
  const handleUnlinkPestel = useCallback(async () => {
    setShowConfirmUnlink(false);
    setIsUnlinkingPestel(true);
    try {
      const r = await fetch("/api/moddulo/f2/unlink-pestel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (r.ok) {
        setLastUnlinkedPestAnalysisId(pestAnalysisId);
        setPestlVia(null);
        setPestProjectId(null);
        setPestAnalysisId(null);
        setMapaPESTEL(null);
        setXpctoStaleChanges([]);
        setMotorAprobaciones({});
        // draftDVS NO se limpia: si el usuario restaura el vínculo o
        // regenera vía express, sigue teniendo su último estado válido
        // visible mientras la regeneración corre.
      }
    } finally {
      setIsUnlinkingPestel(false);
    }
  }, [projectId, pestAnalysisId]);

  // Deshace una desvinculación: re-vincula con el MISMO análisis de
  // Centinela del que se desvinculó (no uno nuevo). Si el usuario generó un
  // análisis express nuevo mientras tanto, mapaPESTEL viene de esa otra
  // fuente — import-pestel responde 409 y se pide confirmación explícita en
  // vez de bloquear o sobrescribir en silencio.
  const handleRelinkPestel = useCallback(async () => {
    if (!lastUnlinkedPestAnalysisId) return;
    setIsRelinkingPestel(true);
    try {
      const result = await importPestel(lastUnlinkedPestAnalysisId);
      if (!result.ok && result.conflict) {
        setPendingReplaceConfirm({ pestAnalysisId: lastUnlinkedPestAnalysisId, source: "relink" });
      }
    } finally {
      setIsRelinkingPestel(false);
    }
  }, [lastUnlinkedPestAnalysisId, importPestel]);

  // Confirma el reemplazo tras un 409 de import-pestel (mapaPESTEL de otra
  // fuente) — reintenta con confirmReplace: true.
  const handleConfirmReplace = useCallback(async () => {
    if (!pendingReplaceConfirm) return;
    setIsConfirmingReplace(true);
    try {
      await importPestel(pendingReplaceConfirm.pestAnalysisId, true);
    } finally {
      setIsConfirmingReplace(false);
      setPendingReplaceConfirm(null);
    }
  }, [pendingReplaceConfirm, importPestel]);

  const [isRegeneratingReport, setIsRegeneratingReport] = useState(false);
  const [reportRegenError, setReportRegenError] = useState<string | null>(null);

  const handleRegenerarReporteF2 = useCallback(async () => {
    setIsRegeneratingReport(true);
    setReportRegenError(null);
    try {
      const r = await fetch("/api/moddulo/f2/generate-dvs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, saveas: "final" }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.dvs) setDvs(data.dvs as DVSF2);
      } else {
        const err = await r.json().catch(() => ({}));
        const motor = (err as { motor?: string }).motor;
        setReportRegenError(
          motor
            ? `Error en ${motor}. Intenta de nuevo.`
            : "No se pudo regenerar el reporte. Intenta de nuevo."
        );
      }
    } catch {
      setReportRegenError("Error de red. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setIsRegeneratingReport(false);
    }
  }, [projectId]);

  // Abre el modal de cierre evaluando los 10 criterios DVS
  const handleOpenReview = () => {
    if (dvs) setDvsChecklist(evaluarCriteriosDVS(dvs, mapaPESTEL ?? undefined, projectType));
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
        if (mode !== "completed") setMode("completed");
        // showReporte queda en false — el usuario ve el panel "Análisis completo"
        // y decide cuándo abrir el Reporte F2
      }
    } catch {/* silencioso */}
  };

  const handleSaveMotorEdit = (_motor: "M2" | "M3" | "M4" | "M5") => {
    if (!draftDVS) return;
    fetch("/api/moddulo/f2/save-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, draftDVS }),
    }).catch(() => {});
  };

  const handleStartEdit = () => {
    if (dvs) {
      // Modo edición de motores: copia dvs actual a draftDVS con todos pre-aprobados
      setDraftDVS(structuredClone(dvs));
      setMotorAprobaciones({ M2: true, M3: true, M4: true, M5: true });
    } else {
      setEditForm(structuredClone(form));
    }
    setMode("editing");
  };

  const handleCancelEdit = () => {
    if (dvs) {
      // Restaurar draftDVS y aprobaciones al estado previo a la edición
      setDraftDVS(null);
      setMotorAprobaciones({});
      setShowReporte(true);
    }
    setMode(dvs ? "completed" : "active");
  };

  const handleSaveEdit = async () => {
    // ── Modo edición de motores (dvs ya existe) ──────────────────────────────
    if (dvs !== null) {
      if (!draftDVS) return;
      setIsSaving(true);
      setSaveError(null);
      try {
        const r = await fetch("/api/moddulo/f2/finalize-dvs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ projectId, draftDVS }),
        });
        if (r.ok) {
          const data = await r.json();
          if (data.dvs) {
            setDvs(data.dvs as DVSF2);
            setDraftDVS(null);
            setMotorAprobaciones({});
            setMode("completed");
            setShowReporte(true);
            setLastSaved(new Date());
          } else {
            setSaveError("No se pudo guardar — respuesta inesperada del servidor. Sigues en modo edición, tus cambios no se han perdido: intenta guardar de nuevo.");
          }
        } else {
          setSaveError("No se pudo guardar los cambios. Sigues en modo edición, tus cambios no se han perdido: intenta guardar de nuevo.");
        }
      } catch {
        setSaveError("Error de conexión al guardar. Sigues en modo edición, tus cambios no se han perdido: intenta guardar de nuevo.");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ── Modo edición de formulario (dvs aún no existe) ───────────────────────
    setIsSaving(true);
    setSaveError(null);
    try {
      const rForm = await fetch(`/api/moddulo/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phaseData: { phaseId: "exploracion", data: editForm } }),
      });
      if (!rForm.ok) {
        setSaveError("No se pudo guardar los cambios. Intenta de nuevo.");
        setIsSaving(false);
        return;
      }
      setForm(structuredClone(editForm));
      setLastSaved(new Date());

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
    } catch {
      setSaveError("Error de conexión al guardar. Intenta de nuevo.");
    } finally {
      setIsSaving(false);
      setGenerandoDVS(false);
    }
  };

  const activeForm = mode === "editing" ? editForm : form;
  const setActiveForm = mode === "editing" ? setEditForm : (mode === "active" ? setForm : () => {});

  // ==========================================
  // RENDER
  // ==========================================

  // Moddulo project was hard-deleted — show recovery UI
  if (projectNotFound) {
    const pestAnalysisIdFromUrl =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("pest_analysis_id")
        : null;
    return (
      <OrphanRecoveryView
        pestAnalysisId={pestAnalysisIdFromUrl}
        deadProjectId={projectId}
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ===== HEADER ===== */}
      <div className="shrink-0 px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        {/* Fila 1: título + badge + descarga */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske dark:text-blue-eske-20 shrink-0">F2</span>
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
              ) : saveError ? (
                <span className="text-red-eske font-medium">⚠ {saveError}</span>
              ) : lastSaved ? (
                <span className="text-gray-eske-40 dark:text-[#6D8294]">✓ {lastSaved.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
              ) : null}
            </span>
            <PhaseDownloadMenu
              phaseId="exploracion"
              projectName={projectName}
              content={{
                reporte: (dvs ?? draftDVS) ? formatF2Report(dvs ?? draftDVS!) : null,
                pestel: mapaPESTEL ? formatPestelAnalysis(mapaPESTEL) : null,
              }}
            />
          </div>
        </div>

        {/* Fila 2: 3 chips — idéntico a F1 */}
        {(() => {
          const btnBase = "px-2.5 py-1.5 border border-bluegreen-eske-60 dark:border-blue-eske-20 text-bluegreen-eske-60 dark:text-blue-eske-20 bg-transparent rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:bg-bluegreen-eske/5 dark:hover:bg-blue-eske-20/10";
          const btnClose = "px-2.5 py-1.5 bg-bluegreen-eske-60 text-white-eske rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

          return (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1.5">
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

            </div>
          );
        })()}
      </div>

      {/* Banner F1 incompleto — visible cuando PESTEL está importado pero F1 aún no está completado */}
      {mapaPESTEL && phaseStatusF1 !== "completed" && (
        <div
          role="alert"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-yellow-eske/10 border-l-4 border-yellow-eske text-sm"
        >
          <svg className="w-4 h-4 shrink-0 text-yellow-eske-70 dark:text-yellow-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-black-eske dark:text-[#EAF2F8]">
            <strong>Propósito (F1) incompleto.</strong> El análisis PESTEL está importado. Completa las variables XPCTO en F1 para desbloquear los Motores DVS.
          </span>
          <Link
            href={`/moddulo/proyecto/${projectId}/proposito`}
            className="ml-auto text-bluegreen-eske dark:text-blue-eske-20 underline text-xs shrink-0 hover:text-bluegreen-eske-60"
          >
            Ir a Propósito →
          </Link>
        </div>
      )}

      {/* ===== TABS MOBILE (solo cuando no está en landing) ===== */}
      {!showLanding && (
        <div className="lg:hidden shrink-0 flex border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
          {[
            { id: "chat" as const, label: mode === "editing" && dvs !== null ? "Editando motores" : showReporte && dvs !== null ? "Reporte F2" : mapaPESTEL !== null && mode !== "editing" ? "Motores" : "Chat" },
            { id: "form" as const, label: "Análisis PESTEL" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setMobileTab(id)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors border-b-2 ${
                mobileTab === id ? "border-bluegreen-eske text-bluegreen-eske dark:border-blue-eske-20 dark:text-blue-eske-20" : "border-transparent text-gray-eske-50 dark:text-[#9AAEBE]"
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
              <div className="shrink-0 mb-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowReporte(false)}
                    className="flex items-center gap-1.5 text-sm font-medium text-bluegreen-eske dark:text-blue-eske-20 hover:text-bluegreen-eske/80 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver al chat
                  </button>
                  <div className="flex items-center gap-2">
                    {isRegeneratingReport ? (
                      <span className="text-xs text-gray-eske-50 dark:text-[#6D8294]">Regenerando...</span>
                    ) : (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Reporte generado</span>
                    )}
                    <button
                      onClick={handleRegenerarReporteF2}
                      disabled={isRegeneratingReport}
                      className="p-1 rounded text-bluegreen-eske dark:text-blue-eske-20 hover:bg-bluegreen-eske/10 disabled:opacity-40 transition-colors"
                      aria-label="Regenerar reporte F2"
                      title="Regenerar reporte F2"
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${isRegeneratingReport ? "animate-spin" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
                {reportRegenError && (
                  <p className="text-xs text-red-eske text-right">{reportRegenError}</p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                <DVSView dvs={dvs} />
              </div>
            </div>

          /* Modo edición de motores — dvs existe y se está editando */
          ) : mode === "editing" && dvs !== null ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 mb-2 px-1">
                <p className="text-xs text-bluegreen-eske/60 dark:text-blue-eske-20/70">
                  Edita los motores y guarda los cambios para actualizar el reporte.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                <MotoresSequentialView
                  projectId={projectId}
                  draftDVS={draftDVS}
                  motorAprobaciones={motorAprobaciones}
                  isGenerating={false}
                  editMode={true}
                  onApprove={handleApproveMotor}
                  onDraftChange={setDraftDVS}
                  onSaveEdit={handleSaveMotorEdit}
                />
              </div>
            </div>

          /* Estado de carga — express path: Claude analizando entorno */
          ) : isExpressAnalyzing ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-8 flex flex-col items-center gap-4 w-full max-w-md">
                <div className="w-10 h-10 border-4 border-bluegreen-eske border-t-transparent rounded-full animate-spin" aria-hidden />
                <div className="text-center">
                  <p className="font-semibold text-black-eske dark:text-[#EAF2F8]">Analizando con IA…</p>
                  <p className="text-sm text-black-eske dark:text-[#C7D6E0] mt-1">
                    Moddulo está procesando las 6 dimensiones PESTEL.
                  </p>
                  <p className="text-sm text-black-eske dark:text-[#C7D6E0]">
                    El proceso tarda varios minutos. Por favor, espera.
                  </p>
                  {elapsedSeconds > 0 && (
                    <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mt-2">
                      Tiempo transcurrido:{" "}
                      {Math.floor(elapsedSeconds / 60) > 0 ? `${Math.floor(elapsedSeconds / 60)} min ` : ""}
                      {elapsedSeconds % 60} seg
                    </p>
                  )}
                </div>
                <div className="w-full max-w-xs h-1.5 bg-gray-eske-20 dark:bg-[#21425E] rounded-full overflow-hidden">
                  <div className="h-1.5 bg-bluegreen-eske rounded-full animate-pulse w-2/3" />
                </div>
              </div>
            </div>

          /* Estado B — mapaPESTEL disponible (con o sin DVS previo) */
          ) : mapaPESTEL !== null && mode !== "editing" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-black-eske dark:text-white">
                    Análisis por motores
                  </p>
                  <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE]">
                    Revisa y aprueba cada sección antes de generar el Reporte F2.
                  </p>
                </div>
                {pestlVia === "pestel" && pestProjectId && (
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/centinela/pestel/${pestProjectId}/analisis`)}
                      className="px-3 py-1.5 border border-bluegreen-eske-60 text-bluegreen-eske-60 dark:border-blue-eske-20 dark:text-blue-eske-20 rounded-lg text-xs font-semibold hover:bg-bluegreen-eske/5 transition-colors"
                    >
                      Regresar a PESTEL →
                    </button>
                    <span className="flex items-center gap-0.5">
                      <button
                        onClick={() => setShowConfirmUnlink(true)}
                        disabled={isUnlinkingPestel}
                        className="px-3 py-1.5 text-black-eske/50 dark:text-[#9AAEBE] text-xs font-medium hover:underline disabled:opacity-50"
                      >
                        {isUnlinkingPestel ? "Desvinculando…" : "Desvincular"}
                      </button>
                      <InfoTooltip
                        content="Rompe el vínculo de este proyecto con el análisis de Centinela PESTEL. El escaneo PESTEL actual (M1) y las secciones M2-M5 ya aprobadas se borran. Podrás regenerar vía el flujo express de Moddulo, o restaurar este mismo vínculo después."
                        placement="left"
                      />
                    </span>
                  </div>
                )}
              </div>
              {xpctoStaleChanges.length > 0 && (() => {
                const regenType = getRegenerationType(xpctoStaleChanges);
                // El M1 vía Centinela no se puede regenerar in-app: pertenece a un
                // análisis independiente. Redirigir a Centinela en vez de llamar a
                // generate-m1-express, que sobrescribiría el mapaPESTEL vinculado.
                const viaCentinela = regenType === "full" && pestlVia === "pestel" && !!pestProjectId;
                return (
                  <div className="shrink-0 bg-yellow-eske-10 dark:bg-yellow-eske-80/10 border border-yellow-eske-30 dark:border-yellow-eske-60/40 rounded-lg p-3 mb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8] mb-1">
                          {regenType === "full"
                            ? "Cambios en el sujeto o capacidades requieren regenerar el análisis completo."
                            : "El XPCTO fue modificado en F1. El contraste con el entorno está desactualizado."}
                        </p>
                        <ul className="text-xs text-black-eske dark:text-[#C7D6E0] space-y-0.5">
                          {xpctoStaleChanges.slice(0, 3).map((d) => (
                            <li key={d.field}>
                              <span className="font-medium">{d.field}:</span>{" "}
                              <span className="line-through opacity-60">{d.from.slice(0, 40)}</span>
                              {" → "}
                              {d.to.slice(0, 40)}
                            </li>
                          ))}
                          {xpctoStaleChanges.length > 3 && (
                            <li className="opacity-60">+{xpctoStaleChanges.length - 3} campos más</li>
                          )}
                        </ul>
                        <p className="text-xs text-black-eske/50 dark:text-[#9AAEBE] mt-1.5">
                          {viaCentinela
                            ? "Este M1 proviene de Centinela PESTEL. Actualiza el análisis ahí y vuelve a importarlo."
                            : regenType === "full"
                            ? "Se regenerará el escaneo PESTEL completo (M1) y el contraste XPCTO-Entorno."
                            : "El escaneo de fuentes no se repite — solo se actualiza el contraste XPCTO-Entorno."}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (viaCentinela) {
                            // Etapa 2 (Datos), donde vive "Ejecutar Análisis IA".
                            // Centinela avanza solo a Etapa 3 al terminar.
                            router.push(`/centinela/pestel/${pestProjectId}/datos`);
                            return;
                          }
                          setXpctoStaleChanges([]);
                          setMotorAprobaciones({});
                          // draftDVS NO se limpia aquí — se conserva mientras
                          // corre la regeneración; solo se sobreescribe si
                          // generarDraftDVS/generate-m1-express tienen éxito.
                          if (regenType === "full") {
                            setRegenKind("full");
                            setMapaPESTEL(null);
                            handleGenerarDVSRef.current();
                          } else {
                            setRegenKind("partial");
                            generarDraftDVS();
                          }
                        }}
                        className="shrink-0 text-sm font-medium text-orange-eske hover:underline whitespace-nowrap"
                      >
                        {viaCentinela
                          ? "Ir a Centinela PESTEL →"
                          : regenType === "full" ? "Regenerar análisis completo ↺" : "Actualizar contraste XPCTO ↺"}
                      </button>
                    </div>
                  </div>
                );
              })()}
              <div className="flex-1 overflow-y-auto">
                {mode === "completed" && dvs !== null && !showReporte ? (
                  <div className="rounded-xl p-6 border border-bluegreen-eske/30 bg-bluegreen-eske/5 dark:bg-bluegreen-eske/10">
                    <p className="text-xs font-bold uppercase tracking-wider text-bluegreen-eske-70 dark:text-blue-eske-20 mb-2">
                      Análisis de exploración completo
                    </p>
                    <p className="text-sm text-black-eske-80 dark:text-[#C5D8E8] leading-relaxed mb-5">
                      El Documento de Viabilidad Situacional está listo. Genera el Reporte F2
                      para revisar el análisis completo, edítalo si lo necesitas y, cuando estés
                      conforme, cierra la fase para avanzar a{" "}
                      <strong className="text-black-eske dark:text-[#EAF2F8]">F3 — Investigación</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowReporte(true)}
                      className="px-5 py-2 bg-bluegreen-eske text-white rounded-full text-sm font-semibold hover:bg-bluegreen-eske/90 transition-colors"
                    >
                      Generar Reporte F2
                    </button>
                  </div>
                ) : (
                  <MotoresSequentialView
                    projectId={projectId}
                    draftDVS={draftDVS}
                    motorAprobaciones={motorAprobaciones}
                    isGenerating={isGeneratingMotors}
                    generationError={motorGenerationError}
                    onRetry={generarDraftDVS}
                    retryLabel={regenKind === "partial" ? "Reintentar actualización" : "Reintentar análisis"}
                    onApprove={handleApproveMotor}
                    onDraftChange={setDraftDVS}
                    onSaveEdit={handleSaveMotorEdit}
                  />
                )}
              </div>
            </div>

          /* Error express — análisis falló, mostrar panel con Reintentar */
          ) : expressError !== null ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-red-eske/20 dark:border-red-800/30 p-8 flex flex-col items-center gap-4 w-full max-w-md">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-black-eske dark:text-[#EAF2F8]">Análisis no completado</p>
                  <p className="text-sm text-gray-eske-50 dark:text-[#9AAEBE] mt-1">{expressError}</p>
                </div>
                <button
                  onClick={() => { setExpressError(null); handleGenerarDVS(); }}
                  className="px-4 py-2 bg-bluegreen-eske text-white-eske rounded-lg text-sm font-medium hover:bg-bluegreen-eske/90 transition-colors"
                >
                  Reintentar análisis express
                </button>
                <button
                  onClick={() => setExpressError(null)}
                  className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] transition-colors"
                >
                  Volver al chat
                </button>
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
                renderAfterWelcome={null}
              />
              {/* Botón PESTEL — posición inferior */}
              {(dvs === null || pestlVia === "pestel") && mode !== "editing" && (
                <div className="shrink-0 flex justify-end">
                  <button
                    onClick={pestlVia === "pestel" && pestProjectId
                      ? () => {
                          const dest = pestCurrentStage !== null && pestCurrentStage >= 5
                            ? `/centinela/pestel/${pestProjectId}/analisis`
                            : `/centinela/pestel/${pestProjectId}/datos`;
                          router.push(dest);
                        }
                      : handleAbrirPESTEL}
                    disabled={!!(pestlVia === "pestel" && pestProjectId && pestStageLoading)}
                    className="px-3 py-2 border border-bluegreen-eske-60 text-bluegreen-eske-60 dark:border-blue-eske-20 dark:text-blue-eske-20 rounded-lg text-xs font-semibold hover:bg-bluegreen-eske/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pestlVia === "pestel" && pestProjectId
                      ? pestStageLoading ? <span className="text-red-eske">Cargando…</span> : "Regresar a PESTEL →"
                      : "Abrir PESTEL"}
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
            isAnalyzing={isExpressAnalyzing}
            pestProjectId={pestProjectId}
            onNuevoAnalisis={pestProjectId === null ? () => setShowConfirmReanalisis(true) : undefined}
            lastUnlinkedPestAnalysisId={lastUnlinkedPestAnalysisId}
            onRelinkPestel={handleRelinkPestel}
            isRelinkingPestel={isRelinkingPestel}
            onLinkExisting={() => setShowLinkExistingPicker(true)}
            onAnalizarConPESTEL={handleAbrirPESTEL}
            esMexico={esMexico}
            webElectoralData={webElectoralData}
            webElectoralLoading={webElectoralLoading}
          />
        </div>
        </>)}
      </div>

      {/* Modal confirmación nuevo análisis */}
      {showConfirmReanalisis && (
        <ConfirmReanalisisModal
          onCancel={() => setShowConfirmReanalisis(false)}
          onConfirm={() => {
            setShowConfirmReanalisis(false);
            setRegenKind("full");
            setMapaPESTEL(null);
            setExpressError(null);
            setMotorAprobaciones({});
            // draftDVS NO se limpia — se conserva mientras corre la
            // regeneración; solo se sobreescribe si express tiene éxito.
            handleGenerarDVSRef.current();
          }}
        />
      )}

      {/* Modal confirmación desvincular de Centinela PESTEL */}
      {showConfirmUnlink && (
        <ConfirmUnlinkPestelModal
          onCancel={() => setShowConfirmUnlink(false)}
          onConfirm={handleUnlinkPestel}
        />
      )}

      {/* Modal confirmación reemplazo — mapaPESTEL existente viene de otra fuente */}
      {pendingReplaceConfirm && (
        <ConfirmReplacePestelModal
          source={pendingReplaceConfirm.source}
          isConfirming={isConfirmingReplace}
          onCancel={() => setPendingReplaceConfirm(null)}
          onConfirm={handleConfirmReplace}
        />
      )}

      {/* Picker: vincular a un análisis PESTEL existente (upgrade express→Centinela) */}
      {showLinkExistingPicker && (
        <LinkExistingPestelModal
          projectId={projectId}
          projectType={projectType}
          projectTerritory={projectTerritory}
          onClose={() => setShowLinkExistingPicker(false)}
        />
      )}

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

function SkeletonDimension() {
  return (
    <div className="space-y-3 animate-pulse py-1">
      <div className="h-4 w-20 bg-gray-eske-20 dark:bg-white/10 rounded" />
      <div className="h-3 w-full bg-gray-eske-10 dark:bg-white/5 rounded" />
      <div className="h-3 w-4/5 bg-gray-eske-10 dark:bg-white/5 rounded" />
      <div className="h-3 w-3/5 bg-gray-eske-10 dark:bg-white/5 rounded" />
      <div className="mt-3 h-8 w-full bg-gray-eske-10 dark:bg-white/5 rounded-lg" />
      <div className="h-8 w-full bg-gray-eske-10 dark:bg-white/5 rounded-lg" />
    </div>
  );
}

function ExplorationFormPanel({
  form, onChange, activeSection, onSectionChange, readOnly, projectType, sefixData, mapaPESTEL,
  isAnalyzing = false, onNuevoAnalisis, pestProjectId,
  lastUnlinkedPestAnalysisId, onRelinkPestel, isRelinkingPestel, onLinkExisting, onAnalizarConPESTEL,
  esMexico, webElectoralData, webElectoralLoading,
}: {
  form: ExplorationForm;
  onChange: (f: ExplorationForm) => void;
  activeSection: PestlSection;
  onSectionChange: (s: PestlSection) => void;
  readOnly: boolean;
  projectType: ProjectType;
  sefixData: SefixData | null;
  mapaPESTEL: MapaPESTEL | null;
  isAnalyzing?: boolean;
  onNuevoAnalisis?: () => void;
  pestProjectId?: string | null;
  lastUnlinkedPestAnalysisId?: string | null;
  onRelinkPestel?: () => void;
  isRelinkingPestel?: boolean;
  onLinkExisting?: () => void;
  onAnalizarConPESTEL?: () => void;
  esMexico: boolean;
  webElectoralData: WebContextResult | null;
  webElectoralLoading: boolean;
}) {
  const fieldClass =
    "w-full px-3 py-2 text-sm font-normal rounded-lg border border-gray-eske-20 dark:border-white/10 " +
    "focus:outline-none focus:ring-2 focus:ring-bluegreen-eske/30 focus:border-bluegreen-eske " +
    "text-black-eske dark:text-[#EAF2F8] bg-white-eske dark:bg-[#112230] " +
    "disabled:bg-gray-eske-10 dark:disabled:bg-[#21425E] disabled:text-black-eske-10 dark:disabled:text-[#9AAEBE] " +
    "placeholder:text-gray-eske-40 dark:placeholder:text-[#6D8294] resize-none";

  // Menú kebab — consolida "Analizar con PESTEL" / "Nuevo análisis" /
  // "Vincular con análisis independiente" (mismo patrón que app/moddulo/page.tsx).
  const [kebabOpen, setKebabOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!kebabOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [kebabOpen]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A] flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-black-eske-80 dark:text-[#9AAEBE]">Análisis PESTEL</h2>
        {readOnly ? (
          <span className="text-xs text-gray-eske-40 dark:text-[#6D8294]">Solo lectura</span>
        ) : pestProjectId ? (
          <Link
            href={`/centinela/pestel/${pestProjectId}/analisis`}
            className="text-xs text-bluegreen-eske dark:text-blue-eske-20 hover:underline font-medium"
          >
            Ver en Centinela →
          </Link>
        ) : lastUnlinkedPestAnalysisId && onRelinkPestel ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRelinkPestel}
              disabled={isRelinkingPestel}
              className="text-xs text-bluegreen-eske dark:text-blue-eske-20 hover:underline font-medium disabled:opacity-50"
            >
              {isRelinkingPestel ? "Vinculando…" : "Vincular de nuevo ↺"}
            </button>
            {onNuevoAnalisis && (
              <button
                type="button"
                onClick={onNuevoAnalisis}
                className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] hover:underline"
              >
                Nuevo análisis
              </button>
            )}
          </div>
        ) : onNuevoAnalisis ? (
          <div className="relative shrink-0" ref={kebabRef}>
            <button
              type="button"
              aria-label="Opciones de análisis PESTEL"
              onClick={() => setKebabOpen((o) => !o)}
              className="flex items-center justify-center w-7 h-7 rounded-md text-gray-eske-40
                hover:text-gray-eske-70 hover:bg-gray-eske-10 dark:hover:bg-white/10 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>
            {kebabOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-56 max-w-[calc(100vw-1.5rem)] bg-white-eske dark:bg-[#1E3A52]
                  rounded-lg shadow-lg border border-gray-eske-20 dark:border-white/10 py-1 z-20"
              >
                {onAnalizarConPESTEL && (
                  <button
                    type="button"
                    onClick={() => { setKebabOpen(false); onAnalizarConPESTEL(); }}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-bluegreen-eske dark:text-blue-eske-20 hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
                  >
                    Analizar con PESTEL
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setKebabOpen(false); onNuevoAnalisis(); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-eske-70 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
                >
                  Nuevo análisis ↺
                </button>
                {onLinkExisting && (
                  <button
                    type="button"
                    onClick={() => { setKebabOpen(false); onLinkExisting(); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-eske-70 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors"
                  >
                    Vincular con análisis independiente
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-eske-40 dark:text-[#6D8294]">Auto-rellena via chat</span>
        )}
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
                  ? "border-bluegreen-eske text-bluegreen-eske dark:border-blue-eske-20 dark:text-blue-eske-20"
                  : "border-transparent text-gray-eske-50 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8]"
              }`}>
              <span className="hidden sm:inline">{sec.label}</span>
              <span className="sm:hidden">{sec.short}</span>
              {isAnalyzing
                ? <span className="w-1.5 h-1.5 rounded-full bg-gray-eske-30 dark:bg-white/20 animate-pulse shrink-0" />
                : hasSignals
                  ? <span className="w-1.5 h-1.5 rounded-full bg-orange-eske shrink-0" title="Señales PESTEL importadas" />
                  : filled && <span className="w-1.5 h-1.5 rounded-full bg-bluegreen-eske shrink-0" />
              }
            </button>
          );
        })}
      </div>

      {/* Contenido de la sección */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeSection === "politico" && (
          isAnalyzing ? <SkeletonDimension /> :
          mapaPESTEL?.["P"] ? (
            <div className="space-y-4">
              <TripartiteSignalsPanel dim={mapaPESTEL["P"]} />
              {(projectType === "electoral" || projectType === "gubernamental") && (
                <div className="border-t border-gray-eske-20 dark:border-white/10 pt-3">
                  <p className="text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE] uppercase tracking-wider mb-2">
                    Contexto Electoral
                  </p>
                  {esMexico
                    ? sefixData && <SefixWidget data={sefixData} projectType={projectType} />
                    : <WebElectoralWidget data={webElectoralData} loading={webElectoralLoading} />
                  }
                </div>
              )}
            </div>
          ) : (
            <PoliticoSection form={form} onChange={onChange} readOnly={readOnly} fieldClass={fieldClass} projectType={projectType} sefixData={sefixData} esMexico={esMexico} webElectoralData={webElectoralData} webElectoralLoading={webElectoralLoading} />
          )
        )}
        {activeSection === "economico" && (
          isAnalyzing ? <SkeletonDimension /> :
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
          isAnalyzing ? <SkeletonDimension /> :
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
          isAnalyzing ? <SkeletonDimension /> :
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
          isAnalyzing ? <SkeletonDimension /> :
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
          isAnalyzing ? <SkeletonDimension /> :
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
// MARKDOWN INLINE RENDERER
// ==========================================

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={i}>{part.slice(1, -1)}</em>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ==========================================
// SEÑALES TRIPARTITAS (C4)
// ==========================================

function TripartiteSignalsPanel({ dim }: { dim: F2DimensionPESTEL }) {
  const CLASIF_COLORS: Record<string, string> = {
    OPORTUNIDAD: "bg-green-eske-20 text-green-eske-80 dark:bg-green-eske/20 dark:text-[#7BC47C]",
    NEUTRAL: "bg-[#FFF2CC] text-[#816000] dark:bg-yellow-eske/20 dark:text-yellow-eske",
    AMENAZA: "bg-red-eske-20 text-red-eske-80 dark:bg-orange-eske/20 dark:text-orange-eske",
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
        colorClass="text-red-eske-70 dark:text-orange-eske"
        summaryClass="border border-red-eske-20 dark:border-orange-eske/30"
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
            <p className="text-xs text-black-eske dark:text-[#EAF2F8]"><InlineMarkdown text={s.descripcion} /></p>
            <div className="flex items-center gap-2 text-xs text-gray-eske-50 dark:text-[#9AAEBE]">
              <span>{s.fuente}</span>
              {s.fechaCorte && <span>· {s.fechaCorte}</span>}
              {s.origenInternacional && (
                <span className="px-1.5 py-0.5 bg-bluegreen-eske-10 text-bluegreen-eske-70 rounded text-xs dark:bg-bluegreen-eske/20 dark:text-blue-eske-20">
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

function PoliticoSection({ form, onChange, readOnly, fieldClass, projectType, sefixData, esMexico, webElectoralData, webElectoralLoading }: {
  form: ExplorationForm; onChange: (f: ExplorationForm) => void;
  readOnly: boolean; fieldClass: string; projectType: ProjectType;
  sefixData: SefixData | null;
  esMexico: boolean;
  webElectoralData: WebContextResult | null;
  webElectoralLoading: boolean;
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
      {esMexico
        ? sefixData && <SefixWidget data={sefixData} projectType={projectType} />
        : <WebElectoralWidget data={webElectoralData} loading={webElectoralLoading} />
      }
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
      <label className="text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE] block mb-1">
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

function ConfirmReanalisisModal({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-eske/50">
      <div className="bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-black-eske dark:text-[#EAF2F8]">¿Relanzar el análisis PESTEL?</h2>
            <p className="text-sm text-black-eske-10 dark:text-[#C7D6E0] mt-1">
              Se descartarán el mapa de dimensiones, los motores generados y las aprobaciones actuales. Esta acción no se puede deshacer.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-eske-20 dark:bg-white/10 text-black-eske dark:text-[#EAF2F8] rounded-lg text-sm font-medium hover:bg-gray-eske-30 dark:hover:bg-white/15 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-orange-eske text-white-eske rounded-lg text-sm font-medium hover:bg-orange-eske/90 transition-colors"
          >
            Relanzar análisis
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmUnlinkPestelModal({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-eske/50">
      <div className="bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-black-eske dark:text-[#EAF2F8]">¿Desvincular del análisis de Centinela PESTEL?</h2>
            <p className="text-sm text-black-eske-10 dark:text-[#C7D6E0] mt-1">
              Se borrará el escaneo PESTEL actual (M1) y las secciones M2-M5 ya aprobadas. El análisis
              de Centinela seguirá intacto — podrás regenerar vía el flujo express de Moddulo, o
              restaurar este mismo vínculo después.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-eske-20 dark:bg-white/10 text-black-eske dark:text-[#EAF2F8] rounded-lg text-sm font-medium hover:bg-gray-eske-30 dark:hover:bg-white/15 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-orange-eske text-white-eske rounded-lg text-sm font-medium hover:bg-orange-eske/90 transition-colors"
          >
            Desvincular
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// PICKER: VINCULAR A ANÁLISIS PESTEL EXISTENTE (upgrade express→Centinela)
// ==========================================
// Dirección inversa del picker de ModduloButton.tsx (PESTEL→Moddulo): aquí el
// usuario navega desde un proyecto Moddulo de origen express y elige un
// proyecto PESTEL de Centinela ya existente para vincularlo. Reutiliza el
// mismo endpoint link-moddulo/route.ts sin cambios — es agnóstico a qué lado
// lo invoca — y la misma lógica de compatibilidad tipo/territorio.

// checkTerritoryMatchInverse local fue consolidada 26-08-13 en
// lib/moddulo/linkCompatibility.ts (checkTerritoryMatch) — auditada contra
// esta versión antes de fusionar: el cuerpo era idéntico, la única
// diferencia real era que esta aceptaba ambos parámetros como nullable
// (projectTerritory puede ser null si el proyecto Moddulo no tiene
// territorio configurado). La versión consolidada ya adoptó esa firma más
// permisiva, así que el alias de abajo es un import directo, sin wrapper.
type TerritoryMatchKind = TerritoryMatch;
const checkTerritoryMatchInverse = checkTerritoryMatch;

type PestelPickerProject = {
  id: string;
  nombre: string;
  tipo: ProjectType;
  territorio?: Territorio;
  status?: string;
};

function LinkExistingPestelModal({ projectId, projectType, projectTerritory, onClose }: {
  projectId: string;
  projectType: ProjectType;
  projectTerritory: Territorio | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<(PestelPickerProject & { tipoOk: boolean; territoryMatch: TerritoryMatchKind })[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<(PestelPickerProject & { territoryMatch: TerritoryMatchKind }) | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/centinela/pestel/project", { credentials: "include" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { projects: PestelPickerProject[] };
        const enriched = (data.projects ?? [])
          .filter((p) => p.status !== "archived")
          .map((p) => ({
            ...p,
            tipoOk: p.tipo === projectType,
            territoryMatch: checkTerritoryMatchInverse(projectTerritory, p.territorio),
          }));
        enriched.sort((a, b) => {
          const scoreA = !a.tipoOk ? 3 : a.territoryMatch === "exact" ? 0 : a.territoryMatch === "approximate" ? 1 : 2;
          const scoreB = !b.tipoOk ? 3 : b.territoryMatch === "exact" ? 0 : b.territoryMatch === "approximate" ? 1 : 2;
          return scoreA - scoreB;
        });
        setProjects(enriched);
      } catch {
        setFetchError("No se pudieron cargar los proyectos PESTEL.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectType, projectTerritory]);

  async function doLink(target: PestelPickerProject, force: boolean) {
    setLinking(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/centinela/pestel/project/${target.id}/link-moddulo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modduloProjectId: projectId, forceLink: force }),
      });
      if (res.ok) {
        const data = (await res.json()) as { sourceAnalysisId?: string };
        onClose();
        router.push(
          `/moddulo/proyecto/${projectId}/exploracion${data.sourceAnalysisId ? `?pest_analysis_id=${data.sourceAnalysisId}` : ""}`
        );
        router.refresh();
        return;
      }
      const err = (await res.json()) as { message?: string };
      setLinkError(err.message ?? "No se pudo vincular. Intenta de nuevo.");
    } catch {
      setLinkError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLinking(false);
      setConfirmTarget(null);
    }
  }

  function handleSelect(target: PestelPickerProject & { tipoOk: boolean; territoryMatch: TerritoryMatchKind }) {
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
        <div className="flex items-center justify-between p-5 border-b border-gray-eske-20 dark:border-white/10 shrink-0">
          <h3 className="font-semibold text-gray-eske-80 dark:text-[#C7D6E0] text-base">
            Vincular con análisis independiente
          </h3>
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

        {confirmTarget && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex gap-2.5 p-3 rounded-lg bg-yellow-eske/10 border border-yellow-eske/30 text-sm leading-snug text-yellow-eske-80 dark:text-yellow-eske/90">
              <svg className="shrink-0 mt-0.5 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>
                {confirmTarget.territoryMatch === "approximate"
                  ? `Los territorios parecen coincidir, pero no se pudo verificar con un identificador confiable. Revisa que sean el mismo territorio antes de vincular.`
                  : `El análisis es de "${confirmTarget.territorio?.nombre ?? "territorio no especificado"}", pero este proyecto cubre "${projectTerritory?.nombre ?? "territorio no especificado"}".`}
              </span>
            </div>
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
                onClick={() => doLink(confirmTarget, true)}
                disabled={linking}
                className="px-4 py-2 text-sm font-medium bg-orange-eske text-white rounded-lg hover:bg-orange-eske-60 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {linking && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Vincular de todas formas
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
              <p className="text-sm text-gray-eske-50 dark:text-[#9AAEBE] text-center py-8">
                No tienes proyectos PESTEL en Centinela todavía.
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
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-start gap-3 ${
                    disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-eske-10 dark:hover:bg-white/5 cursor-pointer"
                  }`}
                  title={!p.tipoOk ? `Tipo incompatible: el análisis es "${p.tipo}" y este proyecto es "${projectType}"` : undefined}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium text-sm text-gray-eske-80 dark:text-[#C7D6E0] truncate">{p.nombre}</span>
                      {showWarning && <span className="shrink-0 text-yellow-eske text-xs" aria-label="Diferencia de territorio">⚠</span>}
                    </div>
                    <p className="text-xs text-gray-eske-50 dark:text-[#9AAEBE] mt-0.5 truncate">
                      {p.tipo}{p.territorio?.nombre ? ` · ${p.territorio.nombre}` : ""}
                    </p>
                    {!p.tipoOk && <p className="text-xs text-gray-eske-40 mt-0.5">Tipo incompatible con este proyecto</p>}
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
// SEFIX WIDGET
// ==========================================

function EleccionCard({
  eleccion,
  isPrimary,
}: {
  eleccion: SefixEleccion;
  isPrimary: boolean;
}) {
  const fmtN = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : String(n);

  const { resultados, label, granularity } = eleccion;

  const wrapCls = isPrimary
    ? "rounded-lg border border-bluegreen-eske/20 bg-bluegreen-eske/5 p-3 space-y-2"
    : "rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/50 dark:bg-[#112230] p-3 space-y-1.5";
  const headerCls = isPrimary
    ? "text-xs font-bold uppercase tracking-widest text-bluegreen-eske dark:text-blue-eske-20"
    : "text-xs font-semibold uppercase tracking-wider text-black-eske-80 dark:text-[#C7D6E0]";

  return (
    <div className={wrapCls}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={headerCls}>
            {label}{resultados ? ` ${resultados.anio}` : ""}
          </p>
          {granularity && (
            <p className="text-xs text-black-eske-80 dark:text-[#C7D6E0] mt-0.5">{granularity}</p>
          )}
        </div>
        {isPrimary && <span className="text-xs text-gray-eske-40 dark:text-[#6D8294] shrink-0">INE · DERFE</span>}
      </div>

      {!resultados ? (
        <p className="text-xs text-gray-eske-40 dark:text-[#6D8294] italic">Datos no disponibles</p>
      ) : (
        <div className="bg-white-eske dark:bg-[#21425E] rounded-lg px-2.5 py-2 space-y-1.5">
          <div className="flex gap-3 flex-wrap">
            {resultados.partidos.slice(0, 3).map((p) => (
              <div key={p.partido} className="text-xs">
                <span className="font-bold text-black-eske dark:text-[#EAF2F8]">{p.partido}</span>
                <span className="ml-1 text-black-eske-80 dark:text-[#9AAEBE]">{p.porcentaje}%</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-black-eske-80 dark:text-[#6D8294]">
            Participación: {resultados.participacion}%
            {isPrimary && resultados.totalVotos > 0 && ` · ${fmtN(resultados.totalVotos)} votos`}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Padrón label helpers ───────────────────────────────────────────────────────

function normalizeParaAbrev(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

const ESTADOS_ABREV: Record<string, string> = {
  aguascalientes:                  "AGS.",
  baja_california:                 "BC.",
  baja_california_sur:             "BCS.",
  campeche:                        "CAMP.",
  chiapas:                         "CHIS.",
  chihuahua:                       "CHIH.",
  coahuila:                        "COAH.",
  coahuila_de_zaragoza:            "COAH.",
  colima:                          "COL.",
  cdmx:                            "CDMX",
  ciudad_de_mexico:                "CDMX",
  df:                              "CDMX",
  durango:                         "DGO.",
  estado_de_mexico:                "EDOMEX.",
  edomex:                          "EDOMEX.",
  mexico:                          "EDOMEX.",
  guanajuato:                      "GTO.",
  guerrero:                        "GRO.",
  hidalgo:                         "HGO.",
  jalisco:                         "JAL.",
  michoacan:                       "MICH.",
  michoacan_de_ocampo:             "MICH.",
  morelos:                         "MOR.",
  nayarit:                         "NAY.",
  nuevo_leon:                      "NL.",
  oaxaca:                          "OAX.",
  puebla:                          "PUE.",
  queretaro:                       "QRO.",
  quintana_roo:                    "Q.ROO.",
  san_luis_potosi:                 "SLP.",
  sinaloa:                         "SIN.",
  sonora:                          "SON.",
  tabasco:                         "TAB.",
  tamaulipas:                      "TAMS.",
  tlaxcala:                        "TLAX.",
  veracruz:                        "VER.",
  veracruz_de_ignacio_de_la_llave: "VER.",
  yucatan:                         "YUC.",
  zacatecas:                       "ZAC.",
};

function romanToInt(s: string): number | null {
  const map: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
  };
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]], next = map[s[i + 1]];
    result += next && next > cur ? -cur : cur;
  }
  return result;
}

function parseCveDistritoFed(
  territory: import("@/types/pestel.types").Territorio
): string | null {
  if (territory.cve_distrito && /^\d+$/.test(territory.cve_distrito)) {
    return territory.cve_distrito;
  }
  const haystack = (territory.municipio ?? "") + " " + (territory.nombre ?? "");
  const m = haystack.match(/Distrito\s+Electoral\s+Federal\s+([IVX\d]+)/i);
  if (!m) return null;
  const raw = m[1].toUpperCase();
  if (/^\d+$/.test(raw)) return raw;
  const n = romanToInt(raw);
  return n !== null ? String(n) : null;
}

function nivelEquivalente(a?: string, b?: string): boolean {
  const norm = (n?: string) => (n === "distrito" ? "distrito_federal" : n);
  return norm(a) === norm(b);
}

function buildPadronLabel(territory: import("@/types/pestel.types").Territorio | null, estado: string): string {
  if (!territory) return estado.toUpperCase();
  const nivel = territory.nivel;

  if (nivel === "nacional") return "NACIONAL";
  if (nivel === "estatal") return (territory.estado ?? estado).toUpperCase();

  if (nivel === "municipal") {
    const mun = (territory.municipio ?? territory.nombre).toUpperCase();
    const abrev = ESTADOS_ABREV[normalizeParaAbrev(territory.estado ?? estado)]
      ?? (territory.estado ?? estado).slice(0, 3).toUpperCase() + ".";
    return `${mun}, ${abrev}`;
  }

  // distrito_federal | distrito_local | distrito (legacy)
  // NOTE: parsing depends on the user having followed the standard format
  // "Distrito Electoral Federal/Local {num} con cabecera en {ciudad}".
  // If the free-text field was filled differently, the fallback returns
  // the raw text uppercased — acceptable degradation, not an error.
  const haystack = territory.municipio ?? territory.nombre ?? "";
  const fallback  = territory.nombre ?? "";

  const fedRe = /Distrito\s+Electoral\s+Federal\s+([IVX\d]+)(?:\s+con\s+cabecera\s+en\s+([^,]+))?/i;
  const locRe = /Distrito\s+Electoral\s+Local\s+([IVX\d]+)(?:\s+(.+?))?(?:,|$)/i;

  const fedMatch = haystack.match(fedRe) ?? fallback.match(fedRe);
  if (fedMatch) {
    const raw = fedMatch[1].toUpperCase();
    const n   = /^\d+$/.test(raw) ? parseInt(raw, 10) : (romanToInt(raw) ?? 0);
    return "DTTO. FED. " + String(n).padStart(2, "0") + " " +
      (territory.estado ?? estado).toUpperCase();
  }

  const locMatch = haystack.match(locRe) ?? fallback.match(locRe);
  if (locMatch) {
    const raw = locMatch[1].toUpperCase();
    const n   = /^\d+$/.test(raw) ? parseInt(raw, 10) : (romanToInt(raw) ?? 0);
    return "DTTO. LOC. " + String(n).padStart(2, "0") + " " +
      (territory.estado ?? estado).toUpperCase();
  }

  return haystack.toUpperCase() || fallback.toUpperCase();
}

// ==========================================
// WIDGET CONTEXTO ELECTORAL WEB (no-México)
// ==========================================

function WebElectoralWidget({
  data,
  loading,
}: {
  data: WebContextResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-gray-eske-40 dark:text-[#6D8294]">
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Buscando contexto electoral…
      </div>
    );
  }

  if (!data || !data.disponible || data.indicadores.length === 0) {
    return (
      <p className="text-xs italic text-gray-eske-40 dark:text-[#6D8294]">
        No se encontró información electoral reciente para este territorio.
      </p>
    );
  }

  // Derive most recent date from indicators for badge
  const fechas = data.indicadores
    .map((i) => i.fecha)
    .filter(Boolean)
    .sort()
    .reverse();
  const fechaBadge = fechas[0] ?? null;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-blue-eske/20 bg-blue-eske/5 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <svg
            className="h-3.5 w-3.5 text-blue-eske-60 dark:text-blue-eske-20 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
          </svg>
          <span className="text-xs text-blue-eske-60 dark:text-blue-eske-20">
            Búsqueda web{fechaBadge ? ` · ${fechaBadge}` : ""}
          </span>
        </div>
        <ul className="space-y-1.5">
          {data.indicadores.map((ind, i) => (
            <li key={i} className="text-xs text-black-eske-80 dark:text-[#9AAEBE]">
              <span className="font-medium">{ind.nombre}:</span>{" "}
              {ind.valor}
              {ind.fecha ? (
                <span className="text-blue-eske-60 dark:text-blue-eske-20"> ({ind.fecha})</span>
              ) : null}
              {ind.url ? (
                <a
                  href={ind.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-eske-60 dark:text-blue-eske-20 underline"
                  aria-label={`Fuente: ${ind.fuente}`}
                >
                  ↗
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SefixWidget({ data, projectType }: { data: SefixData; projectType?: ProjectType }) {
  const { padron, primary, contraste } = data;
  const hasAnyData = padron || primary.resultados || contraste.some(c => c.resultados);
  if (!hasAnyData) return null;

  const isElectoral = !projectType || projectType === "electoral";

  const fmtN = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : String(n);

  return (
    <div className="space-y-2">
      {/* Padrón */}
      {padron && (
        <div className="rounded-lg border border-bluegreen-eske/20 bg-bluegreen-eske/5 p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske dark:text-blue-eske-20 leading-snug">
            {isElectoral ? `LNE y Padrón Electoral — ${data.padronLabel}` : "Contexto Electoral de Referencia"}
          </p>
          <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mb-2">
            INE / DERFE · al {padron.corte}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white-eske dark:bg-[#21425E] rounded-lg px-2.5 py-2">
              <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mb-0.5">Lista Nominal</p>
              <p className="text-sm font-bold text-black-eske dark:text-[#EAF2F8]">{fmtN(padron.listaNominal)}</p>
              <p className="text-xs text-black-eske-80 dark:text-[#6D8294]">
                {padron.listaNominalHombres && padron.listaNominalMujeres
                  ? `H: ${fmtN(padron.listaNominalHombres)} · M: ${fmtN(padron.listaNominalMujeres)}`
                  : "Desglose no disponible"}
              </p>
            </div>
            <div className="bg-white-eske dark:bg-[#21425E] rounded-lg px-2.5 py-2">
              <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mb-0.5">Padrón Electoral</p>
              <p className="text-sm font-bold text-black-eske dark:text-[#EAF2F8]">{fmtN(padron.padronElectoral)}</p>
              <p className="text-xs text-black-eske-80 dark:text-[#6D8294]">
                H: {fmtN(padron.padronHombres)} · M: {fmtN(padron.padronMujeres)}
              </p>
            </div>
          </div>
          {padron?.granularidadReal &&
           !nivelEquivalente(padron.granularidadReal, data.nivel) && (
            <p className="text-[10px] text-gray-eske-80 dark:text-[#6D8294] mt-1.5 italic">
              Cifras a nivel estatal. No se encontraron datos a nivel{" "}
              {data.nivel.replace(/_/g, " ")}.
            </p>
          )}
        </div>
      )}

      {/* Elección primaria */}
      <EleccionCard eleccion={primary} isPrimary />

      {/* Contrastes */}
      {contraste.map((c) => (
        <EleccionCard key={c.key} eleccion={c} isPrimary={false} />
      ))}
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

async function resolveGeoFilter(
  estado: string,
  key: ElecKey,
  territorio: Territorio | null,
  anio: number
): Promise<{ cabecera?: string; municipio?: string } | null> {
  if (!territorio) return null;

  if (key === "ayun") {
    return territorio.municipio ? { municipio: territorio.municipio } : null;
  }

  if (key === "diputados") {
    const geoUrl = `/api/sefix/elecciones-geo?nivel=distritos&cargo=dip&anio=${anio}&estado=${encodeURIComponent(estado)}`;
    try {
      const res = await fetch(geoUrl, { credentials: "include" });
      if (!res.ok) return null;
      const json = await res.json();
      const opciones: { cve: string; nombre: string }[] = json?.opciones ?? [];
      const cabecera = matchDistrito(opciones, territorio);
      if (cabecera) return { cabecera };
    } catch { /* no-op */ }
    return null;
  }

  if (key === "dip_loc") {
    const geoUrl = `/api/sefix/elecciones-locales-geo?nivel=distritos&cargo=dip_loc&anio=${anio}&estado=${encodeURIComponent(estado)}`;
    try {
      const res = await fetch(geoUrl, { credentials: "include" });
      if (!res.ok) return null;
      const json = await res.json();
      const opciones: { cve: string; nombre: string }[] = json?.opciones ?? [];
      const cabecera = matchDistrito(opciones, territorio);
      if (cabecera) return { cabecera };
    } catch { /* no-op */ }
    return null;
  }

  return null;
}

async function fetchSefixEleccion(
  estado: string,
  key: ElecKey,
  isPrimary: boolean,
  scope: SefixScope,
  territorio: Territorio | null
): Promise<SefixEleccion> {
  const label = ELEC_LABELS[key];
  const empty: SefixEleccion = { key, label, resultados: null, granularity: "" };
  const isFed = (["diputados", "senadores", "presidencia"] as ElecKey[]).includes(key);
  const isNac = scope === "nacional";

  try {
    if (isFed) {
      const estadoParam = isNac ? "" : `&estado=${encodeURIComponent(estado)}`;
      const baseUrl = `/api/sefix/resultados?cargo=${key}${estadoParam}`;
      const baseRes = await fetch(baseUrl, { credentials: "include" });
      if (!baseRes.ok) return empty;
      const baseJson = await baseRes.json();
      const baseResultados: SefixResultados | null = baseJson?.resultados ?? null;
      if (!baseResultados) return empty;

      const year = baseResultados.anio;
      let resultados = baseResultados;
      let granularity =
        key === "presidencia"
          ? "Elección de mayoría relativa a nivel Nacional"
          : isNac
          ? "Promedio ponderado de votación a nivel Nacional"
          : key === "senadores"
          ? `Elección de mayoría relativa en ${estado}`
          : `Promedio ponderado de votación en ${estado}`;

      if (isPrimary && !isNac && key === "diputados" && territorio) {
        const geo = await resolveGeoFilter(estado, key, territorio, year);
        if (geo?.cabecera) {
          const filtUrl = `/api/sefix/resultados?cargo=${key}&estado=${encodeURIComponent(estado)}&cabecera=${encodeURIComponent(geo.cabecera)}&anio=${year}`;
          const filtRes = await fetch(filtUrl, { credentials: "include" });
          if (filtRes.ok) {
            const filtJson = await filtRes.json();
            if (filtJson?.resultados) {
              resultados = filtJson.resultados;
              granularity = formatDistritoCabecera(geo.cabecera, "federal");
            }
          }
        }
      }

      return { key, label, resultados, granularity };
    } else {
      // Local cargo — first resolve year
      const locCargoKey = key === "gubernatura" ? "gob" : key;
      const yearsUrl = `/api/sefix/elecciones-locales-resultados?years_for_cargo&cargo=${locCargoKey}&estado=${encodeURIComponent(estado)}`;
      const yearsRes = await fetch(yearsUrl, { credentials: "include" });
      if (!yearsRes.ok) return empty;
      const yearsJson = await yearsRes.json();
      const years: number[] = yearsJson?.availableYears ?? [];
      if (years.length === 0) return empty;
      const maxYear = Math.max(...years);

      let geoParam = "";
      let granularity = key === "gubernatura"
        ? `Elección de mayoría relativa en ${estado}`
        : `Promedio ponderado de votación en ${estado}`;

      if (isPrimary && territorio) {
        if (key === "ayun" && territorio.municipio) {
          geoParam = `&municipio=${encodeURIComponent(territorio.municipio)}`;
          granularity = territorio.municipio;
        } else if (key === "dip_loc") {
          const geo = await resolveGeoFilter(estado, key, territorio, maxYear);
          if (geo?.cabecera) {
            geoParam = `&cabecera=${encodeURIComponent(geo.cabecera)}`;
            granularity = formatDistritoCabecera(geo.cabecera, "local");
          }
        }
      }

      const resultUrl = `/api/sefix/elecciones-locales-resultados?cargo=${locCargoKey}&anio=${maxYear}&estado=${encodeURIComponent(estado)}${geoParam}`;
      const resultRes = await fetch(resultUrl, { credentials: "include" });
      if (!resultRes.ok) return empty;
      const resultJson = await resultRes.json();
      const resultados: SefixResultados | null = resultJson?.resultados ?? null;

      return { key, label, resultados, granularity };
    }
  } catch {
    return empty;
  }
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
            <span className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske dark:text-blue-eske-20">F2 — Exploración</span>
          </div>
          {projectName && (
            <h1 className="text-xl sm:text-2xl font-bold text-black-eske dark:text-[#EAF2F8] leading-tight">
              {projectName}
            </h1>
          )}
          <div className="flex flex-wrap gap-1.5">
            {projectType && (
              <span className="px-2 py-0.5 bg-bluegreen-eske/10 text-bluegreen-eske dark:text-blue-eske-20 rounded-full text-xs font-medium">
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
                  bg-bluegreen-eske/10 text-bluegreen-eske dark:text-blue-eske-20 text-xs font-bold">
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
