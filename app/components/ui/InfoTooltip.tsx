"use client";

// app/components/ui/InfoTooltip.tsx
// Reusable contextual help tooltip triggered by an ℹ icon button.
// Shows a brief description + optional example on click.
// Closes on Escape, outside click, or second click on the trigger.
//
// Positioning: the panel uses position:fixed with coordinates computed from
// the trigger's getBoundingClientRect(), clamped to the viewport. This keeps
// the tooltip fully visible on mobile even when the trigger sits near a
// screen edge — a plain CSS left/right offset isn't enough there.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface InfoTooltipProps {
  /** Main explanation of what the field/action does and why it matters — string o JSX (ej. con <strong> para resaltar un número dentro del texto) */
  content: ReactNode;
  /** Optional short example to illustrate (shown after content) */
  example?: string;
  /**
   * Optional source citation (e.g. "INEGI, Censo 2020, vía ECEG"), shown
   * in italics at a smaller size than content — distinct from `example`
   * (which renders a hardcoded "Ej:" label; not appropriate for a source).
   */
  fuente?: string;
  /**
   * Custom trigger content — replaces the default "i" icon. Use this to
   * make an existing element (e.g. a badge) clickable to open the same
   * tooltip panel, without adding a separate (i) icon next to it. The
   * element is still wrapped in the same <button> (same a11y/positioning
   * behavior) — pass only the visual content, not your own <button>.
   */
  trigger?: ReactNode;
  /** Overrides the default "i" icon button classes when `trigger` is set */
  triggerClassName?: string;
  /** Additional CSS classes for the trigger's wrapping <span> */
  className?: string;
  /**
   * Initial alignment hint relative to the trigger button.
   * Final position is always clamped to the viewport, so this only
   * affects which side the panel prefers when there's room on both.
   */
  placement?: "right" | "left";
}

const VIEWPORT_PADDING = 12;

export default function InfoTooltip({
  content,
  example,
  fuente,
  trigger,
  triggerClassName,
  className = "",
  placement = "right",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleMousedown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMousedown);
    return () => document.removeEventListener("mousedown", handleMousedown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open]);

  // Compute a viewport-clamped fixed position so the panel never overflows
  // the screen, regardless of how close the trigger is to a screen edge.
  function computePosition() {
    const trigger = buttonRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;

    let left =
      placement === "left"
        ? triggerRect.right - panelWidth
        : triggerRect.left;
    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, window.innerWidth - panelWidth - VIEWPORT_PADDING)
    );

    let top = triggerRect.bottom + 6;
    const fitsBelow = top + panelHeight + VIEWPORT_PADDING <= window.innerHeight;
    if (!fitsBelow) {
      const above = triggerRect.top - panelHeight - 6;
      top = above >= VIEWPORT_PADDING ? above : VIEWPORT_PADDING;
    }

    setCoords({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    computePosition();
    function handleReposition() {
      computePosition();
    }
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, content, example]);

  const tooltipId = `tooltip-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <span ref={containerRef} className={`relative inline-flex normal-case font-normal ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-label={trigger ? undefined : "Más información"}
        className={
          triggerClassName ??
          [
            "inline-flex items-center justify-center",
            "w-4 h-4 rounded-full text-[10px] font-bold leading-none",
            // dark: agregado (2026-08-19) — sin variante propia, el ícono
            // heredaba el mismo bluegreen-eske de modo claro y se perdía
            // contra el fondo oscuro de las cards. Mismo par
            // text-bluegreen-eske/dark:text-blue-eske-20 ya usado en todo
            // Fontana (FontanaComparativeTable.tsx, FontanaOnboarding.tsx,
            // TerritorySelector.tsx), no un color nuevo.
            "bg-bluegreen-eske/10 text-bluegreen-eske dark:bg-blue-eske-20/10 dark:text-blue-eske-20",
            "hover:bg-bluegreen-eske/20 dark:hover:bg-blue-eske-20/20 transition-colors",
            "focus:outline-none focus-visible:ring-2",
            "focus-visible:ring-bluegreen-eske focus-visible:ring-offset-1",
            "cursor-pointer shrink-0",
          ].join(" ")
        }
      >
        {trigger ?? "i"}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={tooltipId}
          role="tooltip"
          className={[
            "fixed z-50 w-64 sm:w-72",
            // dark:bg-blue-eske-90 (2026-08-19, no #18324A) — ese tono es el
            // mismo fondo de card/panel normal en dark mode en varios
            // componentes de Fontana/PESTEL; el tooltip se confundía con
            // "una sección más" en vez de leerse como mensaje emergente.
            // blue-eske-90 (#004062) es un azul real del design system
            // (app/globals.css), claramente distinto de los fondos oscuros
            // ya usados — no un color inventado.
            "bg-white-eske dark:bg-blue-eske-90 border border-gray-eske-20 dark:border-white/10 rounded-lg shadow-lg",
            "p-3 flex flex-col gap-1.5",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95",
            "motion-safe:duration-100",
          ].join(" ")}
          style={{
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            visibility: coords ? "visible" : "hidden",
            maxWidth: "calc(100vw - 24px)",
          }}
        >
          {/* Unificado al estilo estándar de texto secundario del cuerpo de
              la app (text-black-eske-80 / dark:text-[#9AAEBE], mismo tono
              que usa F3Tablero.tsx fuera de tooltips) — antes usaba
              dark:text-[#C5D8E8], un tono más claro exclusivo de este
              componente que desentonaba con el resto de la UI. */}
          {/* text-left explícito: el panel es position:fixed pero text-align
              SÍ hereda de ancestros en el DOM (ej. una tabla o modal con
              text-center) — sin esto, el contenido se veía centrado cuando
              el trigger vivía dentro de un contexto centrado. */}
          <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE] mt-1 text-left">{content}</p>
          {fuente && (
            <p className="text-[10px] lg:text-[12px] italic text-gray-eske-60 dark:text-[#6D8294] text-left">{fuente}</p>
          )}
          {example && (
            <p className="text-xs lg:text-sm text-gray-eske-60 dark:text-[#6D8294] italic border-t border-gray-eske-10 dark:border-white/10 pt-1.5 text-left">
              <span className="not-italic font-medium text-gray-eske-70 dark:text-[#9AAEBE]">
                Ej:{" "}
              </span>
              {example}
            </p>
          )}
        </div>
      )}
    </span>
  );
}
