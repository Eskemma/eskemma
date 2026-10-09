// app/moddulo/proyecto/[projectId]/investigacion/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  decidirCierreDeFase,
  decidirGeneracionF3UI,
  mensajeDeAviso,
  urlSinAviso,
  type RespuestaGuardado,
} from "@/lib/moddulo/guardadoHonesto";
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
import { extraerTerritorioEscalar } from "@/lib/territorio/staleness";
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
  // Ronda 13 (26-08-18) — propagación de cambios de territorio. Solo
  // presentes en resultados de Canal 3 (origen.sourceKind === "external").
  metadatosFuente?: { nombreHerramienta: string };
  proyectoTerritorioSnapshotAtVinculacion?: string;
  // Opción A (26-09-09) — capa interpretativa de Fontana (Canal 1/3). El
  // storagePath NO se usa en el cliente; F3ResultadosRecibidos lo resuelve
  // vía GET /api/moddulo/f3/resultados/[id]/reporte.
  payload?: { reporteInterpretativoUrl?: string };
}

export default function InvestigacionPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Notice carried by `?aviso=<code>` (closed list; fixed text per code, the URL
  // value is never rendered). Read once, then removed from the URL so it does not
  // reappear on reload or when the link is shared.
  const [avisoCierre, setAvisoCierre] = useState<string | null>(null);
  const [cierreError, setCierreError] = useState<string | null>(null);
  useEffect(() => {
    if (!searchParams.has("aviso")) return;
    setAvisoCierre(mensajeDeAviso(searchParams.get("aviso")));
    router.replace(urlSinAviso(pathname, searchParams.toString()));
  }, [searchParams, router, pathname]);

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
  // Piezas 1/3 del plan de escenarios (b)/(c) (2026-08-19) — resultado de
  // Fontana pendiente de vincular a este proyecto.
  const [fontanaPendiente, setFontanaPendiente] = useState<
    { sesionId: string; territorio: Territorio; fechaCreacion: string } | null
  >(null);
  const fontanaRetryDoneRef = useRef(false);
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
      if (!r.ok) {
        // 404: el layout de la ruta muestra la página 404; otros códigos quedan registrados.
        if (r.status !== 404) console.error(`[investigacion] API error ${r.status}:`, await r.text());
        return;
      }
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
      setFontanaPendiente(f3?.fontanaPendiente ?? null);
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

  // Pieza 3 (2026-08-19) — red de seguridad: si el wizard de creación
  // (Flujo 1) no logró confirmar vincular-moddulo antes de redirigir aquí,
  // reintenta una sola vez en silencio con el sesionId que sí viaja en la
  // URL — antes de decidir si mostrar el banner de fontanaPendiente.
  useEffect(() => {
    const fontanaSesionId = searchParams.get("fontana_sesion_id");
    if (!isLoaded || !fontanaSesionId || fontanaPendiente || fontanaRetryDoneRef.current) return;
    fontanaRetryDoneRef.current = true;
    fetch(`/api/fontana/sesion/${fontanaSesionId}/vincular-moddulo`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ modduloProjectId: projectId }),
    })
      .then((r) => {
        if (r.ok) loadProject();
        // Silent by design (safety net); if it fails, the fontanaPendiente
        // banner already tells the user. Leave a trace for debugging.
        else console.warn(`[investigacion] reintento de vinculación a Fontana falló (HTTP ${r.status})`);
      })
      .catch((e) => console.warn("[investigacion] reintento de vinculación a Fontana falló (red)", e));
  }, [isLoaded, searchParams, fontanaPendiente, projectId, loadProject]);

  // canal3/vincular ya limpia fontanaPendiente server-side (mismo write que
  // crea el resultado) cuando recibe el fontanaSesionId correspondiente —
  // esto solo refleja ese estado en la UI sin una 2ª llamada de red.
  const handleDismissFontanaPendiente = useCallback(() => {
    setFontanaPendiente(null);
  }, []);

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

  // H-M3: the F3 generators answer 409/5xx that used to be ignored in silence. Decisions
  // live in lib/moddulo/guardadoHonesto.ts; these handlers only perform effects.
  const [avisoErrorF3, setAvisoErrorF3] = useState<string | null>(null);

  async function pedirF3(url: string, cuerpo: Record<string, unknown>) {
    let datos: Record<string, unknown> = {};
    let resp: RespuestaGuardado;
    try {
      const r = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(cuerpo),
      });
      try { datos = (await r.json()) as Record<string, unknown>; } catch { datos = {}; }
      resp = {
        tipo: "respuesta", ok: r.ok, status: r.status,
        codigo: typeof datos.error === "string" ? datos.error : undefined,
        motor: typeof datos.motor === "string" ? datos.motor : undefined,
        mensaje: typeof datos.mensaje === "string" ? datos.mensaje : undefined,
      };
    } catch {
      resp = { tipo: "error_red" };
    }
    return { resp, datos };
  }

  const handleGenerarTareas = useCallback(async (confirmar = false) => {
    setGenerandoTareas(true);
    setAvisoErrorF3(null);
    try {
      const { resp, datos } = await pedirF3("/api/moddulo/f3/tareas/generar", { projectId, confirmar });
      if (resp.tipo === "respuesta" && resp.status === 409 && resp.codigo === "progreso_existente") {
        setConflictoRegenerar({
          mensaje: datos.mensaje as string,
          resumen: datos.resumen as NonNullable<typeof conflictoRegenerar>["resumen"],
        });
        return;
      }
      const d = decidirGeneracionF3UI("generar_tablero", resp);
      if (d.tipo === "exito" && Array.isArray(datos.tareas)) {
        setTareas(datos.tareas as typeof tareas);
        setConflictoRegenerar(null);
      } else if (d.tipo !== "exito") {
        setConflictoRegenerar(null);
        setAvisoErrorF3(d.mensajeError);
      } else {
        setAvisoErrorF3("No se pudo registrar la generación del tablero. El servidor respondió algo inesperado; recarga la página para verificar el estado.");
      }
    } finally {
      setGenerandoTareas(false);
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSincronizarTablero = useCallback(async () => {
    setSincronizandoPip(true);
    setAvisoErrorF3(null);
    try {
      const { resp, datos } = await pedirF3("/api/moddulo/f3/tareas/sincronizar", { projectId });
      const d = decidirGeneracionF3UI("sincronizar_tablero", resp);
      if (d.tipo === "exito" && Array.isArray(datos.tareas)) {
        setTareas(datos.tareas as typeof tareas);
        setPipStaleChanges([]);
      } else if (d.tipo !== "exito") {
        setAvisoErrorF3(d.mensajeError);
      }
    } finally {
      setSincronizandoPip(false);
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ronda 13 (26-08-18) — propagación de cambios de territorio (Canal 3).
  // Actualiza `resultados` in-place con el veredicto/snapshot frescos —
  // la fuente sale de la lista de "stale" en cuanto el snapshot vuelve a
  // coincidir, sin necesitar recargar toda la página. Nunca desvincula ni
  // invalida nada — solo refresca el veredicto para que el analista decida.
  const [revisandoTerritorioResultadoId, setRevisandoTerritorioResultadoId] = useState<string | null>(null);
  const [ultimoVeredictoTerritorio, setUltimoVeredictoTerritorio] = useState<{ nombre: string; match: string } | null>(null);
  const handleRevisarTerritorioFuente = useCallback(async (resultadoId: string) => {
    setRevisandoTerritorioResultadoId(resultadoId);
    try {
      const r = await fetch("/api/moddulo/f3/canal3/revisar-territorio", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ projectId, resultadoId }),
      });
      if (r.ok) {
        const d = await r.json();
        setResultados((prev) =>
          prev.map((res) =>
            res.resultadoId === resultadoId
              ? {
                  ...res,
                  compatibilidad: d.compatibilidad,
                  proyectoTerritorioSnapshotAtVinculacion: projectTerritory
                    ? JSON.stringify(extraerTerritorioEscalar(projectTerritory))
                    : undefined,
                }
              : res
          ) as typeof prev
        );
        const fuente = resultados.find((res) => res.resultadoId === resultadoId);
        setUltimoVeredictoTerritorio({
          nombre: fuente?.metadatosFuente?.nombreHerramienta ?? resultadoId,
          match: d.compatibilidad?.pertinencia?.territorioDetalle ?? "Territorio verificado — sin problema de compatibilidad.",
        });
      }
    } finally {
      setRevisandoTerritorioResultadoId(null);
    }
  }, [projectId, projectTerritory, resultados]);

  const handleGenerarSintesis = useCallback(async () => {
    setGenerandoSintesis(true);
    setAvisoErrorF3(null);
    try {
      const { resp, datos } = await pedirF3("/api/moddulo/f3/sintesis/generar", { projectId });
      const d = decidirGeneracionF3UI("generar_sintesis", resp);
      if (d.tipo === "exito" && datos.sintesis) setSintesis(datos.sintesis as typeof sintesis);
      else if (d.tipo !== "exito") setAvisoErrorF3(d.mensajeError);
      else setAvisoErrorF3("No se pudo CONFIRMAR la generación de la síntesis: el servidor respondió algo inesperado. Recarga la página para verificar el estado.");
    } finally {
      setGenerandoSintesis(false);
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerarVeredicto = useCallback(async () => {
    setGenerandoVeredicto(true);
    setAvisoErrorF3(null);
    try {
      const { resp, datos } = await pedirF3("/api/moddulo/f3/veredicto/generar", { projectId });
      const d = decidirGeneracionF3UI("generar_veredicto", resp);
      if (d.tipo === "exito" && datos.veredicto) setVeredicto(datos.veredicto as typeof veredicto);
      else if (d.tipo !== "exito") setAvisoErrorF3(d.mensajeError);
      else setAvisoErrorF3("No se pudo CONFIRMAR la generación del veredicto: el servidor respondió algo inesperado. Recarga la página para verificar el estado.");
    } finally {
      setGenerandoVeredicto(false);
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const btnBase = "px-2.5 py-1.5 border border-bluegreen-eske-60 dark:border-blue-eske-20 text-bluegreen-eske-60 dark:text-blue-eske-20 bg-transparent rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:bg-bluegreen-eske/5 dark:hover:bg-blue-eske-20/10";
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
    onRevisarTerritorioFuente: handleRevisarTerritorioFuente,
    revisandoTerritorioResultadoId,
    ultimoVeredictoTerritorio,
    onCerrarVeredictoTerritorio: () => setUltimoVeredictoTerritorio(null),
    fontanaPendiente,
    onDismissFontanaPendiente: handleDismissFontanaPendiente,
    avisoError: avisoErrorF3,
    onCerrarAvisoError: () => setAvisoErrorF3(null),
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
              <span className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske dark:text-blue-eske-20 shrink-0">F3</span>
              <h1 className="text-sm sm:text-base font-bold text-black-eske dark:text-[#EAF2F8] truncate">Investigación</h1>
              {isLista && (
                <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 bg-green-eske/20 text-green-eske-80 dark:text-green-eske-30 rounded-full">✓ Lista</span>
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
                setCierreError(null);
                let resp: RespuestaGuardado;
                try {
                  const r = await fetch(`/api/moddulo/projects/${projectId}/complete-phase`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                    body: JSON.stringify({ phaseId: "investigacion" }),
                  });
                  resp = { tipo: "respuesta", ok: r.ok, status: r.status };
                } catch {
                  resp = { tipo: "error_red" };
                }
                const d = decidirCierreDeFase(resp, null, { fase: "Fase 3" });
                if (!d.navegar) setCierreError(d.mensajeBloqueante);
                setCerrandoFase(false);
              }}
              disabled={cerrandoFase}
              className={btnClose}
            >
              {cerrandoFase ? "Cerrando…" : "Cerrar Fase 3"}
            </button>
            {cierreError && (
              <p role="alert" className="basis-full text-xs font-medium text-red-eske-60 dark:text-red-eske-10">
                {cierreError}
              </p>
            )}
          </div>
        )}
      </div>

      {avisoCierre && (
        <div
          role="status"
          className="mx-4 mt-2 flex items-start justify-between gap-3 rounded-lg border border-yellow-eske/30 bg-yellow-eske/10 px-3 py-2 text-sm text-brown-eske-60 dark:text-yellow-eske"
        >
          <span>{avisoCierre}</span>
          <button
            type="button"
            onClick={() => setAvisoCierre(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 font-medium underline focus-visible:outline focus-visible:outline-2"
          >
            Cerrar
          </button>
        </div>
      )}

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
              className={`flex-1 py-2 text-xs font-semibold transition-colors border-b-2 dark:text-blue-eske-20 ${
                mobileTab === id ? "border-bluegreen-eske dark:border-blue-eske-20 text-bluegreen-eske" : "border-transparent text-black-eske-20"
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
