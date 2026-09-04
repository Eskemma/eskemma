"use client";

// app/centinela/fontana/FontanaIndicadoresAccordion.tsx
// Pestaña "Indicadores" del workspace de Fontana (T10) — acordeón
// horizontal de las 5 familias, una abierta a la vez. Carga PEREZOSA con
// caché en estado local: al expandir F_n por primera vez se hace fetch a
// /api/fontana/familia/F_n; re-expandir NO vuelve a pedir. Mutar la
// selección (añadir/quitar indicador) invalida la caché de esa familia.
//
// La lógica de catálogo por familia, fetch y "+ Añadir indicador" vivía
// en FontanaMain.tsx antes del rediseño de 2 pestañas — se movió aquí.

import { useCallback, useEffect, useState } from "react";
import type { FamiliaFontanaId, FontanaSesion } from "@/types/fontana.types";
import type { NivelTablaFontana } from "@/lib/fontana/tablaColumnas";
import type { IndicadorFilaFontana } from "@/lib/fontana/tablaColumnas";
import FontanaComparativeTable from "./FontanaComparativeTable";
import FontanaF4Panel, { type IndicadorFilaF4 } from "./FontanaF4Panel";
import { FAMILIA1_ORDEN, FAMILIA1_NOMBRES } from "@/lib/fontana/familia1Catalogo";
import { FAMILIA2_ORDEN, FAMILIA2_NOMBRES } from "@/lib/fontana/familia2Catalogo";
import { FAMILIA3_ORDEN, FAMILIA3_NOMBRES } from "@/lib/fontana/familia3Catalogo";
import { FAMILIA4_ORDEN, FAMILIA4_NOMBRES } from "@/lib/fontana/familia4Catalogo";
import { FAMILIA5_ORDEN, FAMILIA5_NOMBRES } from "@/lib/fontana/familia5Catalogo";
import { FAMILIA_META } from "@/lib/fontana/familias";
import InfoTooltip from "@/app/components/ui/InfoTooltip";

interface FamiliaMeta {
  id: FamiliaFontanaId;
  nombre: string;
  color: string;
  descripcion: string;
  orden: string[];
  nombres: Record<string, string>;
}

// nombre / color / descripcion salen de la fuente única (lib/fontana/familias.ts);
// orden / nombres (por indicador) siguen viniendo de los catálogos por familia.
const FAMILIAS: FamiliaMeta[] = [
  { ...FAMILIA_META.F1, orden: FAMILIA1_ORDEN, nombres: FAMILIA1_NOMBRES },
  { ...FAMILIA_META.F2, orden: FAMILIA2_ORDEN, nombres: FAMILIA2_NOMBRES },
  { ...FAMILIA_META.F3, orden: FAMILIA3_ORDEN, nombres: FAMILIA3_NOMBRES },
  { ...FAMILIA_META.F4, orden: FAMILIA4_ORDEN, nombres: FAMILIA4_NOMBRES },
  { ...FAMILIA_META.F5, orden: FAMILIA5_ORDEN, nombres: FAMILIA5_NOMBRES },
];

type FamiliaData =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "geo"; columnas: NivelTablaFontana[]; indicadores: IndicadorFilaFontana[] }
  | { kind: "f4"; indicadores: IndicadorFilaF4[]; paisPrincipal: { iso3: string; nombre: string }; paisesReferencia: { iso3: string; nombre: string }[] };

interface Props {
  sesion: FontanaSesion;
  expandedFamily: FamiliaFontanaId | null;
  onExpandedFamilyChange: (id: FamiliaFontanaId | null) => void;
  onSesionActualizada: (sesion: FontanaSesion) => void;
  retornoUrl?: string;
}

export default function FontanaIndicadoresAccordion({
  sesion,
  expandedFamily,
  onExpandedFamilyChange,
  onSesionActualizada,
  retornoUrl,
}: Props) {
  const [cache, setCache] = useState<Partial<Record<FamiliaFontanaId, FamiliaData>>>({});
  const [seleccionAgregar, setSeleccionAgregar] = useState("");
  const [mutando, setMutando] = useState<string | null>(null);
  const [errorMutacion, setErrorMutacion] = useState<string | null>(null);

  const cargarFamilia = useCallback(
    async (familiaId: FamiliaFontanaId) => {
      setCache((prev) => ({ ...prev, [familiaId]: { kind: "loading" } }));
      try {
        const res = await fetch(`/api/fontana/familia/${familiaId}?sesionId=${sesion.sesionId}`);
        if (!res.ok) throw new Error(`No se pudieron cargar los indicadores de la familia ${familiaId}.`);
        const data = await res.json();
        if (familiaId === "F4") {
          setCache((prev) => ({
            ...prev,
            F4: {
              kind: "f4",
              indicadores: data.indicadores as IndicadorFilaF4[],
              paisPrincipal: data.paisPrincipal,
              paisesReferencia: data.paisesReferencia,
            },
          }));
        } else {
          setCache((prev) => ({
            ...prev,
            [familiaId]: {
              kind: "geo",
              columnas: data.columnas as NivelTablaFontana[],
              indicadores: data.indicadores as IndicadorFilaFontana[],
            },
          }));
        }
      } catch (err) {
        setCache((prev) => ({
          ...prev,
          [familiaId]: { kind: "error", message: err instanceof Error ? err.message : "Error inesperado" },
        }));
      }
    },
    [sesion.sesionId]
  );

  // Al cambiar de familia expandida: cargar solo si no hay caché.
  useEffect(() => {
    setSeleccionAgregar("");
    setErrorMutacion(null);
    if (expandedFamily && !cache[expandedFamily]) {
      cargarFamilia(expandedFamily);
    }
  }, [expandedFamily, cache, cargarFamilia]);

  async function modificarSesion(accion: "agregar" | "quitar", familiaId: FamiliaFontanaId, indicadorId: string) {
    setMutando(indicadorId);
    setErrorMutacion(null);
    try {
      const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, familiaId, indicadorId }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { mensaje?: string; error?: string };
        throw new Error(err.mensaje ?? err.error ?? "No se pudo actualizar la sesión");
      }
      const { sesion: actualizada } = (await res.json()) as { sesion: FontanaSesion };
      onSesionActualizada(actualizada);
      // Invalida la caché de esa familia — la selección cambió.
      setCache((prev) => ({ ...prev, [familiaId]: undefined }));
      await cargarFamilia(familiaId);
    } catch (err) {
      setErrorMutacion(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setMutando(null);
    }
  }

  // Punto 1 (26-09-05): "Añadir todos los indicadores" / "Limpiar
  // indicadores" — mismo bulk PATCH del backend, sin indicadorId.
  const BULK_SENTINEL = "__bulk__";
  async function modificarSesionBulk(accion: "agregar_todos" | "quitar_todos", familiaId: FamiliaFontanaId) {
    setMutando(BULK_SENTINEL);
    setErrorMutacion(null);
    try {
      const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, familiaId }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { mensaje?: string; error?: string };
        throw new Error(err.mensaje ?? err.error ?? "No se pudo actualizar la sesión");
      }
      const { sesion: actualizada } = (await res.json()) as { sesion: FontanaSesion };
      onSesionActualizada(actualizada);
      setCache((prev) => ({ ...prev, [familiaId]: undefined }));
      await cargarFamilia(familiaId);
    } catch (err) {
      setErrorMutacion(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setMutando(null);
    }
  }

  const familiaMeta = FAMILIAS.find((f) => f.id === expandedFamily);
  const familiaSeleccion = expandedFamily ? sesion.indicadoresPorFamilia[expandedFamily] : null;
  const idsEnSesion = familiaSeleccion
    ? new Set([...familiaSeleccion.minimos, ...familiaSeleccion.seleccionUsuario])
    : new Set<string>();
  const disponiblesParaAgregar = familiaMeta
    ? familiaMeta.orden.filter((id) => !idsEnSesion.has(id))
    : [];

  const conteo = (id: FamiliaFontanaId) =>
    new Set([...sesion.indicadoresPorFamilia[id].minimos, ...sesion.indicadoresPorFamilia[id].seleccionUsuario]).size;

  const data = expandedFamily ? cache[expandedFamily] : undefined;

  return (
    <div className="px-4 md:px-8 py-6">
      {/* Fila de familias (segmented control) */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Familias de indicadores">
        {FAMILIAS.map((f) => {
          const active = expandedFamily === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onExpandedFamilyChange(active ? null : f.id)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors"
              style={
                active
                  ? { background: f.color, color: "#fff", borderColor: f.color }
                  : { background: "transparent", color: "inherit", borderColor: "#e5e7eb" }
              }
            >
              <span
                className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 text-white"
                style={{ background: active ? "rgba(255,255,255,0.25)" : f.color }}
                aria-hidden="true"
              >
                {f.id.replace("F", "")}
              </span>
              {f.nombre}
              <span className="text-xs opacity-70">{conteo(f.id)}</span>
              <span className="transition-transform" style={{ transform: active ? "rotate(180deg)" : "none" }}>
                ▾
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel expandido */}
      {expandedFamily && familiaMeta ? (
        <div
          className="mt-4 rounded-b-xl bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 border-t-2 p-4 md:p-5"
          style={{ borderTopColor: familiaMeta.color }}
        >
          <h3 className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">{familiaMeta.nombre}</h3>
          <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] mb-4">{familiaMeta.descripcion}</p>

          {/* + Añadir indicador, y a la derecha: Añadir todos / Limpiar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            {disponiblesParaAgregar.length > 0 ? (
              <div className="flex flex-col sm:flex-row gap-2 sm:flex-1">
                <select
                  value={seleccionAgregar}
                  onChange={(e) => setSeleccionAgregar(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-sm text-black-eske dark:text-[#EAF2F8]"
                >
                  <option value="">+ Añadir indicador…</option>
                  {disponiblesParaAgregar.map((id) => (
                    <option key={id} value={id}>
                      {familiaMeta.nombres[id] ?? id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => seleccionAgregar && modificarSesion("agregar", familiaMeta.id, seleccionAgregar)}
                  disabled={!seleccionAgregar || mutando !== null}
                  className="px-4 py-2 rounded-lg bg-bluegreen-eske text-white-eske text-sm font-medium hover:bg-bluegreen-eske-60 disabled:opacity-60 shrink-0"
                >
                  Añadir
                </button>
              </div>
            ) : (
              <div className="sm:flex-1" />
            )}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => modificarSesionBulk("agregar_todos", familiaMeta.id)}
                disabled={disponiblesParaAgregar.length === 0 || mutando !== null}
                className="text-[11px] text-bluegreen-eske dark:text-blue-eske-20 underline underline-offset-2 hover:text-bluegreen-eske-70 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Añadir todos los indicadores
              </button>
              <button
                type="button"
                onClick={() => modificarSesionBulk("quitar_todos", familiaMeta.id)}
                disabled={(familiaSeleccion?.seleccionUsuario.length ?? 0) === 0 || mutando !== null}
                className="text-[11px] text-bluegreen-eske dark:text-blue-eske-20 underline underline-offset-2 hover:text-bluegreen-eske-70 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Limpiar indicadores
              </button>
            </div>
          </div>

          {errorMutacion && <p className="text-xs text-red-eske mb-3">{errorMutacion}</p>}

          {!data || data.kind === "loading" ? (
            <p className="text-sm text-red-eske">Cargando indicadores…</p>
          ) : data.kind === "error" ? (
            <p className="text-sm text-red-eske">{data.message}</p>
          ) : data.kind === "f4" ? (
            <FontanaF4Panel
              sesionId={sesion.sesionId}
              indicadores={data.indicadores}
              paisPrincipal={data.paisPrincipal}
              paisesReferencia={data.paisesReferencia}
              onQuitar={(id) => modificarSesion("quitar", "F4", id)}
              quitando={mutando}
            />
          ) : (
            <FontanaComparativeTable
              sesionId={sesion.sesionId}
              columnas={data.columnas}
              indicadores={data.indicadores}
              onQuitar={(id) => modificarSesion("quitar", familiaMeta.id, id)}
              quitando={mutando}
              territorioNivel={sesion.territorio.nivel}
              territorio={sesion.territorio}
              modduloProjectId={sesion.modduloProjectId}
              retornoUrl={retornoUrl}
            />
          )}

          <div className="mt-6 text-[11px] text-black-eske-80 dark:text-[#9AAEBE] flex items-center gap-1">
            <span>Los indicadores con candado son requeridos por el Programa de Investigación Profunda de tu proyecto.</span>
            <InfoTooltip content="Los indicadores mínimos no pueden eliminarse de la sesión." />
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-black-eske-80 dark:text-[#9AAEBE] border border-dashed border-gray-eske-20 dark:border-white/10 rounded-xl p-8 text-center">
          Selecciona una familia para ver su tabla comparativa.
        </div>
      )}
    </div>
  );
}
