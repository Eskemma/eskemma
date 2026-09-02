"use client";

// app/centinela/fontana/FontanaMain.tsx
// Contenedor principal post-wizard. Header (banner + breadcrumb + botones
// de vínculo con Moddulo/Canal 1) + FontanaWorkspace, que aloja las 2
// pestañas ("Indicadores" con el acordeón de 5 familias, "Fontana" con el
// Canvas) y la burbuja del agente conversacional (T10).
//
// El bloque de tabs por familia + tabla + "+ Añadir indicador" que vivía
// aquí inline se movió a FontanaIndicadoresAccordion.tsx en el rediseño
// de 2 pestañas (2026-08-27).

import { useRouter } from "next/navigation";
import type { FontanaSesion } from "@/types/fontana.types";
import FontanaWorkspace from "./FontanaWorkspace";
import FontanaModduloButton from "./FontanaModduloButton";
import FontanaCanal1Button from "./FontanaCanal1Button";

interface Props {
  sesion: FontanaSesion;
  onSesionActualizada: (sesion: FontanaSesion) => void;
  // Ronda 9 (26-08-18) — para el enlace "Resolver en Moddulo" del modal de
  // ambigüedad, que necesita saber a dónde traer de vuelta al usuario.
  retornoUrl?: string;
}

export default function FontanaMain({ sesion, onSesionActualizada, retornoUrl }: Props) {
  const router = useRouter();

  return (
    <div>
      {/* Header — mismo patrón visual que las páginas internas de PESTEL:
          banner bg-bluegreen-eske de ancho completo, breadcrumb de regreso
          al hub, título + subtítulo, acción(es) a la derecha. */}
      <div className="bg-bluegreen-eske text-white px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => router.push("/centinela/fontana")}
            className="text-sm text-white/70 hover:text-white mb-2 flex items-center gap-1 transition-colors"
            aria-label="Volver a Fontana"
          >
            ← Fontana
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{sesion.nombre || "Fontana"}</h1>
              <p className="text-white/80 text-sm mt-0.5">
                {sesion.territorio.nombre ||
                  [sesion.territorio.estado, sesion.territorio.municipio].filter(Boolean).join(" › ")}
              </p>
            </div>
            {sesion.modduloProjectId && sesion.tareaPipIds.length > 0 ? (
              <FontanaCanal1Button sesion={sesion} onSesionActualizada={onSesionActualizada} />
            ) : sesion.modduloProjectId ? (
              <div className="w-full flex justify-center gap-2 sm:w-fit sm:justify-start">
                <button
                  type="button"
                  onClick={() => router.push(`/moddulo/proyecto/${sesion.modduloProjectId}/investigacion`)}
                  className="px-4 py-2 border border-white/30 text-white text-sm rounded-lg hover:bg-white/10 transition-colors"
                >
                  Regresar a Moddulo F3
                </button>
              </div>
            ) : (
              <FontanaModduloButton sesion={sesion} />
            )}
          </div>
        </div>
      </div>

      <FontanaWorkspace sesion={sesion} onSesionActualizada={onSesionActualizada} retornoUrl={retornoUrl} />
    </div>
  );
}
