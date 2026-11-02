"use client";

// T3: el ajuste que el analista hizo en Centinela sobre una dimensión, dentro de la tarjeta de F2. Un desplegable
// accesible (botón con aria-expanded + región) en vez del `title` nativo, que tarda, no sale en táctil ni con teclado
// y no deja leer una justificación larga. Cerrado por defecto.
import { useId, useState } from "react";
import type { AjusteAnalistaF2 } from "@/types/moddulo.types";

function fechaLegible(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export default function AjusteAnalista({ ajuste, abiertoInicial = false }: { ajuste: AjusteAnalistaF2; abiertoInicial?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const idPanel = useId();
  const fecha = fechaLegible(ajuste.ajustadoEn);
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((v) => !v)}
        className="text-xs font-medium underline text-brown-eske-80 dark:text-yellow-eske focus-visible:outline focus-visible:outline-2"
      >
        {abierto ? "Ocultar el ajuste" : "Ver el ajuste"}
      </button>
      {abierto && (
        <div
          id={idPanel}
          className="border-l-4 border-brown-eske-60 dark:border-yellow-eske bg-brown-eske-60/10 dark:bg-yellow-eske/10 rounded-r-lg px-3 py-2 text-xs text-brown-eske-80 dark:text-yellow-eske space-y-1"
        >
          <p className="font-semibold">
            {ajuste.clasificacionOriginal} → {ajuste.clasificacionAjustada}
          </p>
          <p className="whitespace-pre-wrap break-words">{ajuste.justificacion}</p>
          {fecha && <p className="opacity-80">Ajustado el {fecha}</p>}
        </div>
      )}
    </div>
  );
}
