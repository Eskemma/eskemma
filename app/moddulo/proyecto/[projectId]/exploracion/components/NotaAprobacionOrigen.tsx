"use client";

// T7 C3: la nota de aprobación que el analista dejó en Centinela (aprobó con confianza global < 50), dentro de F2. Mismo
// desplegable accesible que `AjusteAnalista` (botón con aria-expanded + región), cerrado por defecto, atribuido «según el
// analista». Las importaciones anteriores dicen «no disponible» SIN sugerir cómo obtenerla (no existe una acción para eso:
// una importación anterior nunca adquiere la nota). Sin nota (aprobación con confianza suficiente o análisis sin aprobar)
// no se pinta nada.
import { useId, useState } from "react";
import { textoNotaAprobacion, type NotaAprobacion } from "@/lib/centinela/pestel/notaAprobacion";

function fechaLegible(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export default function NotaAprobacionOrigen({
  v,
  nota,
  abiertoInicial = false,
}: {
  v: number | null;
  nota: NotaAprobacion | null;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const idPanel = useId();
  const t = textoNotaAprobacion(v == null ? null : { v }, nota);
  if (!t) return null;
  const fecha = nota ? fechaLegible(nota.aprobadoEn) : null;
  return (
    <div className="shrink-0 mb-3 space-y-1.5">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((x) => !x)}
        className="text-xs font-medium underline text-brown-eske-80 dark:text-yellow-eske focus-visible:outline focus-visible:outline-2"
      >
        {abierto ? "Ocultar la nota de aprobación" : "Ver la nota de aprobación del analista"}
      </button>
      {abierto && (
        <div
          id={idPanel}
          className="border-l-4 border-brown-eske-60 dark:border-yellow-eske bg-brown-eske-60/10 dark:bg-yellow-eske/10 rounded-r-lg px-3 py-2 text-xs text-brown-eske-80 dark:text-yellow-eske space-y-1"
        >
          <p className="whitespace-pre-wrap break-words">{t.texto}</p>
          {t.tipo !== "no_disponible" && fecha && <p className="opacity-80">Aprobado el {fecha}</p>}
        </div>
      )}
    </div>
  );
}
