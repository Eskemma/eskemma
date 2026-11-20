"use client";

// C4a-2b — hook del panel «Historial». Toda la lógica de estado vive en `estadoHookHistorial.ts` (reducer puro, probado);
// este hook solo ejecuta la ÚNICA petición pendiente que el reducer decide y la cancela con AbortController cuando deja
// de ser la vigente (cerrar o cambiar de fase). Con el panel cerrado no hay petición: 0 lecturas. No hace ningún otro fetch.

import { useCallback, useEffect, useReducer } from "react";
import { decidirLecturaHistorial } from "@/lib/moddulo/guardadoHonesto";
import { leerRespuestaGuardado } from "@/lib/moddulo/leerRespuestaGuardado";
import { ESTADO_INICIAL, faseDeRuta, reducirEstadoHistorial } from "@/lib/moddulo/versionado/estadoHookHistorial";
import type { RespuestaHistorial } from "@/lib/versionado/lectura";

export function useHistorialFase(proyectoId: string, pathname: string) {
  const fase = faseDeRuta(pathname);
  const [estado, dispatch] = useReducer(reducirEstadoHistorial, ESTADO_INICIAL);

  // El layout sigue montado al cambiar de fase: el reducer cierra y limpia.
  useEffect(() => {
    dispatch({ tipo: "cambio_fase", fase });
  }, [fase]);

  useEffect(() => {
    const p = estado.pendiente;
    if (!p) return;
    const ac = new AbortController();
    const q = `fase=${p.fase}&limite=20${p.cursor !== undefined ? `&cursor=${p.cursor}` : ""}${p.conDeriva ? "&deriva=1" : ""}`;
    void (async () => {
      const { resp, datos } = await leerRespuestaGuardado(
        () => fetch(`/api/moddulo/projects/${encodeURIComponent(p.proyectoId)}/historial?${q}`, { credentials: "include", signal: ac.signal }),
        (d) => Array.isArray(d.filas) && Array.isArray(d.avisos)
      );
      if (ac.signal.aborted) return;
      const d = decidirLecturaHistorial(resp, resp.tipo === "respuesta" ? resp.cuerpoValido !== false : true);
      if (d.exito) dispatch({ tipo: "respuesta", id: p.id, fase: p.fase, peticion: p.tipo, respuesta: datos as unknown as RespuestaHistorial });
      else dispatch({ tipo: "error", id: p.id, fase: p.fase, peticion: p.tipo, mensaje: d.mensajeError ?? "No se pudo cargar el historial." });
    })();
    return () => ac.abort();
  }, [estado.pendiente]);

  const abrir = useCallback(() => {
    if (fase) dispatch({ tipo: "abrir", fase, proyectoId });
  }, [fase, proyectoId]);
  const cerrar = useCallback(() => dispatch({ tipo: "cerrar" }), []);
  const cargarMas = useCallback(() => dispatch({ tipo: "cargar_mas" }), []);
  const actualizar = useCallback(() => dispatch({ tipo: "actualizar" }), []);
  const comprobarDeriva = useCallback(() => dispatch({ tipo: "comprobar_deriva" }), []);
  return { fase, estado, abrir, cerrar, cargarMas, actualizar, comprobarDeriva };
}
