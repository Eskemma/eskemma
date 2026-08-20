"use client";

// app/centinela/fontana/page.tsx
// Entry point de Fontana. 3 modos de entrada:
//   - Escenario (a): moddulo_project_id + tarea_pip por query param
//     (proyecto activo, PIP de referencia).
//   - Escenarios (b)/(c) — carga directa: sesion_id por query param
//     (sesión suelta, con o sin modduloProjectId ya vinculado — nunca
//     tiene un pipItemId real que poner en la URL de escenario a).
//   - Escenarios (b)/(c) — arranque: sin ningún query param, el usuario
//     elige tipo + territorio (TerritorySelector) y se crea una sesión
//     suelta con los indicadores por defecto ya poblados.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { ProjectType, Territorio } from "@/types/moddulo.types";
import type { FontanaSesion } from "@/types/fontana.types";
import TerritorySelector from "@/app/components/shared/TerritorySelector";
import FontanaOnboarding from "./FontanaOnboarding";
import FontanaMain from "./FontanaMain";
import FontanaSesionesHub from "./FontanaSesionesHub";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "standalone_inicio" }
  | { tipo: "hub"; sesiones: FontanaSesion[] }
  | { tipo: "error"; mensaje: string }
  | {
      tipo: "wizard";
      proyecto: { nombre: string; tipo: ProjectType; territorio: Territorio | null };
      pipItemId: string;
      minimosPreview: string[];
    }
  | { tipo: "sesion"; sesion: FontanaSesion };

const TIPO_PROYECTO_LABELS: Record<ProjectType, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

export default function FontanaPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modduloProjectId = searchParams.get("moddulo_project_id");
  // El query param se sigue llamando `tarea_pip` (URL pública, no romper
  // enlaces existentes), pero desde la migración a identidad estable su
  // valor es un pipItemId (string), no el numero de despliegue.
  const pipItemId = searchParams.get("tarea_pip");
  const sesionIdParam = searchParams.get("sesion_id");

  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [confirmando, setConfirmando] = useState(false);
  // Estado del formulario de arranque standalone (tipo + territorio) —
  // vive aquí porque TerritorySelector solo captura territorio, no tipo.
  const [tipoStandalone, setTipoStandalone] = useState<ProjectType | null>(null);
  const [territorioStandalone, setTerritorioStandalone] = useState<Territorio | null>(null);
  const [creandoStandalone, setCreandoStandalone] = useState(false);
  const [errorStandalone, setErrorStandalone] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (sesionIdParam) {
      setEstado({ tipo: "cargando" });
      try {
        const res = await fetch(`/api/fontana/sesion?sesion_id=${sesionIdParam}`);
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          setEstado({ tipo: "error", mensaje: err.error ?? "No se pudo cargar la sesión de Fontana." });
          return;
        }
        const data = await res.json();
        setEstado({ tipo: "sesion", sesion: data.sesion as FontanaSesion });
      } catch {
        setEstado({ tipo: "error", mensaje: "Error de conexión al cargar Fontana." });
      }
      return;
    }

    if (!modduloProjectId || !pipItemId) {
      // Punto 1 (verificación en navegador, 2026-08-19) — antes de caer al
      // formulario de arranque, revisa si el usuario ya tiene sesiones
      // sueltas guardadas. Si no tiene ninguna, NUNCA se muestra una
      // pantalla de lista vacía como paso intermedio — cae directo al
      // formulario, comportamiento idéntico al de antes de esta pieza.
      try {
        const res = await fetch("/api/fontana/sesion/mias");
        if (res.ok) {
          const data = (await res.json()) as { sesiones: FontanaSesion[] };
          if (data.sesiones.length > 0) {
            setEstado({ tipo: "hub", sesiones: data.sesiones });
            return;
          }
        }
      } catch {
        // No bloquea el flujo — si falla la lista, se cae al formulario.
      }
      setEstado({ tipo: "standalone_inicio" });
      return;
    }
    setEstado({ tipo: "cargando" });
    try {
      const res = await fetch(
        `/api/fontana/sesion?moddulo_project_id=${modduloProjectId}&tarea_pip=${pipItemId}`
      );
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setEstado({ tipo: "error", mensaje: err.error ?? "No se pudo cargar Fontana para este proyecto." });
        return;
      }
      const data = await res.json();
      if (data.existe) {
        setEstado({ tipo: "sesion", sesion: data.sesion as FontanaSesion });
      } else {
        setEstado({
          tipo: "wizard",
          proyecto: data.proyecto,
          pipItemId: data.pipItemId,
          minimosPreview: data.minimosPreview,
        });
      }
    } catch {
      setEstado({ tipo: "error", mensaje: "Error de conexión al cargar Fontana." });
    }
  }, [modduloProjectId, pipItemId, sesionIdParam]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleConfirmarWizard() {
    if (!modduloProjectId || !pipItemId) return;
    setConfirmando(true);
    try {
      const res = await fetch("/api/fontana/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modduloProjectId, pipItemId }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setEstado({ tipo: "error", mensaje: err.error ?? "No se pudo crear la sesión de Fontana." });
        return;
      }
      const data = (await res.json()) as { sesion: FontanaSesion };
      setEstado({ tipo: "sesion", sesion: data.sesion });
    } catch {
      setEstado({ tipo: "error", mensaje: "Error de conexión al confirmar." });
    } finally {
      setConfirmando(false);
    }
  }

  async function handleCrearStandalone() {
    if (!tipoStandalone || !territorioStandalone) return;
    setCreandoStandalone(true);
    setErrorStandalone(null);
    try {
      const res = await fetch("/api/fontana/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ territorio: territorioStandalone, tipoProyecto: tipoStandalone }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setErrorStandalone(err.error ?? "No se pudo crear la sesión de Fontana.");
        return;
      }
      const data = (await res.json()) as { sesion: FontanaSesion };
      // sesion_id en la URL — para que recargar/compartir el link vuelva
      // a esta misma sesión (mismo criterio que retornoUrl de escenario a).
      router.replace(`/centinela/fontana?sesion_id=${data.sesion.sesionId}`);
      setEstado({ tipo: "sesion", sesion: data.sesion });
    } catch {
      setErrorStandalone("Error de conexión al crear la sesión.");
    } finally {
      setCreandoStandalone(false);
    }
  }

  if (estado.tipo === "cargando") {
    return (
      <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center">
        <p className="text-sm text-red-eske">Cargando Fontana…</p>
      </main>
    );
  }

  if (estado.tipo === "hub") {
    return <FontanaSesionesHub sesiones={estado.sesiones} onExplorarNuevo={() => setEstado({ tipo: "standalone_inicio" })} />;
  }

  if (estado.tipo === "standalone_inicio") {
    return (
      <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] py-10 px-4">
        <div className="max-w-lg mx-auto bg-white-eske dark:bg-[#18324A] rounded-xl shadow-sm border border-gray-eske-20 dark:border-white/10 p-6 flex flex-col gap-5">
          <div>
            <h1 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-1">Fontana</h1>
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">
              Explora datos abiertos por territorio, sin necesidad de un proyecto de Moddulo. Elige el tipo de
              proyecto y el territorio para empezar.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tipo-standalone" className="text-sm font-medium text-black-eske dark:text-[#C7D6E0]">
              Tipo de proyecto
            </label>
            <select
              id="tipo-standalone"
              value={tipoStandalone ?? ""}
              onChange={(e) => setTipoStandalone((e.target.value || null) as ProjectType | null)}
              className="px-3 py-2.5 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm
                bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
            >
              <option value="">— Seleccionar —</option>
              {(Object.keys(TIPO_PROYECTO_LABELS) as ProjectType[]).map((t) => (
                <option key={t} value={t}>{TIPO_PROYECTO_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <TerritorySelector
            territorio={territorioStandalone}
            onChange={setTerritorioStandalone}
            onBack={() => router.push("/centinela")}
            onNext={handleCrearStandalone}
            label="¿Cuál es el territorio a explorar?"
          />
          {!tipoStandalone && territorioStandalone && (
            <p className="text-xs text-red-eske">Selecciona un tipo de proyecto para continuar.</p>
          )}
          {errorStandalone && <p className="text-sm text-red-eske">{errorStandalone}</p>}
          {creandoStandalone && (
            <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE]">Creando sesión…</p>
          )}
        </div>
      </main>
    );
  }

  if (estado.tipo === "error") {
    return (
      <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center px-4">
        <p className="text-sm text-red-eske text-center max-w-md">{estado.mensaje}</p>
      </main>
    );
  }

  if (estado.tipo === "wizard") {
    return (
      <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
        <FontanaOnboarding
          proyecto={estado.proyecto}
          minimosPreview={estado.minimosPreview}
          onConfirmar={handleConfirmarWizard}
          confirmando={confirmando}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      <FontanaMain
        sesion={estado.sesion}
        onSesionActualizada={(sesion) => setEstado({ tipo: "sesion", sesion })}
        // Ronda 9 (26-08-18) — para que "Resolver en Moddulo" (ambigüedad
        // de municipio) pueda traer de vuelta al usuario aquí después de
        // guardar, en vez de dejarlo varado en Moddulo. Escenario a usa
        // moddulo_project_id+tarea_pip; sesión suelta usa sesion_id
        // (nunca tiene tarea_pip real que poner en la URL).
        retornoUrl={
          modduloProjectId && pipItemId
            ? `/centinela/fontana?moddulo_project_id=${modduloProjectId}&tarea_pip=${pipItemId}`
            : `/centinela/fontana?sesion_id=${estado.sesion.sesionId}`
        }
      />
    </main>
  );
}
