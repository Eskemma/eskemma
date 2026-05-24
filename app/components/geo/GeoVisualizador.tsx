"use client";

import dynamic from "next/dynamic";
import type { GeoVisualizadorProps } from "@/types/geo.types";
import { GeoMapSkeleton } from "./GeoMapSkeleton";

// Leaflet uses `window` and cannot render server-side.
const GeoVisualizadorMap = dynamic(
  () => import("./GeoVisualizadorMap").then((m) => m.GeoVisualizadorMap),
  { ssr: false, loading: () => <GeoMapSkeleton /> }
);

export function GeoVisualizador({ height = "500px", className = "", ...rest }: GeoVisualizadorProps) {
  return <GeoVisualizadorMap height={height} className={className} {...rest} />;
}
