"use client";

// app/centinela/fontana/FontanaOnboarding.tsx
// Wizard de primer uso — SOLO escenario (a): proyecto activo con datos
// precargados vía query params. Escenario (b)/(c) (uso independiente)
// queda fuera de este incremento.

import type { Territorio, ProjectType } from "@/types/moddulo.types";
import { FAMILIA1_NOMBRES } from "@/lib/fontana/familia1Catalogo";
import Button from "@/app/components/Button";

const NOMBRE_TIPO_PROYECTO: Record<ProjectType, string> = {
  electoral: "Electoral",
  gubernamental: "Gubernamental",
  legislativo: "Legislativo",
  ciudadano: "Ciudadano",
};

interface Props {
  proyecto: { nombre: string; tipo: ProjectType; territorio: Territorio | null };
  minimosPreview: string[];
  onConfirmar: () => void;
  confirmando: boolean;
}

function rutaTerritorial(territorio: Territorio | null): string {
  if (!territorio) return "Territorio no definido";
  return [territorio.pais, territorio.estado, territorio.municipio].filter(Boolean).join(" › ") || territorio.nombre;
}

export default function FontanaOnboarding({ proyecto, minimosPreview, onConfirmar, confirmando }: Props) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-16">
      <div className="rounded-xl border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A] p-6 md:p-8">
        <h1 className="text-xl md:text-2xl font-semibold text-bluegreen-eske dark:text-blue-eske-20">
          Fontana — datos abiertos para tu proyecto
        </h1>
        <p className="mt-2 text-sm text-black-eske-80 dark:text-[#9AAEBE]">
          Vas a consultar indicadores de datos abiertos para el siguiente proyecto:
        </p>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex flex-col sm:flex-row sm:gap-2 text-left">
            <dt className="text-bluegreen-eske dark:text-blue-eske-20 sm:w-28 shrink-0">Proyecto</dt>
            <dd className="font-medium text-black-eske dark:text-[#EAF2F8] text-left">{proyecto.nombre}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-2 text-left">
            <dt className="text-bluegreen-eske dark:text-blue-eske-20 sm:w-28 shrink-0">Tipo</dt>
            <dd className="font-medium text-black-eske dark:text-[#EAF2F8] text-left">{NOMBRE_TIPO_PROYECTO[proyecto.tipo] ?? proyecto.tipo}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-2 text-left">
            <dt className="text-bluegreen-eske dark:text-blue-eske-20 sm:w-28 shrink-0">Territorio</dt>
            <dd className="font-medium text-black-eske dark:text-[#EAF2F8] text-left">{rutaTerritorial(proyecto.territorio)}</dd>
          </div>
        </dl>

        <div className="mt-6 pt-6 border-t border-gray-eske-20 dark:border-white/10">
          <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8]">
            Indicadores mínimos identificados: {minimosPreview.length}
          </p>
          <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-1">
            Se consultarán automáticamente al confirmar — no podrán eliminarse de la sesión.
          </p>
          {minimosPreview.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {minimosPreview.map((id) => (
                <li
                  key={id}
                  className="px-2 py-1 rounded-full text-xs border border-bluegreen-eske-40 text-bluegreen-eske dark:text-blue-eske-20 dark:border-blue-eske-20"
                >
                  {FAMILIA1_NOMBRES[id] ?? id}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-black-eske-80 dark:text-[#9AAEBE] italic">
              No se identificaron indicadores mínimos para esta tarea — podrás explorar libremente.
            </p>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <div className="sm:w-fit">
            <Button
              label={confirmando ? "Consultando…" : "Consultar indicadores del proyecto"}
              onClick={onConfirmar}
              disabled={confirmando}
              className="sm:px-5"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
