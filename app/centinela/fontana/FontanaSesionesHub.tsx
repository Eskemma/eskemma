"use client";

// app/centinela/fontana/FontanaSesionesHub.tsx
// Lista de sesiones sueltas del usuario (Escenarios b/c sin proyecto
// vinculado), patrón de card-grid tipo PESTEL/Moddulo (contenedor ancho,
// CTA "Explorar nuevo territorio" siempre visible arriba, grid de cards).
//
// Punto 1b (2ª pasada, 2026-08-19) — menú kebab por card
// (Editar/Archivar/Eliminar), mismo patrón que `PESTELHubPage.ProjectCard`
// (app/centinela/pestel/page.tsx): botón "⋮" con dropdown, modal de
// edición reutilizando TerritorySelector + campo de nombre (mismo trío
// nombre/tipo/territorio ya usado en `standalone_inicio`), sección
// "Archivadas" plegable al final (mismo patrón que PESTEL separa
// activos/archivados).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FontanaSesion } from "@/types/fontana.types";
import type { ProjectType, Territorio } from "@/types/moddulo.types";
import TerritorySelector from "@/app/components/shared/TerritorySelector";
import { COLOR_SWATCHES, COLOR_DEFAULT } from "@/lib/fontana/colorSwatches";

// 2026-08-21 — el hub ahora también lista sesiones vinculadas (antes
// desaparecían sin dejar rastro al vincularse — hueco real de
// descubribilidad). GET /mias adjunta `proyectoVinculado` (nombre +
// fase actual) cuando corresponde.
export type SesionConProyecto = FontanaSesion & {
  proyectoVinculado?: { nombre: string; currentPhase: string };
};

const TIPO_PROYECTO_LABELS: Record<ProjectType, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

function contarIndicadores(sesion: FontanaSesion): number {
  return (["F1", "F2", "F3", "F4", "F5"] as const).reduce((total, familia) => {
    const seleccion = sesion.indicadoresPorFamilia[familia];
    return total + new Set([...seleccion.minimos, ...seleccion.seleccionUsuario]).size;
  }, 0);
}

function labelTerritorio(sesion: FontanaSesion): string {
  const t = sesion.territorio;
  return t.nombre || [t.estado, t.municipio].filter(Boolean).join(" › ") || "Territorio sin definir";
}

async function patchSesion(sesionId: string, body: Record<string, unknown>): Promise<FontanaSesion | null> {
  const res = await fetch(`/api/fontana/sesion/${sesionId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { sesion: FontanaSesion };
  return data.sesion;
}

function EditModal({ sesion, onClose, onSaved }: {
  sesion: FontanaSesion; onClose: () => void; onSaved: (s: FontanaSesion) => void;
}) {
  const [nombre, setNombre] = useState(sesion.nombre ?? "");
  const [tipo, setTipo] = useState<ProjectType>(sesion.tipoProyecto);
  const [territorio, setTerritorio] = useState<Territorio | null>(sesion.territorio);
  const [color, setColor] = useState(sesion.color ?? COLOR_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGuardar() {
    if (!territorio) return;
    setSaving(true);
    setError(null);
    const actualizada = await patchSesion(sesion.sesionId, { nombre: nombre.trim() || sesion.nombre, tipoProyecto: tipo, territorio, color });
    setSaving(false);
    if (!actualizada) { setError("No se pudo guardar. Intenta de nuevo."); return; }
    onSaved(actualizada);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <h3 className="font-semibold text-black-eske dark:text-[#EAF2F8] text-base">Editar exploración</h3>
        <div>
          <label htmlFor="fontana-edit-nombre" className="block text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE] mb-1">
            Nombre
          </label>
          <input
            id="fontana-edit-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
          />
        </div>
        <div>
          <label htmlFor="fontana-edit-tipo" className="block text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE] mb-1">
            Tipo de proyecto
          </label>
          <select
            id="fontana-edit-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as ProjectType)}
            className="px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
          >
            {(Object.keys(TIPO_PROYECTO_LABELS) as ProjectType[]).map((t) => (
              <option key={t} value={t}>{TIPO_PROYECTO_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="block text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE] mb-1">Color</p>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setColor(hex)}
                aria-label={`Color ${hex}`}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  color === hex ? "border-black-eske dark:border-white-eske scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
        <TerritorySelector
          territorio={territorio}
          onChange={setTerritorio}
          onBack={onClose}
          onNext={handleGuardar}
          label="Territorio"
          nextLabel={saving ? "Guardando…" : "Guardar"}
        />
        {error && <p className="text-sm text-red-eske">{error}</p>}
      </div>
    </div>
  );
}

function SesionCard({ sesion, onOpen, onChanged, onDeleted }: {
  sesion: FontanaSesion;
  onOpen: () => void;
  onChanged: (s: FontanaSesion) => void;
  onDeleted: () => void;
}) {
  const [kebabOpen, setKebabOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);

  // Fix 4 (2026-08-21) — mismo patrón ya usado en PESTELHubPage.ProjectCard
  // (app/centinela/pestel/page.tsx) para cerrar el kebab con cualquier
  // clic fuera de él, no solo re-clic en los 3 puntos.
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

  async function handleArchivar(archivada: boolean) {
    setKebabOpen(false);
    const actualizada = await patchSesion(sesion.sesionId, { archivada });
    if (actualizada) onChanged(actualizada);
  }

  async function handleEliminar() {
    setDeleting(true);
    const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) onDeleted();
  }

  return (
    <>
      <div
        className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5 flex flex-col gap-2 hover:shadow-md transition-all duration-200"
        style={{ borderLeft: `4px solid ${sesion.color ?? COLOR_DEFAULT}` }}
      >
        <div className="flex items-start gap-2">
          <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
            <p className="font-semibold text-black-eske dark:text-[#EAF2F8] truncate">{sesion.nombre || labelTerritorio(sesion)}</p>
            <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-0.5 truncate">{labelTerritorio(sesion)}</p>
          </button>
          <div className="relative shrink-0" ref={kebabRef}>
            <button
              type="button"
              aria-label="Opciones de la sesión"
              onClick={() => setKebabOpen((o) => !o)}
              className="flex items-center justify-center w-7 h-7 rounded-md text-gray-eske-40 hover:text-gray-eske-70 hover:bg-gray-eske-10 dark:hover:bg-white/10 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>
            {kebabOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white-eske dark:bg-[#1E3A52] rounded-lg shadow-lg border border-gray-eske-20 dark:border-white/10 py-1 z-20">
                <button type="button" onClick={() => { setKebabOpen(false); setEditOpen(true); }} className="w-full text-left px-3 py-2 text-sm text-black-eske-80 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors">
                  Editar
                </button>
                <button type="button" onClick={() => handleArchivar(!sesion.archivada)} className="w-full text-left px-3 py-2 text-sm text-black-eske-80 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors">
                  {sesion.archivada ? "Reactivar" : "Archivar"}
                </button>
                <div className="border-t border-gray-eske-10 dark:border-white/10 my-1" />
                <button type="button" onClick={() => { setKebabOpen(false); setConfirmDelete(true); }} className="w-full text-left px-3 py-2 text-sm text-red-eske hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
        <button type="button" onClick={onOpen} className="text-left">
          <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE]">
            {new Date(sesion.fechaUltimoGuardado).toLocaleDateString("es-MX")} · {contarIndicadores(sesion)} indicadores seleccionados
          </p>
        </button>
      </div>

      {editOpen && (
        <EditModal
          sesion={sesion}
          onClose={() => setEditOpen(false)}
          onSaved={(s) => { setEditOpen(false); onChanged(s); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-black-eske dark:text-[#EAF2F8] text-base">
                ¿Eliminar «{sesion.nombre || labelTerritorio(sesion)}»?
              </h3>
              <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] mt-1.5 leading-relaxed">
                Esta acción es permanente. Se perderán los indicadores seleccionados en esta exploración.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="px-4 py-2 text-sm font-medium text-gray-eske-60 hover:text-gray-eske-80 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={handleEliminar} disabled={deleting} className="px-4 py-2 text-sm font-medium bg-red-eske text-white-eske rounded-lg hover:bg-red-eske/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VinculadaCard({ sesion, onDesvinculada }: {
  sesion: SesionConProyecto;
  onDesvinculada: () => void;
}) {
  const router = useRouter();
  const [kebabOpen, setKebabOpen] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);
  const destino = sesion.proyectoVinculado
    ? `/moddulo/proyecto/${sesion.modduloProjectId}/${sesion.proyectoVinculado.currentPhase}`
    : `/moddulo/proyecto/${sesion.modduloProjectId}`;

  // Investigación 2 (aprobada, 2026-08-21) — "Desvincular" solo aplica a
  // sesiones vinculadas por Flujo 1/2 (tareaPipIds vacío). Una sesión de
  // Escenario (a) tiene un vínculo estructural distinto — ni kebab.
  const puedeDesvincular = sesion.tareaPipIds.length === 0;

  useEffect(() => {
    if (!kebabOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [kebabOpen]);

  async function handleDesvincular() {
    setKebabOpen(false);
    setDesvinculando(true);
    const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desvincular: true }),
    });
    setDesvinculando(false);
    if (res.ok) onDesvinculada();
  }

  return (
    <div
      className="relative bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{ borderLeft: `4px solid ${sesion.color ?? COLOR_DEFAULT}` }}
    >
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => router.push(destino)} className="flex-1 min-w-0 text-left" disabled={desvinculando}>
          <p className="font-semibold text-black-eske dark:text-[#EAF2F8] truncate">{sesion.nombre || labelTerritorio(sesion)}</p>
          <p className="text-xs text-bluegreen-eske dark:text-blue-eske-20 mt-1.5">
            Vinculada a: {sesion.proyectoVinculado?.nombre ?? "proyecto de Moddulo"}
          </p>
          <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-1.5">
            {new Date(sesion.fechaUltimoGuardado).toLocaleDateString("es-MX")}
          </p>
        </button>
        {puedeDesvincular && (
          <div className="relative shrink-0" ref={kebabRef}>
            <button
              type="button"
              aria-label="Opciones de la sesión"
              onClick={() => setKebabOpen((o) => !o)}
              disabled={desvinculando}
              className="flex items-center justify-center w-7 h-7 rounded-md text-gray-eske-40 hover:text-gray-eske-70 hover:bg-gray-eske-10 dark:hover:bg-white/10 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>
            {kebabOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white-eske dark:bg-[#1E3A52] rounded-lg shadow-lg border border-gray-eske-20 dark:border-white/10 py-1 z-20">
                <button type="button" onClick={handleDesvincular} className="w-full text-left px-3 py-2 text-sm text-black-eske-80 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors">
                  {desvinculando ? "Desvinculando…" : "Desvincular"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FontanaSesionesHub({
  sesiones, onExplorarNuevo,
}: {
  sesiones: SesionConProyecto[];
  onExplorarNuevo: () => void;
}) {
  const router = useRouter();
  const [lista, setLista] = useState(sesiones);

  const sueltas = lista.filter((s) => !s.modduloProjectId);
  const activas = sueltas.filter((s) => !s.archivada);
  const archivadas = sueltas.filter((s) => s.archivada);
  const vinculadas = lista.filter((s) => !!s.modduloProjectId);

  function handleChanged(actualizada: FontanaSesion) {
    setLista((prev) => prev.map((s) => (s.sesionId === actualizada.sesionId ? { ...s, ...actualizada } : s)));
  }

  function handleDeleted(sesionId: string) {
    setLista((prev) => prev.filter((s) => s.sesionId !== sesionId));
  }

  // No confía en el shape exacto de la respuesta del servidor para
  // reflejar el desvínculo (modduloProjectId se borra vía
  // FieldValue.delete(), no viaja de vuelta en el JSON) — el resultado
  // ya es determinístico desde el propio clic, se aplica directo local.
  function handleDesvinculada(sesionId: string) {
    setLista((prev) => prev.map((s) => (s.sesionId === sesionId ? { ...s, modduloProjectId: undefined, proyectoVinculado: undefined } : s)));
  }

  return (
    <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      <div className="bg-bluegreen-eske">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-2xl font-bold text-white">Fontana</h1>
          <p className="text-sm text-white/75 mt-1 max-w-xl leading-relaxed">
            Explora datos abiertos por territorio, con o sin un proyecto de Moddulo vinculado.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8]">
              Tus exploraciones guardadas
            </h2>
            {activas.length > 0 && (
              <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">
                {activas.length} {activas.length === 1 ? "sesión" : "sesiones"} sin proyecto de Moddulo vinculado
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onExplorarNuevo}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-bluegreen-eske text-white rounded-lg text-sm font-medium hover:bg-bluegreen-eske-60 transition-colors shadow-sm"
          >
            <span aria-hidden="true">+</span> Explorar nuevo territorio
          </button>
        </div>

        {activas.length === 0 && archivadas.length === 0 && vinculadas.length === 0 && (
          <div className="flex flex-col items-center gap-6 py-16 bg-white-eske dark:bg-[#18324A] rounded-xl border border-dashed border-gray-eske-30 dark:border-white/10 text-center">
            <span className="text-5xl" aria-hidden="true">💧</span>
            <div>
              <p className="font-semibold text-black-eske dark:text-[#EAF2F8]">
                Todavía no tienes exploraciones guardadas
              </p>
              <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] mt-1 max-w-sm">
                Elige un territorio para empezar a explorar datos abiertos con Fontana.
              </p>
            </div>
            <button
              type="button"
              onClick={onExplorarNuevo}
              className="px-6 py-2.5 bg-bluegreen-eske text-white rounded-lg text-sm font-medium hover:bg-bluegreen-eske-60 transition-colors"
            >
              Explorar mi primer territorio →
            </button>
          </div>
        )}

        {activas.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activas.map((s) => (
              <SesionCard
                key={s.sesionId}
                sesion={s}
                onOpen={() => router.push(`/centinela/fontana?sesion_id=${s.sesionId}`)}
                onChanged={handleChanged}
                onDeleted={() => handleDeleted(s.sesionId)}
              />
            ))}
          </div>
        )}

        {vinculadas.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-black-eske-80 dark:text-[#9AAEBE] uppercase tracking-wide">
              Vinculadas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vinculadas.map((s) => <VinculadaCard key={s.sesionId} sesion={s} onDesvinculada={() => handleDesvinculada(s.sesionId)} />)}
            </div>
          </div>
        )}

        {archivadas.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-black-eske-80 dark:text-[#9AAEBE] uppercase tracking-wide">
              Archivadas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {archivadas.map((s) => (
                <SesionCard
                  key={s.sesionId}
                  sesion={s}
                  onOpen={() => router.push(`/centinela/fontana?sesion_id=${s.sesionId}`)}
                  onChanged={handleChanged}
                  onDeleted={() => handleDeleted(s.sesionId)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
