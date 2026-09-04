"use client";

// app/centinela/fontana/FontanaCanvasTab.tsx
// Pestaña "Fontana" del workspace — lienzo de salidas que el agente
// genera (FontanaCanvasItem[]). Vacío hasta que el usuario pida algo.

import { useEffect, useRef } from "react";
import type { FontanaCanvasItem, FontanaSesion } from "@/types/fontana.types";
import FontanaCanvasItemCard from "./FontanaCanvasItemCard";

interface Props {
  items: FontanaCanvasItem[];
  sesion: FontanaSesion;
  onEliminarItem?: (itemId: string) => void;
}

export default function FontanaCanvasTab({ items: itemsConEliminados, sesion, onEliminarItem }: Props) {
  // Borrado suave (26-09-05): un item puede llegar con `eliminado:true`
  // (ya sea de una sesión recargada, o marcado en este mismo turno) — se
  // filtra de la vista de inmediato, nunca se borra el elemento del array.
  const items = itemsConEliminados.filter((it) => !it.eliminado);

  // Al aparecer un item nuevo (el chat lo generó), llevar la vista hasta él —
  // si no, el usuario no lo ve porque queda al fondo, detrás del panel.
  const ultimoRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(items.length);
  useEffect(() => {
    if (items.length > prevLen.current) {
      ultimoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prevLen.current = items.length;
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="px-4 md:px-8 py-14">
        <div className="max-w-xl mx-auto text-center">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl"
            style={{ background: "linear-gradient(135deg, #248cc1, #026988)" }}
            aria-hidden="true"
          >
            ✦
          </div>
          <p className="text-black-eske dark:text-[#EAF2F8] font-medium mb-2">
            Te damos la bienvenida a Fontana.
          </p>
          <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] leading-relaxed">
            Aquí van apareciendo las respuestas al chat de Fontana. Pregúntale por
            cualquier indicador de las cinco familias disponibles, por ejemplo,
            población, pobreza, seguridad, comparaciones con otros países o
            características del territorio.
          </p>
          <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] leading-relaxed mt-3">
            Si prefieres explorar por tu cuenta, la pestaña Indicadores tiene la tabla
            comparativa completa, organizada por familia de indicadores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 space-y-4">
      {items.map((item, i) => (
        <div key={item.id} ref={i === items.length - 1 ? ultimoRef : undefined}>
          <FontanaCanvasItemCard item={item} sesion={sesion} onEliminado={onEliminarItem} />
        </div>
      ))}
    </div>
  );
}
