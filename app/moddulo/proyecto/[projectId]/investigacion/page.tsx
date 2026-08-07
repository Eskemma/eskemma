// app/moddulo/proyecto/[projectId]/investigacion/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import ModduloChat from "@/app/moddulo/components/ModduloChat";
import PillButton from "@/app/moddulo/components/PillButton";
import PhaseDownloadMenu from "@/app/components/moddulo/PhaseDownloadMenu";
import ErrorBoundary from "@/app/components/ui/ErrorBoundary";
import { formatF3Report } from "@/lib/moddulo/reportFormatters";
import F3Onboarding from "./components/F3Onboarding";
import F3Tablero from "./components/F3Tablero";
import F3CoberturaSidebar from "./components/F3CoberturaSidebar";
import F3ReporteDIE from "./components/F3ReporteDIE";
import { detectPipStaleness, type PipCambio } from "@/lib/moddulo/pipPropagation";
import type {
  ProjectType, Territorio, PIPItem, IncertidumbreF2, HEIF2, ActorVetoF2,
  TareaPIP, SintesisF3, VeredictoHEI, DIE, RDAItem, ChatMessage,
} from "@/types/moddulo.types";

interface ResultadoDoc {
  resultadoId: string;
  moduloPIP: string;
  origen: { sourceKind: string; componente: string; fechaEntrega: string };
  cobertura: { completa: boolean; detalle?: string };
  aprobado?: boolean;
  notasUsuario?: string;
}

export default function InvestigacionPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [isLoaded, setIsLoaded] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("electoral");
  const [projectTerritory, setProjectTerritory] = useState<Territorio | null>(null);
  const [rda, setRda] = useState<Record<string, RDAItem>>({});

  const [pip, setPip] = useState<PIPItem[]>([]);
  const [incertidumbres, setIncertidumbres] = useState<IncertidumbreF2[]>([]);
  const [hei, setHei] = useState<HEIF2 | undefined>(undefined);
  const [semaforo, setSemaforo] = useState<ActorVetoF2[]>([]);

  const [showLanding, setShowLanding] = useState(true);
  const [tareas, setTareas] = useState<TareaPIP[]>([]);
  const [sintesis, setSintesis] = useState<SintesisF3 | undefined>(undefined);
  const [veredicto, setVeredicto] = useState<VeredictoHEI | undefined>(undefined);
  const [die, setDie] = useState<DIE | undefined>(undefined);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const [resultados, setResultados] = useState<ResultadoDoc[]>([]);
  const [showTablero, setShowTablero] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "cobertura">("chat");

  // D — aviso de resultados nuevos: se compara UNA vez por montaje contra
  // el valor de chatUltimaVisita ya cargado, antes de actualizarlo.
  const chatUltimaVisitaRef = useRef<string | undefined>(undefined);
  const noticeInsertedRef = useRef(false);

  const [generandoTareas, setGenerandoTareas] = useState(false);
  const [conflictoRegenerar, setConflictoRegenerar] = useState<{
    mensaje: string;
    resumen: { conResultadoAprobado: number; desactivadas: number; tareasAfectadas: { numero: number; pregunta: string; motivos: string[] }[] };
  } | null>(null);
  // Propagación PIP(F2)→tablero(F3) — detectada al cargar el proyecto,
  // igual momento y patrón visual que detectForwardStaleness en
  // exploracion/page.tsx (banner + confirmación explícita del usuario).
  const [pipStaleChanges, setPipStaleChanges] = useState<PipCambio[]>([]);
  const [sincronizandoPip, setSincronizandoPip] = useState(false);
  const [generandoSintesis, setGenerandoSintesis] = useState(false);
  const [generandoVeredicto, setGenerandoVeredicto] = useState(false);
  const [aprobandoVeredicto, setAprobandoVeredicto] = useState(false);
  const [cerrandoFase, setCerrandoFase] = useState(false);

  const [resultadosLoaded, setResultadosLoaded] = useState(false);
  const loadResultados = useCallback(async () => {
    if (!projectId) return;
    try {
      const r = await fetch(`/api/moddulo/f3/resultados?projectId=${projectId}`, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      setResultados(data.resultados ?? []);
    } catch {
      // non-fatal
    } finally {
      setResultadosLoaded(true);
    }
  }, [projectId]);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const r = await fetch(`/api/moddulo/projects/${projectId}`, { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      const p = data.project;
      if (!p) return;

      setProjectName(p.name ?? "");
      setProjectType(p.type ?? "electoral");
      if (p.territorio) setProjectTerritory(p.territorio);
      setRda(p.rda ?? {});

      const dvs = p.phases?.exploracion?.dvs;
      setPip(dvs?.pip ?? []);
      setIncertidumbres(dvs?.incertidumbres ?? []);
      setHei(dvs?.hei);
      setSemaforo(dvs?.semaforo ?? []);

      const f3 = p.phases?.investigacion;
      setTareas(f3?.f3TareasPIP ?? []);
      const staleDiffs = detectPipStaleness(p);
      setPipStaleChanges(staleDiffs ?? []);
      setSintesis(f3?.f3Sintesis);
      setVeredicto(f3?.f3Veredicto);
      setDie(f3?.f3DIE);
      setChatHistory(f3?.chatHistory ?? []);
      chatUltimaVisitaRef.current = f3?.chatUltimaVisita;
      if (f3?.started || f3?.status === "completed") setShowLanding(false);
    } finally {
      setIsLoaded(true);
    }
  }, [projectId]);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => { if (!showLanding) loadResultados(); }, [showLanding, loadResultados]);

  // Controla el montaje de <ModduloChat> — su initialMessages solo se lee
  // UNA vez al montar (useState interno, no se resincroniza con props
  // posteriores). Si el aviso se prepende a chatHistory DESPUÉS de que
  // ModduloChat ya montó, el aviso nunca aparece. Por eso no se renderiza
  // el chat hasta que el aviso (si aplica) ya esté resuelto.
  const [chatReady, setChatReady] = useState(false);

  // D — al tener resultados cargados (aunque sea un array vacío), compara
  // contra chatUltimaVisita UNA sola vez y antepone un mensaje sintético si
  // hay resultados nuevos. Después, marca la visita — no antes, para no
  // perder la comparación en un remount rápido.
  useEffect(() => {
    // Espera a que resultados haya terminado de cargar al menos una vez
    // (aunque el resultado sea un array vacío) — sin esto, el guard se
    // dispara con resultados todavía en [] y nunca vuelve a evaluar.
    if (!isLoaded || showLanding || !resultadosLoaded || noticeInsertedRef.current) return;
    noticeInsertedRef.current = true;

    const ultimaVisita = chatUltimaVisitaRef.current;
    if (ultimaVisita) {
      const nuevos = resultados.filter((r) => r.origen.fechaEntrega > ultimaVisita);
      if (nuevos.length > 0) {
        const labels = Array.from(new Set(nuevos.map((r) => r.moduloPIP)));
        const resumen = labels.length <= 3
          ? labels.join("; ")
          : `${labels.slice(0, 3).join("; ")} y ${labels.length - 3} más`;
        setChatHistory((prev) => [
          {
            id: `notice-${Date.now()}`,
            role: "assistant",
            content: `Recibimos ${nuevos.length === 1 ? "un resultado nuevo" : "resultados nuevos"} desde tu última visita: ${resumen}. Revísalos en "Ver tablero" › M2 · Resultados recibidos.`,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    }
    setChatReady(true);

    fetch("/api/moddulo/f3/chat-visita", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ projectId }),
    }).catch(() => {});
  }, [isLoaded, showLanding, resultadosLoaded, resultados, projectId]);

  const handleComenzar = useCallback(async () => {
    setShowLanding(false);
    await fetch(`/api/moddulo/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phaseData: { phaseId: "investigacion", started: true } }),
    }).catch(() => {});
  }, [projectId]);

  const handleGenerarTareas = useCallback(async (confirmar = false) => {
    setGenerandoTareas(true);
    try {
      const r = await fetch("/api/moddulo/f3/tareas/generar", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ projectId, confirmar }),
      });
      if (r.status === 409) {
        const d = await r.json();
        setConflictoRegenerar({ mensaje: d.mensaje, resumen: d.resumen });
        return;
      }
      if (r.ok) {
        const d = await r.json();
        setTareas(d.tareas);
        setConflictoRegenerar(null);
      }
    } finally {
      setGenerandoTareas(false);
    }
  }, [projectId]);

  const handleSincronizarTablero = useCallback(async () => {
    setSincronizandoPip(true);
    try {
      const r = await fetch("/api/moddulo/f3/tareas/sincronizar", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (r.ok) {
        const d = await r.json();
        setTareas(d.tareas);
        setPipStaleChanges([]);
      }
    } finally {
      setSincronizandoPip(false);
    }
  }, [projectId]);

  const handleGenerarSintesis = useCallback(async () => {
    setGenerandoSintesis(true);
    try {
      const r = await fetch("/api/moddulo/f3/sintesis/generar", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (r.ok) { const d = await r.json(); setSintesis(d.sintesis); }
    } finally {
      setGenerandoSintesis(false);
    }
  }, [projectId]);

  const handleGenerarVeredicto = useCallback(async () => {
    setGenerandoVeredicto(true);
    try {
      const r = await fetch("/api/moddulo/f3/veredicto/generar", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (r.ok) { const d = await r.json(); setVeredicto(d.veredicto); }
    } finally {
      setGenerandoVeredicto(false);
    }
  }, [projectId]);

  const handleAprobarVeredicto = useCallback(async () => {
    setAprobandoVeredicto(true);
    try {
      const r = await fetch("/api/moddulo/f3/veredicto/aprobar", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (r.ok) {
        const d = await r.json();
        setDie(d.die);
        setVeredicto(d.die.veredictoHEI);
      }
    } finally {
      setAprobandoVeredicto(false);
    }
  }, [projectId]);

  const isLista = !!die;
  const btnBase = "px-2.5 py-1.5 border border-bluegreen-eske-60 text-bluegreen-eske-60 bg-transparent rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:bg-bluegreen-eske/5";
  const btnClose = "px-2.5 py-1.5 bg-bluegreen-eske-60 text-white-eske rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

  const tableroProps = {
    projectId, projectType, projectTerritory, pip, incertidumbres, hei, semaforo,
    tareas, resultados, sintesis, veredicto,
    onGenerarTareas: handleGenerarTareas,
    conflictoRegenerar,
    onCancelarConflicto: () => setConflictoRegenerar(null),
    pipStaleChanges,
    sincronizandoPip,
    onSincronizarTablero: handleSincronizarTablero,
    onRefresh: () => { loadProject(); loadResultados(); },
    onGenerarSintesis: handleGenerarSintesis,
    onGenerarVeredicto: handleGenerarVeredicto,
    onAprobarVeredicto: handleAprobarVeredicto,
    generandoTareas, generandoSintesis, generandoVeredicto, aprobandoVeredicto,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="shrink-0 px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
        {/* Fila 1: título + toggle, alineados solo dentro del ancho de la
            columna central (el spacer de la derecha, ancho gemelo al
            sidebar de cobertura, evita que el toggle invada visualmente esa
            columna en desktop). La descarga, en cambio, va SIEMPRE al borde
            derecho absoluto de la página — igual que en F1/F2, donde el
            ícono aparece a la derecha del sidebar, no de la columna
            central — por eso vive dentro del spacer (visible solo en
            desktop) y se duplica en una copia mobile-only dentro del grupo
            central (en mobile no hay sidebar con el que alinear). */}
        <div className="flex">
          <div className="flex-1 flex items-center justify-between min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske shrink-0">F3</span>
              <h1 className="text-sm sm:text-base font-bold text-black-eske dark:text-[#EAF2F8] truncate">Investigación</h1>
              {isLista && (
                <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Lista</span>
              )}
            </div>
            {!showLanding && (
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <PillButton
                  variant="outline"
                  onClick={() => setShowTablero((v) => !v)}
                  className="dark:border-blue-eske-20 dark:text-blue-eske-20"
                >
                  {showTablero ? "‹ Volver al chat" : "Ver tablero ›"}
                </PillButton>
                <div className="lg:hidden">
                  <PhaseDownloadMenu
                    phaseId="investigacion"
                    projectName={projectName}
                    content={{ reporte: tareas.length > 0 ? formatF3Report(pip, tareas, sintesis, veredicto) : null }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="hidden lg:flex lg:w-80 xl:w-96 shrink-0 items-center justify-end">
            {!showLanding && (
              <PhaseDownloadMenu
                phaseId="investigacion"
                projectName={projectName}
                content={{ reporte: tareas.length > 0 ? formatF3Report(pip, tareas, sintesis, veredicto) : null }}
              />
            )}
          </div>
        </div>

        {/* Fila 2: botones estándar SOLO en Lista (veredicto aprobado) —
            igual que F2, left-aligned, sin ml-auto. */}
        {!showLanding && isLista && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button onClick={() => setShowTablero(false)} className={btnBase}>Reporte F3</button>
            <button onClick={() => setShowTablero(true)} className={btnBase}>Editar análisis</button>
            <button
              onClick={async () => {
                setCerrandoFase(true);
                try {
                  await fetch(`/api/moddulo/projects/${projectId}/complete-phase`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                    body: JSON.stringify({ phaseId: "investigacion" }),
                  });
                } finally {
                  setCerrandoFase(false);
                }
              }}
              disabled={cerrandoFase}
              className={btnClose}
            >
              {cerrandoFase ? "Cerrando…" : "Cerrar Fase 3"}
            </button>
          </div>
        )}
      </div>

      {/* TABS MOBILE — la pestaña "chat" muestra en realidad lo que esté
          activo en el área central (chat, tablero o reporte final), así que
          su etiqueta refleja showTablero/isLista en vez de un nombre fijo. */}
      {!showLanding && (
        <div className="lg:hidden shrink-0 flex border-b border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A]">
          {[
            { id: "chat" as const, label: showTablero ? "Tablero" : isLista ? "Reporte" : "Chat" },
            { id: "cobertura" as const, label: "Cobertura" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setMobileTab(id)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors border-b-2 dark:text-bluegreen-eske-20 ${
                mobileTab === id ? "border-bluegreen-eske dark:border-bluegreen-eske-20 text-bluegreen-eske" : "border-transparent text-gray-eske-50"
              }`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {showLanding && isLoaded && (
          <F3Onboarding
            projectName={projectName}
            projectType={projectType}
            projectTerritory={projectTerritory}
            onComenzar={handleComenzar}
          />
        )}

        {!showLanding && (<>
          <div className={`flex-1 flex-col p-3 sm:p-4 overflow-hidden min-w-0 ${mobileTab === "chat" ? "flex" : "hidden lg:flex"}`}>
            <ErrorBoundary fallbackLabel="Algo salió mal al mostrar esta vista. Intenta de nuevo o vuelve al chat.">
              {isLista && !showTablero ? (
                <F3ReporteDIE die={die!} rda={rda} />
              ) : isLista && showTablero ? (
                <F3Tablero {...tableroProps} readOnly />
              ) : !isLista && showTablero ? (
                <F3Tablero {...tableroProps} />
              ) : chatReady ? (
                <ModduloChat
                  phaseId="investigacion"
                  projectId={projectId}
                  initialMessages={chatHistory}
                  onMessagesChange={setChatHistory}
                />
              ) : null}
            </ErrorBoundary>
          </div>

          <div className={`flex-col w-full lg:w-80 xl:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-eske-20 dark:border-white/10 overflow-hidden bg-gray-eske-10/50 dark:bg-[#112230] ${mobileTab === "cobertura" ? "flex" : "hidden lg:flex"}`}>
            <ErrorBoundary fallbackLabel="Algo salió mal al mostrar la cobertura del PIP.">
              <F3CoberturaSidebar pip={pip} tareas={tareas} sintesis={sintesis} projectId={projectId} />
            </ErrorBoundary>
          </div>
        </>)}
      </div>
    </div>
  );
}
