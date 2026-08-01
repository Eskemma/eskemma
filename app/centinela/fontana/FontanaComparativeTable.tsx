"use client";

// app/centinela/fontana/FontanaComparativeTable.tsx
// Tabla comparativa por nivel geográfico — columnas dinámicas según el
// tipo de proyecto (Documentación Técnica §5.2). Mínimos con candado (sin
// control de quitar), selección libre removible, cada celda con
// naturaleza del dato + fuente o motivo explícito si no hay valor.
// Mobile-first: lista de tarjetas apiladas en mobile, tabla en pantallas
// medianas o mayores (ambas leen los mismos datos).
//
// Confiabilidad: no es un elemento nuevo — el borde del badge de
// naturaleza (que ya existía) deja de estar fijo a un color y pasa a
// reflejar alta/media/baja, derivada de esa misma naturaleza. Paleta con
// variante distinta por modo claro/oscuro (no solo un tono más oscuro),
// mismo criterio ya verificado en PESTLPanelV2.tsx (nivelConfianza).

import InfoTooltip from "@/app/components/ui/InfoTooltip";
import type { CeldaTablaFontana, NivelTablaFontana } from "@/lib/fontana/tablaColumnas";
import { NOMBRE_NIVEL_TABLA } from "@/lib/fontana/tablaColumnas";

export interface IndicadorFilaFontana {
  id: string;
  nombre: string;
  definicion?: string;
  fuenteEtiqueta?: string;
  esMinimo: boolean;
  celdas: CeldaTablaFontana[];
}

interface Props {
  columnas: NivelTablaFontana[];
  indicadores: IndicadorFilaFontana[];
  onQuitar: (indicadorId: string) => void;
  quitando?: string | null;
}

type Confiabilidad = "alta" | "media" | "baja";

// Verde en ambos modos; café en claro / amarillo en oscuro; rojo en
// claro / naranja en oscuro — tokens ya existentes del sistema, ninguno
// nuevo. No asumir "oscuro = mismo tono más oscuro": la familia de color
// cambia por nivel, igual que en el precedente real (PESTLPanelV2.tsx).
const CONFIABILIDAD_BORDE: Record<Confiabilidad, string> = {
  alta: "border-green-eske dark:border-green-eske",
  media: "border-brown-eske-60 dark:border-yellow-eske",
  baja: "border-red-eske dark:border-orange-eske-40",
};

const NATURALEZA_A_CONFIABILIDAD: Record<string, Confiabilidad> = {
  dato_directo: "alta",
  calculo_directo: "alta",
  estimacion_modelada: "media",
  estimacion_agregada: "media",
  proxy_conceptual: "baja",
};

const NATURALEZA_LABEL: Record<string, string> = {
  dato_directo: "Dato directo",
  calculo_directo: "Cálculo directo",
  estimacion_modelada: "Estimación modelada",
  estimacion_agregada: "Estimación agregada",
  proxy_conceptual: "Proxy conceptual",
};

function Celda({ celda }: { celda: CeldaTablaFontana }) {
  if (celda.valor !== undefined) {
    const confiabilidad = celda.naturaleza ? NATURALEZA_A_CONFIABILIDAD[celda.naturaleza] : undefined;
    return (
      <div className="space-y-1">
        <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
          {celda.valor.toLocaleString("es-MX")}
          {celda.unidad ? <span className="ml-1 font-normal text-xs text-black-eske-80 dark:text-[#9AAEBE]">{celda.unidad}</span> : null}
        </p>
        {celda.naturaleza && (
          <span
            className={`inline-block px-1.5 py-0.5 rounded border text-[10px] text-black-eske-80 dark:text-[#9AAEBE] ${
              confiabilidad ? CONFIABILIDAD_BORDE[confiabilidad] : "border-gray-eske-40"
            }`}
          >
            {NATURALEZA_LABEL[celda.naturaleza] ?? celda.naturaleza}
          </span>
        )}
        {celda.fuenteEtiqueta && <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE]">{celda.fuenteEtiqueta}</p>}
      </div>
    );
  }
  return <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] italic">{celda.motivo}</p>;
}

export default function FontanaComparativeTable({ columnas, indicadores, onQuitar, quitando }: Props) {
  if (indicadores.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/40 dark:bg-[#112230] text-center">
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">
          Aún no hay indicadores en esta sesión. Usa &quot;Añadir indicador&quot; para empezar a explorar.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile — tarjetas apiladas */}
      <div className="md:hidden space-y-3">
        {indicadores.map((ind) => (
          <div key={ind.id} className="rounded-lg border border-gray-eske-20 dark:border-white/10 p-3 bg-white-eske dark:bg-[#18324A]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {ind.esMinimo && (
                  <span aria-label="Indicador mínimo del PIP" title="Indicador mínimo del PIP">
                    <LockIcon />
                  </span>
                )}
                <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] truncate">{ind.nombre}</p>
                {ind.definicion && (
                  <InfoTooltip content={ind.definicion ?? ""} fuente={ind.fuenteEtiqueta} />
                )}
              </div>
              {!ind.esMinimo && (
                <button
                  type="button"
                  onClick={() => onQuitar(ind.id)}
                  disabled={quitando === ind.id}
                  className="text-xs text-red-eske hover:underline shrink-0 disabled:opacity-50"
                >
                  Quitar
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {columnas.map((nivel) => {
                const celda = ind.celdas.find((c) => c.nivel === nivel);
                if (!celda) return null;
                return (
                  <div key={nivel}>
                    <p className="text-[10px] uppercase tracking-wide text-black-eske-80 dark:text-[#9AAEBE] mb-1">
                      {NOMBRE_NIVEL_TABLA[nivel]}
                    </p>
                    <Celda celda={celda} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop — tabla */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-eske-20 dark:border-white/10">
        <table className="w-full text-left">
          <thead className="bg-gray-eske-10/60 dark:bg-[#112230]">
            <tr>
              <th className="px-3 py-2 text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE]">Indicador</th>
              {columnas.map((nivel) => (
                <th key={nivel} className="px-3 py-2 text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE]">
                  {NOMBRE_NIVEL_TABLA[nivel]}
                </th>
              ))}
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {indicadores.map((ind) => (
              <tr key={ind.id} className="border-t border-gray-eske-20 dark:border-white/10">
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {ind.esMinimo && (
                      <span aria-label="Indicador mínimo del PIP" title="Indicador mínimo del PIP">
                        <LockIcon />
                      </span>
                    )}
                    <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8]">{ind.nombre}</p>
                    {ind.definicion && (
                      <InfoTooltip content={ind.definicion ?? ""} fuente={ind.fuenteEtiqueta} />
                    )}
                  </div>
                </td>
                {columnas.map((nivel) => {
                  const celda = ind.celdas.find((c) => c.nivel === nivel);
                  return (
                    <td key={nivel} className="px-3 py-2 align-top">
                      {celda ? <Celda celda={celda} /> : null}
                    </td>
                  );
                })}
                <td className="px-3 py-2 align-top text-right">
                  {!ind.esMinimo && (
                    <button
                      type="button"
                      onClick={() => onQuitar(ind.id)}
                      disabled={quitando === ind.id}
                      className="text-xs text-red-eske hover:underline disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-black-eske-80 dark:text-[#9AAEBE] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v2" />
    </svg>
  );
}
