"use client";

// app/centinela/fontana/FontanaF4Panel.tsx
// Layout propio de Familia 4 (comparación internacional) — mencionado en
// docs desde el Paso 3 (Fontana_T10_Cierre_Paso4.md §"F4: layout propio,
// sin niveles subnacionales") pero nunca implementado hasta esta ronda.
// NO reusa FontanaComparativeTable.tsx/columnasParaTipoProyecto/
// CeldaTablaFontana — confirmado en la investigación de esta ronda que
// esas piezas están acopladas 100% a la jerarquía geográfica mexicana.
// Cada columna aquí es un país (el país principal del proyecto +
// PAISES_REFERENCIA_F4, fijo).
//
// Ronda 6 (2026-08-22) — país principal dinámico (antes México fijo, ver
// resolverPaisPrincipal en familia4Catalogo.ts) + botón "Ver resto de
// países" por indicador (FontanaF4PaisesModal.tsx) + FAMILIA4_POLARIDAD
// sistemático (reemplaza el Set ad-hoc que antes solo cubría F4-9).

import { useState } from "react";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import NaturalezaBadge from "./NaturalezaBadge";
import CoberturaAdvertencia from "./CoberturaAdvertencia";
import FontanaF4PaisesModal from "./FontanaF4PaisesModal";
import type { CeldaComparativaPais, FilaComparativaInternacional } from "@/lib/fontana/tablaComparativaInternacional";
import { FAMILIA4_POLARIDAD } from "@/lib/fontana/familia4Catalogo";

export interface IndicadorFilaF4 {
  id: string;
  nombre: string;
  definicion?: string;
  esMinimo: boolean;
  fila: FilaComparativaInternacional;
}

interface Props {
  sesionId: string;
  indicadores: IndicadorFilaF4[];
  paisPrincipal: { iso3: string; nombre: string };
  paisesReferencia: { iso3: string; nombre: string }[];
  onQuitar: (indicadorId: string) => void;
  quitando: string | null;
}

// F4-1/F4-5 — solo Banco Mundial disponible (FMI bloqueado a nivel de
// infraestructura de red, ver bancoMundial.ts).
const INDICADORES_FMI_NO_DISPONIBLE = new Set(["F4-1", "F4-5"]);

// Ronda 8 (2026-08-22) — "índice (0-1)" a 3 decimales, mismo criterio y
// mismo motivo que FontanaF4PaisesModal.tsx (2 decimales colapsaba
// valores reales distintos, ej. HDI, en la misma cifra en pantalla).
function formatearValor(valor: number, unidad?: string): string {
  const decimales = unidad === "índice (0-1)" ? 3 : 2;
  const numero = Number.isInteger(valor) ? valor.toLocaleString("es-MX") : valor.toLocaleString("es-MX", { maximumFractionDigits: decimales });
  // La unidad de F4-6 (rank/categoría) ya trae su propio texto completo
  // ("rank global (de 167, edición 2024) — Hybrid regime") — no tiene
  // sentido anteponerle el número como si fuera una magnitud simple, se
  // muestra aparte en Celda.
  if (unidad && !unidad.startsWith("rank global")) return `${numero} ${unidad}`;
  return numero;
}

function Celda({ celda, indicadorId }: { celda: CeldaComparativaPais; indicadorId: string }) {
  if (celda.estadoConsulta !== "ok" || celda.valor === undefined) {
    const texto =
      celda.estadoConsulta === "error_conexion" ? "Error de conexión"
      : celda.estadoConsulta === "fuente_no_disponible" ? "Fuente no disponible"
      : "Sin dato";
    return (
      <div className="text-xs text-black-eske-80 dark:text-[#9AAEBE]">
        <p className="italic">{texto}</p>
        {celda.motivo && <p className="text-[10px] mt-0.5">{celda.motivo}</p>}
      </div>
    );
  }

  const unidadEsRank = celda.unidad?.startsWith("rank global");
  return (
    <div>
      {unidadEsRank ? (
        <>
          <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">Rank {celda.valor}</p>
          <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE]">{celda.unidad!.split(" — ")[1]}</p>
        </>
      ) : (
        <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">{formatearValor(celda.valor, celda.unidad)}</p>
      )}
      {celda.naturaleza && <NaturalezaBadge naturaleza={celda.naturaleza} />}
      {celda.fuenteEtiqueta && <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">{celda.fuenteEtiqueta}</p>}
      {celda.notaAclaratoria && <p className="text-[10px] italic text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">{celda.notaAclaratoria}</p>}
      {INDICADORES_FMI_NO_DISPONIBLE.has(indicadorId) && <CoberturaAdvertencia nivel="fmi_no_disponible" />}
    </div>
  );
}

export default function FontanaF4Panel({ sesionId, indicadores, paisPrincipal, paisesReferencia, onQuitar, quitando }: Props) {
  const [modalIndicador, setModalIndicador] = useState<{ id: string; nombre: string; definicion?: string } | null>(null);

  if (indicadores.length === 0) {
    return <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">Sin indicadores seleccionados en esta familia.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-eske-20 dark:border-white/10">
            <th className="py-2 pr-3 text-xs font-semibold text-black-eske dark:text-[#EAF2F8] w-[170px]">Indicador</th>
            <th className="py-2 px-3 text-xs font-semibold text-bluegreen-eske w-[140px]">{paisPrincipal.nombre}</th>
            {paisesReferencia.map((p) => (
              <th key={p.iso3} className="py-2 px-3 text-xs font-semibold text-black-eske dark:text-[#EAF2F8] w-[140px]">
                {p.nombre}
              </th>
            ))}
            <th className="py-2 pl-3 w-20" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {indicadores.map((ind) => (
            <tr key={ind.id} className="border-b border-gray-eske-20 dark:border-white/10 align-top">
              <td className="py-3 pr-3">
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="text-sm font-medium text-black-eske dark:text-[#EAF2F8] break-words min-w-0">{ind.nombre}</span>
                  {ind.definicion && <InfoTooltip content={ind.definicion} />}
                  {ind.esMinimo && (
                    <span aria-hidden="true" title="Indicador mínimo del proyecto" className="text-black-eske-60 dark:text-[#6D8294]">
                      🔒
                    </span>
                  )}
                </div>
                {FAMILIA4_POLARIDAD[ind.id] === "menor_mejor" && (
                  <p className="text-[10px] italic text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">Valor bajo = mejor posición</p>
                )}
                {FAMILIA4_POLARIDAD[ind.id] && (
                  <button
                    type="button"
                    onClick={() => setModalIndicador({ id: ind.id, nombre: ind.nombre, definicion: ind.definicion })}
                    className="block text-[11px] text-bluegreen-eske dark:text-blue-eske-20 hover:underline mt-1"
                  >
                    Ver resto de países
                  </button>
                )}
              </td>
              <td className="py-3 px-3">
                <Celda celda={ind.fila.paisPrincipal} indicadorId={ind.id} />
              </td>
              {paisesReferencia.map((p, i) => {
                const celda = ind.fila.referencia[i] ?? { iso3: p.iso3, estadoConsulta: "sin_datos_confirmado" as const };
                return (
                  <td key={p.iso3} className="py-3 px-3">
                    <Celda celda={celda} indicadorId={ind.id} />
                  </td>
                );
              })}
              <td className="py-3 pl-3">
                {!ind.esMinimo && (
                  <button
                    type="button"
                    onClick={() => onQuitar(ind.id)}
                    disabled={quitando === ind.id}
                    className="text-xs text-red-eske hover:underline shrink-0 disabled:opacity-50"
                  >
                    {quitando === ind.id ? "Quitando…" : "Quitar"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalIndicador && (
        <FontanaF4PaisesModal
          sesionId={sesionId}
          indicadorId={modalIndicador.id}
          indicadorNombre={modalIndicador.nombre}
          definicion={modalIndicador.definicion}
          onClose={() => setModalIndicador(null)}
        />
      )}
    </div>
  );
}
