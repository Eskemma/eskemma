"use client";

// app/centinela/fontana/FontanaF4PaisesModal.tsx
// Modal "Ver resto de países" — todos los países reales con dato para un
// indicador de Familia 4, ordenados por FAMILIA4_POLARIDAD (Punto B,
// Ronda 6, 2026-08-22). Mismo esqueleto de modal ya consolidado en
// FontanaMunicipiosModal.tsx (overlay + useFocusTrap + useEscapeKey) —
// sin componente Modal genérico, no existe uno en el repo.
//
// Ronda 7 (2026-08-22) — 4 ajustes de verificación visual:
//   1. Encabezado: "{indicador} — {fuente/año}" en vez de solo el
//      nombre del indicador.
//   2. Buscador (mismo patrón `normalizar()` + filtro en memoria que
//      FontanaMunicipiosModal.tsx), con mensaje explícito si no hay
//      match — nunca una lista vacía sin explicación.
//   3. Definición del indicador visible dentro del modal (no solo en el
//      tooltip (i) de la tabla principal).
//   4. Numeración usa `rankOficial` cuando la fuente lo publica (PNUD
//      HDR/Transparencia Internacional/RSF) — nunca la posición del
//      array cuando existe un rank real, ver bug diagnosticado en
//      Ronda 7 (empate México/Azerbaiyán en IDH, ambos rank 81 oficial,
//      la posición de array los distinguía incorrectamente).

import { useEffect, useState, type RefObject } from "react";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import NaturalezaBadge from "./NaturalezaBadge";
import type { PaisComparativoCompleto } from "@/lib/fontana/tablaComparativaInternacional";

interface Props {
  sesionId: string;
  indicadorId: string;
  indicadorNombre: string;
  definicion?: string;
  onClose: () => void;
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Ronda 8 (2026-08-22) — "índice (0-1)" a 3 decimales, no 2: con 2
// decimales, valores reales distintos (ej. HDI 0.797/0.794/0.791/0.789/
// 0.788/0.786/0.785) colapsan todos en "0.79" en pantalla, dando la
// falsa impresión de un empate masivo cuando el rank oficial de la
// fuente (que sí usa la precisión completa) los distingue correctamente
// — confusión real reportada por Raúl viendo el modal de IDH.
function formatearValor(valor: number, unidad?: string): string {
  const decimales = unidad === "índice (0-1)" ? 3 : 2;
  const numero = Number.isInteger(valor) ? valor.toLocaleString("es-MX") : valor.toLocaleString("es-MX", { maximumFractionDigits: decimales });
  if (unidad && !unidad.startsWith("rank global")) return `${numero} ${unidad}`;
  return numero;
}

export default function FontanaF4PaisesModal({ sesionId, indicadorId, indicadorNombre, definicion, onClose }: Props) {
  const containerRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paises, setPaises] = useState<PaisComparativoCompleto[]>([]);
  const [alcanceLatam, setAlcanceLatam] = useState(false);
  const [fuenteEncabezado, setFuenteEncabezado] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    fetch(`/api/fontana/familia/F4/paises?sesionId=${sesionId}&indicadorId=${indicadorId}`)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar la lista de países");
        return res.json();
      })
      .then((data: { paises: PaisComparativoCompleto[]; alcanceLatam: boolean }) => {
        if (cancelado) return;
        setPaises(data.paises);
        setAlcanceLatam(data.alcanceLatam);
        setFuenteEncabezado(data.paises[0]?.celda.fuenteEtiqueta ?? null);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : "Error inesperado");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [sesionId, indicadorId]);

  const filtrados = busqueda
    ? paises.filter((p) => normalizar(p.nombre).includes(normalizar(busqueda)))
    : paises;

  // Ronda 8 (2026-08-22) — el número de cada país se calcula UNA SOLA VEZ
  // sobre la lista completa (`paises`, ya ordenada por el servidor), no
  // sobre `filtrados` — bug real reportado por Raúl: buscar "México" lo
  // hacía aparecer como "1." (índice del array filtrado, 1 solo
  // resultado) en vez de conservar su posición real (90.) en el listado
  // completo. `rankOficial` (cuando la fuente lo publica) nunca depende
  // del filtro, pero la posición calculada sí dependía antes.
  const numeroPorPais = new Map(paises.map((p, i) => [p.iso3, p.celda.rankOficial ?? i + 1]));
  // Si NINGÚN país de este indicador trae rankOficial, el número es solo
  // la posición de Fontana en este listado (ordenado por valor), no un
  // rank publicado por la fuente — se aclara una sola vez, no por fila,
  // para no repetir la misma nota decenas de veces.
  const esRankOficial = paises.length > 0 && paises[0].celda.rankOficial !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="f4-paises-modal-title">
      <div
        className="absolute inset-0 bg-black-eske/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={containerRef as RefObject<HTMLDivElement>}
        className="relative z-10 bg-white-eske dark:bg-[#18324A] rounded-xl shadow-lg
          border border-gray-eske-20 dark:border-white/10 w-full max-w-lg max-h-[80vh] p-6 flex flex-col gap-3
          motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="f4-paises-modal-title" className="text-base font-semibold text-bluegreen-eske dark:text-blue-eske-20">
              {indicadorNombre}
              {fuenteEncabezado && <span className="text-black-eske dark:text-[#EAF2F8]"> — {fuenteEncabezado}</span>}
            </h2>
            {definicion && <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-1">{definicion}</p>}
            {alcanceLatam && (
              <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-1">
                Datos disponibles para América Latina y el Caribe. Esta fuente no publica este indicador para el resto del mundo.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-black-eske-80 dark:text-[#9AAEBE] hover:bg-gray-eske-10 dark:hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {paises.length > 5 && (
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar país"
            className="px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-sm text-black-eske dark:text-[#EAF2F8]"
          />
        )}

        {paises.length > 0 && (
          <p className="text-[11px] text-black-eske-60 dark:text-[#6D8294] -mt-1">
            {esRankOficial
              ? "El número es el rank oficial publicado por la fuente."
              : "El número indica la posición en este listado ordenado por valor — la fuente no publica un rank oficial para este indicador."}
          </p>
        )}

        {error && <p className="text-xs text-red-eske">{error}</p>}

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {cargando ? (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">Cargando…</p>
          ) : paises.length === 0 ? (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">Sin países con dato real para este indicador.</p>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">La fuente no tiene dato para "{busqueda}".</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {filtrados.map((p) => (
                <li key={p.iso3} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-eske-20 dark:border-white/10 last:border-0">
                  <span className="text-sm text-black-eske dark:text-[#EAF2F8]">
                    <span className="text-black-eske-60 dark:text-[#6D8294] mr-1.5">{numeroPorPais.get(p.iso3)}.</span>
                    {p.nombre}
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
                      {p.celda.unidad?.startsWith("rank global")
                        ? `Rank ${p.celda.valor} — ${p.celda.unidad.split(" — ")[1]}`
                        : formatearValor(p.celda.valor!, p.celda.unidad)}
                    </span>
                    {p.celda.naturaleza && <NaturalezaBadge naturaleza={p.celda.naturaleza} />}
                    {p.celda.notaAclaratoria && (
                      <span className="block text-[10px] italic text-black-eske-80 dark:text-[#9AAEBE] mt-0.5 max-w-[180px]">{p.celda.notaAclaratoria}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
