"use client";

import {useState} from "react";

interface TerritorioSelectorProps {
  onConfigCreated: (configId: string, territorioNombre: string) => void;
}

export default function TerritorioSelector({
  onConfigCreated,
}: TerritorioSelectorProps) {
  const [territorioNombre, setTerritorioNombre] = useState("");
  const [modo, setModo] = useState<"ciudadano" | "gubernamental">("ciudadano");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!territorioNombre.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/centinela/pestel/config", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          territorioNombre: territorioNombre.trim(),
          modo,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as {error?: string};
        throw new Error(data.error ?? "Error al guardar configuración");
      }

      const data = (await res.json()) as {configId: string};
      onConfigCreated(data.configId, territorioNombre.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-bluegreen-eske-60 dark:text-[#6BA4C6] mb-1">
          Configurar monitoreo
        </h2>
        <p className="text-sm text-gray-eske-90 dark:text-[#9AAEBE]">
          Define el territorio y el tipo de análisis que deseas monitorear.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="territorio"
            className="text-sm font-medium text-gray-700 dark:text-[#C7D6E0]"
          >
            Territorio
          </label>
          <input
            id="territorio"
            type="text"
            value={territorioNombre}
            onChange={(e) => setTerritorioNombre(e.target.value)}
            placeholder="ej. Ciudad de México, Jalisco, México"
            className="px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
              focus:outline-none focus:ring-2 focus:ring-bluegreen-eske
              placeholder:text-gray-eske-60 dark:placeholder:text-[#6D8294]"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="modo"
            className="text-sm font-medium text-gray-700 dark:text-[#C7D6E0]"
          >
            Tipo de análisis
          </label>
          <select
            id="modo"
            value={modo}
            onChange={(e) =>
              setModo(e.target.value as "ciudadano" | "gubernamental")
            }
            className="px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-bluegreen-eske
              bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]"
          >
            <option value="ciudadano">Ciudadano</option>
            <option value="gubernamental">Gubernamental</option>
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !territorioNombre.trim()}
          className="mt-1 px-4 py-2.5 bg-bluegreen-eske text-white
            rounded-lg text-sm font-medium transition-colors duration-200
            hover:bg-bluegreen-eske-60
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Guardando…" : "Guardar configuración"}
        </button>
      </form>
    </div>
  );
}
