// F3TareasPIP.tsx — M1: tablero de tareas del PIP. Cada tarea puede tener
// varias asignaciones (primaria + complementaria), cada una con su propio
// canal/estado/acción.
"use client";

import { useRef, useState } from "react";
import { uploadMedia } from "@/firebase/storageUtils";
import type { TareaPIP, AsignacionCanal, PIPItem, ProjectType, Territorio } from "@/types/moddulo.types";
import type { FamiliaMetodologica } from "@/types/f3.types";
import type { EvaluacionCompatibilidad } from "@/types/shared.types";
import { sugerirFamiliaMetodologica } from "@/lib/moddulo/sugerirFamiliaMetodologica";
import { asignacionEtiquetaCompleta } from "@/lib/moddulo/asignacionLabel";
import PillButton from "@/app/moddulo/components/PillButton";
import TerritorySelector from "@/app/components/shared/TerritorySelector";

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
  onGenerar: () => Promise<void>;
  onRefresh: () => void;
  generando: boolean;
}

export default function F3TareasPIP({
  projectId, pip, tareas, projectType, projectTerritory, readOnly, onGenerar, onRefresh, generando,
}: Props) {
  const [expandedAsignacionId, setExpandedAsignacionId] = useState<string | null>(null);

  if (tareas.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/40 dark:bg-[#112230] text-center">
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE] mb-3">
          Aún no se ha generado el tablero de tareas a partir del PIP heredado de F2.
        </p>
        {!readOnly && (
          <PillButton variant="solid" onClick={onGenerar} disabled={generando || pip.length === 0}>
            {generando ? "Generando…" : "Generar tablero (M1)"}
          </PillButton>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
          <div key={tarea.numero} className="rounded-lg border border-gray-eske-20 dark:border-white/10 p-3 bg-white-eske dark:bg-[#18324A]">
            <p className="text-xs lg:text-sm font-semibold text-bluegreen-eske dark:text-blue-eske-10">
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
                        <span className={`px-2 py-0.5 rounded text-xs lg:text-sm font-medium bg-gray-eske-10 dark:bg-white/10 ${
                          asig.canal === "canal1" && asig.tecnicaId ? "text-bluegreen-eske dark:text-bluegreen-eske-20" : "text-black-eske-80 dark:text-[#C5D8E8]"
                        }`}>
                          {asignacionEtiquetaCompleta(asig)}
                        </span>
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
                                projectId, numero: tarea.numero, asignacionId: asig.asignacionId,
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

                    {!readOnly && asig.estado !== "recibido" && (
                      <div className="mt-2">
                        <PillButton
                          onClick={() => setExpandedAsignacionId(expandedAsignacionId === asig.asignacionId ? null : asig.asignacionId)}
                          className="text-[11px] lg:text-xs dark:border-blue-eske-20 dark:text-blue-eske-20"
                        >
                          {asig.canal === "canal1" ? "Activar app" : asig.canal === "canal2" ? "Cargar archivo" : "Vincular fuente externa"}
                        </PillButton>
                      </div>
                    )}

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
                        {asig.canal === "canal1" && (
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

// Botón real de "Seleccionar archivo" — input oculto + botón estilizado que
// lo dispara, muestra el nombre elegido. Mismo patrón que el clip de ModduloChat.
function FileSelectButton({ file, onChange, label = "Seleccionar archivo" }: {
  file: File | null; onChange: (f: File | null) => void; label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      <PillButton type="button" variant="solid" onClick={() => inputRef.current?.click()} className="text-xs lg:text-sm shrink-0">
        {label}
      </PillButton>
      <span className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE] truncate">
        {file ? file.name : "Ningún archivo seleccionado"}
      </span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs lg:text-sm font-semibold text-black-eske-80 dark:text-[#C5D8E8] mb-1">{children}</label>;
}

const inputClass = "w-full text-xs lg:text-sm px-2 py-1.5 rounded border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230]";

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

// Canal 3 — mini-flujo de 2 pasos: paso 1 reutiliza TerritorySelector tal
// cual fue diseñado (con su propia navegación Atrás/Continuar — no se
// construye un selector nuevo), paso 2 trae el resto de los campos y el
// flujo evaluar→confirmar advertencias→vincular contra /canal3/evaluar y
// /canal3/vincular.
function VincularFuenteForm({ projectId, moduloPIP, projectType, projectTerritory, onDone, onCancel }: {
  projectId: string; moduloPIP: string; projectType: ProjectType; projectTerritory: Territorio | null; onDone: () => void; onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [territorio, setTerritorio] = useState<Territorio | null>(projectTerritory);

  const [file, setFile] = useState<File | null>(null);
  const [nombreHerramienta, setNombreHerramienta] = useState("");
  const [fechaObtencion, setFechaObtencion] = useState("");
  const [tipoProyectoDeclarado, setTipoProyectoDeclarado] = useState<ProjectType>(projectType);
  const [metodoDeclarado, setMetodoDeclarado] = useState("");
  const [familiaMetodologica, setFamiliaMetodologica] = useState<FamiliaMetodologica>("mixta");
  const [familiaTocadaManualmente, setFamiliaTocadaManualmente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [evaluando, setEvaluando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compatibilidad, setCompatibilidad] = useState<EvaluacionCompatibilidad | null>(null);
  const [confirmarTerritorio, setConfirmarTerritorio] = useState(false);
  const [confirmarVigencia, setConfirmarVigencia] = useState(false);
  const [archivoVinculado, setArchivoVinculado] = useState<string | null>(null);

  function handleMetodoChange(value: string) {
    setMetodoDeclarado(value);
    if (!familiaTocadaManualmente) setFamiliaMetodologica(sugerirFamiliaMetodologica(value));
  }

  const metadatosFuente = territorio
    ? { nombreHerramienta, territorioDeclarado: territorio, fechaObtencion, tipoProyectoDeclarado, metodoDeclarado, familiaMetodologica }
    : null;

  async function handleEvaluar() {
    if (!metadatosFuente || !nombreHerramienta || !fechaObtencion || !metodoDeclarado) return;
    setEvaluando(true);
    setError(null);
    try {
      const res = await fetch("/api/moddulo/f3/canal3/evaluar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, metadatosFuente }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudo evaluar la compatibilidad");
      setCompatibilidad(data.compatibilidad);
      setConfirmarTerritorio(false);
      setConfirmarVigencia(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEvaluando(false);
    }
  }

  const puedeVincular = !!compatibilidad
    && compatibilidad.pertinencia.cumple
    && (!compatibilidad.pertinencia.territorioRequiereConfirmacion || confirmarTerritorio)
    && (compatibilidad.vigencia.cumple || confirmarVigencia);

  async function handleVincular() {
    if (!file || !metadatosFuente || !puedeVincular) return;
    setLoading(true);
    setError(null);
    try {
      const ru = await fetch("/api/moddulo/f3/request-upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, formato: "documento", filename: file.name }),
      });
      const { resultadoId, storagePath } = await ru.json();
      if (!ru.ok) throw new Error("No se pudo reservar la subida");

      await uploadMedia(file, storagePath);

      const res = await fetch("/api/moddulo/f3/canal3/vincular", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, resultadoId, storagePath, nombre: file.name, tipo: file.type || "application/octet-stream",
          metadatosFuente, moduloPIP, cobertura: { completa: true },
          confirmarPeseATerritorio: confirmarTerritorio, confirmarPeseAVigencia: confirmarVigencia,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudo vincular la fuente");
      setArchivoVinculado(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (archivoVinculado) {
    return (
      <div className="space-y-2">
        <p className="text-xs lg:text-sm text-green-eske font-medium">
          ✓ Fuente vinculada: {archivoVinculado} — apruébala en M2 (Resultados Recibidos) para vincularla a esta tarea.
        </p>
        <PillButton variant="solid" onClick={onDone}>Cerrar</PillButton>
      </div>
    );
  }

  if (step === 1) {
    return (
      <TerritorySelector
        territorio={territorio}
        onChange={setTerritorio}
        onNext={() => setStep(2)}
        onBack={onCancel}
        label="¿Qué territorio declara cubrir esta fuente/herramienta?"
      />
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <FieldLabel>Archivo</FieldLabel>
        <FileSelectButton file={file} onChange={setFile} />
      </div>
      <div>
        <FieldLabel>Nombre de la herramienta/estudio</FieldLabel>
        <input value={nombreHerramienta} onChange={(e) => setNombreHerramienta(e.target.value)} className={inputClass} />
      </div>
      <div>
        <FieldLabel>Fecha de obtención</FieldLabel>
        <input type="date" onChange={(e) => setFechaObtencion(e.target.value ? new Date(e.target.value).toISOString() : "")} className={inputClass} />
      </div>
      <div>
        <FieldLabel>Tipo de proyecto declarado</FieldLabel>
        <select value={tipoProyectoDeclarado} onChange={(e) => setTipoProyectoDeclarado(e.target.value as ProjectType)} className={inputClass}>
          <option value="electoral">Electoral</option>
          <option value="gubernamental">Gubernamental</option>
          <option value="legislativo">Legislativo</option>
          <option value="ciudadano">Ciudadano</option>
        </select>
      </div>
      <div>
        <FieldLabel>Método declarado</FieldLabel>
        <input
          placeholder="Ej. Encuesta cara a cara, contratada con terceros"
          value={metodoDeclarado}
          onChange={(e) => handleMetodoChange(e.target.value)}
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

      {error && <p className="text-xs lg:text-sm text-yellow-eske-70">{error}</p>}

      {!compatibilidad && (
        <div className="flex gap-2">
          <PillButton
            variant="solid"
            onClick={handleEvaluar}
            disabled={evaluando || !nombreHerramienta || !fechaObtencion || !metodoDeclarado}
          >
            {evaluando ? "Evaluando…" : "Evaluar compatibilidad"}
          </PillButton>
          <PillButton onClick={onCancel} disabled={evaluando} className="dark:border-blue-eske-20 dark:text-blue-eske-20">Cancelar</PillButton>
        </div>
      )}

      {compatibilidad && !compatibilidad.pertinencia.cumple && (
        <div className="space-y-2">
          <p className="text-xs lg:text-sm text-red-eske">{compatibilidad.pertinencia.detalle}</p>
          <div className="flex gap-2">
            <PillButton onClick={() => setCompatibilidad(null)} className="dark:border-blue-eske-20 dark:text-blue-eske-20">Editar y reintentar</PillButton>
            <PillButton onClick={onCancel} className="dark:border-blue-eske-20 dark:text-blue-eske-20">Cancelar</PillButton>
          </div>
        </div>
      )}

      {compatibilidad && compatibilidad.pertinencia.cumple && (
        <div className="space-y-2 rounded-md border border-gray-eske-20 dark:border-white/10 p-2">
          <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">{compatibilidad.pertinencia.detalle}</p>
          {compatibilidad.pertinencia.territorioRequiereConfirmacion && (
            <label className="flex items-start gap-2 text-xs lg:text-sm text-yellow-eske-70">
              <input type="checkbox" checked={confirmarTerritorio} onChange={(e) => setConfirmarTerritorio(e.target.checked)} className="mt-0.5" />
              <span>{compatibilidad.pertinencia.territorioDetalle} Confirmo que es el mismo territorio pese a la diferencia.</span>
            </label>
          )}
          {!compatibilidad.vigencia.cumple && (
            <label className="flex items-start gap-2 text-xs lg:text-sm text-yellow-eske-70">
              <input type="checkbox" checked={confirmarVigencia} onChange={(e) => setConfirmarVigencia(e.target.checked)} className="mt-0.5" />
              <span>{compatibilidad.vigencia.detalle} Confirmo que quiero usar este dato pese a la fecha.</span>
            </label>
          )}
          <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">{compatibilidad.compatibilidadMetodologica.detalle}</p>

          <div className="flex gap-2">
            <PillButton variant="solid" onClick={handleVincular} disabled={loading || !file || !puedeVincular}>
              {loading ? "Vinculando…" : "Vincular fuente"}
            </PillButton>
            <PillButton onClick={() => setCompatibilidad(null)} disabled={loading} className="dark:border-blue-eske-20 dark:text-blue-eske-20">
              Volver a evaluar
            </PillButton>
            <PillButton onClick={onCancel} disabled={loading} className="dark:border-blue-eske-20 dark:text-blue-eske-20">Cancelar</PillButton>
          </div>
        </div>
      )}
    </div>
  );
}
