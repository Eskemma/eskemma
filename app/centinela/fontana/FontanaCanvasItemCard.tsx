"use client";

// app/centinela/fontana/FontanaCanvasItemCard.tsx
// Renderiza un FontanaCanvasItem en la pestaña "Fontana" (Canvas). El
// tipo "tabla" reutiliza FontanaComparativeTable tal cual (no se duplica).

import type { FontanaCanvasItem, FontanaSesion } from "@/types/fontana.types";
import { NOMBRE_NIVEL_TABLA } from "@/lib/fontana/tablaColumnas";
import { FAMILIA_META } from "@/lib/fontana/familias";
import NaturalezaBadge from "./NaturalezaBadge";
import FontanaComparativeTable from "./FontanaComparativeTable";

interface Props {
  item: FontanaCanvasItem;
  sesion: FontanaSesion;
}

export default function FontanaCanvasItemCard({ item, sesion }: Props) {
  const color = FAMILIA_META[item.familiaId]?.color ?? "#248cc1";

  return (
    <div className="rounded-xl border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#18324A] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: color }}>
          {item.familiaId.replace("F", "")}
        </span>
        <div>
          <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] leading-none">{item.titulo}</p>
          <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mt-1">Generado desde el chat</p>
        </div>
      </div>

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
        <GraficaBarras item={item} color={color} />
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

      {item.tipo === "distribucion" && <DistribucionBarras item={item} color={color} />}

      {(item.tipo === "grafica" || item.tipo === "desglose" || item.tipo === "distribucion") && item.fuenteEtiqueta && (
        <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mt-2">Fuente: {item.fuenteEtiqueta}</p>
      )}
    </div>
  );
}

function fmtValor(valor: number, formato: "conteo" | "moneda" | "porcentaje"): string {
  if (formato === "moneda") return `$${valor.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
  if (formato === "porcentaje") return `${valor.toLocaleString("es-MX", { maximumFractionDigits: 2 })}%`;
  return valor.toLocaleString("es-MX");
}

function DistribucionBarras({
  item,
  color,
}: {
  item: Extract<FontanaCanvasItem, { tipo: "distribucion" }>;
  color: string;
}) {
  const max = Math.max(...item.categorias.map((c) => c.valor), 1);
  return (
    <div>
      {item.nota && (
        <p className="text-[11px] text-orange-eske-60 dark:text-orange-eske-40 mb-3 leading-snug">{item.nota}</p>
      )}
      <div className="space-y-1.5">
        {item.categorias.map((c) => (
          <div key={c.etiqueta} className="flex items-center gap-2">
            <span className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] w-28 shrink-0 text-right">
              {c.etiqueta}
            </span>
            <div className="flex-1 h-4 rounded-full bg-gray-eske-10 dark:bg-[#112230] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.valor / max) * 100)}%`, background: color }} />
            </div>
            <span className="text-[11px] text-black-eske dark:text-[#EAF2F8] w-24 shrink-0 text-right">
              {fmtValor(c.valor, item.formato)}
            </span>
          </div>
        ))}
      </div>
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
    <div className="space-y-2">
      {item.barras.map((b) => (
        <div key={b.nivel} className="flex items-center gap-2">
          <span className="text-xs text-black-eske-80 dark:text-[#9AAEBE] w-24 shrink-0">
            {NOMBRE_NIVEL_TABLA[b.nivel]}
          </span>
          {b.valor !== null ? (
            <>
              <div className="flex-1 h-4 rounded-full bg-gray-eske-10 dark:bg-[#112230] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(6, (b.valor / max) * 100)}%`, background: color }} />
              </div>
              <span className="text-xs text-black-eske dark:text-[#EAF2F8] w-24 shrink-0 text-right">
                {b.valor.toLocaleString("es-MX")}
                {item.unidad ? ` ${item.unidad}` : ""}
              </span>
            </>
          ) : (
            <span className="flex-1 text-[11px] text-black-eske-80 dark:text-[#9AAEBE] italic">{b.motivo}</span>
          )}
        </div>
      ))}
    </div>
  );
}
