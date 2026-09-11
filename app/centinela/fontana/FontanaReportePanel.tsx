"use client";

// app/centinela/fontana/FontanaReportePanel.tsx
// Pestaña "Reporte" del workspace de Fontana. Genera (ASÍNCRONO — job en
// background + polling) / regenera / edita (texto libre, autoguardado) /
// descarga (PDF · DOCX) / elimina el único reporte de sesión.
//
// Flujo async: "Generar"/"Regenerar" → POST .../reporte devuelve { jobId }
// de inmediato; el panel hace polling de GET .../reporte/job cada 4s. Al
// `completed` carga el markdown (GET .../reporte) y actualiza el puntero.
// El reporte anterior sigue visible mientras se regenera. Al montar la
// pestaña se reanuda el polling de un job en curso (reload / disparado
// desde el chat).
//
// Edición: toggle "Editar texto" ⇄ "Guardar cambios" sobre un <textarea>.
// Autoguardado por debounce; "Guardar cambios" hace un flush inmediato.

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { FontanaCanvasItem, FontanaSesion } from "@/types/fontana.types";
import { exportToPdf, exportToDocx } from "@/lib/shared/reportExport";
import InfoTooltip from "@/app/components/ui/InfoTooltip";

const BTN_OUTLINE =
  "text-xs px-2.5 py-1 rounded-lg border border-bluegreen-eske-60 dark:border-blue-eske-20 " +
  "text-bluegreen-eske-60 dark:text-blue-eske-20 bg-transparent hover:bg-bluegreen-eske/5 " +
  "dark:hover:bg-blue-eske-20/10 transition-colors disabled:opacity-50";

const POLL_MS = 4000;
const POLL_TIMEOUT_MS = 12 * 60 * 1000;

const MD_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-black-eske dark:text-[#EAF2F8] mt-5 mb-2 leading-snug first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8] mt-5 mb-2 border-b border-gray-eske-20 dark:border-white/10 pb-1 leading-snug">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] mt-4 mb-1.5 leading-snug">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-3 leading-relaxed text-black-eske dark:text-[#C7D6E0]">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-0.5 text-black-eske dark:text-[#C7D6E0]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-0.5 text-black-eske dark:text-[#C7D6E0]">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-black-eske dark:text-[#EAF2F8]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-gray-eske-20 dark:border-white/10 my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-eske-10 dark:bg-[#21425E]">{children}</thead>,
  tr: ({ children }) => <tr className="even:bg-gray-eske-10/50 dark:even:bg-white/5">{children}</tr>,
  th: ({ children }) => (
    <th className="border border-gray-eske-20 dark:border-white/10 px-2 py-1.5 font-semibold text-left text-black-eske dark:text-[#EAF2F8]">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-eske-20 dark:border-white/10 px-2 py-1.5 align-top text-black-eske dark:text-[#C7D6E0]">{children}</td>
  ),
};

interface Props {
  sesion: FontanaSesion;
  canvasItems: FontanaCanvasItem[];
  // jobId de una generación disparada desde el chat — el panel arranca el
  // polling aunque la pestaña no estuviera abierta.
  jobIdInicial?: string | null;
  onJobIdConsumido?: () => void;
  onSesionActualizada: (sesion: FontanaSesion) => void;
}

function hayContenidoNuevo(reporteSesion: FontanaSesion["reporteSesion"], idsActivos: string[]): boolean {
  if (!reporteSesion) return false;
  const ahora = new Set(idsActivos);
  const ref = reporteSesion.canvasItemsRef;
  if (ahora.size !== ref.length) return true;
  return ref.some((id) => !ahora.has(id));
}

type JobStatus = "idle" | "running" | "failed";

export default function FontanaReportePanel({
  sesion,
  canvasItems,
  jobIdInicial,
  onJobIdConsumido,
  onSesionActualizada,
}: Props) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [jobError, setJobError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [guardado, setGuardado] = useState<"idle" | "guardando" | "guardado" | "error">("idle");
  const [descargando, setDescargando] = useState(false);
  const [submenuDescarga, setSubmenuDescarga] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ultimoGeneradoRef = useRef<string | null>(null);
  const pendienteRef = useRef<string | null>(null);
  // Refs vivos para los callbacks de polling (evita recrearlos y arrastrar
  // estado sesión viejo al llamar onSesionActualizada desde el intervalo).
  const sesionRef = useRef(sesion);
  sesionRef.current = sesion;
  const onSesionActualizadaRef = useRef(onSesionActualizada);
  onSesionActualizadaRef.current = onSesionActualizada;
  const sesionIdRef = useRef(sesion.sesionId);
  sesionIdRef.current = sesion.sesionId;

  const idsActivos = canvasItems.filter((it) => !it.eliminado).map((it) => it.id);
  const haySeleccionTabla = Object.values(sesion.indicadoresPorFamilia).some(
    (f) => f.minimos.length + f.seleccionUsuario.length > 0
  );
  const nadaQueGenerar = idsActivos.length === 0 && !haySeleccionTabla;
  const baseName = sesion.nombre || sesion.territorio.nombre || "Fontana";

  const detenerPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const cargarMarkdown = useCallback(async () => {
    try {
      const res = await fetch(`/api/fontana/sesion/${sesionIdRef.current}/reporte`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        contenidoMarkdown: string;
        reporteSesion?: FontanaSesion["reporteSesion"];
      };
      setMarkdown(data.contenidoMarkdown);
      ultimoGeneradoRef.current = data.reporteSesion?.generadoEn ?? ultimoGeneradoRef.current;
      if (data.reporteSesion) {
        onSesionActualizadaRef.current({ ...sesionRef.current, reporteSesion: data.reporteSesion });
      }
    } catch {
      setError("No se pudo cargar el reporte generado.");
    }
  }, []);

  const iniciarPolling = useCallback(() => {
    detenerPolling();
    setJobStatus("running");
    setJobError(null);
    setError(null);
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        detenerPolling();
        setJobStatus("failed");
        setJobError("La generación del reporte tardó demasiado. Vuelve a intentarlo.");
        return;
      }
      try {
        const res = await fetch(`/api/fontana/sesion/${sesionIdRef.current}/reporte/job`);
        if (!res.ok) return;
        const data = (await res.json()) as { status: string; enCurso?: boolean; error?: string | null };
        if (data.status === "completed") {
          detenerPolling();
          setJobStatus("idle");
          setEditMode(false);
          await cargarMarkdown();
        } else if (data.status === "failed") {
          detenerPolling();
          setJobStatus("failed");
          setJobError(data.error || "No se pudo generar el reporte. Vuelve a intentarlo.");
        } else if (data.status === "none" || data.enCurso === false) {
          detenerPolling();
          setJobStatus("idle");
        }
        // pending / running → seguir
      } catch {
        // error de red → seguir hasta el timeout
      }
    }, POLL_MS);
  }, [detenerPolling, cargarMarkdown]);

  // Carga el cuerpo markdown cuando aparece/cambia un reporte (generadoEn).
  useEffect(() => {
    const generadoEn = sesion.reporteSesion?.generadoEn ?? null;
    if (!generadoEn) {
      setMarkdown(null);
      ultimoGeneradoRef.current = null;
      return;
    }
    if (generadoEn === ultimoGeneradoRef.current) return;
    let cancelado = false;
    setCargando(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}/reporte`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { contenidoMarkdown: string };
        if (cancelado) return;
        setMarkdown(data.contenidoMarkdown);
        ultimoGeneradoRef.current = generadoEn;
      } catch {
        if (!cancelado) setError("No se pudo cargar el reporte.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [sesion.reporteSesion?.generadoEn, sesion.sesionId]);

  // Job disparado desde el chat — llega como prop, puede ser en el mount o
  // después si la pestaña Reporte ya estaba abierta.
  useEffect(() => {
    if (!jobIdInicial) return;
    onJobIdConsumido?.();
    iniciarPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIdInicial]);

  // Al montar / cambiar de sesión: reanudar según el estado DURABLE del job
  // (fontana_sesiones/{id}/reporte/job en Firestore), aunque el navegador se
  // haya cerrado por completo y no haya habido ningún setInterval vivo — el
  // job corre server-side (after()), independiente de esta pestaña.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}/reporte/job`);
        if (!res.ok || cancelado) return;
        const data = (await res.json()) as { status: string; enCurso?: boolean; error?: string | null };
        if (cancelado) return;
        if (data.enCurso) {
          // pending / running (no colgado) → arranca un setInterval nuevo.
          iniciarPolling();
        } else if (data.status === "failed") {
          setJobStatus("failed");
          setJobError(data.error || "La última generación del reporte falló.");
        } else if (data.status === "completed" && !sesion.reporteSesion) {
          // El job terminó mientras el navegador estaba cerrado y el puntero
          // `reporteSesion` de la sesión que llegó por props no está fresco
          // (normalmente sí lo está tras un reload y lo carga el efecto de
          // arriba). Traemos el markdown directo del job completado.
          await cargarMarkdown();
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion.sesionId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleGenerar = useCallback(async () => {
    const rs = sesion.reporteSesion;
    if (rs?.editadoEn && rs.editadoEn > rs.generadoEn) {
      const ok = window.confirm(
        "Regenerar el reporte descarta las ediciones manuales que hiciste. ¿Continuar?"
      );
      if (!ok) return;
    }
    setError(null);
    setJobError(null);
    setJobStatus("running");
    try {
      const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}/reporte`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setJobStatus("idle");
        setError(data.mensaje ?? data.error ?? "No se pudo iniciar la generación del reporte.");
        return;
      }
      iniciarPolling();
    } catch {
      setJobStatus("idle");
      setError("No se pudo iniciar la generación del reporte.");
    }
  }, [sesion.sesionId, sesion.reporteSesion, iniciarPolling]);

  const guardarContenido = useCallback(
    async (valor: string) => {
      setGuardado("guardando");
      try {
        const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}/reporte`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenidoMarkdown: valor }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        onSesionActualizada(data.sesion);
        ultimoGeneradoRef.current = data.sesion?.reporteSesion?.generadoEn ?? ultimoGeneradoRef.current;
        pendienteRef.current = null;
        setGuardado("guardado");
        setTimeout(() => setGuardado("idle"), 2000);
      } catch {
        setGuardado("error");
      }
    },
    [sesion.sesionId, onSesionActualizada]
  );

  const handleEditarTexto = useCallback(
    (valor: string) => {
      setMarkdown(valor);
      pendienteRef.current = valor;
      setGuardado("guardando");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void guardarContenido(valor);
      }, 800);
    },
    [guardarContenido]
  );

  const flushGuardado = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendienteRef.current !== null) {
      await guardarContenido(pendienteRef.current);
    }
  }, [guardarContenido]);

  const handleEliminar = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}/reporte`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje ?? data.error ?? "No se pudo eliminar el reporte.");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      detenerPolling();
      pendienteRef.current = null;
      ultimoGeneradoRef.current = null;
      setMarkdown(null);
      setEditMode(false);
      setJobStatus("idle");
      setJobError(null);
      onSesionActualizada(data.sesion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [sesion.sesionId, onSesionActualizada, detenerPolling]);

  async function handleDescargar(formato: "pdf" | "docx") {
    if (!markdown) return;
    setDescargando(true);
    setError(null);
    try {
      if (formato === "pdf") {
        await exportToPdf(markdown, baseName, "reporte-sesion", "Reporte de sesión", "Fontana");
      } else {
        await exportToDocx(markdown, baseName, "reporte-sesion", "Fontana");
      }
    } catch {
      setError(`No se pudo generar el ${formato.toUpperCase()}.`);
    } finally {
      setDescargando(false);
      setSubmenuDescarga(false);
    }
  }

  const generando = jobStatus === "running";

  const bloqueGenerando = (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-bluegreen-eske/5 border border-bluegreen-eske/20 text-xs text-bluegreen-eske dark:text-blue-eske-20">
      <span className="w-4 h-4 border-2 border-bluegreen-eske border-t-transparent rounded-full animate-spin shrink-0" />
      <span>
        Generando el reporte… puede tardar un par de minutos. Puedes cambiar de pestaña y seguir
        usando Fontana; aparecerá aquí en cuanto esté listo.
      </span>
    </div>
  );

  const bloqueError = jobError && (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-red-eske/10 border border-red-eske/20 text-xs text-red-eske">
      <span>{jobError}</span>
      <button type="button" onClick={handleGenerar} className={`${BTN_OUTLINE} self-start`}>
        Reintentar
      </button>
    </div>
  );

  // ---------- Estado sin reporte ----------
  if (!sesion.reporteSesion) {
    return (
      <div className="px-4 md:px-8 py-14">
        <div className="max-w-xl mx-auto text-center flex flex-col items-center gap-4">
          <p className="text-black-eske dark:text-[#EAF2F8] font-medium">Reporte de sesión</p>
          <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] leading-relaxed">
            Organiza en un solo documento los indicadores de esta sesión —los heredados del
            proyecto y los que consultaste, tanto en el chat como en la tabla comparativa—, con
            la lectura estratégica de cada uno. Puedes editarlo, descargarlo y —si esta sesión
            viene de un proyecto— entregarlo a Moddulo.
          </p>
          {generando ? (
            <div className="w-full max-w-md text-left">{bloqueGenerando}</div>
          ) : jobStatus === "failed" ? (
            <div className="w-full max-w-md text-left">{bloqueError}</div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGenerar}
                disabled={nadaQueGenerar}
                className="px-5 py-2.5 bg-bluegreen-eske text-white rounded-lg text-sm font-semibold hover:bg-bluegreen-eske-60 transition-colors disabled:opacity-50"
              >
                Generar reporte
              </button>
              {nadaQueGenerar && (
                <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE]">
                  Esta sesión no tiene indicadores todavía: agrega alguno en la pestaña Indicadores
                  o consulta uno en el chat para poder generar el reporte.
                </p>
              )}
            </>
          )}
          {error && <p className="text-xs text-red-eske">{error}</p>}
        </div>
      </div>
    );
  }

  // ---------- Estado con reporte ----------
  return (
    <div className="px-4 md:px-8 py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={generando}
              onClick={async () => {
                if (editMode) {
                  await flushGuardado();
                  setEditMode(false);
                } else {
                  setEditMode(true);
                }
              }}
              className={BTN_OUTLINE}
            >
              {editMode ? "Guardar cambios" : "Editar texto"}
            </button>
            {guardado === "guardando" && <span className="text-xs text-black-eske-80 dark:text-[#9AAEBE]">Guardando…</span>}
            {guardado === "guardado" && <span className="text-xs text-green-eske">Guardado</span>}
            {guardado === "error" && <span className="text-xs text-red-eske">No se guardó — reintenta</span>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleGenerar} disabled={generando} className={BTN_OUTLINE}>
              {generando ? "Regenerando…" : "Regenerar"}
            </button>
            <InfoTooltip
              content="Úsalo cuando hayas consultado nuevos indicadores en Fontana y quieras incorporarlos al reporte ya generado — reconstruye el reporte completo desde el estado actual."
              placement="left"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setSubmenuDescarga((v) => !v)}
                disabled={descargando || !markdown}
                className="text-xs px-2.5 py-1 rounded-lg bg-bluegreen-eske text-white hover:bg-bluegreen-eske-60 transition-colors disabled:opacity-50"
              >
                {descargando ? "Descargando…" : "Descargar"}
              </button>
              {submenuDescarga && !descargando && (
                <div className="absolute right-0 mt-1 z-10 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A] shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleDescargar("pdf")}
                    className="block w-full text-left px-4 py-2 text-xs text-black-eske dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDescargar("docx")}
                    className="block w-full text-left px-4 py-2 text-xs text-black-eske dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
                  >
                    Word (.docx)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {generando && bloqueGenerando}
        {jobStatus === "failed" && bloqueError}

        {jobStatus === "idle" && hayContenidoNuevo(sesion.reporteSesion, idsActivos) && (
          <div className="flex gap-2.5 p-3 rounded-lg bg-yellow-eske/10 border border-yellow-eske/30 text-xs leading-snug text-[#816000] dark:text-yellow-eske/90">
            <span>
              Hay contenido nuevo en el Canvas desde el último reporte. Pulsa "Regenerar" para
              incluirlo — el reporte no se actualiza solo.
            </span>
          </div>
        )}

        {error && <p className="text-xs text-red-eske">{error}</p>}

        {cargando ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-bluegreen-eske border-t-transparent rounded-full animate-spin" />
          </div>
        ) : editMode ? (
          <textarea
            value={markdown ?? ""}
            onChange={(e) => handleEditarTexto(e.target.value)}
            className="min-h-[420px] w-full rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] p-4 text-sm text-black-eske dark:text-[#C7D6E0] leading-relaxed font-mono outline-none resize-y focus-visible:ring-2 focus-visible:ring-bluegreen-eske/30"
            aria-label="Editar el reporte de sesión"
          />
        ) : (
          <div className="min-h-[300px] w-full rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] p-5 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {markdown ?? ""}
            </ReactMarkdown>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {!editMode && markdown ? (
            <p className="text-xs text-gray-eske-50 dark:text-[#6D8294] max-w-md">
              Pulsa "Editar texto" para ajustar el reporte antes de descargarlo o entregarlo. Los
              cambios se guardan solos.
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting || generando}
            className="text-xs text-red-eske hover:underline disabled:opacity-50 shrink-0"
          >
            Eliminar reporte
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(false);
          }}
        >
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-black-eske dark:text-[#EAF2F8] text-base">
                ¿Eliminar el reporte de sesión?
              </h3>
              <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] mt-1.5 leading-relaxed">
                La pestaña Reporte volverá a su estado vacío y los botones para entregar o vincular
                a Moddulo quedarán deshabilitados hasta que generes uno nuevo. Un reporte que ya
                hayas entregado a Moddulo no se ve afectado.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-eske-60 hover:text-gray-eske-80 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminar}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium bg-red-eske text-white-eske rounded-lg hover:bg-red-eske/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
