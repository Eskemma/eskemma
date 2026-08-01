"use client";

// app/centinela/fontana/FontanaMain.tsx
// Contenedor principal post-wizard — este incremento solo renderiza
// Familia 1 (Sociodemográficos). El resto de familias, el Canvas y el
// panel del agente no se construyen todavía; sus tabs se muestran
// deshabilitadas (ver FontanaFamiliaTabs.tsx).

import { useCallback, useEffect, useState } from "react";
import type { FamiliaFontanaId, FontanaSesion } from "@/types/fontana.types";
import type { NivelTablaFontana } from "@/lib/fontana/tablaColumnas";
import FontanaComparativeTable, { type IndicadorFilaFontana } from "./FontanaComparativeTable";
import FontanaFamiliaTabs from "./FontanaFamiliaTabs";
import { FAMILIA1_ORDEN, FAMILIA1_NOMBRES } from "@/lib/fontana/familia1Catalogo";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import Button from "@/app/components/Button";

interface Props {
  sesion: FontanaSesion;
  onSesionActualizada: (sesion: FontanaSesion) => void;
}

export default function FontanaMain({ sesion, onSesionActualizada }: Props) {
  const [indicadores, setIndicadores] = useState<IndicadorFilaFontana[] | null>(null);
  const [columnas, setColumnas] = useState<NivelTablaFontana[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [seleccionAgregar, setSeleccionAgregar] = useState("");

  const cargarIndicadores = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/fontana/familia/F1?sesionId=${sesion.sesionId}`);
      if (!res.ok) throw new Error("No se pudieron cargar los indicadores de Familia 1");
      const data = (await res.json()) as { indicadores: IndicadorFilaFontana[]; columnas: NivelTablaFontana[] };
      setIndicadores(data.indicadores);
      setColumnas(data.columnas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCargando(false);
    }
  }, [sesion.sesionId]);

  useEffect(() => {
    cargarIndicadores();
  }, [cargarIndicadores]);

  async function modificarSesion(accion: "agregar" | "quitar", indicadorId: string) {
    const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, familiaId: "F1", indicadorId }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { mensaje?: string; error?: string };
      throw new Error(err.mensaje ?? err.error ?? "No se pudo actualizar la sesión");
    }
    const { sesion: actualizada } = (await res.json()) as { sesion: FontanaSesion };
    onSesionActualizada(actualizada);
    await cargarIndicadores();
  }

  async function handleQuitar(indicadorId: string) {
    setQuitando(indicadorId);
    try {
      await modificarSesion("quitar", indicadorId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setQuitando(null);
    }
  }

  async function handleAgregar() {
    if (!seleccionAgregar) return;
    setAgregando(true);
    try {
      await modificarSesion("agregar", seleccionAgregar);
      setSeleccionAgregar("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setAgregando(false);
    }
  }

  const familia = sesion.indicadoresPorFamilia.F1;
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  const disponiblesParaAgregar = FAMILIA1_ORDEN.filter((id) => !idsEnSesion.has(id));

  const conteosPorFamilia: Record<FamiliaFontanaId, number> = {
    F1: idsEnSesion.size,
    F2: 0,
    F3: 0,
    F4: 0,
    F5: 0,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
      {/* Banda de contexto */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-black-eske dark:text-[#EAF2F8]">Fontana</h1>
          <p className="text-xs md:text-sm text-black-eske-80 dark:text-[#9AAEBE]">
            {sesion.territorio.nombre || [sesion.territorio.estado, sesion.territorio.municipio].filter(Boolean).join(" › ")}
          </p>
        </div>
        <div className="inline-block w-fit" title="Disponible próximamente">
          <Button label="Regresar a Moddulo F3 con resultados" disabled className="px-5" />
        </div>
      </div>

      <FontanaFamiliaTabs
        familiaActiva="F1"
        conteos={conteosPorFamilia}
        onCambiar={() => {
          /* solo Familia 1 está habilitada este incremento */
        }}
      />

      <h2 className="text-base md:text-lg font-semibold mt-4 mb-1" style={{ color: "#026988" }}>
        Familia 1 — Sociodemográficos
      </h2>
      <p className="text-xs md:text-sm text-black-eske-80 dark:text-[#9AAEBE] mb-4">
        Indicadores derivados del Censo de Población y Vivienda 2020 (INEGI).
      </p>

      {/* + Añadir indicador */}
      {disponiblesParaAgregar.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <select
            value={seleccionAgregar}
            onChange={(e) => setSeleccionAgregar(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-sm text-black-eske dark:text-[#EAF2F8]"
          >
            <option value="">+ Añadir indicador…</option>
            {disponiblesParaAgregar.map((id) => (
              <option key={id} value={id}>{FAMILIA1_NOMBRES[id]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAgregar}
            disabled={!seleccionAgregar || agregando}
            className="px-4 py-2 rounded-lg bg-bluegreen-eske text-white-eske text-sm font-medium hover:bg-bluegreen-eske-60 disabled:opacity-60 shrink-0"
          >
            {agregando ? "Añadiendo…" : "Añadir"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs md:text-sm text-red-eske mb-3">{error}</p>
      )}

      <h3 className="text-sm md:text-base font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
        Tabla comparativa por nivel
      </h3>
      {cargando ? (
        <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">Cargando indicadores…</p>
      ) : (
        <FontanaComparativeTable columnas={columnas} indicadores={indicadores ?? []} onQuitar={handleQuitar} quitando={quitando} />
      )}

      <div className="mt-6 text-[11px] text-black-eske-80 dark:text-[#9AAEBE] flex items-center gap-1">
        <span>Los indicadores con candado son requeridos por el Programa de Investigación Profunda de tu proyecto.</span>
        <InfoTooltip content="Los indicadores mínimos no pueden eliminarse de la sesión — Fontana los identifica a partir de la pregunta de investigación asignada en tu proyecto." />
      </div>
    </div>
  );
}
