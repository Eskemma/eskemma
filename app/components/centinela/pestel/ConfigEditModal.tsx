"use client";

// ConfigEditModal.tsx
// Modal de edición segura de configuración PESTEL.
// Ruta A — datos básicos (nombre, horizonte, color): no afecta el análisis.
// Ruta B — reconfigurar variables: navega al wizard con advertencia previa.

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";

interface ConfigEditModalProps {
  projectId: string;
  onClose: () => void;
}

type View = "choice" | "formA" | "confirmB";

// Mismos 7 valores ya usados en el resto de PESTEL (app/centinela/pestel/page.tsx,
// WizardStep1Tipo.tsx) — homologación del selector de color (26-09-12).
const COLOR_SWATCHES = ["#026988", "#248cc1", "#ffa366", "#649941", "#ffd14a", "#d10f3f", "#474747"];

export default function ConfigEditModal({
  projectId,
  onClose,
}: ConfigEditModalProps) {
  const router = useRouter();
  const [view, setView] = useState<View>("choice");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [nombre, setNombre] = useState("");
  const [horizonte, setHorizonte] = useState(6);
  const [color, setColor] = useState("#026988");
  const colorCustomInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(true, onClose);
  const modalRef = useFocusTrap(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/centinela/pestel/project/${projectId}`
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as {
          project: { nombre: string; horizonte: number; color?: string };
        };
        setNombre(data.project.nombre ?? "");
        setHorizonte(data.project.horizonte ?? 6);
        setColor(data.project.color ?? "#026988");
      } catch {
        setError("No se pudo cargar el proyecto.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [projectId]);

  const handleSaveBasic = useCallback(async () => {
    if (!nombre.trim()) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombre.trim(),
            horizonte,
            color,
          }),
        }
      );
      if (!res.ok) throw new Error();
      setSuccess(true);
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 700);
    } catch {
      setError("No se pudo guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }, [nombre, horizonte, color, projectId, onClose, router]);

  const handleGoToWizard = useCallback(() => {
    onClose();
    router.push(`/centinela/pestel/${projectId}/configurar`);
  }, [projectId, onClose, router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="config-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        className="relative z-10 w-full max-w-md bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-eske-20 dark:border-white/10">
          <h2
            id="config-modal-title"
            className="font-semibold text-base text-black-eske dark:text-white"
          >
            {view === "choice" && "¿Qué deseas modificar?"}
            {view === "formA" && "Datos del proyecto"}
            {view === "confirmB" && "Reconfigurar variables"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-eske-60 hover:text-black-eske dark:hover:text-white transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske rounded"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {loading && (
            <p className="text-sm text-gray-eske-60 dark:text-[#9AAEBE] text-center py-6">
              Cargando...
            </p>
          )}

          {!loading && view === "choice" && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setView("formA")}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-eske-20
                  dark:border-white/10 hover:border-bluegreen-eske dark:hover:border-bluegreen-eske/60
                  transition-colors group focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-bluegreen-eske"
              >
                <p className="font-semibold text-sm text-black-eske dark:text-white group-hover:text-bluegreen-eske-80 transition-colors">
                  Datos del proyecto
                </p>
                <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5">
                  Nombre, horizonte temporal y color identificador.
                  No afecta el análisis existente.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setView("confirmB")}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-eske-20
                  dark:border-white/10 hover:border-orange-eske dark:hover:border-orange-eske/60
                  transition-colors group focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-orange-eske"
              >
                <p className="font-semibold text-sm text-black-eske dark:text-white group-hover:text-orange-eske transition-colors">
                  Variables y configuración completa
                </p>
                <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-0.5">
                  Cambia dimensiones, variables y sus pesos.
                  <span className="text-orange-eske-60 font-medium">
                    {" "}Requiere volver a ejecutar el análisis.
                  </span>
                </p>
              </button>
            </div>
          )}

          {!loading && view === "formA" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveBasic();
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="cfg-nombre"
                  className="block text-xs font-semibold text-gray-eske-70 dark:text-[#9AAEBE] mb-1"
                >
                  Nombre del proyecto
                </label>
                <input
                  id="cfg-nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={120}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-eske-30
                    dark:border-white/20 bg-white-eske dark:bg-[#112233]
                    text-black-eske dark:text-white
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-horizonte"
                  className="block text-xs font-semibold text-gray-eske-70 dark:text-[#9AAEBE] mb-1"
                >
                  Horizonte temporal (meses)
                </label>
                <select
                  id="cfg-horizonte"
                  value={horizonte}
                  onChange={(e) => setHorizonte(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-eske-30
                    dark:border-white/20 bg-white-eske dark:bg-[#112233]
                    text-black-eske dark:text-white
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
                >
                  {[3, 6, 12, 18, 24, 36].map((m) => (
                    <option key={m} value={m}>
                      {m} meses
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cfg-color-hex"
                  className="block text-xs font-semibold text-gray-eske-70 dark:text-[#9AAEBE] mb-1"
                >
                  Color identificador
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setColor(hex.toUpperCase())}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color.toLowerCase() === hex ? "border-black-eske dark:border-white-eske scale-110" : "border-transparent"
                      }`}
                      aria-label={`Color ${hex}`}
                    />
                  ))}
                  {/* Selector hexadecimal personalizado (26-09-12) — homologado
                      con el resto del ecosistema (Fontana/PESTEL-crear/Moddulo);
                      antes esta ruta solo tenía el input nativo, sin swatches ni
                      campo de texto hex. */}
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
                    value={color}
                    onChange={(e) => setColor(e.target.value.toUpperCase())}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <input
                    id="cfg-color-hex"
                    type="text"
                    value={color}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) setColor(val.toUpperCase());
                    }}
                    maxLength={7}
                    className="w-24 px-2 py-1 border border-gray-eske-30 dark:border-white/10 rounded-lg
                      text-xs font-mono bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
                    aria-label="Código hexadecimal del color"
                  />
                  <span
                    className="w-7 h-7 rounded-full border border-gray-eske-20 shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-eske" role="alert">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-xs text-green-eske-70" role="status">
                  Proyecto actualizado correctamente.
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setView("choice")}
                  className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-eske-30
                    dark:border-white/20 text-gray-eske-70 dark:text-[#9AAEBE]
                    hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={saving || success}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg
                    bg-bluegreen-eske text-white hover:bg-bluegreen-eske-80 transition-colors
                    disabled:opacity-60 disabled:cursor-not-allowed
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
                >
                  {saving ? "Guardando..." : success ? "Guardado" : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}

          {!loading && view === "confirmB" && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 bg-orange-eske-10 dark:bg-orange-eske/10 border border-orange-eske/30">
                <p className="text-sm text-orange-eske-80 dark:text-orange-eske-40 font-semibold mb-1">
                  Atención
                </p>
                <p className="text-sm text-black-eske-80 dark:text-[#C5D8E8]">
                  Si modificas las variables o sus pesos, necesitarás ejecutar
                  el análisis nuevamente para que los cambios se reflejen.
                  El análisis PESTEL actual se conservará hasta que generes uno nuevo.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setView("choice")}
                  className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-eske-30
                    dark:border-white/20 text-gray-eske-70 dark:text-[#9AAEBE]
                    hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGoToWizard}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg
                    bg-orange-eske text-white hover:bg-orange-eske-60 transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-eske"
                >
                  Ir a reconfigurar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
