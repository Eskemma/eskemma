"use client";

// app/centinela/fontana/FontanaCanvasItemCard.tsx
// Renderiza un FontanaCanvasItem en la pestaña "Fontana" (Canvas). El
// tipo "tabla" reutiliza FontanaComparativeTable tal cual (no se duplica).
//
// Kebab (⋮, 26-09-05): Descargar (PDF para resumen/tabla/desglose vía
// lib/shared/reportExport.ts; PNG/JPG para grafica/distribucion/
// serie_temporal vía app/components/shared/exportElementAsImage.ts) y
// Eliminar (borrado suave — eliminado:true, nunca se borra el documento).
// Modal de confirmación: mismo patrón inline de FontanaSesionesHub.tsx
// (SesionCard) — no existe un componente compartido de confirmación hoy.

import { useEffect, useRef, useState } from "react";
import type { FontanaCanvasItem, FontanaSesion } from "@/types/fontana.types";
import { NOMBRE_NIVEL_TABLA } from "@/lib/fontana/tablaColumnas";
import { FAMILIA_META } from "@/lib/fontana/familias";
import NaturalezaBadge from "./NaturalezaBadge";
import FontanaComparativeTable from "./FontanaComparativeTable";
import { canvasItemToMarkdown } from "@/lib/fontana/canvasExport";
import { exportToPdf, buildFilename } from "@/lib/shared/reportExport";
import { exportElementAsImage, type FormatoImagen } from "@/app/components/shared/exportElementAsImage";

interface Props {
  item: FontanaCanvasItem;
  sesion: FontanaSesion;
  onEliminado?: (itemId: string) => void;
}

const TIPOS_IMAGEN = new Set<FontanaCanvasItem["tipo"]>(["grafica", "distribucion", "serie_temporal", "comparacion_territorios", "serie_internacional"]);
const TIPOS_PDF = new Set<FontanaCanvasItem["tipo"]>(["resumen", "tabla", "desglose"]);

export default function FontanaCanvasItemCard({ item, sesion, onEliminado }: Props) {
  const color = FAMILIA_META[item.familiaId]?.color ?? "#248cc1";
  const graficaRef = useRef<HTMLDivElement>(null);
  const kebabRef = useRef<HTMLDivElement>(null);

  const [kebabOpen, setKebabOpen] = useState(false);
  const [submenuDescarga, setSubmenuDescarga] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!kebabOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false);
        setSubmenuDescarga(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [kebabOpen]);

  // Referencia legible de ESTA tarjeta para el nombre de archivo — el
  // título ("Índice de Percepción de Corrupción — comparación
  // internacional (2012-2024)"), no el id opaco `cv-…`. Sin título
  // (defensivo) cae al id.
  const refDescarga = item.titulo?.trim() || item.id;

  async function handleDescargarPdf() {
    setDescargando(true);
    setErrorDescarga(null);
    try {
      const markdown = canvasItemToMarkdown(item);
      const baseName = sesion.nombre || sesion.territorio.nombre || "Fontana";
      await exportToPdf(markdown, baseName, refDescarga, item.titulo, "Fontana");
    } catch {
      setErrorDescarga("No se pudo generar el PDF.");
    } finally {
      setDescargando(false);
      setKebabOpen(false);
      setSubmenuDescarga(false);
    }
  }

  async function handleDescargarImagen(formato: FormatoImagen) {
    if (!graficaRef.current) return;
    setDescargando(true);
    setErrorDescarga(null);
    try {
      const baseName = sesion.nombre || sesion.territorio.nombre || "Fontana";
      const filename = buildFilename(baseName, refDescarga, formato === "jpg" ? "jpg" : "png");
      await exportElementAsImage(graficaRef.current, filename, formato);
    } catch {
      setErrorDescarga("No se pudo generar la imagen.");
    } finally {
      setDescargando(false);
      setKebabOpen(false);
      setSubmenuDescarga(false);
    }
  }

  async function handleEliminar() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasItemId: item.id, eliminarCanvasItem: true }),
      });
      if (res.ok) onEliminado?.(item.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="relative rounded-xl border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: color }}>
          {item.familiaId.replace("F", "")}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] leading-none truncate">{item.titulo}</p>
          <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mt-1">Generado desde el chat</p>
        </div>

        {/* Kebab (⋮) */}
        <div className="relative shrink-0" ref={kebabRef}>
          <button
            type="button"
            aria-label="Opciones de esta tarjeta"
            onClick={() => setKebabOpen((o) => !o)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-eske-40 hover:text-gray-eske-70 hover:bg-gray-eske-10 dark:hover:bg-white/10 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
          {kebabOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white-eske dark:bg-[#1E3A52] rounded-lg shadow-lg border border-gray-eske-20 dark:border-white/10 py-1 z-20">
              {TIPOS_PDF.has(item.tipo) && (
                <button
                  type="button"
                  onClick={handleDescargarPdf}
                  disabled={descargando}
                  className="w-full text-left px-3 py-2 text-sm text-black-eske-80 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Descargar PDF
                </button>
              )}
              {TIPOS_IMAGEN.has(item.tipo) && (
                <div>
                  <button
                    type="button"
                    onClick={() => setSubmenuDescarga((s) => !s)}
                    className="w-full text-left px-3 py-2 text-sm text-black-eske-80 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors flex items-center justify-between"
                  >
                    Descargar
                    <span aria-hidden="true">{submenuDescarga ? "▾" : "▸"}</span>
                  </button>
                  {submenuDescarga && (
                    <div className="pb-1">
                      <button
                        type="button"
                        onClick={() => handleDescargarImagen("png")}
                        disabled={descargando}
                        className="w-full text-left pl-6 pr-3 py-1.5 text-sm text-black-eske-80 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        PNG
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDescargarImagen("jpg")}
                        disabled={descargando}
                        className="w-full text-left pl-6 pr-3 py-1.5 text-sm text-black-eske-80 dark:text-[#C7D6E0] hover:bg-gray-eske-10 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        JPG
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-gray-eske-10 dark:border-white/10 my-1" />
              <button
                type="button"
                onClick={() => {
                  setKebabOpen(false);
                  setConfirmDelete(true);
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-eske hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      {errorDescarga && <p className="text-xs text-red-eske mb-2">{errorDescarga}</p>}

      {item.tipo === "resumen" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {item.filas.map((f) => (
            <div key={f.indicadorId} className="rounded-lg bg-gray-eske-10/60 dark:bg-[#112230] border border-gray-eske-20 dark:border-white/10 px-3 py-2">
              <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE]">{f.nombre}</p>
              {f.valor !== null ? (
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">{f.valor}</p>
                  {f.naturaleza && <NaturalezaBadge naturaleza={f.naturaleza} />}
                </div>
              ) : (
                <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] italic mt-0.5">{f.motivo}</p>
              )}
              {f.fuenteEtiqueta && (
                <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE] mt-1">Fuente: {f.fuenteEtiqueta}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {item.tipo === "grafica" && (
        <div ref={graficaRef} className="bg-white-eske dark:bg-[#18324A] p-4">
          <GraficaBarras item={item} color={color} />
          {item.fuenteEtiqueta && (
            <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mt-2">Fuente: {item.fuenteEtiqueta}</p>
          )}
        </div>
      )}

      {item.tipo === "comparacion_territorios" && (
        <div ref={graficaRef} className="bg-white-eske dark:bg-[#18324A] p-4">
          <ComparacionTerritoriosBarras item={item} color={color} />
          {item.fuenteEtiqueta && (
            <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mt-2">Fuente: {item.fuenteEtiqueta}</p>
          )}
        </div>
      )}

      {item.tipo === "desglose" && (
        <div>
          <p className="text-xs text-orange-eske-60 dark:text-orange-eske-40 mb-2">{item.motivoNoAgregable}</p>
          <div className="overflow-x-auto rounded-lg border border-gray-eske-20 dark:border-white/10">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-eske-10/60 dark:bg-[#112230]">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE]">Unidad</th>
                  <th className="px-3 py-2 text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE]">Valor</th>
                </tr>
              </thead>
              <tbody>
                {item.filas.map((f) => (
                  <tr key={f.unidad} className="border-t border-gray-eske-20 dark:border-white/10">
                    <td className="px-3 py-2 text-black-eske dark:text-[#EAF2F8]">{f.unidad}</td>
                    <td className="px-3 py-2">
                      {f.valor !== null && f.valor !== undefined ? (
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-black-eske dark:text-[#EAF2F8]">
                            {typeof f.valor === "number" ? f.valor.toLocaleString("es-MX") : f.valor}
                          </span>
                          {f.naturaleza && <NaturalezaBadge naturaleza={f.naturaleza} />}
                        </span>
                      ) : (
                        <span className="text-xs text-black-eske-80 dark:text-[#9AAEBE] italic">{f.motivo}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {item.tipo === "tabla" && (
        <FontanaComparativeTable
          sesionId={sesion.sesionId}
          columnas={item.columnas}
          indicadores={item.indicadores}
          onQuitar={() => {}}
          quitando={null}
          territorioNivel={sesion.territorio.nivel}
          territorio={sesion.territorio}
        />
      )}

      {item.tipo === "distribucion" && (
        <div ref={graficaRef} className="bg-white-eske dark:bg-[#18324A] p-4">
          <DistribucionBarras item={item} color={color} />
          {item.fuenteEtiqueta && (
            <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mt-2">Fuente: {item.fuenteEtiqueta}</p>
          )}
        </div>
      )}

      {item.tipo === "serie_temporal" && (
        <div ref={graficaRef} className="bg-white-eske dark:bg-[#18324A] p-4">
          <SerieTemporalGrafica item={item} color={color} />
          {item.fuenteEtiqueta && (
            <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mt-2">Fuente: {item.fuenteEtiqueta}</p>
          )}
        </div>
      )}

      {item.tipo === "serie_internacional" && (
        <div ref={graficaRef} className="bg-white-eske dark:bg-[#18324A] p-4">
          <SerieInternacionalGrafica item={item} />
          {item.fuenteEtiqueta && (
            <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mt-2">Fuente: {item.fuenteEtiqueta}</p>
          )}
        </div>
      )}

      {item.tipo === "desglose" && item.fuenteEtiqueta && (
        <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mt-2">Fuente: {item.fuenteEtiqueta}</p>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(false);
          }}
        >
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-black-eske dark:text-[#EAF2F8] text-base">¿Eliminar «{item.titulo}»?</h3>
              <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] mt-1.5 leading-relaxed">
                Dejará de verse en tu Canvas.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-eske-60 hover:text-gray-eske-80 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminar}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium bg-red-eske text-white-eske rounded-lg hover:bg-red-eske/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtValor(valor: number, formato: "conteo" | "moneda" | "porcentaje"): string {
  if (formato === "moneda") return `$${valor.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
  if (formato === "porcentaje") return `${valor.toLocaleString("es-MX", { maximumFractionDigits: 2 })}%`;
  return valor.toLocaleString("es-MX");
}

function abreviarConteo(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  if (n >= 10_000) return `${Math.round(n / 1000)} k`;
  return n.toLocaleString("es-MX");
}

// Pirámide de edades de dos lados (solo F1-2) — hombres a la izquierda,
// mujeres a la derecha, desde un eje central. Grupo más viejo arriba.
function PiramideSexo({
  item,
  color,
}: {
  item: Extract<FontanaCanvasItem, { tipo: "distribucion" }> & {
    piramideSexo: NonNullable<Extract<FontanaCanvasItem, { tipo: "distribucion" }>["piramideSexo"]>;
  };
  color: string;
}) {
  const filas = [...item.piramideSexo].reverse();
  const max = Math.max(...item.piramideSexo.flatMap((f) => [f.hombres, f.mujeres]), 1);
  return (
    <div>
      <div className="flex items-center gap-1 text-[9px] font-medium text-black-eske dark:text-[#EAF2F8] mb-1">
        <span className="flex-1 text-right pr-1">Hombres</span>
        <span className="w-12 shrink-0 text-center">Edad</span>
        <span className="flex-1 pl-1">Mujeres</span>
      </div>
      <div className="space-y-1">
        {filas.map((f) => (
          <div key={f.etiqueta} className="flex items-center gap-1 text-[9px]">
            {/* 26-09-06, corrección del fix anterior: un TOPE al ancho de la
                barra (80%) aplanaba la diferencia entre valores altos —
                varios grupos con valores distintos (61k-76k) se veían con
                la misma longitud, rompiendo la lectura de proporciones que
                es el propósito de la pirámide. Fix correcto: la etiqueta
                vive en su propia columna de ancho FIJO (shrink-0, fuera del
                cálculo de porcentaje); la barra se escala 0-100% dentro de
                un "carril" (bar-track) que ya excluye ese ancho — a
                cualquier valor, incluido el máximo, la barra llena como
                mucho su carril, nunca invade la columna de la etiqueta.
                Proporcionalidad exacta entre barras preservada. */}
            <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
              <span className="text-black-eske-80 dark:text-[#9AAEBE] tabular-nums shrink-0 text-right">{abreviarConteo(f.hombres)}</span>
              <div className="flex-1 flex justify-end min-w-0">
                <div className="h-3 rounded-l-sm" style={{ width: `${(f.hombres / max) * 100}%`, background: color }} />
              </div>
            </div>
            <span className="w-12 shrink-0 text-center text-black-eske-80 dark:text-[#9AAEBE]">
              {f.etiqueta.replace(" años", "")}
            </span>
            <div className="flex-1 flex items-center gap-1 min-w-0">
              <div className="flex-1 flex justify-start min-w-0">
                <div className="h-3 rounded-r-sm" style={{ width: `${(f.mujeres / max) * 100}%`, background: color, opacity: 0.55 }} />
              </div>
              <span className="text-black-eske-80 dark:text-[#9AAEBE] tabular-nums shrink-0">{abreviarConteo(f.mujeres)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistribucionBarras({
  item,
  color,
}: {
  item: Extract<FontanaCanvasItem, { tipo: "distribucion" }>;
  color: string;
}) {
  if (item.piramideSexo && item.piramideSexo.length > 0) {
    return <PiramideSexo item={item as Parameters<typeof PiramideSexo>[0]["item"]} color={color} />;
  }
  const max = Math.max(...item.categorias.map((c) => c.valor), 1);
  return (
    <div>
      {item.nota && (
        <p className="text-[11px] text-orange-eske-60 dark:text-orange-eske-40 mb-3 leading-snug">{item.nota}</p>
      )}
      <div className="space-y-3">
        {item.categorias.map((c) => (
          <FilaBarraHorizontal
            key={c.etiqueta}
            etiqueta={c.etiqueta}
            valorTexto={fmtValor(c.valor, item.formato)}
            pct={Math.max(3, (c.valor / max) * 100)}
            color={color}
          />
        ))}
      </div>
    </div>
  );
}

function SerieTemporalGrafica({
  item,
  color,
}: {
  item: Extract<FontanaCanvasItem, { tipo: "serie_temporal" }>;
  color: string;
}) {
  // Precisión de display por escala (ver unión `formato` en fontana.types):
  // indice → 0-100 (2 dec) · coeficiente → 0-1 y negativos (4 dec) ·
  // puntaje → 1-5 (3 dec).
  const fmt = (v: number) => {
    switch (item.formato) {
      case "moneda":
        return `$${v.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
      case "porcentaje":
        return `${v.toLocaleString("es-MX", { maximumFractionDigits: 2 })}%`;
      case "coeficiente":
        return v.toLocaleString("es-MX", { maximumFractionDigits: 4 });
      case "puntaje":
        return v.toLocaleString("es-MX", { maximumFractionDigits: 3 });
      default: // "conteo" | "indice"
        return v.toLocaleString("es-MX", { maximumFractionDigits: 2 });
    }
  };

  const notaNivel =
    item.nivel === "nacional"
      ? "Dato nacional (todo México)."
      : item.nivel === "municipal"
      ? `Dato municipal — de ${item.territorioLabel}.`
      : `Dato estatal — de ${item.territorioLabel}. No es un promedio de municipios o distritos.`;

  const pts = item.puntos;
  const n = pts.length;
  const nums = pts.filter((p) => p.valor !== null).map((p) => p.valor as number);
  const hayDatos = nums.length > 0;
  const rawMin = hayDatos ? Math.min(...nums) : 0;
  const rawMax = hayDatos ? Math.max(...nums) : 1;
  const pad = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.08;
  // Conteo no negativo → base 0; cualquier otra escala → rango de datos con padding.
  const domMin = item.formato === "conteo" && rawMin >= 0 ? 0 : rawMin - pad;
  const domMax = rawMax + pad;
  const span = domMax - domMin || 1;

  const xAt = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yAt = (v: number) => 100 - ((v - domMin) / span) * 100;

  // Nulos → la línea se parte: una polilínea por corrida contigua de valores.
  const segmentos: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  pts.forEach((p, i) => {
    if (p.valor === null) {
      if (cur.length) segmentos.push(cur);
      cur = [];
      return;
    }
    cur.push({ x: xAt(i), y: yAt(p.valor) });
  });
  if (cur.length) segmentos.push(cur);

  const idxMin = hayDatos ? pts.findIndex((p) => p.valor === rawMin) : -1;
  const idxMax = hayDatos ? pts.findIndex((p) => p.valor === rawMax) : -1;
  const mostrarValor = (i: number) =>
    pts[i].valor !== null && (n <= 8 || i === 0 || i === n - 1 || i === idxMin || i === idxMax);
  const stepX = n <= 12 ? 1 : Math.ceil(n / 8);
  const mostrarAnio = (i: number) => i === 0 || i === n - 1 || i % stepX === 0;

  return (
    <div>
      {/* Origen del dato — nunca ambiguo */}
      {item.esTerritorioExterno ? (
        <p className="text-[11px] text-orange-eske-60 dark:text-orange-eske-40 mb-2">
          Otro territorio: {item.territorioLabel} — no es tu proyecto
        </p>
      ) : item.esTerritorioDelProyecto ? (
        <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mb-2">
          {item.territorioLabel} — territorio del proyecto
        </p>
      ) : (
        <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mb-2">{item.territorioLabel}</p>
      )}

      {/* Nota a nivel de serie — limitación estructural del dato (ej. "serie
          cerrada, sin ediciones futuras"). Siempre visible, no depende de
          que el modelo la narre. Mismo estilo que la nota de distribucion. */}
      {item.nota && (
        <p className="text-[11px] text-orange-eske-60 dark:text-orange-eske-40 mb-2 leading-snug">{item.nota}</p>
      )}

      {/* mx-8 (26-09-06, no mx-1): las etiquetas de los puntos en 0%/100%
          se centran con -translate-x-1/2 — la mitad del texto ("0.759",
          "2020"…) cae fuera del propio contenedor en los extremos. mx-1
          no dejaba margen suficiente y se veía cortado tanto en pantalla
          como al exportar como imagen (exportElementAsImage captura el
          recuadro exacto del nodo). */}
      {!hayDatos ? (
        <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] italic">Sin datos para graficar.</p>
      ) : (
        <div className="relative h-28 mt-6 mb-7 mx-8">
          <svg
            className="absolute inset-0 w-full h-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {segmentos.map((seg, si) => (
              <polyline
                key={si}
                points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </svg>

          {pts.map((p, i) =>
            p.valor === null ? null : (
              <div
                key={p.periodo}
                className="absolute"
                style={{ left: `${xAt(i)}%`, top: `${yAt(p.valor)}%`, transform: "translate(-50%,-50%)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {mostrarValor(i) && (
                  <span className="absolute left-1/2 -translate-x-1/2 -top-4 whitespace-nowrap text-[9px] text-black-eske dark:text-[#EAF2F8]">
                    {fmt(p.valor)}
                  </span>
                )}
                {p.ranking != null && (
                  <span className="absolute left-1/2 -translate-x-1/2 top-1.5 whitespace-nowrap text-[9px] text-black-eske-80 dark:text-[#9AAEBE]">
                    #{p.ranking}/32
                  </span>
                )}
              </div>
            )
          )}

          {pts.map((p, i) =>
            mostrarAnio(i) ? (
              <span
                key={`x-${p.periodo}`}
                className="absolute -bottom-6 -translate-x-1/2 text-[9px] text-black-eske-80 dark:text-[#9AAEBE]"
                style={{ left: `${xAt(i)}%` }}
              >
                {p.periodo}
              </span>
            ) : null
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-eske-40 mt-2">{notaNivel}</p>
    </div>
  );
}

// Serie internacional (Familia 4) — N líneas de tiempo, una por país
// (México + países de referencia). Cada país conserva SUS PROPIOS años; el
// eje X posiciona cada punto por VALOR de año (no por índice), así que
// países con muestreo distinto (México bienal, Colombia anual) se dibujan
// sin romper la línea. Dominio Y compartido, México enfatizado (línea más
// gruesa). Un país con `estadoConsulta` distinto de "ok" NO se dibuja — se
// declara en la leyenda con su motivo (nunca una línea inventada).
const PALETA_SERIE_INTL = ["#1F6FB2", "#E8833A", "#2E8B57", "#8E5BA6", "#C0392B"];

function SerieInternacionalGrafica({
  item,
}: {
  item: Extract<FontanaCanvasItem, { tipo: "serie_internacional" }>;
}) {
  const fmt = (v: number) => {
    switch (item.formato) {
      case "moneda":
        return `$${v.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
      case "porcentaje":
        return `${v.toLocaleString("es-MX", { maximumFractionDigits: 2 })}%`;
      case "coeficiente":
        return v.toLocaleString("es-MX", { maximumFractionDigits: 4 });
      case "puntaje":
        return v.toLocaleString("es-MX", { maximumFractionDigits: 3 });
      default:
        return v.toLocaleString("es-MX", { maximumFractionDigits: 2 });
    }
  };

  const conSerie = item.paises.filter((p) => p.estadoConsulta === "ok" && p.puntos.length > 0);
  const sinSerie = item.paises.filter((p) => p.estadoConsulta !== "ok" || p.puntos.length === 0);

  // Eje X por VALOR de año — la unión de años de todos los países con serie.
  const aniosUnion = [
    ...new Set(conSerie.flatMap((p) => p.puntos.map((pt) => Number(pt.periodo)))),
  ].sort((a, b) => a - b);
  const minYear = aniosUnion[0] ?? 0;
  const maxYear = aniosUnion[aniosUnion.length - 1] ?? 1;

  const todosValores = conSerie.flatMap((p) => p.puntos.map((pt) => pt.valor).filter((v): v is number => v !== null));
  const hayDatos = todosValores.length > 0;
  const rawMin = hayDatos ? Math.min(...todosValores) : 0;
  const rawMax = hayDatos ? Math.max(...todosValores) : 1;
  const pad = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.08;
  const domMin = item.formato === "conteo" && rawMin >= 0 ? 0 : rawMin - pad;
  const domMax = rawMax + pad;
  const span = domMax - domMin || 1;

  // (c-lite) Cuando UN país tiene una magnitud muy superior al resto
  // (ej. inflación de Argentina, 220% frente a <15% del resto), la escala
  // Y lineal compartida comprime a los demás contra el borde. No se toca
  // el dominio (rehacer el layout sería desproporcionado y la tabla
  // año×país ya da los valores exactos) — solo se anota por qué se ve así.
  // Se compara el pico de cada país (no el rango global, que también crece
  // por variación natural): la nota solo aparece si el país más alto
  // supera al 2º por un factor grande — un outlier real, no dispersión.
  const picosPorPais = conSerie
    .map((p) => ({
      pais: p.pais,
      pico: Math.max(...p.puntos.map((pt) => (pt.valor === null ? -Infinity : Math.abs(pt.valor)))),
    }))
    .filter((x) => Number.isFinite(x.pico))
    .sort((a, b) => b.pico - a.pico);
  const escalaComprimida =
    hayDatos && picosPorPais.length > 2 && picosPorPais[1].pico > 0 && picosPorPais[0].pico / picosPorPais[1].pico > 5;
  const paisDominante = escalaComprimida ? picosPorPais[0].pais : null;

  const xAt = (year: number) => (maxYear === minYear ? 50 : ((year - minYear) / (maxYear - minYear)) * 100);
  const yAt = (v: number) => 100 - ((v - domMin) / span) * 100;

  // Un país → índice de color; México (principal) siempre el 0.
  const colorDe = (iso3: string, esPrincipal: boolean) => {
    if (esPrincipal) return PALETA_SERIE_INTL[0];
    const idx = conSerie.filter((p) => !p.esPaisPrincipal).findIndex((p) => p.iso3 === iso3);
    return PALETA_SERIE_INTL[(idx % (PALETA_SERIE_INTL.length - 1)) + 1];
  };

  const segmentosDe = (puntos: { periodo: string; valor: number | null }[]) => {
    const segs: { x: number; y: number }[][] = [];
    let cur: { x: number; y: number }[] = [];
    puntos.forEach((p) => {
      if (p.valor === null) {
        if (cur.length) segs.push(cur);
        cur = [];
        return;
      }
      cur.push({ x: xAt(Number(p.periodo)), y: yAt(p.valor) });
    });
    if (cur.length) segs.push(cur);
    return segs;
  };

  // Ticks del eje X: primer y último año + ~1 cada `stepX` de la unión.
  const stepX = aniosUnion.length <= 12 ? 1 : Math.ceil(aniosUnion.length / 8);
  const aniosTick = aniosUnion.filter((_, i) => i === 0 || i === aniosUnion.length - 1 || i % stepX === 0);

  const polaridadNota =
    item.polaridad === "mayor_mejor"
      ? "Valor más alto = mejor posición."
      : item.polaridad === "menor_mejor"
      ? "Valor más bajo = mejor posición."
      : null;

  // Etiqueta de valor al final de cada línea. Sin descolisión, cuando dos
  // países terminan con valores Y cercanos (F4-1: PIB PPA de MX/BRA/COL
  // muy juntos; F4-5: 3 %/1 %/0.4 %) los `<span>` se dibujan uno encima de
  // otro y quedan ilegibles. Se calcula un Y ajustado: ordenar por Y real,
  // empujar hacia abajo lo que quede a menos de `gap`, y corregir hacia
  // arriba si topa el borde. El contenedor mide 128 px (h-32) y la Y va en
  // %, así que ~9 % ≈ 11-12 px separa texto de 9 px. El punto queda en su
  // Y real; si la etiqueta se desplazó, una línea guía punteada las une.
  const etiquetasFinales = conSerie
    .map((p) => {
      const ultimo = [...p.puntos].reverse().find((pt) => pt.valor !== null);
      if (!ultimo || ultimo.valor === null) return null;
      return {
        iso3: p.iso3,
        color: colorDe(p.iso3, p.esPaisPrincipal),
        texto: fmt(ultimo.valor),
        x: xAt(Number(ultimo.periodo)),
        yReal: yAt(ultimo.valor),
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const yEtiquetaFinal: number[] = (() => {
    const n = etiquetasFinales.length;
    const PISO = 4;
    const TOPE = 96;
    const gap = n > 1 ? Math.min(9, (TOPE - PISO) / (n - 1)) : 9;
    const orden = etiquetasFinales.map((e, i) => ({ i, y: e.yReal })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < orden.length; k++) {
      if (orden[k].y - orden[k - 1].y < gap) orden[k].y = orden[k - 1].y + gap;
    }
    if (orden.length && orden[orden.length - 1].y > TOPE) {
      orden[orden.length - 1].y = TOPE;
      for (let k = orden.length - 2; k >= 0; k--) {
        if (orden[k + 1].y - orden[k].y < gap) orden[k].y = orden[k + 1].y - gap;
      }
    }
    const out = new Array<number>(n);
    for (const o of orden) out[o.i] = o.y;
    return out;
  })();

  return (
    <div>
      {item.nota && (
        <p className="text-[11px] text-orange-eske-60 dark:text-orange-eske-40 mb-2 leading-snug">{item.nota}</p>
      )}

      {!hayDatos ? (
        <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] italic">Sin datos para graficar.</p>
      ) : (
        <div className="relative h-32 mt-6 mb-7 mx-8">
          <svg
            className="absolute inset-0 w-full h-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {conSerie.map((p) =>
              segmentosDe(p.puntos).map((seg, si) => (
                <polyline
                  key={`${p.iso3}-${si}`}
                  points={seg.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                  fill="none"
                  stroke={colorDe(p.iso3, p.esPaisPrincipal)}
                  strokeWidth={p.esPaisPrincipal ? 3 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))
            )}
          </svg>

          {/* Valor final de cada país — descolisionado verticalmente */}
          {etiquetasFinales.map((e, i) => {
            const yLbl = yEtiquetaFinal[i];
            const desplazada = Math.abs(yLbl - e.yReal) > 1.5;
            return (
              <div key={`end-${e.iso3}`}>
                <div
                  className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${e.x}%`, top: `${e.yReal}%`, background: e.color }}
                />
                {desplazada && (
                  <div
                    className="absolute border-l border-dotted -translate-x-1/2"
                    style={{
                      left: `${e.x}%`,
                      top: `${Math.min(e.yReal, yLbl)}%`,
                      height: `${Math.abs(yLbl - e.yReal)}%`,
                      borderColor: e.color,
                    }}
                  />
                )}
                <span
                  className="absolute -translate-y-1/2 whitespace-nowrap text-[9px] text-black-eske dark:text-[#EAF2F8]"
                  style={{ left: `calc(${e.x}% + 0.5rem)`, top: `${yLbl}%` }}
                >
                  {e.texto}
                </span>
              </div>
            );
          })}

          {aniosTick.map((year) => (
            <span
              key={`x-${year}`}
              className="absolute -bottom-6 -translate-x-1/2 text-[9px] text-black-eske-80 dark:text-[#9AAEBE]"
              style={{ left: `${xAt(year)}%` }}
            >
              {year}
            </span>
          ))}
        </div>
      )}

      {/* Leyenda: un swatch por país con serie */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {conSerie.map((p) => (
          <span key={`leg-${p.iso3}`} className="inline-flex items-center gap-1.5 text-[11px] text-black-eske-80 dark:text-[#9AAEBE]">
            <span
              className="inline-block rounded-full"
              style={{
                width: p.esPaisPrincipal ? 14 : 10,
                height: p.esPaisPrincipal ? 3 : 2,
                background: colorDe(p.iso3, p.esPaisPrincipal),
              }}
            />
            {p.pais}
            {p.esPaisPrincipal ? " (tu país)" : ""}
            {p.rankOficialUltimo != null ? ` · rank ${p.rankOficialUltimo}` : ""}
          </span>
        ))}
      </div>

      {/* Tabla de valores año × país — para leer los valores puntuales que
          la gráfica multi-línea no muestra. Los años son EXACTAMENTE los
          del eje X (`aniosTick`): completos si ≤12 puntos (F4-2, 5 años);
          "thinned" con el mismo criterio del eje para series largas (F4-3,
          34 años) — así tabla y gráfica quedan consistentes. */}
      {conSerie.length > 0 && aniosTick.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="text-[10px] border-collapse w-full">
            <thead>
              <tr className="text-black-eske-80 dark:text-[#9AAEBE]">
                <th className="text-left font-medium pr-2 pb-1">Año</th>
                {conSerie.map((p) => (
                  <th key={`th-${p.iso3}`} className="text-right font-medium px-2 pb-1 whitespace-nowrap">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                      style={{ background: colorDe(p.iso3, p.esPaisPrincipal) }}
                    />
                    {p.pais}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-black-eske dark:text-[#EAF2F8]">
              {aniosTick.map((year) => (
                <tr key={`tr-${year}`} className="border-t border-gray-eske-10 dark:border-[#112230]">
                  <td className="text-left pr-2 py-0.5 text-black-eske-80 dark:text-[#9AAEBE]">{year}</td>
                  {conSerie.map((p) => {
                    const pt = p.puntos.find((x) => Number(x.periodo) === year);
                    return (
                      <td key={`td-${year}-${p.iso3}`} className="text-right px-2 py-0.5">
                        {pt && pt.valor !== null ? fmt(pt.valor) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {aniosTick.length < aniosUnion.length && (
            <p className="text-[9px] text-gray-eske-40 mt-1">
              Años mostrados: los mismos del eje de la gráfica. La serie completa va de {minYear} a {maxYear}.
            </p>
          )}
        </div>
      )}

      {sinSerie.length > 0 && (
        <div className="mt-2 text-[11px] text-orange-eske-60 dark:text-orange-eske-40">
          <p className="font-medium">Sin serie para este indicador:</p>
          <ul className="list-disc list-inside">
            {sinSerie.map((p) => (
              <li key={`ns-${p.iso3}`}>
                {p.pais} — {p.motivo ?? "sin dato"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {escalaComprimida && (
        <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE] mt-2 leading-snug">
          {paisDominante
            ? `${paisDominante} domina la escala vertical por su magnitud muy superior al resto — `
            : "Un país domina la escala vertical por su magnitud muy superior al resto — "}
          los valores exactos de cada país están en la tabla.
        </p>
      )}

      {polaridadNota && <p className="text-[10px] text-gray-eske-40 mt-2">{polaridadNota}</p>}
    </div>
  );
}

// Fila compartida por las 3 gráficas de barras horizontales del Canvas
// (GraficaBarras, DistribucionBarras, ComparacionTerritoriosBarras) —
// rediseño 26-09-06: el nombre completo va ARRIBA de la barra (nunca se
// trunca, cabe cualquier longitud), la barra ocupa el ancho completo
// debajo, y el valor se muestra junto al nombre — nunca la frase completa
// de una unidad de medida repetida en cada fila (eso se muestra UNA vez,
// como subtítulo de toda la gráfica, en el componente que llama a esta
// fila). Mismo lenguaje visual en las 3 gráficas del ecosistema.
function FilaBarraHorizontal({
  etiqueta,
  badge,
  valorTexto,
  motivo,
  pct,
  color,
  opacidad,
}: {
  etiqueta: string;
  badge?: React.ReactNode;
  valorTexto: string | null;
  motivo?: string;
  pct: number;
  color: string;
  opacidad?: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs font-medium text-black-eske dark:text-[#EAF2F8]">
          {etiqueta}
          {badge}
        </span>
        {valorTexto !== null && (
          <span className="text-xs text-black-eske-80 dark:text-[#9AAEBE] tabular-nums shrink-0">{valorTexto}</span>
        )}
      </div>
      {valorTexto !== null ? (
        <div className="h-2.5 rounded-full bg-gray-eske-10 dark:bg-[#112230] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, opacity: opacidad }} />
        </div>
      ) : (
        <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] italic">{motivo}</p>
      )}
    </div>
  );
}

function GraficaBarras({
  item,
  color,
}: {
  item: Extract<FontanaCanvasItem, { tipo: "grafica" }>;
  color: string;
}) {
  const valores = item.barras.map((b) => b.valor ?? 0);
  const max = Math.max(...valores, 1);
  return (
    <div>
      {item.unidad && <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mb-3">{item.unidad}</p>}
      <div className="space-y-3">
        {item.barras.map((b) => (
          <FilaBarraHorizontal
            key={b.nivel}
            etiqueta={NOMBRE_NIVEL_TABLA[b.nivel]}
            valorTexto={b.valor !== null ? b.valor.toLocaleString("es-MX") : null}
            motivo={b.motivo}
            pct={Math.max(6, ((b.valor ?? 0) / max) * 100)}
            color={color}
          />
        ))}
      </div>
    </div>
  );
}

// Comparación de territorios ARBITRARIOS (26-09-06) — cada barra se
// identifica por territorioLabel (no por nivel geográfico) y declara
// honestamente su nivel real + si es del proyecto o externo, y qué
// territorios pedidos no entraron (noResueltos).
function ComparacionTerritoriosBarras({
  item,
  color,
}: {
  item: Extract<FontanaCanvasItem, { tipo: "comparacion_territorios" }>;
  color: string;
}) {
  const valores = item.filas.map((f) => f.valor ?? 0);
  const max = Math.max(...valores, 1);
  const nivelesDistintos = new Set(item.filas.map((f) => f.nivel)).size > 1;
  return (
    <div>
      {item.unidad && <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mb-2">{item.unidad}</p>}
      {nivelesDistintos && (
        <p className="text-[11px] text-orange-eske-60 dark:text-orange-eske-40 mb-3">
          Los territorios comparados no son todos del mismo nivel geográfico (algunos son estados, otros municipios) — el nivel de cada uno se indica junto a su nombre.
        </p>
      )}
      <div className="space-y-3">
        {item.filas.map((f) => (
          <FilaBarraHorizontal
            key={f.territorioLabel}
            etiqueta={`${f.territorioLabel}${nivelesDistintos ? ` (${NOMBRE_NIVEL_TABLA[f.nivel]})` : ""}`}
            badge={
              f.esTerritorioDelProyecto ? (
                <span className="text-[9px] text-black-eske-80 dark:text-[#9AAEBE] ml-1.5">(tu proyecto)</span>
              ) : undefined
            }
            valorTexto={f.valor !== null ? f.valor.toLocaleString("es-MX") : null}
            motivo={f.motivo}
            pct={Math.max(6, ((f.valor ?? 0) / max) * 100)}
            color={color}
          />
        ))}
      </div>
      {item.noResueltos.length > 0 && (
        <div className="mt-3 text-[11px] text-orange-eske-60 dark:text-orange-eske-40">
          <p className="font-medium">No se pudieron incluir:</p>
          <ul className="list-disc list-inside">
            {item.noResueltos.map((n) => (
              <li key={n.nombreIngresado}>
                {n.nombreIngresado} — {n.motivo}
                {n.candidatos && n.candidatos.length > 0 ? ` (${n.candidatos.join(", ")})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
