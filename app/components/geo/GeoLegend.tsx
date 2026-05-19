import type { GeoColorRamp } from "@/types/geo.types";

interface GeoLegendProps {
  colorRamp: GeoColorRamp;
  label?: string;
  formatValue?: (v: number) => string;
}

function lerp(a: string, b: string, t: number): string {
  const hex = (s: string) => [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export function GeoLegend({ colorRamp, label, formatValue }: GeoLegendProps) {
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("es-MX"));
  const steps = 5;

  return (
    <div className="absolute bottom-6 right-3 z-[1000] rounded-lg bg-white-eske/95 dark:bg-[#0D2035]/95 shadow-md border border-gray-eske-20 dark:border-white/10 p-3 min-w-[140px]">
      {label && (
        <p className="text-xs font-semibold text-black-eske dark:text-black-eske-10 mb-2 leading-tight">
          {label}
        </p>
      )}
      <div
        className="h-3 w-full rounded"
        style={{
          background: `linear-gradient(to right, ${colorRamp.colorLow}, ${colorRamp.colorHigh})`,
        }}
        aria-hidden="true"
      />
      <div className="flex justify-between mt-1">
        {Array.from({ length: steps }, (_, i) => {
          const t = i / (steps - 1);
          const val = colorRamp.min + (colorRamp.max - colorRamp.min) * t;
          return (
            <span
              key={i}
              className="text-[10px] text-black-eske-60 dark:text-black-eske-40 leading-none"
            >
              {fmt(val)}
            </span>
          );
        })}
      </div>
      {colorRamp.noDataColor && (
        <div className="flex items-center gap-1.5 mt-2">
          <div
            className="h-3 w-3 rounded-sm border border-gray-eske-20 flex-shrink-0"
            style={{ background: colorRamp.noDataColor }}
            aria-hidden="true"
          />
          <span className="text-[10px] text-black-eske-60 dark:text-black-eske-40">Sin datos</span>
        </div>
      )}
    </div>
  );
}
