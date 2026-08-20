// F3FormHelpers.tsx — piezas de UI compartidas entre los formularios de
// F3 (CargaManualForm en F3TareasPIP.tsx, VincularFuenteForm) — extraído
// 2026-08-19 al separar VincularFuenteForm a su propio archivo, para que
// ambos formularios sigan usando exactamente los mismos estilos sin
// duplicar código.
"use client";

import { useRef } from "react";
import PillButton from "@/app/moddulo/components/PillButton";

// Botón real de "Seleccionar archivo" — input oculto + botón estilizado que
// lo dispara, muestra el nombre elegido. Mismo patrón que el clip de ModduloChat.
export function FileSelectButton({ file, onChange, label = "Seleccionar archivo" }: {
  file: File | null; onChange: (f: File | null) => void; label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      <PillButton type="button" variant="solid" onClick={() => inputRef.current?.click()} className="text-xs lg:text-sm shrink-0">
        {label}
      </PillButton>
      <span className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE] truncate">
        {file ? file.name : "Ningún archivo seleccionado"}
      </span>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs lg:text-sm font-semibold text-black-eske-80 dark:text-[#C5D8E8] mb-1">{children}</label>;
}

export const inputClass = "w-full text-xs lg:text-sm px-2 py-1.5 rounded border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230]";
