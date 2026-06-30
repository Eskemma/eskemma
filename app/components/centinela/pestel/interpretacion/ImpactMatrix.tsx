"use client";

// app/components/centinela/pestel/interpretacion/ImpactMatrix.tsx
// Interactive 2D impact/probability matrix for E6 interpretation.
// Each dimension is a draggable circle. Keyboard-accessible (arrows + Enter).
// Shows AI-proposed ghost position alongside the analyst's adjusted position.
// Triggers AdjustmentModal when a meaningful drag ends.

import { useState, useRef, useCallback } from "react";
import type {
  DimensionAnalysis,
  HumanAdjustment,
  DimensionCode,
  Classification,
} from "@/types/pestel.types";
import {
  getDimensionCoordinates,
  getAdjustedCoordinates,
} from "@/lib/pestel/matrizUtils";
import AdjustmentModal from "./AdjustmentModal";
import { DIMENSION_META } from "@/types/pestel.types";

// Minimum drag distance (in matrix units 0–100) to trigger the modal
const DRAG_THRESHOLD = 5;

// Keyboard movement step (in matrix units)
const KEY_STEP = 5;

interface PendingDrag {
  code: DimensionCode;
  newPosition: { x: number; y: number };
}

interface Props {
  dimensions: DimensionAnalysis[];
  adjustments: HumanAdjustment[];
  saving: boolean;
  onAdjust: (
    code: DimensionCode,
    newPosition: { x: number; y: number },
    justification: string,
    newClassification: Classification
  ) => Promise<void>;
  readOnly?: boolean;
}

export default function ImpactMatrix({
  dimensions: dimensionsProp,
  adjustments,
  saving,
  onAdjust,
  readOnly = false,
}: Props) {
  const dimensions = dimensionsProp ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DimensionCode | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingDrag, setPendingDrag] = useState<PendingDrag | null>(null);

  // Convert client pointer coordinates to matrix units (0–100)
  function clientToMatrix(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    // Y axis: invert so top = high impact
    const y = Math.max(0, Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100));
    return { x: Math.round(x), y: Math.round(y) };
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, code: DimensionCode) => {
      if (readOnly) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(code);
      const pos = clientToMatrix(e.clientX, e.clientY);
      if (pos) setDragPos(pos);
    },
    [readOnly]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const pos = clientToMatrix(e.clientX, e.clientY);
      if (pos) setDragPos(pos);
    },
    [dragging]
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent, code: DimensionCode) => {
      if (!dragging || dragging !== code) return;
      const dim = dimensions.find((d) => d.code === code)!;
      const original = getAdjustedCoordinates(dim, adjustments);
      const newPos = dragPos ?? original;

      const delta = Math.sqrt(
        Math.pow(newPos.x - original.x, 2) + Math.pow(newPos.y - original.y, 2)
      );

      setDragging(null);
      setDragPos(null);

      if (delta >= DRAG_THRESHOLD) {
        setPendingDrag({ code, newPosition: newPos });
      }
    },
    [dragging, dragPos, dimensions, adjustments]
  );

  // Keyboard handler for focused point
  function handleKeyDown(
    e: React.KeyboardEvent,
    code: DimensionCode
  ) {
    if (readOnly) return;
    const dim = dimensions.find((d) => d.code === code)!;
    const current = getAdjustedCoordinates(dim, adjustments);
    let { x, y } = current;
    let moved = false;

    if (e.key === "ArrowRight") { x = Math.min(100, x + KEY_STEP); moved = true; }
    else if (e.key === "ArrowLeft") { x = Math.max(0, x - KEY_STEP); moved = true; }
    else if (e.key === "ArrowUp") { y = Math.min(100, y + KEY_STEP); moved = true; }
    else if (e.key === "ArrowDown") { y = Math.max(0, y - KEY_STEP); moved = true; }
    else if (e.key === "Enter") {
      setPendingDrag({ code, newPosition: current });
      return;
    }

    if (moved) {
      e.preventDefault();
      setPendingDrag({ code, newPosition: { x, y } });
    }
  }

  async function handleModalSave(
    justification: string,
    newClassification: Classification
  ) {
    if (!pendingDrag) return;
    await onAdjust(
      pendingDrag.code,
      pendingDrag.newPosition,
      justification,
      newClassification
    );
    setPendingDrag(null);
  }

  function handleModalCancel() {
    setPendingDrag(null);
  }

  const pendingDim = pendingDrag
    ? dimensions.find((d) => d.code === pendingDrag.code)
    : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Visible methodology description */}
        <div className="text-xs text-black-eske dark:text-[#C5D8E8] space-y-1 mb-2
          bg-gray-eske-10 dark:bg-[#112233] rounded-lg px-3 py-2.5">
          <p>La matriz posiciona cada factor PESTEL según probabilidad de ocurrencia e impacto en el proyecto.</p>
          <ul className="space-y-0.5 list-disc list-inside text-black-eske dark:text-[#9AAEBE]">
            <li>Eje horizontal: probabilidad de ocurrencia (baja → alta)</li>
            <li>Eje vertical: impacto en el proyecto (bajo → alto)</li>
          </ul>
          <p className="font-semibold mt-1">Cuadrantes:</p>
          <ul className="space-y-0.5 list-disc list-inside text-black-eske dark:text-[#9AAEBE]">
            <li><span className="text-red-eske font-medium">Prioridad crítica:</span> alta probabilidad + alto impacto → acción inmediata</li>
            <li><span className="text-violet-700 dark:text-violet-400 font-medium">Vigilar:</span> baja probabilidad + alto impacto → monitoreo estrecho</li>
            <li><span className="text-gray-eske-60 dark:text-[#9AAEBE] font-medium">Atención moderada:</span> alta probabilidad + bajo impacto → gestión rutinaria</li>
            <li><span className="text-green-eske font-medium">Monitoreo básico:</span> baja probabilidad + bajo impacto → atención mínima</li>
          </ul>
          {!readOnly && (
            <p className="mt-1 italic text-black-eske-60 dark:text-[#9AAEBE]">
              La IA posicionó cada dimensión según el análisis. Puedes arrastrar los puntos para ajustar. Cada movimiento requiere justificación.
            </p>
          )}
        </div>

        {/* Axis labels */}
        <div className="flex items-stretch gap-2">
          <div
            className="flex flex-col items-center justify-center text-xs font-bold text-black-eske dark:text-[#C5D8E8] shrink-0"
            aria-hidden="true"
          >
            <span className="[writing-mode:vertical-rl] rotate-180 leading-none
              py-2 text-center w-5 text-sm">
              Impacto ↑
            </span>
          </div>

          {/* Matrix container */}
          <div className="flex-1 flex flex-col gap-1">
            <div
              ref={containerRef}
              className="relative w-full rounded-xl border border-gray-eske-20 dark:border-white/10
                overflow-hidden cursor-crosshair"
              style={{ paddingBottom: "75%" }}
              onPointerMove={handlePointerMove}
              role="group"
              aria-label="Matriz de impacto y probabilidad. Usa las teclas de flecha para mover los puntos."
            >
              {/* Absolute inner container */}
              <div className="absolute inset-0">
                {/* Quadrant backgrounds */}
                {/* Top-left: high impact, low probability → Vigilar */}
                <div className="absolute top-0 left-0 w-1/2 h-1/2
                  bg-violet-100/40 dark:bg-violet-900/20" aria-hidden="true" />
                {/* Top-right: high impact, high probability → Prioridad crítica */}
                <div className="absolute top-0 right-0 w-1/2 h-1/2
                  bg-red-eske/8" aria-hidden="true" />
                {/* Bottom-left: low impact, low probability → Monitoreo básico */}
                <div className="absolute bottom-0 left-0 w-1/2 h-1/2
                  bg-green-eske/10" aria-hidden="true" />
                {/* Bottom-right: low impact, high probability → Atención moderada */}
                <div className="absolute bottom-0 right-0 w-1/2 h-1/2
                  bg-gray-eske-10 dark:bg-white/5" aria-hidden="true" />

                {/* Center crosshair */}
                <div className="absolute inset-0 pointer-events-none"
                  aria-hidden="true">
                  <div className="absolute top-1/2 left-0 right-0 h-px
                    bg-gray-eske-20 dark:bg-white/10" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px
                    bg-gray-eske-20 dark:bg-white/10" />
                </div>

                {/* Quadrant labels */}
                <span className="absolute top-2 left-2 text-xs
                  text-violet-700 dark:text-violet-400 font-bold pointer-events-none"
                  aria-hidden="true">
                  Vigilar
                </span>
                <span className="absolute top-2 right-2 text-xs
                  text-red-eske font-bold pointer-events-none text-right"
                  aria-hidden="true">
                  Prioridad crítica
                </span>
                <span className="absolute bottom-2 left-2 text-xs
                  text-green-eske font-bold pointer-events-none"
                  aria-hidden="true">
                  Monitoreo básico
                </span>
                <span className="absolute bottom-2 right-2 text-xs
                  text-gray-eske-60 dark:text-[#9AAEBE] font-bold pointer-events-none text-right"
                  aria-hidden="true">
                  Atención moderada
                </span>

                {/* Ghost points (AI-proposed positions) */}
                {dimensions.map((dim) => {
                  const aiPos = getDimensionCoordinates(dim);
                  const adjPos = getAdjustedCoordinates(dim, adjustments);
                  const hasAdjustment =
                    aiPos.x !== adjPos.x || aiPos.y !== adjPos.y;

                  if (!hasAdjustment) return null;

                  return (
                    <div
                      key={`ghost-${dim.code}`}
                      className="absolute w-9 h-9 rounded-full border-2
                        border-dashed border-bluegreen-eske/40
                        bg-bluegreen-eske/10 flex items-center justify-center
                        pointer-events-none -translate-x-1/2 translate-y-1/2"
                      style={{
                        left: `${aiPos.x}%`,
                        bottom: `${aiPos.y}%`,
                      }}
                      aria-hidden="true"
                    >
                      <span className="text-xs font-bold text-bluegreen-eske/40">
                        {dim.code}
                      </span>
                    </div>
                  );
                })}

                {/* Draggable dimension points */}
                {dimensions.map((dim) => {
                  const isCurrentlyDragging = dragging === dim.code;
                  const pos =
                    isCurrentlyDragging && dragPos
                      ? dragPos
                      : getAdjustedCoordinates(dim, adjustments);

                  const hasAdjustment = adjustments?.some(
                    (a) => a.dimensionCode === dim.code
                  );

                  return (
                    <div
                      key={dim.code}
                      role="button"
                      tabIndex={readOnly ? -1 : 0}
                      aria-label={`${DIMENSION_META[dim.code].label}. Impacto: ${Math.round(pos.y)}%, Probabilidad: ${Math.round(pos.x)}%. ${readOnly ? "" : "Usa flechas para mover, Enter para ajustar."}`}
                      className={[
                        "absolute w-9 h-9 rounded-full flex items-center justify-center",
                        "text-xs font-bold text-white shadow-sm",
                        "-translate-x-1/2 translate-y-1/2",
                        readOnly
                          ? "cursor-default"
                          : isCurrentlyDragging
                          ? "cursor-grabbing scale-110 shadow-md"
                          : "cursor-grab hover:scale-105",
                        hasAdjustment
                          ? "bg-orange-eske ring-2 ring-orange-eske/40"
                          : "bg-bluegreen-eske ring-2 ring-bluegreen-eske/20",
                        "transition-transform motion-safe:duration-100",
                        "focus:outline-none focus-visible:ring-4 focus-visible:ring-bluegreen-eske",
                      ].join(" ")}
                      style={{
                        left: `${pos.x}%`,
                        bottom: `${pos.y}%`,
                        zIndex: isCurrentlyDragging ? 20 : 10,
                        touchAction: "none",
                      }}
                      onPointerDown={(e) => handlePointerDown(e, dim.code)}
                      onPointerUp={(e) => handlePointerUp(e, dim.code)}
                      onKeyDown={(e) => handleKeyDown(e, dim.code)}
                    >
                      {dim.code}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* X axis label */}
            <p className="text-sm font-bold text-black-eske dark:text-[#C5D8E8] text-center"
              aria-hidden="true">
              Probabilidad →
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-1 text-xs text-black-eske dark:text-[#9AAEBE]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-bluegreen-eske
              inline-block shrink-0" aria-hidden="true" />
            Posición actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-dashed
              border-bluegreen-eske/50 inline-block shrink-0" aria-hidden="true" />
            Propuesta IA (referencia)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-eske
              inline-block shrink-0" aria-hidden="true" />
            Ajustado por analista
          </span>
        </div>
      </div>

      {/* Adjustment modal */}
      {pendingDrag && pendingDim && (
        <AdjustmentModal
          dimensionCode={pendingDrag.code}
          currentClassification={
            adjustments.find((a) => a.dimensionCode === pendingDrag.code)
              ?.newClassification ?? pendingDim.classification
          }
          saving={saving}
          onSave={handleModalSave}
          onCancel={handleModalCancel}
        />
      )}
    </>
  );
}
