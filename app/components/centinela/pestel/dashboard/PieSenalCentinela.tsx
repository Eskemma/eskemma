import type { Senal } from "@/types/pestel.types";
import { FECHA_NO_REGISTRADA, FUENTE_NO_REGISTRADA, fechaLegible, fuenteLegible, nivelLegible } from "@/lib/pestel/senalCampos";

// Pie de una señal en el panel de dimensiones. T7 C4: pasa por `senalCampos` — lo que falta se dice («fuente no
// registrada», «fecha no registrada») y un nivel ausente o desconocido NO se pinta (antes salía como «baja» en rojo).
const NIVEL: Record<"alto" | "medio" | "bajo", { clase: string; texto: string }> = {
  alto: { clase: "text-green-eske", texto: "alta" },
  medio: { clase: "text-brown-eske-60 dark:text-yellow-eske-60", texto: "media" },
  bajo: { clase: "text-red-eske", texto: "baja" },
};

export function PieSenalCentinela({ s }: { s: Senal }) {
  const fuente = fuenteLegible(s);
  const fecha = fechaLegible(s);
  const nivel = nivelLegible(s);
  return (
    <p className="text-xs text-gray-eske-60 dark:text-[#9AAEBE] mt-1">
      {fuente ?? FUENTE_NO_REGISTRADA}
      {" · "}
      {fecha ?? FECHA_NO_REGISTRADA}
      {nivel && (
        <>
          {" · "}
          <span className={NIVEL[nivel].clase}>confianza {NIVEL[nivel].texto}</span>
        </>
      )}
      {s.origenInternacional && " · internacional"}
    </p>
  );
}
