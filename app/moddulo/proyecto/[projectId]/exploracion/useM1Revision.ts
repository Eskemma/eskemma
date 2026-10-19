"use client";

// Effects of the M1 review on the F2 screen: edit one dimension, save, restore, approve, reopen.
// Every DECISION (who may edit, what a response means, what the footer says) lives in the pure
// modules (pantallaM1, guardadoHonesto, textosModalM1); this hook only performs requests and keeps
// the state. The screen never says "Guardado"/"Aprobado" unless the server confirmed it (200 with a
// usable body); on any 409 it refetches the project.

import { useCallback, useMemo, useRef, useState } from "react";
import type { M1Datos, MapaPESTEL } from "@/types/moddulo.types";
import {
  decidirReemplazoAnalisis,
  decidirResultadoGuardado,
  mensajeTrasRefresco,
  type RespuestaGuardado,
} from "@/lib/moddulo/guardadoHonesto";
import { leerRespuestaGuardado } from "@/lib/moddulo/leerRespuestaGuardado";
import { ETIQUETA_DIMENSION } from "@/lib/moddulo/impactoM1";
import { registrarEdicion, restaurarDimension } from "@/lib/moddulo/m1Aprobacion";
import {
  debeRefrescarTras409,
  dimensionesConCambios,
  errorDeBorrador,
  permisoEdicionM1,
  type Borradores,
  debeGenerarTrasAprobar,
} from "@/lib/moddulo/pantallaM1";
import type { ResumenM1Cliente } from "@/lib/moddulo/m1Servidor";

export interface ReabrirModal {
  lineas: string[];
  huella: string | null;
  aviso: string | null;
  error: string | null;
  ocupado: boolean;
}

interface Params {
  projectId: string;
  mapaPESTEL: MapaPESTEL | null;
  setMapaPESTEL: (m: MapaPESTEL | null) => void;
  /** A motors draft or a finalized dvs is on screen. */
  motoresGenerados: boolean;
  /** Clears the local motors draft and approvals (the server discarded them on approving). */
  limpiarMotoresLocales: () => void;
  /** Generates M2–M5 (generarDraftDVS). Resolves when the attempt ended. */
  generarMotores: () => Promise<void>;
  /** The page leaves the editing/report views after a successful reopen. */
  alReabrir: () => void;
}

type GetProyecto = { project?: { phases?: { exploracion?: { m1?: M1Datos; linkedSource?: { payload?: MapaPESTEL }; status?: string } } }; m1?: ResumenM1Cliente };

export function useM1Revision(p: Params) {
  const { projectId } = p;
  const [resumen, setResumen] = useState<ResumenM1Cliente | null>(null);
  const [datos, setDatos] = useState<M1Datos | undefined>(undefined);
  const [f2Cerrada, setF2Cerrada] = useState(false);

  const [borradores, setBorradores] = useState<Borradores>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [errorDim, setErrorDim] = useState<Partial<Record<string, string>>>({});
  const [confirmarRestaurar, setConfirmarRestaurar] = useState<string | null>(null);
  const [dimParaFoco, setDimParaFoco] = useState<string | null>(null);

  const [aprobando, setAprobando] = useState(false);
  const [errorAprobar, setErrorAprobar] = useState<string | null>(null);
  const [avisoAprobar, setAvisoAprobar] = useState<string | null>(null);

  const [reabrirModal, setReabrirModal] = useState<ReabrirModal | null>(null);
  const [verificandoReabrir, setVerificandoReabrir] = useState(false);
  const [errorReabrir, setErrorReabrir] = useState<string | null>(null);

  // Latest values for async callbacks (no stale closures).
  const ref = useRef({ mapa: p.mapaPESTEL, resumen, datos, motoresGenerados: p.motoresGenerados, borradores });
  ref.current = { mapa: p.mapaPESTEL, resumen, datos, motoresGenerados: p.motoresGenerados, borradores };

  /** Applies a project GET to the M1 state. Returns the summary, or null if it did not carry one. */
  const aplicarGet = useCallback((data: GetProyecto | null): ResumenM1Cliente | null => {
    const exp = data?.project?.phases?.exploracion;
    if (!data?.m1) return null;
    setResumen(data.m1);
    setDatos(exp?.m1);
    setF2Cerrada(exp?.status === "completed");
    return data.m1;
  }, []);

  /** Refetches the project and refreshes the M1 state and the map. Null if the fetch failed. */
  const refrescar = useCallback(async (): Promise<ResumenM1Cliente | null> => {
    try {
      const r = await fetch(`/api/moddulo/projects/${projectId}`, { credentials: "include" });
      if (!r.ok) return null;
      const data = (await r.json()) as GetProyecto;
      const nuevo = aplicarGet(data);
      const payload = data.project?.phases?.exploracion?.linkedSource?.payload;
      if (nuevo && payload) p.setMapaPESTEL(payload);
      return nuevo;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, aplicarGet]);

  const estado = resumen?.estado ?? null;
  const kind = resumen?.kind ?? null;
  const permiso = useMemo(() => permisoEdicionM1({ kind, f2Cerrada, estado }), [kind, f2Cerrada, estado]);
  const cambiosSinGuardar = useMemo(() => dimensionesConCambios(borradores, p.mapaPESTEL), [borradores, p.mapaPESTEL]);

  // ── Edit one dimension ──────────────────────────────────────────────────────
  const iniciarEdicion = useCallback((dim: string) => {
    const d = ref.current.mapa?.[dim];
    if (!d) return;
    setBorradores((b) => ({ ...b, [dim]: { narrativa: d.narrativa ?? "", clasificacion: d.clasificacion } }));
    setErrorDim((e) => ({ ...e, [dim]: undefined }));
  }, []);

  const cambiarBorrador = useCallback((dim: string, patch: Partial<{ narrativa: string; clasificacion: string }>) => {
    setBorradores((b) => (b[dim] ? { ...b, [dim]: { ...b[dim]!, ...patch } } : b));
  }, []);

  const cerrarEdicion = useCallback((dim: string) => {
    setBorradores((b) => {
      const { [dim]: _quitada, ...resto } = b;
      void _quitada;
      return resto;
    });
    setErrorDim((e) => ({ ...e, [dim]: undefined }));
    setConfirmarRestaurar(null);
    setDimParaFoco(dim);
  }, []);

  /** Writes the server-confirmed values of one dimension into the local map and the local edits. */
  const aplicarResultadoLocal = useCallback((dim: string, datosResp: Record<string, unknown>, tras: "guardar" | "restaurar") => {
    const mapa = ref.current.mapa;
    const d = mapa?.[dim];
    if (!mapa || !d) return;
    const narrativa = typeof datosResp.narrativa === "string" ? datosResp.narrativa : d.narrativa ?? "";
    const clasificacion = (typeof datosResp.clasificacion === "string" ? datosResp.clasificacion : d.clasificacion) as typeof d.clasificacion;
    // Local mirror of what the server wrote, using the same pure functions it uses.
    let ediciones = ref.current.datos?.ediciones;
    if (tras === "restaurar") {
      ediciones = restaurarDimension(ediciones, dim).ediciones;
    } else {
      const ahora = new Date();
      if (narrativa !== (d.narrativa ?? "")) ediciones = registrarEdicion(ediciones, { dim, campo: "narrativa", valorActual: d.narrativa ?? "", editado: narrativa, por: "", en: ahora });
      if (clasificacion !== d.clasificacion) ediciones = registrarEdicion(ediciones, { dim, campo: "clasificacion", valorActual: d.clasificacion, editado: clasificacion, por: "", en: ahora });
    }
    setDatos((prev) => ({ ...(prev ?? {}), ediciones }));
    p.setMapaPESTEL({ ...mapa, [dim]: { ...d, narrativa, clasificacion } });
    if (typeof datosResp.huella === "string") setResumen((r) => (r ? { ...r, huella: datosResp.huella as string } : r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enviarEdicion = useCallback(
    async (dim: string, cuerpo: Record<string, unknown>, tras: "guardar" | "restaurar") => {
      const d = ref.current.mapa?.[dim];
      if (!d) return;
      setGuardando(dim);
      setErrorDim((e) => ({ ...e, [dim]: undefined }));
      try {
        const { resp, datos: respDatos } = await leerRespuestaGuardado(
          () =>
            fetch("/api/moddulo/f2/m1-edit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ projectId, dim, base: { narrativa: d.narrativa ?? "", clasificacion: d.clasificacion }, ...cuerpo }),
            }),
          (x) => x.ok === true && typeof x.huella === "string"
        );
        const decision = decidirResultadoGuardado("guardar_edicion_m1", resp, { dimension: ETIQUETA_DIMENSION[dim] ?? dim });
        if (!decision.exito) {
          // The user's text stays on screen; a 409 means the screen is stale: refetch, and word the message
          // by whether the refetch worked (m1_cambio says «la pantalla se actualizó» only if it did).
          let mensaje = decision.mensajeError;
          if (debeRefrescarTras409(resp)) {
            const nuevo = await refrescar();
            mensaje = mensajeTrasRefresco("guardar_edicion_m1", resp, mensaje, nuevo !== null);
          }
          setErrorDim((e) => ({ ...e, [dim]: mensaje ?? "" }));
          return;
        }
        aplicarResultadoLocal(dim, respDatos, tras);
        cerrarEdicion(dim);
      } finally {
        setGuardando(null);
      }
    },
    [projectId, aplicarResultadoLocal, cerrarEdicion, refrescar]
  );

  const guardarEdicion = useCallback(
    async (dim: string) => {
      const b = ref.current.borradores[dim];
      const d = ref.current.mapa?.[dim];
      if (!b || !d || guardando) return;
      const err = errorDeBorrador(b);
      if (err) {
        setErrorDim((e) => ({ ...e, [dim]: err }));
        return;
      }
      const cambioTexto = b.narrativa.trim() !== (d.narrativa ?? "");
      const cambioClas = b.clasificacion !== d.clasificacion;
      if (!cambioTexto && !cambioClas) {
        cerrarEdicion(dim); // nothing to save: leaving edit mode is not a save
        return;
      }
      await enviarEdicion(dim, { ...(cambioTexto ? { texto: b.narrativa } : {}), ...(cambioClas ? { clasificacion: b.clasificacion } : {}) }, "guardar");
    },
    [guardando, enviarEdicion, cerrarEdicion]
  );

  const restaurar = useCallback(
    async (dim: string) => {
      setConfirmarRestaurar(null);
      await enviarEdicion(dim, { restaurar: true }, "restaurar");
    },
    [enviarEdicion]
  );

  // ── Approve, then generate (two separate steps) ─────────────────────────────
  const aprobar = useCallback(async () => {
    const r0 = ref.current;
    if (aprobando || !r0.resumen?.huella) return;
    setAprobando(true);
    setErrorAprobar(null);
    setAvisoAprobar(null);
    try {
      const { resp, datos: respDatos } = await leerRespuestaGuardado(
        () =>
          fetch("/api/moddulo/f2/m1-approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ projectId, huellaVista: r0.resumen!.huella }),
          }),
        (x) => x.ok === true && typeof x.huella === "string"
      );
      const decision = decidirResultadoGuardado("aprobar_m1", resp);
      if (!decision.exito) {
        let mensaje = decision.mensajeError;
        if (debeRefrescarTras409(resp)) {
          const nuevo = await refrescar();
          mensaje = mensajeTrasRefresco("aprobar_m1", resp, mensaje, nuevo !== null);
        }
        setErrorAprobar(mensaje);
        return;
      }
      if (respDatos.motoresDescartados === true) p.limpiarMotoresLocales();
      // The authoritative state (and the approval date) comes from the server.
      const nuevo = await refrescar();
      if (!nuevo) {
        setAvisoAprobar("El análisis quedó aprobado, pero no se pudo actualizar la pantalla. Recarga la página para continuar.");
        return;
      }
      if (debeGenerarTrasAprobar({
        motoresSinGenerarServidor: nuevo.motoresSinGenerar,
        hayBorradorLocal: ref.current.motoresGenerados,
        motoresDescartados: respDatos.motoresDescartados === true,
      })) await p.generarMotores();
    } finally {
      setAprobando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, aprobando, refrescar]);

  // ── Reopen (H15 in the server) ──────────────────────────────────────────────
  const pedirReabrir = useCallback(
    async (confirmar: { huella: string } | null) => {
      if (confirmar) setReabrirModal((m) => (m ? { ...m, ocupado: true, error: null } : m));
      else {
        setVerificandoReabrir(true);
        setErrorReabrir(null);
      }
      try {
        const { resp, datos: respDatos } = await leerRespuestaGuardado(
          () =>
            fetch("/api/moddulo/f2/m1-reopen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ projectId, ...(confirmar ? { confirmar: true, huella: confirmar.huella } : {}) }),
            }),
          (x) => x.ok === true
        );
        const d = decidirReemplazoAnalisis(resp, { confirmado: confirmar !== null }, "reabrir_m1");
        const lineas = Array.isArray(respDatos.lineas) ? (respDatos.lineas as string[]) : [];
        const huella = typeof respDatos.huella === "string" ? respDatos.huella : null;
        if (d.tipo === "requiere_confirmacion" || d.tipo === "huella_vencida" || d.tipo === "bloqueado") {
          setReabrirModal({
            lineas, huella, ocupado: false, error: null,
            aviso: d.tipo === "huella_vencida" ? "El estado del análisis cambió. No se reabrió nada: revisa lo que se perderá y confirma de nuevo." : null,
          });
          return;
        }
        if (d.tipo === "error") {
          if (confirmar) setReabrirModal((m) => (m ? { ...m, ocupado: false, error: d.mensajeError } : m));
          else setErrorReabrir(d.mensajeError);
          if (debeRefrescarTras409(resp)) void refrescar();
          return;
        }
        // 200 (reopened, or it already was).
        setReabrirModal(null);
        await refrescar();
        p.alReabrir();
      } finally {
        setVerificandoReabrir(false);
        setReabrirModal((m) => (m ? { ...m, ocupado: false } : m));
      }
    },
    [projectId, refrescar, p]
  );

  return {
    // state
    resumen, datos, f2Cerrada, estado, kind, permiso,
    // load
    aplicarGet, refrescar, setResumen, setDatos, setF2Cerrada,
    // edit
    borradores, cambiosSinGuardar, guardando, errorDim, confirmarRestaurar, setConfirmarRestaurar,
    dimParaFoco, consumirFoco: () => setDimParaFoco(null),
    iniciarEdicion, cambiarBorrador, cancelarEdicion: cerrarEdicion, guardarEdicion, restaurar,
    // approve
    aprobando, errorAprobar, avisoAprobar, aprobar,
    // reopen
    reabrirModal, setReabrirModal, verificandoReabrir, errorReabrir,
    pedirReabrir: () => pedirReabrir(null),
    confirmarReabrir: () => (reabrirModal?.huella ? pedirReabrir({ huella: reabrirModal.huella }) : Promise.resolve()),
  };
}

export type M1Revision = ReturnType<typeof useM1Revision>;
