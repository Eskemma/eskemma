// lib/moddulo/versionado/estadoHookHistorial.ts
// C4a-2b — REDUCER PURO del hook del panel «Historial» y función pura de ruta → fase (sin DOM, sin red; importable desde
// el cliente). El hook solo ejecuta lo que este módulo decide:
//   · `faseDeRuta`: la fase sale del SEGMENTO EXACTO de la ruta (nunca `pathname.includes`); el botón existe solo en F1–F3.
//   · `reducirEstadoHistorial`: abrir, respuesta de la 1.ª página, «Cargar más», error, «Actualizar», cerrar, cambio de
//     fase. Una sola petición en vuelo a la vez, numerada: la respuesta (o error) de una petición anterior, o de otra
//     fase, o recibida con el panel cerrado, se DESCARTA. Con el panel cerrado no hay petición pendiente (0 lecturas).
//   · `vigente` y `esVigente` salen SOLO de la última respuesta de la 1.ª página (las páginas de «Cargar más» no los tocan).
//   · el hook cancela con AbortController la petición cuyo número deja de ser el vigente (cerrar / cambiar de fase).

import { esFaseConHistorial, type CodigoAviso, type FaseConHistorial, type FilaHistorial, type RespuestaHistorial } from "@/lib/versionado/lectura";
import { fusionarPagina, type EntradaEstadoPanel } from "./estadoPanelHistorial";

// ---- ruta → fase ----

/** `/moddulo/proyecto/{id}/{fase}` con la fase EXACTA (una de las tres con historial); cualquier otra ruta → null. */
export function faseDeRuta(pathname: string | null | undefined): FaseConHistorial | null {
  if (typeof pathname !== "string") return null;
  const seg = pathname.split("/").filter((s) => s.length > 0);
  if (seg.length !== 4 || seg[0] !== "moddulo" || seg[1] !== "proyecto") return null;
  return esFaseConHistorial(seg[3]) ? seg[3] : null;
}

// ---- reducer ----

export type TipoPeticion = "primera" | "mas";
export interface PeticionPendiente {
  /** Número de la petición: solo su respuesta es aceptada. */
  id: number;
  tipo: TipoPeticion;
  fase: FaseConHistorial;
  proyectoId: string;
  cursor?: number;
  conDeriva: boolean;
}

export interface EstadoHistorial {
  abierto: boolean;
  fase: FaseConHistorial | null;
  proyectoId: string | null;
  filas: FilaHistorial[];
  /** Última respuesta de la 1.ª página (de ella salen `vigente` y `totalCambios`). */
  primera: RespuestaHistorial | null;
  avisos: { codigo: CodigoAviso; texto: string }[];
  siguienteCursor: number | null;
  totalCambios: number;
  cargando: boolean;
  cargandoMas: boolean;
  actualizando: boolean;
  mensajeError: string | null;
  errorAlCargarMas: string | null;
  errorAlActualizar: string | null;
  /** F3: la persona pidió comprobar los cambios sin registro. */
  derivaF3Pedida: boolean;
  /** Contador de peticiones lanzadas (cada acción que pide datos suma 1). */
  contador: number;
  /** Petición que el hook debe lanzar ahora (null = ninguna). */
  pendiente: PeticionPendiente | null;
  /** Petición cuya respuesta se acepta (null = ninguna: p. ej. panel cerrado). */
  vigenteId: number | null;
}

export const ESTADO_INICIAL: EstadoHistorial = {
  abierto: false, fase: null, proyectoId: null, filas: [], primera: null, avisos: [], siguienteCursor: null, totalCambios: 0,
  cargando: false, cargandoMas: false, actualizando: false, mensajeError: null, errorAlCargarMas: null, errorAlActualizar: null,
  derivaF3Pedida: false, contador: 0, pendiente: null, vigenteId: null,
};

export type AccionHistorial =
  | { tipo: "abrir"; fase: FaseConHistorial; proyectoId: string }
  | { tipo: "cerrar" }
  | { tipo: "cambio_fase"; fase: FaseConHistorial | null }
  | { tipo: "cargar_mas" }
  /** «Actualizar» y «Reintentar» (recarga la 1.ª página). */
  | { tipo: "actualizar" }
  | { tipo: "comprobar_deriva" }
  | { tipo: "respuesta"; id: number; fase: FaseConHistorial; peticion: TipoPeticion; respuesta: RespuestaHistorial }
  | { tipo: "error"; id: number; fase: FaseConHistorial; peticion: TipoPeticion; mensaje: string };

const enVuelo = (e: EstadoHistorial) => e.cargando || e.cargandoMas || e.actualizando;

/** Estado limpio (todo lo cargado se descarta; la petición en vuelo queda invalidada). */
function limpio(e: EstadoHistorial, extra: Partial<EstadoHistorial> = {}): EstadoHistorial {
  return { ...ESTADO_INICIAL, contador: e.contador + 1, ...extra };
}

function lanzar(e: EstadoHistorial, tipo: TipoPeticion, extra: Partial<PeticionPendiente> = {}): Pick<EstadoHistorial, "contador" | "pendiente" | "vigenteId"> {
  const id = e.contador + 1;
  return {
    contador: id,
    vigenteId: id,
    pendiente: { id, tipo, fase: e.fase as FaseConHistorial, proyectoId: e.proyectoId as string, conDeriva: false, ...extra },
  };
}

function unir(previos: EstadoHistorial["avisos"], nuevos: RespuestaHistorial["avisos"]): EstadoHistorial["avisos"] {
  const m = new Map(previos.map((a) => [a.codigo, a]));
  for (const a of nuevos) if (!m.has(a.codigo)) m.set(a.codigo, a);
  return [...m.values()];
}

export function reducirEstadoHistorial(e: EstadoHistorial, a: AccionHistorial): EstadoHistorial {
  switch (a.tipo) {
    case "abrir": {
      if (e.abierto && e.fase === a.fase && e.proyectoId === a.proyectoId) return e;
      const base: EstadoHistorial = { ...ESTADO_INICIAL, contador: e.contador, abierto: true, fase: a.fase, proyectoId: a.proyectoId, cargando: true };
      return { ...base, ...lanzar(base, "primera") };
    }
    case "cerrar":
      return limpio(e, { fase: e.fase, proyectoId: e.proyectoId });
    case "cambio_fase": {
      if (a.fase === e.fase) return e;
      // El layout sigue montado al cambiar de fase: el panel se cierra y limpia su estado.
      return limpio(e, { fase: a.fase, proyectoId: e.proyectoId });
    }
    case "cargar_mas": {
      if (!e.abierto || e.siguienteCursor === null || enVuelo(e)) return e;
      return { ...e, cargandoMas: true, errorAlCargarMas: null, ...lanzar(e, "mas", { cursor: e.siguienteCursor }) };
    }
    case "actualizar":
    case "comprobar_deriva": {
      if (!e.abierto || e.fase === null || enVuelo(e)) return e;
      if (a.tipo === "comprobar_deriva" && e.fase !== "investigacion") return e;
      const derivaF3Pedida = e.derivaF3Pedida || a.tipo === "comprobar_deriva";
      const conDeriva = e.fase === "investigacion" && derivaF3Pedida;
      const sinFilas = e.filas.length === 0;
      return {
        ...e, derivaF3Pedida, mensajeError: null, errorAlActualizar: null, errorAlCargarMas: null,
        cargando: sinFilas, actualizando: !sinFilas, ...lanzar(e, "primera", { conDeriva }),
      };
    }
    case "respuesta": {
      if (!e.abierto || a.id !== e.vigenteId || a.fase !== e.fase) return e; // petición anterior, otra fase o panel cerrado
      const comun = { cargando: false, cargandoMas: false, actualizando: false, mensajeError: null, errorAlCargarMas: null, errorAlActualizar: null, pendiente: null, vigenteId: null };
      if (a.peticion === "primera") {
        return {
          ...e, ...comun, filas: [...a.respuesta.filas], primera: a.respuesta, avisos: a.respuesta.avisos.map((x) => x),
          siguienteCursor: a.respuesta.siguienteCursor, totalCambios: a.respuesta.totalCambios,
        };
      }
      return {
        ...e, ...comun, filas: fusionarPagina(e.filas, a.respuesta.filas), avisos: unir(e.avisos, a.respuesta.avisos),
        siguienteCursor: a.respuesta.siguienteCursor, // `primera` (vigente, esVigente, total) NO se toca
      };
    }
    case "error": {
      if (!e.abierto || a.id !== e.vigenteId || a.fase !== e.fase) return e;
      const base = { ...e, cargando: false, cargandoMas: false, actualizando: false, pendiente: null, vigenteId: null };
      if (a.peticion === "mas") return { ...base, errorAlCargarMas: a.mensaje };
      return e.filas.length === 0 ? { ...base, mensajeError: a.mensaje } : { ...base, errorAlActualizar: a.mensaje };
    }
  }
}

/** Entrada de `decidirEstadoPanel` a partir del estado del hook (avisos acumulados de todas las páginas). */
export function entradaDePanel(e: EstadoHistorial): EntradaEstadoPanel {
  return {
    cargando: e.cargando,
    mensajeError: e.mensajeError,
    filas: e.filas,
    respuesta: e.primera === null ? null : { ...e.primera, avisos: e.avisos },
    siguienteCursor: e.siguienteCursor,
    totalCambios: e.totalCambios,
    cargandoMas: e.cargandoMas,
    actualizando: e.actualizando,
    errorAlCargarMas: e.errorAlCargarMas,
    errorAlActualizar: e.errorAlActualizar,
  };
}
