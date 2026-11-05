// lib/moddulo/lineasAvisoSalida.ts
// SERVER-ONLY (decidirCandadoM1Servidor usa node:crypto y NextResponse). T5b: lo que F2 avisa ANTES de salir hacia
// Centinela: «si al volver importas un análisis, esto se reemplazaría». Reutiliza la MISMA decisión del candado H15 de
// `import-pestel` (acción «vincular») sin confirmación: si el candado pediría confirmar, sus líneas son el aviso; si
// no hay nada que perder (proyecto limpio) no hay líneas. Devuelve SOLO el estado y los rótulos de las líneas: nunca
// el mapa, la copia aprobada, el reporte ni el payload (prueba en `lineasAvisoSalida.test.ts`).
import { decidirCandadoM1Servidor } from "./candadoM1Servidor";
import type { ExploracionParaM1 } from "./m1Servidor";

export type SalidaAviso =
  | { estado: "sin_lineas" }
  | { estado: "con_lineas"; lineas: string[] }
  | { estado: "no_verificable" };

export function calcularSalida(exp: ExploracionParaM1 | undefined): SalidaAviso {
  // Fase 2 cerrada: el import respondería `fase_cerrada`, no reemplaza nada.
  if (exp?.status === "completed") return { estado: "sin_lineas" };
  const d = decidirCandadoM1Servidor(exp, "vincular", { confirmar: false, huella: null });
  if (d.accion === "continuar") return { estado: "sin_lineas" };
  const lineas = d.lineas.filter((l): l is string => typeof l === "string");
  return lineas.length > 0 ? { estado: "con_lineas", lineas } : { estado: "sin_lineas" };
}
