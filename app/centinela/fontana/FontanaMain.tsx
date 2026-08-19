"use client";

// app/centinela/fontana/FontanaMain.tsx
// Contenedor principal post-wizard — generalizado a familia activa
// (2026-08-07, habilitación del tab F2): antes solo renderizaba Familia 1
// hardcodeada; ahora recibe la familia activa como estado LOCAL (no
// prop — page.tsx no necesita conocerla) y deriva catálogo/fetch/PATCH de
// esa familia. F3-F5 siguen sin conector real — sus tabs se muestran
// deshabilitadas (ver FontanaFamiliaTabs.tsx).

import { useCallback, useEffect, useState } from "react";
import type { FamiliaFontanaId, FontanaSesion } from "@/types/fontana.types";
import type { NivelTablaFontana } from "@/lib/fontana/tablaColumnas";
import FontanaComparativeTable, { type IndicadorFilaFontana } from "./FontanaComparativeTable";
import FontanaFamiliaTabs from "./FontanaFamiliaTabs";
import { FAMILIA1_ORDEN, FAMILIA1_NOMBRES, FAMILIA1_DIFERIDOS } from "@/lib/fontana/familia1Catalogo";
import { FAMILIA2_ORDEN, FAMILIA2_NOMBRES, FAMILIA2_DIFERIDOS } from "@/lib/fontana/familia2Catalogo";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import Button from "@/app/components/Button";

interface Props {
  sesion: FontanaSesion;
  onSesionActualizada: (sesion: FontanaSesion) => void;
  // Ronda 9 (26-08-18) — para el enlace "Resolver en Moddulo" del modal de
  // ambigüedad, que necesita saber a dónde traer de vuelta al usuario.
  retornoUrl?: string;
}

interface FamiliaCatalogo {
  orden: string[];
  nombres: Record<string, string>;
  diferidos: Set<string>;
  titulo: string;
  descripcion: string;
  color: string;
}

// Mismos colores ya aprobados en FontanaFamiliaTabs.tsx (Fontana_T10_Cierre_Paso4.md §5).
const CATALOGO_POR_FAMILIA: Partial<Record<FamiliaFontanaId, FamiliaCatalogo>> = {
  F1: {
    orden: FAMILIA1_ORDEN,
    nombres: FAMILIA1_NOMBRES,
    diferidos: FAMILIA1_DIFERIDOS,
    titulo: "Familia 1 — Sociodemográficos",
    descripcion: "Indicadores derivados del Censo de Población y Vivienda 2020 (INEGI).",
    color: "#026988",
  },
  F2: {
    orden: FAMILIA2_ORDEN,
    nombres: FAMILIA2_NOMBRES,
    diferidos: FAMILIA2_DIFERIDOS,
    titulo: "Familia 2 — Socioeconómicos",
    descripcion: "Indicadores de pobreza, marginación, bienestar y acceso a servicios — fuentes oficiales (CONAPO, Bienestar, INEGI).",
    color: "#DB6015",
  },
};

export default function FontanaMain({ sesion, onSesionActualizada, retornoUrl }: Props) {
  const [familiaActiva, setFamiliaActiva] = useState<FamiliaFontanaId>("F1");
  const [indicadores, setIndicadores] = useState<IndicadorFilaFontana[] | null>(null);
  const [columnas, setColumnas] = useState<NivelTablaFontana[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [seleccionAgregar, setSeleccionAgregar] = useState("");

  const catalogo = CATALOGO_POR_FAMILIA[familiaActiva] ?? CATALOGO_POR_FAMILIA.F1!;

  const cargarIndicadores = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/fontana/familia/${familiaActiva}?sesionId=${sesion.sesionId}`);
      if (!res.ok) throw new Error(`No se pudieron cargar los indicadores de ${catalogo.titulo}`);
      const data = (await res.json()) as { indicadores: IndicadorFilaFontana[]; columnas: NivelTablaFontana[] };
      setIndicadores(data.indicadores);
      setColumnas(data.columnas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCargando(false);
    }
    // catalogo.titulo depende solo de familiaActiva — no se agrega como
    // dependencia extra para no recalcular el callback en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion.sesionId, familiaActiva]);

  useEffect(() => {
    setSeleccionAgregar("");
    cargarIndicadores();
  }, [cargarIndicadores]);

  async function modificarSesion(accion: "agregar" | "quitar", indicadorId: string) {
    const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, familiaId: familiaActiva, indicadorId }),
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

  const familia = sesion.indicadoresPorFamilia[familiaActiva];
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  // Excluye diferidos del selector manual — solo indicadores con conector
  // real son ofrecidos como opción de "+ Añadir" (decisión confirmada
  // 2026-08-07, sin precedente real de Familia 1 que copiar — investigado
  // que FAMILIA1_DIFERIDOS nunca tuvo consumidor en este repo).
  const disponiblesParaAgregar = catalogo.orden.filter((id) => !idsEnSesion.has(id) && !catalogo.diferidos.has(id));

  const conteosPorFamilia: Record<FamiliaFontanaId, number> = {
    F1: new Set([...sesion.indicadoresPorFamilia.F1.minimos, ...sesion.indicadoresPorFamilia.F1.seleccionUsuario]).size,
    F2: new Set([...sesion.indicadoresPorFamilia.F2.minimos, ...sesion.indicadoresPorFamilia.F2.seleccionUsuario]).size,
    F3: new Set([...sesion.indicadoresPorFamilia.F3.minimos, ...sesion.indicadoresPorFamilia.F3.seleccionUsuario]).size,
    F4: new Set([...sesion.indicadoresPorFamilia.F4.minimos, ...sesion.indicadoresPorFamilia.F4.seleccionUsuario]).size,
    F5: new Set([...sesion.indicadoresPorFamilia.F5.minimos, ...sesion.indicadoresPorFamilia.F5.seleccionUsuario]).size,
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
        {/* w-full flex justify-center en mobile: centra el/los botón(es) de
            cierre de la fila en vez de dejarlos alineados a la izquierda por
            defecto (align-items:stretch de la fila en flex-col). Funciona
            igual con 1 o 2 botones (gap-2) cuando este bloque pase a
            "Vincular a proyecto" / "Iniciar nuevo proyecto". */}
        <div className="w-full flex justify-center gap-2 sm:w-fit sm:justify-start" title="Disponible próximamente">
          <Button label="Regresar a Moddulo F3 con resultados" disabled className="px-5" />
        </div>
      </div>

      <FontanaFamiliaTabs
        familiaActiva={familiaActiva}
        conteos={conteosPorFamilia}
        onCambiar={setFamiliaActiva}
      />

      <h2 className="text-base md:text-lg font-semibold mt-4 mb-1" style={{ color: catalogo.color }}>
        {catalogo.titulo}
      </h2>
      <p className="text-xs md:text-sm text-black-eske-80 dark:text-[#9AAEBE] mb-4">
        {catalogo.descripcion}
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
              <option key={id} value={id}>{catalogo.nombres[id]}</option>
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
        <p className="text-sm text-red-eske">Cargando indicadores…</p>
      ) : (
        <FontanaComparativeTable sesionId={sesion.sesionId} columnas={columnas} indicadores={indicadores ?? []} onQuitar={handleQuitar} quitando={quitando} territorioNivel={sesion.territorio.nivel} modduloProjectId={sesion.modduloProjectId} retornoUrl={retornoUrl} />
      )}

      <div className="mt-6 text-[11px] text-black-eske-80 dark:text-[#9AAEBE] flex items-center gap-1">
        <span>Los indicadores con candado son requeridos por el Programa de Investigación Profunda de tu proyecto.</span>
        <InfoTooltip content="Los indicadores mínimos no pueden eliminarse de la sesión — Fontana los identifica a partir de la pregunta de investigación asignada en tu proyecto." />
      </div>
    </div>
  );
}
