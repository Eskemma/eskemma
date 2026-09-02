"use client";

// app/components/shared/Tabs.tsx
// Componente genérico de pestañas del ecosistema — antes cada módulo
// (PESTEL, Sefix, Moddulo) implementaba las suyas ad-hoc con useState +
// <button role="tab">. Sin dependencias de dominio: recibe la config de
// pestañas y el estado por props.
//
// variant "underline" (default): subrayado border-b-2, patrón dominante
// del repo. variant "pill": botón con fondo, para barras compactas.

import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  title?: string; // tooltip nativo, ej. motivo de deshabilitada
}

interface Props {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: "underline" | "pill";
  className?: string;
  "aria-label"?: string;
}

export default function Tabs({
  tabs,
  activeId,
  onChange,
  variant = "underline",
  className = "",
  "aria-label": ariaLabel,
}: Props) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1 ${variant === "underline" ? "border-b border-gray-eske-20 dark:border-white/10" : "gap-2"} ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const base =
          "flex items-center gap-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
        const styles =
          variant === "underline"
            ? `px-4 py-2.5 border-b-2 -mb-px ${
                active
                  ? "border-blue-eske text-black-eske dark:text-[#EAF2F8]"
                  : "border-transparent text-gray-eske-60 dark:text-[#9AAEBE] hover:text-black-eske-80 dark:hover:text-[#C7D6E0]"
              }`
            : `px-3.5 py-2 rounded-lg border ${
                active
                  ? "bg-blue-eske text-white-eske border-blue-eske"
                  : "bg-white-eske dark:bg-[#18324A] text-black-eske dark:text-[#EAF2F8] border-gray-eske-20 dark:border-white/10 hover:border-gray-eske-40"
              }`;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={tab.disabled}
            disabled={tab.disabled}
            title={tab.title}
            onClick={() => onChange(tab.id)}
            className={`${base} ${styles}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
