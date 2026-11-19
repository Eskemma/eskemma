// lib/moddulo/versionado/derivaVivo.ts
// SOLO SERVIDOR (usa `lib/versionado/huella`, que depende de node:crypto). C4a-1 — DERIVA al LEER: el estado vivo de un
// artefacto cambió por un escritor que no registra historial. Se compara la huella de la PROYECCIÓN VIVA actual contra
// la huella `vivo` que guardó el manifiesto vigente (mismo mecanismo que `prepararVersion`, C3a). Solo lectura: no
// escribe nada.
//
// Devuelve `true` (cambió sin registro), `false` (coincide) o `null` (no se puede comprobar: el manifiesto no trae
// huella viva, el artefacto no es de los conocidos, o es de F3 y no se pidió comprobarlo).

import { huellaContenido } from "@/lib/versionado/huella";
import { normalizeTareaPIP } from "@/lib/moddulo/project";
import { vivoF2M1, type ExploracionCruda } from "./artefactosF2";
import { vivoCierre, type FaseCruda } from "./artefactosCierre";
import { vivoAsignacion, vivoResultado } from "./artefactosF3";
import type { AsignacionCanal } from "@/types/moddulo.types";

type Doc = Record<string, unknown>;

export interface ContextoDeriva {
  /** `phases` del documento del proyecto (crudo). */
  phases: Doc | undefined;
  /**
   * Documentos de `f3Resultados` (id → datos). `null` = no se pidió leerlos (F3 sin `deriva=1`): los artefactos de
   * resultados y asignaciones de F3 quedan «no comprobados».
   */
  resultadosF3: Map<string, Doc> | null;
}

export function detectarDeriva(nombre: string, entrada: { vivo?: string } | undefined, ctx: ContextoDeriva): boolean | null {
  const guardada = entrada?.vivo;
  if (typeof guardada !== "string") return null;
  const phases = ctx.phases ?? {};

  if (nombre === "f2M1") {
    return huellaContenido(vivoF2M1(phases.exploracion as ExploracionCruda | undefined)) !== guardada;
  }
  if (nombre.startsWith("cierre:")) {
    const fase = nombre.slice("cierre:".length);
    if (!fase) return null;
    return huellaContenido(vivoCierre(fase as never, phases[fase] as FaseCruda | undefined)) !== guardada;
  }
  if (nombre.startsWith("f3Resultado:")) {
    if (ctx.resultadosF3 === null) return null;
    const doc = ctx.resultadosF3.get(nombre.slice("f3Resultado:".length));
    return doc === undefined ? true : huellaContenido(vivoResultado(doc)) !== guardada;
  }
  if (nombre.startsWith("f3Asignacion:")) {
    if (ctx.resultadosF3 === null) return null;
    const id = nombre.slice("f3Asignacion:".length);
    const tablero = ((phases.investigacion as Doc | undefined)?.f3TareasPIP ?? []) as unknown[];
    const asignaciones: AsignacionCanal[] = Array.isArray(tablero)
      ? tablero.flatMap((t) => normalizeTareaPIP(t as never).asignaciones)
      : [];
    const a = asignaciones.find((x) => x.asignacionId === id);
    return a === undefined ? true : huellaContenido(vivoAsignacion(a)) !== guardada;
  }
  return null;
}
