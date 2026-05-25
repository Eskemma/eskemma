// lib/geo/colorUtils.ts
// Shared color utilities for geo choropleth maps.
import type { GeoColorRamp } from "@/types/geo.types";

export function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

/**
 * Linearly interpolates between ramp.colorLow and ramp.colorHigh.
 * Returns ramp.colorHigh when min === max (avoids division by zero).
 */
export function interpolateColor(ramp: GeoColorRamp, value: number): string {
  const range = ramp.max - ramp.min;
  const t = range === 0 ? 1 : Math.max(0, Math.min(1, (value - ramp.min) / range));
  const [lr, lg, lb] = hexToRgb(ramp.colorLow);
  const [hr, hg, hb] = hexToRgb(ramp.colorHigh);
  return `rgb(${Math.round(lr + (hr - lr) * t)},${Math.round(lg + (hg - lg) * t)},${Math.round(lb + (hb - lb) * t)})`;
}
