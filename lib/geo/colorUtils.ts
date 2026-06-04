// lib/geo/colorUtils.ts
// Shared color utilities for geo choropleth maps.
import type { GeoColorRamp } from "@/types/geo.types";

export function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

/**
 * Linearly interpolates between ramp.colorLow and ramp.colorHigh.
 * When ramp.colorMid is provided, uses 3-point interpolation (divergent scale):
 *   [min → mid] maps t∈[0,0.5] and [mid → max] maps t∈[0.5,1].
 */
export function interpolateColor(ramp: GeoColorRamp, value: number): string {
  const range = ramp.max - ramp.min;
  const t = range === 0 ? 0.5 : Math.max(0, Math.min(1, (value - ramp.min) / range));

  if (ramp.colorMid) {
    const [mr, mg, mb] = hexToRgb(ramp.colorMid);
    if (t <= 0.5) {
      const t2 = t * 2;
      const [lr, lg, lb] = hexToRgb(ramp.colorLow);
      return `rgb(${Math.round(lr + (mr - lr) * t2)},${Math.round(lg + (mg - lg) * t2)},${Math.round(lb + (mb - lb) * t2)})`;
    } else {
      const t2 = (t - 0.5) * 2;
      const [hr, hg, hb] = hexToRgb(ramp.colorHigh);
      return `rgb(${Math.round(mr + (hr - mr) * t2)},${Math.round(mg + (hg - mg) * t2)},${Math.round(mb + (hb - mb) * t2)})`;
    }
  }

  // Original 2-point interpolation (backward compatible)
  const [lr, lg, lb] = hexToRgb(ramp.colorLow);
  const [hr, hg, hb] = hexToRgb(ramp.colorHigh);
  return `rgb(${Math.round(lr + (hr - lr) * t)},${Math.round(lg + (hg - lg) * t)},${Math.round(lb + (hb - lb) * t)})`;
}
