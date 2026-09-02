"use client";

// app/components/shared/ResponsivePanel.tsx
// Panel lateral responsive del ecosistema — generaliza el patrón repetido
// en ~8 archivos de Sefix (aside fixed + translate-x + estado xOpen +
// useEscapeKey). NO se tocó ningún archivo de Sefix: este componente
// queda disponible para adopción futura; su primer consumidor es el
// panel de chat de Fontana (T10).
//
// placement:
//  - "sidebar-right": mobile = drawer que entra desde la derecha.
//  - "bottom-sheet-mobile" (default): mobile = hoja inferior a 75vh.
// En desktop (lg+) ambos son una columna fija a la derecha con sombra.

import { useEffect } from "react";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  placement?: "sidebar-right" | "bottom-sheet-mobile";
  widthDesktop?: number; // px, default 400
  "aria-label"?: string;
}

export default function ResponsivePanel({
  open,
  onClose,
  children,
  placement = "bottom-sheet-mobile",
  widthDesktop = 400,
  "aria-label": ariaLabel,
}: Props) {
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 1023px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const mobile =
    placement === "bottom-sheet-mobile"
      ? `inset-x-0 bottom-0 h-[75vh] rounded-t-2xl border-t ${open ? "translate-y-0" : "translate-y-full"}`
      : `right-0 top-0 bottom-0 w-[min(90vw,400px)] border-l ${open ? "translate-x-0" : "translate-x-full"}`;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <aside
        aria-label={ariaLabel}
        aria-hidden={!open}
        className={[
          "fixed z-50 flex flex-col overflow-hidden bg-white-eske dark:bg-[#0F2233]",
          "border-gray-eske-20 dark:border-white/10 shadow-2xl",
          "transition-transform duration-300 ease-out",
          mobile,
          // Desktop: columna fija a la derecha, siempre visible cuando open
          "lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:rounded-none lg:border-l lg:border-t-0 lg:translate-x-0 lg:translate-y-0",
          open ? "lg:flex" : "lg:hidden",
        ].join(" ")}
      >
        <div
          className="flex h-full w-full flex-col lg:w-[var(--rp-w)]"
          style={{ ["--rp-w" as string]: `${widthDesktop}px` }}
        >
          {children}
        </div>
      </aside>
    </>
  );
}
