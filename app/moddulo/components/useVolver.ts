"use client";

// C4b-2b — ejecuta la ÚNICA petición pendiente que decide el reductor `estadoVolver` y dispara el efecto de éxito.
// Vive en `HistorialFase` (que sigue montado aunque el panel se cierre), así que una escritura en vuelo termina de
// procesarse y avisa a la página aunque el panel ya no esté a la vista.
//
// Aviso a la pantalla de fondo: `avisarProyectoActualizado` se llama UNA sola vez, solo cuando el reductor llega a
// «éxito» (un 200 tras confirmar) y se consume con `efecto_hecho`; nunca tras la pregunta ni tras un error.

import { useCallback, useEffect, useReducer, useRef } from "react";
import { leerRespuestaGuardado } from "@/lib/moddulo/leerRespuestaGuardado";
import { avisarProyectoActualizado } from "@/lib/moddulo/eventosProyecto";
import {
  cuerpoPeticionVolver, ESTADO_VOLVER_INICIAL, reducirEstadoVolver, type ObjetivoVolver,
} from "@/lib/moddulo/versionado/estadoVolver";

export function useVolver(projectId: string, alExito: () => void) {
  const [estado, dispatch] = useReducer(reducirEstadoVolver, ESTADO_VOLVER_INICIAL);
  const claveRef = useRef<string | null>(null);
  const alExitoRef = useRef(alExito);
  alExitoRef.current = alExito;
  const efectoHecho = useRef(0);

  useEffect(() => {
    const p = estado.pendiente;
    if (!p) return;
    const ac = new AbortController();
    void (async () => {
      const { resp, datos } = await leerRespuestaGuardado(() =>
        fetch("/api/moddulo/f3/resultados/volver", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpoPeticionVolver(projectId, p)),
          signal: ac.signal,
        })
      );
      if (ac.signal.aborted) return;
      dispatch({ tipo: "respuesta", id: p.id, resp, datos });
    })();
    return () => ac.abort();
  }, [estado.pendiente, projectId]);

  useEffect(() => {
    if (estado.efecto !== "avisar_y_recargar" || efectoHecho.current === estado.contador) return;
    efectoHecho.current = estado.contador;
    avisarProyectoActualizado(projectId);
    alExitoRef.current();
    dispatch({ tipo: "efecto_hecho" });
  }, [estado.efecto, estado.contador, projectId]);

  const abrir = useCallback((objetivo: ObjetivoVolver, clave: string) => {
    claveRef.current = clave;
    dispatch({ tipo: "abrir", objetivo });
  }, []);
  const confirmar = useCallback(() => dispatch({ tipo: "confirmar" }), []);
  const cancelar = useCallback(() => dispatch({ tipo: "cancelar" }), []);
  return { estado, claveRef, abrir, confirmar, cancelar };
}
