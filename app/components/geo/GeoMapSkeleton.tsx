interface GeoMapSkeletonProps {
  height?: string;
  className?: string;
}

export function GeoMapSkeleton({ height = "500px", className = "" }: GeoMapSkeletonProps) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-lg bg-gray-eske-10 dark:bg-white/10 animate-pulse ${className}`}
      style={{ height }}
      aria-busy="true"
      aria-label="Cargando mapa..."
    >
      <div className="flex flex-col items-center gap-3 text-gray-eske-40">
        <svg
          className="h-10 w-10 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm font-medium">Cargando mapa…</span>
      </div>
    </div>
  );
}
