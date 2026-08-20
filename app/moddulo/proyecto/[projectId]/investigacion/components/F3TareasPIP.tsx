// F3TareasPIP.tsx — M1: tablero de tareas del PIP. Cada tarea puede tener
// varias asignaciones (primaria + complementaria), cada una con su propio
// canal/estado/acción.
"use client";

import { useState } from "react";
import Link from "next/link";
import { uploadMedia } from "@/firebase/storageUtils";
import type { TareaPIP, AsignacionCanal, PIPItem, ProjectType, Territorio } from "@/types/moddulo.types";
import type { FamiliaMetodologica } from "@/types/f3.types";
import { sugerirFamiliaMetodologica } from "@/lib/moddulo/sugerirFamiliaMetodologica";
import { asignacionEtiquetaCompleta } from "@/lib/moddulo/asignacionLabel";
import PillButton from "@/app/moddulo/components/PillButton";
import VincularFuenteForm from "./VincularFuenteForm";
import { FieldLabel, FileSelectButton, inputClass } from "./F3FormHelpers";

const ESTADO_LABELS: Record<AsignacionCanal["estado"], string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  recibido: "Recibido",
  derivado: "Derivado",
};

// Mismo esquema de 3 colores que el semáforo de F3CoberturaSidebar.tsx:
// naranja (pendiente), amarillo (en curso), verde (recibido/derivado/cubierta).
// En modo oscuro, "en_curso" necesita su propia variante — bg-yellow-eske/20
// + text-black-eske se ve grisáceo (bajo contraste) sobre fondo oscuro.
const ESTADO_COLORS: Record<AsignacionCanal["estado"], string> = {
  pendiente: "bg-orange-eske/15 text-orange-eske",
  en_curso: "bg-yellow-eske/20 text-black-eske dark:bg-yellow-eske/20 dark:text-yellow-eske",
  recibido: "bg-green-eske/15 text-green-eske",
  derivado: "bg-green-eske/15 text-green-eske",
};

interface Props {
  projectId: string;
  pip: PIPItem[];
  tareas: TareaPIP[];
  projectType: ProjectType;
  projectTerritory: Territorio | null;
  readOnly?: boolean;
  onGenerar: (confirmar?: boolean) => Promise<void>;
  conflictoRegenerar: {
    mensaje: string;
    resumen: { conResultadoAprobado: number; desactivadas: number; tareasAfectadas: { numero: number; pregunta: string; motivos: string[] }[] };
  } | null;
  onCancelarConflicto: () => void;
  onRefresh: () => void;
  generando: boolean;
  // Piezas 1/2 del plan de escenarios (b)/(c) (2026-08-19) — resultado de
  // Fontana pendiente de vincular (escrito por vincular-moddulo). El
  // banner solo se muestra si el proyecto lo trae; se limpia al confirmar
  // la vinculación (PATCH de fontanaPendiente:null vía onDismissFontanaPendiente).
  fontanaPendiente?: { sesionId: string; territorio: Territorio; fechaCreacion: string } | null;
  onDismissFontanaPendiente?: () => void;
}

export default function F3TareasPIP({
  projectId, pip, tareas, projectType, projectTerritory, readOnly, onGenerar, conflictoRegenerar, onCancelarConflicto, onRefresh, generando,
  fontanaPendiente, onDismissFontanaPendiente,
}: Props) {
  const [expandedAsignacionId, setExpandedAsignacionId] = useState<string | null>(null);
  // "externo" — id sintético reservado para el formulario fuera del loop de
  // tareas (botón "Vincular resultado externo" y el banner de Fontana
  // pendiente comparten este mismo slot, nunca 2 formularios abiertos a la
  // vez con el resto de las asignaciones).
  const externoAbierto = expandedAsignacionId === "externo";

  // Pieza 2 (2026-08-19) — cabecera compartida por ambos returns: banner de
  // Fontana pendiente (si lo hay) + botón "Vincular resultado externo",
  // siempre visible/independiente de si M1 ya generó tareas o no — el
  // backend de Canal 3 nunca exigió una asignación M1 para funcionar.
  const cabeceraExterna = !readOnly && (
    <div className="space-y-2">
      {fontanaPendiente && !externoAbierto && (
        <div className="flex items-center justify-between gap-2 bg-bluegreen-eske/5 dark:bg-blue-eske-20/10 border border-bluegreen-eske/20 dark:border-blue-eske-20/30 rounded-lg p-2.5">
          <p className="text-xs lg:text-sm text-black-eske dark:text-[#EAF2F8]">
            Tienes un resultado de Fontana pendiente de vincular a este proyecto
            {fontanaPendiente.territorio.nombre ? ` (${fontanaPendiente.territorio.nombre})` : ""}.
          </p>
          <PillButton variant="solid" onClick={() => setExpandedAsignacionId("externo")} className="shrink-0 whitespace-nowrap">
            Vincular ahora
          </PillButton>
        </div>
      )}
      {!externoAbierto ? (
        <PillButton onClick={() => setExpandedAsignacionId("externo")} className="dark:border-blue-eske-20 dark:text-blue-eske-20">
          Vincular resultado externo
        </PillButton>
      ) : (
        <div className="rounded-md border border-gray-eske-20 dark:border-white/10 p-2">
          <VincularFuenteForm
            projectId={projectId}
            moduloPIP={fontanaPendiente ? `Resultado de Fontana${fontanaPendiente.territorio.nombre ? ` — ${fontanaPendiente.territorio.nombre}` : ""}` : "Resultado externo"}
            projectType={projectType}
            projectTerritory={fontanaPendiente?.territorio ?? projectTerritory}
            fontanaSesionId={fontanaPendiente?.sesionId}
            onDone={() => {
              setExpandedAsignacionId(null);
              if (fontanaPendiente) onDismissFontanaPendiente?.();
              onRefresh();
            }}
            onCancel={() => setExpandedAsignacionId(null)}
          />
        </div>
      )}
    </div>
  );

  if (tareas.length === 0) {
    return (
      <div className="space-y-3">
        {cabeceraExterna}
        <div className="p-4 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/40 dark:bg-[#112230] text-center">
        {conflictoRegenerar ? (
          <div className="text-left bg-yellow-eske-10 dark:bg-yellow-eske-80/10 border border-yellow-eske-30 dark:border-yellow-eske-60/40 rounded-lg p-3">
            <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8] mb-2">
              {conflictoRegenerar.mensaje}
            </p>
            {conflictoRegenerar.resumen.tareasAfectadas.length > 0 && (
              <ul className="text-xs text-black-eske dark:text-[#C7D6E0] space-y-1 mb-2">
                {conflictoRegenerar.resumen.tareasAfectadas.map((t) => (
                  <li key={t.numero}>
                    <span className="font-medium">P{t.numero} — {t.pregunta}:</span>{" "}
                    {t.motivos.join("; ")}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-end gap-2 mt-2">
              <PillButton variant="outline" onClick={onCancelarConflicto} disabled={generando}>
                Cancelar
              </PillButton>
              <PillButton variant="solid" onClick={() => onGenerar(true)} disabled={generando}>
                {generando ? "Regenerando…" : "Sí, perder el progreso y regenerar"}
              </PillButton>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE] mb-3">
              Aún no se ha generado el tablero de tareas a partir del PIP heredado de F2.
            </p>
            {!readOnly && (
              <PillButton variant="solid" onClick={() => onGenerar(false)} disabled={generando || pip.length === 0}>
                {generando ? "Generando…" : "Generar tablero (M1)"}
              </PillButton>
            )}
          </>
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cabeceraExterna}
      {tareas.map((tarea) => {
        const item = pip.find((p) => p.numero === tarea.numero);
        // Defensivo: proyectos con datos del esquema anterior a asignaciones[]
        // (normalizados en getProject(), pero este componente puede recibir
        // datos de otras fuentes, ej. la respuesta directa de tareas/generar)
        // no deben tronar el render — mismo criterio que f3Suficiencia.ts.
        // Orden de render: canal1 primero, luego canal2/canal3 — sort
        // estable, no depende de que M1/Claude ya las devuelva así, y no
        // se persiste (solo afecta el orden visual de esta pasada).
        const asignaciones = [...(tarea.asignaciones ?? [])].sort(
          (a, b) => (a.canal === "canal1" ? 0 : 1) - (b.canal === "canal1" ? 0 : 1)
        );
        return (
          <div key={tarea.pipItemId} className="rounded-lg border border-gray-eske-20 dark:border-white/10 p-3 bg-white-eske dark:bg-[#18324A]">
            <p className="text-xs lg:text-sm font-semibold text-bluegreen-eske dark:text-blue-eske-20">
              P{tarea.numero} — {item?.pregunta ?? "Necesidad de información"}
            </p>

            <div className="mt-2 space-y-2">
              {asignaciones.map((asig) => {
                const disponible = asig.canal !== "canal1" || asig.estadoApp !== "proximamente";
                return (
                  <div key={asig.asignacionId} className="rounded-md border border-gray-eske-20 dark:border-white/10 p-2">
                    {/* La etiqueta (izquierda) y el bloque activar/desactivar
                        + badge de estado (derecha) forman las dos columnas
                        de este flex row — el párrafo de justificación va
                        FUERA de esta fila (no anidado en la columna
                        izquierda) para que use el 100% del ancho de la
                        tarjeta, en vez de heredar el ancho reducido que esa
                        columna deja libre para la derecha. */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
                        {/* La etiqueta ES el botón de acción (2026-08-19) —
                            antes había un PillButton "Activar app"/"Cargar
                            archivo"/"Vincular fuente externa" aparte, debajo.
                            Mismo destino/acción que tenía ese botón, mismo
                            gate de disponibilidad (!readOnly && no recibido)
                            — sin ese gate, se queda como <span> plano (sin
                            estilo de botón, nada que activar). */}
                        {(() => {
                          const clicable = !readOnly && asig.estado !== "recibido";
                          const esLinkDirecto = asig.canal === "canal1" && asig.tecnicaId === "T10" && disponible;
                          const baseClass = "px-2 py-0.5 rounded text-xs lg:text-sm bg-gray-eske-10 dark:bg-white/10";
                          // Nombres de app en negritas en modo claro (destacan
                          // sobre "Acción a realizar..."); en modo oscuro
                          // mismo peso y mismo color de texto que "Acción a
                          // realizar" — no un tono de acento aparte. Cuando es
                          // clicable, mismo azul ya usado por el PillButton
                          // que reemplaza (bluegreen-eske-60/blue-eske-20),
                          // sin importar el canal.
                          const colorClass = clicable
                            ? "font-bold text-bluegreen-eske-60 dark:text-blue-eske-20 cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske focus-visible:ring-offset-1"
                            : asig.canal === "canal1" && asig.tecnicaId
                              ? "font-bold text-bluegreen-eske dark:font-medium dark:text-[#C5D8E8]"
                              : "font-medium text-black-eske-80 dark:text-[#C5D8E8]";
                          const etiqueta = asignacionEtiquetaCompleta(asig);
                          if (!clicable) {
                            return <span className={`${baseClass} ${colorClass}`}>{etiqueta}</span>;
                          }
                          if (esLinkDirecto) {
                            // Único destino real de Canal 1 hoy — navega
                            // directo, no alterna el panel expandido (no hay
                            // nada que expandir: la acción ES la navegación).
                            return (
                              <Link
                                href={`/centinela/fontana?moddulo_project_id=${projectId}&tarea_pip=${tarea.pipItemId}`}
                                className={`${baseClass} ${colorClass}`}
                              >
                                {etiqueta}
                              </Link>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => setExpandedAsignacionId(expandedAsignacionId === asig.asignacionId ? null : asig.asignacionId)}
                              className={`${baseClass} ${colorClass}`}
                            >
                              {etiqueta}
                            </button>
                          );
                        })()}
                      </div>
                      {/* Responsivo en una sola estructura: en sm: y superior
                          el select queda a la izquierda del badge en la
                          misma línea (desktop); por debajo de sm: el badge
                          cae a una segunda línea, ambos alineados a la
                          derecha. */}
                      <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
                        <select
                          value={asig.activada ? "activada" : "desactivada"}
                          disabled={readOnly}
                          onChange={async (e) => {
                            await fetch("/api/moddulo/f3/tareas/aprobar", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                projectId, pipItemId: tarea.pipItemId, asignacionId: asig.asignacionId,
                                activada: e.target.value === "activada",
                              }),
                            });
                            onRefresh();
                          }}
                          className="text-[10px] lg:text-xs px-1.5 py-0.5 rounded border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske-80 dark:text-[#C5D8E8]"
                        >
                          <option value="activada">Activada</option>
                          <option value="desactivada">Desactivada</option>
                        </select>
                        {/* invisible (no hidden/no renderizado condicional):
                            conserva el espacio del layout al desactivar —
                            estado interno no cambia, solo deja de verse. */}
                        <span className={`px-2 py-0.5 rounded-full text-xs lg:text-sm font-medium ${ESTADO_COLORS[asig.estado]} ${!asig.activada ? "invisible" : ""}`}>
                          {ESTADO_LABELS[asig.estado]}
                        </span>
                      </div>
                    </div>
                    {/* Bloque propio de ancho completo (no compite con los
                        demás badges dentro de la fila flex-wrap de arriba) —
                        border-radius reducido (discreto, no pill) y texto
                        más pequeño para que quepa en una sola línea incluso
                        en mobile. */}
                    {asig.canal === "canal1" && !disponible && (
                      <div className="mt-1.5 px-2 py-1 rounded text-[11px] lg:text-xs font-medium bg-yellow-eske/15 text-black-eske dark:bg-yellow-eske-10 dark:text-black-eske">
                        No disponible aún — derivado a carga manual
                      </div>
                    )}
                    <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE] mt-1">{asig.justificacion}</p>

                    {expandedAsignacionId === asig.asignacionId && !readOnly && (
                      <div className="mt-3 pt-3 border-t border-gray-eske-20 dark:border-white/10">
                        {asig.canal === "canal2" && (
                          <CargaManualForm
                            projectId={projectId}
                            moduloPIP={item?.pregunta ?? `Tarea ${tarea.numero}`}
                            onDone={() => { setExpandedAsignacionId(null); onRefresh(); }}
                            onCancel={() => setExpandedAsignacionId(null)}
                          />
                        )}
                        {asig.canal === "canal3" && (
                          <VincularFuenteForm
                            projectId={projectId}
                            moduloPIP={item?.pregunta ?? `Tarea ${tarea.numero}`}
                            projectType={projectType}
                            projectTerritory={projectTerritory}
                            onDone={() => { setExpandedAsignacionId(null); onRefresh(); }}
                            onCancel={() => setExpandedAsignacionId(null)}
                          />
                        )}
                        {asig.canal === "canal1" && !(asig.tecnicaId === "T10" && disponible) && (
                          <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">
                            Activación de apps del ecosistema aún no está disponible como
                            integración automática — usa carga manual o vincula una herramienta externa mientras tanto.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CargaManualForm({ projectId, moduloPIP, onDone, onCancel }: {
  projectId: string; moduloPIP: string; onDone: () => void; onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fuente, setFuente] = useState("");
  const [fechaObtencion, setFechaObtencion] = useState("");
  const [tecnicaDescrita, setTecnicaDescrita] = useState("");
  const [familiaMetodologica, setFamiliaMetodologica] = useState<FamiliaMetodologica>("mixta");
  const [familiaTocadaManualmente, setFamiliaTocadaManualmente] = useState(false);
  const [formato, setFormato] = useState<"documento" | "audio" | "video" | "imagen" | "texto">("documento");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivoSubido, setArchivoSubido] = useState<string | null>(null);

  function handleTecnicaChange(value: string) {
    setTecnicaDescrita(value);
    if (!familiaTocadaManualmente) setFamiliaMetodologica(sugerirFamiliaMetodologica(value));
  }

  async function handleSubmit() {
    if (!file || !fuente || !fechaObtencion) return;
    setLoading(true);
    setError(null);
    try {
      const ru = await fetch("/api/moddulo/f3/request-upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, formato, filename: file.name }),
      });
      const { resultadoId, storagePath } = await ru.json();
      if (!ru.ok) throw new Error("No se pudo reservar la subida");

      await uploadMedia(file, storagePath);

      const confirm = await fetch("/api/moddulo/f3/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, resultadoId, storagePath, nombre: file.name, tipo: file.type || "application/octet-stream",
          metadatosCarga: { fuente, fechaObtencion, tecnicaDescrita, familiaMetodologica, formato },
          moduloPIP, cobertura: { completa: true },
        }),
      });
      if (!confirm.ok) throw new Error("No se pudo confirmar la carga");
      // No se limpia el archivo en Storage si el usuario cancela ANTES de
      // este punto (request-upload ya reservó la ruta) — un archivo subido
      // sin confirmar simplemente no se referencia en ningún lado. Si en el
      // futuro se necesita una política de retención/limpieza de huérfanos,
      // se agrega aquí; no aplica todavía.
      setArchivoSubido(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (archivoSubido) {
    return (
      <div className="space-y-2">
        <p className="text-xs lg:text-sm text-green-eske font-medium">
          ✓ Archivo subido: {archivoSubido} — apruébalo en M2 (Resultados Recibidos) para vincularlo a esta tarea.
        </p>
        <PillButton variant="solid" onClick={onDone}>Cerrar</PillButton>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <FieldLabel>Archivo</FieldLabel>
        <FileSelectButton file={file} onChange={setFile} />
      </div>
      <div>
        <FieldLabel>Fuente</FieldLabel>
        <input placeholder="Ej. Entrevista con dirigente local" value={fuente} onChange={(e) => setFuente(e.target.value)} className={inputClass} />
      </div>
      <div>
        <FieldLabel>Fecha de obtención</FieldLabel>
        <input type="date" onChange={(e) => setFechaObtencion(e.target.value ? new Date(e.target.value).toISOString() : "")} className={inputClass} />
      </div>
      <div>
        <FieldLabel>Técnica</FieldLabel>
        <input
          placeholder="Ej. Entrevista a profundidad, Encuesta telefónica propia, Revisión documental"
          value={tecnicaDescrita}
          onChange={(e) => handleTecnicaChange(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <FieldLabel>Familia metodológica (sugerida, editable)</FieldLabel>
        <select
          value={familiaMetodologica}
          onChange={(e) => { setFamiliaMetodologica(e.target.value as FamiliaMetodologica); setFamiliaTocadaManualmente(true); }}
          className={inputClass}
        >
          <option value="cuantitativa">Cuantitativa</option>
          <option value="cualitativa">Cualitativa</option>
          <option value="documental">Documental</option>
          <option value="mixta">Mixta</option>
        </select>
      </div>
      <div>
        <FieldLabel>Tipo de archivo</FieldLabel>
        <select value={formato} onChange={(e) => setFormato(e.target.value as typeof formato)} className={inputClass}>
          <option value="documento">Documento</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
          <option value="imagen">Imagen</option>
          <option value="texto">Texto</option>
        </select>
      </div>
      {error && <p className="text-xs lg:text-sm text-red-eske">{error}</p>}
      <div className="flex gap-2">
        <PillButton variant="solid" onClick={handleSubmit} disabled={loading || !file || !fuente || !fechaObtencion}>
          {loading ? "Subiendo…" : "Confirmar carga"}
        </PillButton>
        <PillButton onClick={onCancel} disabled={loading} className="dark:border-blue-eske-20 dark:text-blue-eske-20">Cancelar</PillButton>
      </div>
    </div>
  );
}

