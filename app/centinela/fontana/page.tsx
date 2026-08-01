"use client";

// app/centinela/fontana/page.tsx
// Entry point de Fontana. Este incremento solo implementa escenario (a):
// proyecto activo, con moddulo_project_id + tarea_pip por query param.
// Escenarios (b)/(c) (uso independiente) quedan fuera — se muestra un
// aviso explícito en vez de simular un flujo que no existe todavía.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ProjectType, Territorio } from "@/types/moddulo.types";
import type { FontanaSesion } from "@/types/fontana.types";
import FontanaOnboarding from "./FontanaOnboarding";
import FontanaMain from "./FontanaMain";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "sin_proyecto" }
  | { tipo: "error"; mensaje: string }
  | {
      tipo: "wizard";
      proyecto: { nombre: string; tipo: ProjectType; territorio: Territorio | null };
      tareaPip: number;
      minimosPreview: string[];
    }
  | { tipo: "sesion"; sesion: FontanaSesion };

export default function FontanaPage() {
  const searchParams = useSearchParams();
  const modduloProjectId = searchParams.get("moddulo_project_id");
  const tareaPip = searchParams.get("tarea_pip");

  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [confirmando, setConfirmando] = useState(false);

  const cargar = useCallback(async () => {
    if (!modduloProjectId || !tareaPip) {
      setEstado({ tipo: "sin_proyecto" });
      return;
    }
    setEstado({ tipo: "cargando" });
    try {
      const res = await fetch(
        `/api/fontana/sesion?moddulo_project_id=${modduloProjectId}&tarea_pip=${tareaPip}`
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
          tareaPip: data.tareaPip,
          minimosPreview: data.minimosPreview,
        });
      }
    } catch {
      setEstado({ tipo: "error", mensaje: "Error de conexión al cargar Fontana." });
    }
  }, [modduloProjectId, tareaPip]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleConfirmarWizard() {
    if (!modduloProjectId || !tareaPip) return;
    setConfirmando(true);
    try {
      const res = await fetch("/api/fontana/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modduloProjectId, tareaPip: Number(tareaPip) }),
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

  if (estado.tipo === "cargando") {
    return (
      <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center">
        <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">Cargando Fontana…</p>
      </main>
    );
  }

  if (estado.tipo === "sin_proyecto") {
    return (
      <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
            Fontana — uso independiente próximamente
          </h1>
          <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">
            Por ahora, Fontana solo está disponible dentro de un proyecto activo de Moddulo.
            Actívala desde el tablero de Fase 3 — Investigación de tu proyecto.
          </p>
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
      />
    </main>
  );
}
