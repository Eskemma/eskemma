// app/moddulo/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PHASE_NAMES, PROJECT_TYPE_LABELS } from "@/types/moddulo.types";
import type { ModduloProject } from "@/types/moddulo.types";
import { DIAS_RETENCION_PROYECTOS, diasRestantesEnPapelera } from "@/lib/moddulo/papelera";
import ErrorCarga from "@/app/components/shared/ErrorCarga";
import {
  decidirEstadoLista,
  type EstadoLista,
  type RespuestaGuardado,
} from "@/lib/moddulo/guardadoHonesto";

// Mismo patrón ya usado por el hub de PESTEL (app/centinela/pestel/page.tsx):
// un Timestamp de Admin SDK llega serializado como {_seconds, _nanoseconds}.
function toMs(value: unknown): number {
  if (!value) return Date.now();
  if (typeof value === "object" && value !== null && "_seconds" in value) {
    return (value as { _seconds: number })._seconds * 1000;
  }
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

function formatDate(value: unknown): string {
  return new Date(toMs(value)).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

type EstadoCarga = "cargando" | EstadoLista;

/**
 * Loads a project list and classifies it as cargado / vacio / fallido (never
 * "vacio" on a failure). Decision in lib/moddulo/guardadoHonesto.ts.
 */
async function cargarListaProyectos(
  url: string,
  lista: string,
  plural = false
): Promise<{ estado: EstadoLista; mensajeError: string | null; items: ModduloProject[] }> {
  let resp: RespuestaGuardado;
  let items: ModduloProject[] = [];
  try {
    const r = await fetch(url, { credentials: "include" });
    let cuerpoValido: boolean | undefined;
    if (r.ok) {
      try {
        const data = (await r.json()) as { projects?: unknown };
        cuerpoValido = Array.isArray(data?.projects);
        if (cuerpoValido) items = data.projects as ModduloProject[];
      } catch {
        cuerpoValido = false;
      }
    }
    resp = { tipo: "respuesta", ok: r.ok, status: r.status, cuerpoValido };
  } catch {
    resp = { tipo: "error_red" };
  }
  return { ...decidirEstadoLista(resp, items.length, { lista, plural }), items };
}

export default function ModduloPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ModduloProject[]>([]);
  const [estadoProyectos, setEstadoProyectos] = useState<EstadoCarga>("cargando");
  const [errorProyectos, setErrorProyectos] = useState<string | null>(null);
  const [papeleraProjects, setPapeleraProjects] = useState<ModduloProject[]>([]);
  const [estadoPapelera, setEstadoPapelera] = useState<EstadoCarga>("cargando");
  const [errorPapelera, setErrorPapelera] = useState<string | null>(null);
  const isLoading = estadoProyectos === "cargando";

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  const cargarProyectos = useCallback(async () => {
    setEstadoProyectos("cargando");
    const r = await cargarListaProyectos("/api/moddulo/projects", "tus proyectos", true);
    if (r.estado !== "fallido") setProjects(r.items);
    setErrorProyectos(r.mensajeError);
    setEstadoProyectos(r.estado);
  }, []);

  const cargarPapelera = useCallback(async () => {
    setEstadoPapelera("cargando");
    const r = await cargarListaProyectos("/api/moddulo/projects/papelera", "la papelera");
    if (r.estado !== "fallido") setPapeleraProjects(r.items);
    setErrorPapelera(r.mensajeError);
    setEstadoPapelera(r.estado);
  }, []);

  useEffect(() => {
    if (!user) return;
    void cargarProyectos();
    void cargarPapelera();
  }, [user, cargarProyectos, cargarPapelera]);

  // Al mover a papelera, el proyecto desaparece de "Mis proyectos" y aparece
  // en la sección Papelera de inmediato (sin esperar un refetch) — deletedAt
  // se sintetiza con la hora del cliente solo para mostrar "se elimina en N
  // días" de inmediato; el valor real que manda es el que escribió el
  // servidor (serverTimestamp), esto es solo una aproximación visual.
  // (Verificado 26-09-28: a diferencia de handleRestored de abajo, esta función
  // YA era pura en sus 2 updaters — project viene de un argumento, no de leer
  // `prev` de una de las 2 listas dentro del updater de la otra — así que no
  // tenía el mismo riesgo de duplicado por doble invocación en Strict Mode.)
  function handleMovedToPapelera(project: ModduloProject) {
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    setPapeleraProjects((prev) => [
      { ...project, deletedAt: { _seconds: Math.floor(Date.now() / 1000) } as never, deletedBy: user?.uid },
      ...prev,
    ]);
  }

  // Bug real (26-09-28, verificación de fase (b)): la versión anterior llamaba
  // setProjects() DESDE DENTRO del updater de setPapeleraProjects — un updater de
  // React debe ser puro (sin efectos secundarios). En desarrollo, Strict Mode
  // invoca cada updater DOS VECES a propósito para detectar justo esta clase de
  // impureza; la llamada anidada a setProjects se ejecutaba en ambas invocaciones,
  // duplicando el proyecto restaurado en "Mis proyectos" (warning real de React:
  // "Encountered two children with the same key"). Fix: leer `found` del estado ya
  // renderizado (closure, no de un `prev` dentro de un updater) y disparar los 2
  // setState como actualizaciones independientes y puras — ninguna llama a la otra.
  function handleRestored(id: string) {
    const found = papeleraProjects.find((p) => p.id === id);
    setPapeleraProjects((prev) => prev.filter((p) => p.id !== id));
    if (found) {
      const { deletedAt: _deletedAt, deletedBy: _deletedBy, ...rest } = found;
      setProjects((prev) => [rest as ModduloProject, ...prev]);
    }
  }

  // Eliminación DEFINITIVA (Punto 4, fase c): a diferencia de handleRestored,
  // solo quita la tarjeta — no hay a dónde moverla. Un solo updater puro,
  // sin el riesgo de doble-invocación de Strict Mode que tenía handleRestored.
  function handlePurgedDefinitivo(id: string) {
    setPapeleraProjects((prev) => prev.filter((p) => p.id !== id));
  }

  function handleStatusChange(id: string, newStatus: ModduloProject["status"]) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );
  }

  function handleMetaChange(id: string, meta: Pick<ModduloProject, "name" | "description" | "color">) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...meta } : p))
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-eske-10 dark:bg-[#112230]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-bluegreen-eske border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      {/* Hero */}
      <section className="relative min-h-50 max-sm:min-h-40 w-full flex items-center justify-center bg-bluegreen-eske overflow-hidden">
        <Image
          src="/images/yanmin_yang.jpg"
          alt="Imagen de fondo Moddulo"
          fill
          style={{ objectFit: "cover" }}
          className="object-cover"
          priority
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-bluegreen-eske dark:bg-bluegreen-eske-80 opacity-75" aria-hidden="true" />
        <div className="relative z-10 text-center text-white-eske px-4 sm:px-6 md:px-8 max-w-7xl mx-auto w-full py-8 max-sm:py-6">
          <h1 className="text-[36px] max-sm:text-2xl leading-tight font-bold">Moddulo</h1>
          <p className="mt-4 max-sm:mt-2 text-[18px] max-sm:text-base leading-relaxed font-light">
            El colaborador estratégico para tus proyectos políticos de alto impacto.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="bg-white-eske dark:bg-[#0B1620] py-12 max-sm:py-8 px-4 sm:px-6 md:px-8">
        <div className="w-[90%] mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl max-sm:text-xl font-semibold text-bluegreen-eske dark:text-[#6BA4C6]">
                Mis proyectos
              </h2>
              <p className="text-base font-light text-gray-eske-60 mt-1">
                {projects.length > 0
                  ? `${projects.length} proyecto${projects.length !== 1 ? "s" : ""} en curso`
                  : "Aquí aparecerán tus proyectos estratégicos"}
              </p>
            </div>
            <Link
              href="/moddulo/proyecto/nuevo"
              className="shrink-0 px-5 py-2.5 bg-bluegreen-eske text-white-eske rounded-lg font-medium hover:bg-bluegreen-eske/90 transition-colors text-sm"
            >
              + Nuevo proyecto
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-bluegreen-eske border-t-transparent" />
            </div>
          ) : estadoProyectos === "fallido" ? (
            <ErrorCarga mensaje={errorProyectos} onReintentar={cargarProyectos} />
          ) : projects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onStatusChange={handleStatusChange}
                  onMetaChange={handleMetaChange}
                  onMovedToPapelera={handleMovedToPapelera}
                />
              ))}
            </div>
          )}

          {estadoPapelera === "fallido" && (
            <ErrorCarga compacto mensaje={errorPapelera} onReintentar={cargarPapelera} />
          )}

          {estadoPapelera !== "cargando" && estadoPapelera !== "fallido" && papeleraProjects.length > 0 && (
            <PapeleraSection
              projects={papeleraProjects}
              onRestored={handleRestored}
              onPurged={handlePurgedDefinitivo}
            />
          )}
        </div>
      </section>
    </main>
  );
}

// ==========================================
// SECCIÓN PAPELERA
// ==========================================

function PapeleraSection({
  projects,
  onRestored,
  onPurged,
}: {
  projects: ModduloProject[];
  onRestored: (id: string) => void;
  onPurged: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-12 border-t border-gray-eske-20 dark:border-white/10 pt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-black-eske-20 dark:text-[#9AAEBE] hover:text-black-eske-40 dark:hover:text-[#C7D6E0] transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Papelera ({projects.length})
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
          {projects.map((project) => (
            <PapeleraCard
              key={project.id}
              project={project}
              onRestored={onRestored}
              onPurged={onPurged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PapeleraCard({
  project,
  onRestored,
  onPurged,
}: {
  project: ModduloProject;
  onRestored: (id: string) => void;
  onPurged: (id: string) => void;
}) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const dias = diasRestantesEnPapelera(toMs(project.deletedAt));

  async function handleRestore() {
    setIsRestoring(true);
    setError(null);
    try {
      const r = await fetch(`/api/moddulo/projects/${project.id}/restore`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error ?? "No se pudo restaurar el proyecto.");
        return;
      }
      onRestored(project.id!);
    } catch {
      setError("Error de conexión al restaurar.");
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 p-5 opacity-80">
      <h3 className="font-semibold text-gray-eske-80 dark:text-[#C7D6E0] truncate mb-1">{project.name}</h3>
      <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE]">
        Eliminado el {formatDate(project.deletedAt)} · se elimina definitivamente en {dias} día{dias !== 1 ? "s" : ""}
      </p>
      {error && <p className="text-xs text-red-eske mt-2">{error}</p>}
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={handleRestore}
          disabled={isRestoring}
          className="px-3 py-1.5 text-xs font-medium bg-bluegreen-eske text-white-eske rounded-lg hover:bg-bluegreen-eske/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isRestoring && (
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Restaurar
        </button>
        <button
          type="button"
          onClick={() => setConfirmPurge(true)}
          className="px-3 py-1.5 text-xs font-medium text-red-eske hover:bg-red-eske/10 rounded-lg transition-colors"
        >
          Eliminar definitivamente
        </button>
      </div>
      {confirmPurge && (
        <PurgeNowModal
          projectId={project.id!}
          projectName={project.name}
          onPurged={() => { onPurged(project.id!); setConfirmPurge(false); }}
          onCancel={() => setConfirmPurge(false)}
        />
      )}
    </div>
  );
}

// ==========================================
// MODAL DE CONFIRMACIÓN — ELIMINAR DEFINITIVAMENTE
// ==========================================

function PurgeNowModal({
  projectId,
  projectName,
  onPurged,
  onCancel,
}: {
  projectId: string;
  projectName: string;
  onPurged: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [isPurging, setIsPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === projectName;

  async function handlePurge() {
    if (!matches) return;
    setIsPurging(true);
    setError(null);
    try {
      const r = await fetch(`/api/moddulo/projects/${projectId}/purge-now`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: typed.trim() }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error ?? "No se pudo eliminar el proyecto.");
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (data.modoReal === false) {
        // Modo simulación (todavía no autorizado por Raúl): el servidor no
        // borró nada de verdad, solo registró qué se habría borrado. No se
        // le miente al usuario diciendo "eliminado" — se le avisa.
        setError("Modo simulación activo: se registró qué se borraría, pero nada se eliminó todavía.");
        return;
      }
      onPurged();
    } catch {
      setError("Error de conexión al eliminar.");
    } finally {
      setIsPurging(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold text-gray-eske-80 dark:text-[#C7D6E0] text-base">
            Eliminar «{projectName}» definitivamente
          </h3>
          <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] leading-relaxed">
            Esta acción NO se puede deshacer. Se borran los archivos de F3, el proyecto
            pierde su vínculo con PESTEL y con las sesiones de Fontana, y el proyecto
            desaparece por completo.
          </p>
          <div>
            <label htmlFor="purge-confirm-name" className="block text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] mb-1">
              Escribe «{projectName}» para confirmar
            </label>
            <input
              id="purge-confirm-name"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-white focus:outline-none focus:ring-1 focus:ring-red-eske"
            />
          </div>
          {error && <p className="text-sm text-red-eske">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPurging}
            className="px-4 py-2 text-sm font-medium text-gray-eske-60 hover:text-gray-eske-80
              transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handlePurge}
            disabled={isPurging || !matches}
            className="px-4 py-2 text-sm font-medium bg-red-eske text-white-eske rounded-lg
              hover:bg-red-eske/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPurging && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Eliminar definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TARJETA DE PROYECTO
// ==========================================

const STATUS_COLORS: Record<ModduloProject["status"], string> = {
  draft: "bg-gray-eske-20 text-black-eske-20 dark:bg-white/10 dark:text-[#C7D6E0]",
  active: "bg-green-eske/20 text-green-eske-80 dark:text-green-eske-30",
  paused: "bg-yellow-eske/20 text-brown-eske-60 dark:text-yellow-eske",
  completed: "bg-blue-eske/20 text-blue-eske-80 dark:text-blue-eske-30",
  // La escala -eske no tiene paso 50 (ver globals.css): el token que había aquí
  // quedaba como no-op y el texto heredaba el color del ancestro, casi invisible
  // en modo oscuro sobre el mismo `bg-gray-eske-20` claro (mismo bug ya
  // corregido en el hub de PESTEL, 26-09-12).
  archived: "bg-gray-eske-20 text-black-eske-20 dark:bg-white/10 dark:text-[#C7D6E0]",
};

const STATUS_LABELS: Record<ModduloProject["status"], string> = {
  draft: "Borrador",
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
  archived: "Archivado",
};

const META_COLOR_SWATCHES = ["#026988", "#248cc1", "#ffa366", "#649941", "#ffd14a", "#d10f3f", "#474747"];

function ProjectCard({
  project,
  onMovedToPapelera,
  onStatusChange,
  onMetaChange,
}: {
  project: ModduloProject;
  onMovedToPapelera: (project: ModduloProject) => void;
  onStatusChange: (id: string, status: ModduloProject["status"]) => void;
  onMetaChange: (id: string, meta: Pick<ModduloProject, "name" | "description" | "color">) => void;
}) {
  const [kebabOpen, setKebabOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaDraft, setMetaDraft] = useState({ name: project.name, description: project.description ?? "", color: project.color ?? "#026988" });
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const kebabRef = useRef<HTMLDivElement>(null);
  const colorCustomInputRef = useRef<HTMLInputElement>(null);
  const borderColor = project.status === "archived" ? "#9ca3af" : (project.color ?? "#026988");

  function openEditMeta() {
    setKebabOpen(false);
    setMetaDraft({ name: project.name, description: project.description ?? "", color: project.color ?? "#026988" });
    setIsEditingMeta(true);
  }

  async function handleMetaSave() {
    const name = metaDraft.name.trim();
    if (!name || name.length < 3) return;
    setIsSavingMeta(true);
    setMetaError(null);
    try {
      const r = await fetch(`/api/moddulo/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description: metaDraft.description.trim(), color: metaDraft.color }),
      });
      if (r.ok) {
        onMetaChange(project.id!, { name, description: metaDraft.description.trim(), color: metaDraft.color });
        setIsEditingMeta(false);
      } else {
        const data = await r.json().catch(() => ({}));
        setMetaError(data.error ?? "No se pudo guardar. Intenta de nuevo.");
      }
    } catch {
      setMetaError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsSavingMeta(false);
    }
  }

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

  async function handleStatusPatch(newStatus: ModduloProject["status"]) {
    setKebabOpen(false);
    setStatusError(null);
    try {
      const r = await fetch(`/api/moddulo/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) {
        onStatusChange(project.id!, newStatus);
      } else {
        const data = await r.json().catch(() => ({}));
        setStatusError(data.error ?? "No se pudo cambiar el estado.");
      }
    } catch {
      setStatusError("Error de conexión al cambiar el estado.");
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const r = await fetch(`/api/moddulo/projects/${project.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.ok) {
        onMovedToPapelera(project);
        setConfirmDelete(false);
      } else {
        const data = await r.json().catch(() => ({}));
        setDeleteError(data.error ?? "No se pudo mover a la papelera. Intenta de nuevo.");
      }
    } catch {
      setDeleteError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsDeleting(false);
    }
  }

  const isProjectArchived = project.status === "archived";
  const menuItems: { label: string; onClick: () => void; danger?: boolean }[] = [];
  if (!isProjectArchived) {
    menuItems.push({ label: "Editar", onClick: openEditMeta });
  }
  if (project.status === "active") {
    menuItems.push({ label: "Pausar", onClick: () => handleStatusPatch("paused") });
    menuItems.push({ label: "Archivar", onClick: () => handleStatusPatch("archived") });
  }
  if (project.status === "paused") {
    menuItems.push({ label: "Reactivar", onClick: () => handleStatusPatch("active") });
    menuItems.push({ label: "Archivar", onClick: () => handleStatusPatch("archived") });
  }
  if (project.status === "completed") {
    menuItems.push({ label: "Archivar", onClick: () => handleStatusPatch("archived") });
  }
  if (isProjectArchived) {
    menuItems.push({ label: "Activar", onClick: () => handleStatusPatch("active") });
  }
  menuItems.push({
    label: "Eliminar",
    onClick: () => { setKebabOpen(false); setConfirmDelete(true); },
    danger: true,
  });

  return (
    <>
      <div className="relative group">
        <Link
          href={`/moddulo/proyecto/${project.id}/${project.currentPhase}`}
          className="block bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 p-5 hover:border-bluegreen-eske/40 hover:shadow-sm transition-all"
          style={{ borderLeft: `4px solid ${borderColor}` }}
        >
          {/* Title + description — pr-8 reserves space for kebab */}
          <div className="min-w-0 mb-3 pr-8">
            <h3 className="font-semibold text-gray-eske-80 dark:text-[#C7D6E0] truncate">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mt-0.5 line-clamp-2">
                {project.description}
              </p>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-black-eske-20 dark:text-[#9AAEBE] flex-wrap">
            <span className="font-medium text-bluegreen-eske/80 dark:text-[#6BA4C6]">
              {PROJECT_TYPE_LABELS[project.type]}
            </span>
            <span aria-hidden="true">·</span>
            <span>Fase: {PHASE_NAMES[project.currentPhase]}</span>
          </div>
          {/* Status — esquina inferior derecha */}
          <div className="flex justify-end mt-2">
            <span className={`shrink-0 font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status]}`}>
              {STATUS_LABELS[project.status]}
            </span>
          </div>
        </Link>

        {statusError && (
          <p className="px-1 mt-1 text-xs text-red-eske">{statusError}</p>
        )}

        {/* Kebab — outside Link so clicks don't navigate */}
        <div className="absolute top-3 right-3 z-10" ref={kebabRef}>
          <button
            type="button"
            aria-label="Opciones del proyecto"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setKebabOpen((o) => !o); }}
            className="flex items-center justify-center w-7 h-7 rounded-md text-black-eske-40 dark:text-[#9AAEBE]
              hover:bg-gray-eske-10 dark:hover:bg-white/5
              transition-colors focus-visible:opacity-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>

          {kebabOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-44 bg-white-eske dark:bg-[#1E3A52]
                rounded-lg shadow-lg border border-gray-eske-20 dark:border-white/10 py-1 z-20"
            >
              {menuItems.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors
                    ${item.danger
                      ? "text-red-eske hover:bg-red-eske/10 dark:hover:bg-red-eske/20"
                      : "text-gray-eske-70 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5"
                    }
                    ${i > 0 && menuItems[i - 1]?.danger === false && item.danger
                      ? "border-t border-gray-eske-10 dark:border-white/10 mt-1 pt-2"
                      : ""
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <DeleteModal
          projectName={project.name}
          isDeleting={isDeleting}
          error={deleteError}
          hasPestelLink={project.phases?.exploracion?.linkedSource?.kind === "T22"}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {isEditingMeta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setIsEditingMeta(false); }}
        >
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-black-eske dark:text-[#C7D6E0] text-base">
              Editar proyecto
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="meta-name" className="block text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] mb-1">
                  Nombre <span className="text-red-eske dark:text-red-eske-20">*</span>
                </label>
                <input
                  id="meta-name"
                  type="text"
                  value={metaDraft.name}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, name: e.target.value }))}
                  maxLength={100}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-white focus:outline-none focus:ring-1 focus:ring-bluegreen-eske"
                />
                <p className="text-xs text-gray-eske-40 dark:text-[#6D8294] mt-0.5">{metaDraft.name.length}/100</p>
              </div>
              <div>
                <label htmlFor="meta-desc" className="block text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] mb-1">
                  Descripción
                </label>
                <textarea
                  id="meta-desc"
                  value={metaDraft.description}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, description: e.target.value }))}
                  maxLength={300}
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-white focus:outline-none focus:ring-1 focus:ring-bluegreen-eske resize-none"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-black-eske-40 dark:text-[#9AAEBE] mb-2">Color</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {META_COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setMetaDraft((d) => ({ ...d, color: hex }))}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        metaDraft.color === hex ? "border-black-eske scale-110" : "border-transparent"
                      }`}
                      aria-label={`Color ${hex}`}
                    />
                  ))}
                  {/* Selector hexadecimal personalizado (26-09-12) — homologado
                      con el mismo picker de Fontana/PESTEL/Moddulo-crear. */}
                  <button
                    type="button"
                    onClick={() => colorCustomInputRef.current?.click()}
                    className="w-7 h-7 rounded-full border-2 border-dashed border-gray-eske-40
                      flex items-center justify-center text-gray-eske-60 hover:border-gray-eske-70
                      transition-colors text-xs font-bold"
                    aria-label="Elegir color personalizado"
                  >
                    +
                  </button>
                  <input
                    ref={colorCustomInputRef}
                    type="color"
                    value={metaDraft.color}
                    onChange={(e) => setMetaDraft((d) => ({ ...d, color: e.target.value.toUpperCase() }))}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <input
                    type="text"
                    value={metaDraft.color}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) setMetaDraft((d) => ({ ...d, color: val.toUpperCase() }));
                    }}
                    maxLength={7}
                    className="w-24 px-2 py-1 border border-gray-eske-30 dark:border-white/10 rounded-lg
                      text-xs font-mono bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
                    aria-label="Código hexadecimal del color"
                  />
                  <span
                    className="w-7 h-7 rounded-full border border-gray-eske-20 shrink-0"
                    style={{ backgroundColor: metaDraft.color }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
            {metaError && <p className="text-xs text-red-eske">{metaError}</p>}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingMeta(false)}
                disabled={isSavingMeta}
                className="px-4 py-2 text-sm font-medium text-gray-eske-60 hover:text-gray-eske-80 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleMetaSave}
                disabled={isSavingMeta || metaDraft.name.trim().length < 3}
                className="px-4 py-2 text-sm font-medium bg-bluegreen-eske text-white rounded-lg hover:bg-bluegreen-eske/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingMeta && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
// ==========================================

function DeleteModal({
  projectName,
  isDeleting,
  error,
  hasPestelLink,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  isDeleting: boolean;
  error?: string | null;
  hasPestelLink?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold text-gray-eske-80 dark:text-[#C7D6E0] text-base">
            ¿Mover «{projectName}» a la papelera?
          </h3>
          <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] leading-relaxed">
            Podrás restaurarlo durante {DIAS_RETENCION_PROYECTOS} días desde la sección Papelera.
            Pasado ese plazo se eliminará junto con sus resultados de F3 y archivos adjuntos.
            Las sesiones de Fontana vinculadas quedarán sueltas, sin perder su información.
          </p>
          {hasPestelLink && (
            <div className="flex gap-2.5 p-3 rounded-lg bg-yellow-eske/10 border border-yellow-eske/30 text-sm leading-snug text-yellow-eske-80 dark:text-yellow-eske/90">
              <svg
                className="shrink-0 mt-0.5 w-4 h-4"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>
                Este proyecto tiene un análisis PESTEL vinculado en Centinela. Mientras esté en
                la papelera, el vínculo se mantiene intacto — si lo restauras, todo sigue
                funcionando igual. Solo se rompe si pasan los {DIAS_RETENCION_PROYECTOS} días.
              </span>
            </div>
          )}
          {error && <p className="text-sm text-red-eske">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-eske-60 hover:text-gray-eske-80
              transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium bg-red-eske text-white-eske rounded-lg
              hover:bg-red-eske/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Mover a papelera
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ESTADO VACÍO
// ==========================================

function EmptyState() {
  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-xl border border-gray-eske-20 dark:border-white/10 p-12 max-sm:p-8 text-center mb-12">
      <div className="w-16 h-16 bg-bluegreen-eske/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-bluegreen-eske" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-eske-80 dark:text-[#C7D6E0] mb-2">
        Aún no tienes proyectos
      </h2>
      <p className="text-black-eske-20 dark:text-[#9AAEBE] mb-6 text-sm font-light max-w-sm mx-auto">
        Crea tu primer proyecto estratégico y comienza a trabajar con Moddulo como tu colaborador estratégico
      </p>
      <Link
        href="/moddulo/proyecto/nuevo"
        className="px-6 py-3 bg-bluegreen-eske text-white-eske rounded-lg font-medium hover:bg-bluegreen-eske/90 transition-colors text-sm inline-block"
      >
        Crear primer proyecto
      </Link>
    </div>
  );
}
