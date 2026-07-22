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

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface InfoTooltipProps {
  /** Main explanation of what the field/action does and why it matters */
  content: string;
  /** Optional short example to illustrate (shown after content) */
  example?: string;
  /** Additional CSS classes for the trigger button */
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
        aria-label="Más información"
        className={[
          "inline-flex items-center justify-center",
          "w-4 h-4 rounded-full text-[10px] font-bold leading-none",
          "bg-bluegreen-eske/10 text-bluegreen-eske",
          "hover:bg-bluegreen-eske/20 transition-colors",
          "focus:outline-none focus-visible:ring-2",
          "focus-visible:ring-bluegreen-eske focus-visible:ring-offset-1",
          "cursor-pointer shrink-0",
        ].join(" ")}
      >
        i
      </button>

      {open && (
        <div
          ref={panelRef}
          id={tooltipId}
          role="tooltip"
          className={[
            "fixed z-50 w-64 sm:w-72",
            "bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 rounded-lg shadow-lg",
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
          {/* Estilo idéntico al texto de la HEI en F3Tablero.tsx (referencia
              de diseño para todo tooltip del sistema): mismo tamaño
              (text-xs lg:text-sm), mismo color (text-black-eske-80 /
              dark:text-[#C5D8E8] — no text-black-eske ni otro hex, aunque
              se vean casi iguales) y sin leading-relaxed (la HEI no fuerza
              ningún leading-*, así que usa el companion line-height por
              defecto de Tailwind para su tamaño). */}
          <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#C5D8E8]">{content}</p>
          {example && (
            <p className="text-xs lg:text-sm text-gray-eske-60 dark:text-[#6D8294] italic border-t border-gray-eske-10 dark:border-white/10 pt-1.5">
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
