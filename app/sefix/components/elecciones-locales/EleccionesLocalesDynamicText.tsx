"use client";
// Análisis textual dinámico para Elecciones Locales (sidebar derecho).
// 5 secciones: título, alcance, resumen, fuerza partidista, participación.
import { ResultadosEleccionesData, EleccionesLocalesFilterParams } from "@/types/sefix.types";
import {
  generateTituloLoc,
  generateAlcanceLoc,
  generateResumenGeneralLoc,
  generateFuerzaPartidistaLoc,
  generateParticipacionLoc,
} from "@/lib/sefix/eleccionesLocalesTextUtils";

function RichText({ html }: { html: string }) {
  return (
    <p
      dangerouslySetInnerHTML={{ __html: html }}
      className="text-sm leading-relaxed text-black-eske dark:text-[#C7D6E0]"
    />
  );
}

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
  data: ResultadosEleccionesData | null;
  committed: EleccionesLocalesFilterParams;
  isLoading: boolean;
  onClose?: () => void;
}

export default function EleccionesLocalesDynamicText({
  data,
  committed,
  isLoading,
  onClose,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[80, 60, 120, 80, 160].map((h, i) => (
          <div
            key={i}
            className="rounded-md bg-gray-eske-20 dark:bg-white/10"
            style={{ height: h }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-black-eske-60 dark:text-[#6D8294] text-center py-4">
        Ejecuta una consulta para ver el análisis.
      </p>
    );
  }

  const titulo = generateTituloLoc(committed.anio, committed.cargo, committed.tipo);
  const alcance = generateAlcanceLoc(committed);
  const resumen = generateResumenGeneralLoc(data, committed);
  const fuerza = generateFuerzaPartidistaLoc(data);
  const participacionLines = generateParticipacionLoc(data, committed);

  return (
    <div className="space-y-3">
      {/* Encabezado de sección */}
      <p className="text-xs font-bold text-bluegreen-eske dark:text-[#6BA4C6] uppercase tracking-widest text-center">
        Análisis Dinámico
      </p>

      {/* Header con botón cerrar (móvil) */}
      {onClose && (
        <div className="flex items-center justify-between sm:hidden">
          <span className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
            Análisis
          </span>
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

      {/* Título dinámico */}
      <div className="p-3 bg-gray-eske-10 dark:bg-blue-eske/10 rounded-md border-l-2 border-bluegreen-eske-40">
        <p className="font-semibold text-base text-black-eske dark:text-[#C7D6E0] text-center">
          {titulo.esExtraordinaria ? "Elección Local Extraordinaria" : "Elecciones Locales"}{" "}
          <span className="text-blue-eske dark:text-[#7B8FD4]">{titulo.anio}</span>
        </p>
        <p className="text-sm text-black-eske-60 dark:text-[#9AAEBE] text-center mt-0.5">
          {titulo.cargo}
        </p>
      </div>

      {/* Alcance del análisis */}
      <Block label="Alcance del análisis">
        <p className="text-sm text-black-eske dark:text-[#C7D6E0] leading-relaxed">{alcance}</p>
      </Block>

      {/* Resumen general */}
      <Block label="Resumen general">
        <RichText html={resumen} />
      </Block>

      {/* Fuerza partidista */}
      {fuerza && (
        <Block label="Fuerza partidista">
          <RichText html={fuerza} />
        </Block>
      )}

      {/* Participación electoral */}
      {participacionLines.length > 0 && (
        <Block label="Participación electoral">
          <div className="space-y-2">
            {participacionLines.map((line, i) => (
              <RichText key={i} html={line} />
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}
