"use client";

import { GeoNavegador } from "@/app/components/geo/GeoNavegador";
import type { GeoScopeElectoral } from "@/types/geo.types";
import { useState } from "react";

export default function GeoTestPage() {
  const [lastScope, setLastScope] = useState<GeoScopeElectoral | null>(null);
  const [lastClick, setLastClick] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white-eske dark:bg-[#0D2035] p-6">
      <h1 className="text-2xl font-bold text-black-eske dark:text-white mb-1">
        GeoNavegador — Prueba
      </h1>
      <p className="text-sm text-black-eske-60 dark:text-white/50 mb-5 max-w-2xl">
        Selecciona una entidad para ver su mapa. Elige el nivel de análisis (municipio, distrito federal o local)
        y luego una unidad específica para ver sus secciones electorales internas.
      </p>

      <GeoNavegador
        height="640px"
        onScopeChange={setLastScope}
        onFeatureClick={(layerId, props) => setLastClick(`[${layerId}] ${JSON.stringify(props)}`)}
      />

      {lastScope && (
        <div className="mt-4 rounded bg-blue-eske/5 border border-blue-eske/15 px-4 py-2.5 text-xs font-mono text-black-eske-60 dark:text-white/55">
          <span className="text-blue-eske font-semibold">scope actual: </span>
          {JSON.stringify(lastScope)}
        </div>
      )}

      {lastClick && (
        <div className="mt-2 rounded bg-gray-eske-10 dark:bg-white/5 p-3 text-xs font-mono text-black-eske dark:text-white break-all">
          <span className="font-semibold">Último click: </span>{lastClick}
        </div>
      )}

      <p className="mt-6 text-xs text-black-eske-60 dark:text-black-eske-40">
        Página temporal de prueba. Eliminar antes de producción.
      </p>
    </div>
  );
}
