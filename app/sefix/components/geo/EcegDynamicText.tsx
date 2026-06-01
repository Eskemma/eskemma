"use client";
// app/sefix/components/geo/EcegDynamicText.tsx
// Right sidebar "Análisis Textual Dinámico" for Estadísticos Geoelectorales.
// Same visual design as EleccionesDynamicText.tsx.
import { generateAlcanceEceg, generateComparativoEceg } from "@/lib/sefix/ecegTextUtils";
import type { EcegCommitted } from "@/app/sefix/hooks/useGeoEcegFilters";
import type { EcegContexto } from "@/app/sefix/hooks/useGeoEcegContexto";
import type { EcegIndicator } from "@/lib/sefix/ecegConstants";
import { ECEG_GROUPS } from "@/lib/sefix/ecegConstants";

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-3 bg-gray-eske-10 dark:bg-blue-eske/10 rounded-md border-l-2 border-bluegreen-eske-40">
      <p className="text-xs font-semibold text-bluegreen-eske dark:text-[#4791B3] mb-1.5 uppercase tracking-wide">
        {label}
      </p>
      {children}
    </div>
  );
}

interface Props {
  committed: EcegCommitted;
  indicator: EcegIndicator | undefined;
  denominatorKey: string | undefined;
  contexto: EcegContexto | null;
  isLoading: boolean;
  error: string | null;
  onClose?: () => void;
}

export default function EcegDynamicText({
  committed,
  indicator,
  denominatorKey,
  contexto,
  isLoading,
  error,
  onClose,
}: Props) {
  const groupLabel = indicator
    ? (ECEG_GROUPS.find((g) => g.id === indicator.group)?.label ?? indicator.group)
    : "";

  return (
    <div className="space-y-3">
      {/* Panel header */}
      <p className="text-xs font-bold text-bluegreen-eske dark:text-[#6BA4C6] uppercase tracking-widest text-center">
        Análisis Dinámico
      </p>

      {/* Close button (mobile only) */}
      {onClose && (
        <div className="flex items-center justify-between sm:hidden">
          <span className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">Análisis</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de análisis"
            className="text-black-eske-60 dark:text-[#9AAEBE] hover:text-black-eske dark:hover:text-[#EAF2F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-eske rounded p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Indicador activo */}
      <div className="p-3 bg-gray-eske-10 dark:bg-blue-eske/10 rounded-md border-l-2 border-bluegreen-eske-40">
        <p className="text-xs font-semibold text-bluegreen-eske dark:text-[#4791B3] mb-1 uppercase tracking-wide">
          Indicador activo
        </p>
        {indicator ? (
          <>
            <p className="text-[11px] text-black-eske-60 dark:text-[#9AAEBE]">{groupLabel}</p>
            <p className="font-semibold text-sm text-black-eske dark:text-[#C7D6E0] leading-tight mt-0.5">
              {indicator.label}
            </p>
            {indicator.unit && (
              <p className="text-xs text-black-eske-50 dark:text-[#6D8294] mt-0.5">
                Unidad: {indicator.unit}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-black-eske-50 dark:text-[#6D8294]">—</p>
        )}
      </div>

      {/* Alcance de la consulta */}
      <Block label="Alcance de la consulta">
        <p className="text-sm text-black-eske dark:text-[#C7D6E0] leading-relaxed whitespace-pre-line">
          {generateAlcanceEceg(committed)}
        </p>
      </Block>

      {/* Comparativo por niveles */}
      <Block label="Análisis comparativo">
        {isLoading ? (
          <div className="space-y-2 animate-pulse" aria-hidden="true">
            {[60, 60, 60, 60].map((_, i) => (
              <div key={i} className="h-5 rounded bg-gray-eske-20 dark:bg-white/10" />
            ))}
          </div>
        ) : error ? (
          <p className="text-xs text-red-eske">{error}</p>
        ) : !contexto ? (
          <p className="text-sm text-black-eske-50 dark:text-[#6D8294]">
            Ejecuta una consulta para ver el análisis.
          </p>
        ) : indicator ? (
          <div className="space-y-1.5">
            {generateComparativoEceg(contexto, committed, indicator, denominatorKey).map(
              (line, i) => (
                <p
                  key={i}
                  className="text-sm text-black-eske dark:text-[#C7D6E0] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: line }}
                />
              )
            )}
          </div>
        ) : null}
      </Block>

      {/* Nota metodológica */}
      <div className="text-[11px] text-black-eske-40 dark:text-[#6D8294] leading-relaxed">
        <p>
          Fuente: INEGI — Estadísticas Censales a Escalas Geoelectorales (ECEG 2020).
          Datos del Censo de Población y Vivienda 2020.
        </p>
        {denominatorKey && (
          <p className="mt-1">
            Los porcentajes se calculan respecto al denominador natural de cada indicador.
          </p>
        )}
      </div>
    </div>
  );
}
