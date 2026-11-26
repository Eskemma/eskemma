// lib/moddulo/versionado/estadoVolver.ts
// C4b-2a — REDUCTOR PURO de la vista «Volver a esta versión» del panel «Historial» (solo F3). Sin DOM ni red: el componente
// solo pinta y ejecuta la ÚNICA petición pendiente que este módulo decide (patrón de `estadoHookHistorial.ts`).
//
//   reposo → preguntando (POST sin confirmar) → confirmando (la persona ve las líneas) → volviendo (POST con huella)
//          → exito | error
//
// Reglas (decisiones de Raúl, C4b-2):
//   · se decide por el CÓDIGO del cuerpo (`decidirReemplazoAnalisis("volver_a_version")`), nunca por el status;
//   · `reemplazo_huella_vencida` vuelve a «confirmando» con las líneas y la huella NUEVAS (la persona confirma otra vez);
//   · `reemplazo_bloqueado` muestra el mensaje del servidor y NO ofrece reintentar;
//   · `sin_cambios` explica y cierra la vista;
//   · un fallo ambiguo (red, 5xx, escritura incierta, 200 inválido) NUNCA ofrece reintentar a ciegas: dice que se abra el
//     historial y se revise; ningún estado de error tiene acción de confirmar;
//   · una respuesta de una petición anterior o de una vista ya cancelada se DESCARTA (número de petición vigente);
//   · el servidor NO formatea fechas: la fecha de la fila llega ya formateada por el panel (`fechaTexto`), con el mismo
//     formateador de la lista, y si falta la frase se compone sin ella (nunca «undefined»).

import {
  decidirReemplazoAnalisis, TEXTOS_VOLVER, type RespuestaGuardado,
} from "@/lib/moddulo/guardadoHonesto";
import type { ArtefactoDeFila, FilaHistorial } from "@/lib/versionado/lectura";

export const PREFIJO_RESULTADO = "f3Resultado:";

export const TEXTOS_VISTA_VOLVER = {
  botonFila: "Volver a esta versión",
  titulo: "¿Volver a una versión anterior de este resultado?",
  cancelar: "Cancelar",
  confirmar: "Volver a esta versión",
  volviendo: "Volviendo a la versión anterior…",
  preguntando: "Revisando qué cambiaría…",
  cerrar: "Cerrar",
  verHistorial: "Ver el historial",
  avisoHuella: TEXTOS_VOLVER.huellaVencida,
  /** Frase de apertura; la fecha es la de la FILA del panel, ya formateada. Sin nombre o sin fecha se compone sin ellos. */
  apertura: (nombre: string | null, fechaTexto: string | null): string =>
    `Vas a volver a ${fraseVersion(fechaTexto)} de ${nombre ? `«${nombre}»` : "este resultado"}. ` +
    "El resultado como está ahora no se borra: queda en el historial y puedes volver a él.",
  exito: (fechaTexto: string | null): string =>
    `Listo: volviste a ${fraseVersion(fechaTexto)}. El resultado quedó sin aprobar.`,
} as const;

function fraseVersion(fechaTexto: string | null): string {
  return fechaTexto ? `la versión del ${fechaTexto}` : "una versión anterior";
}

// ---- botón de la fila ----

export interface DestinoVolver {
  resultadoId: string;
  versionId: string;
  artefacto: ArtefactoDeFila;
}

/**
 * Qué artefactos de la fila ofrecen «Volver a esta versión». Decide POR ARTEFACTO, no por fila: solo `f3Resultado:*`, solo
 * si el servidor dijo que esta persona puede (`puedeVolver`), la versión se conserva completa (`recuperable === "completo"`:
 * `no` y `desconocido` no llevan botón) y no es ya la vigente. Una fila `parcial` con su `f3Resultado` completo SÍ lo lleva.
 * El servidor vuelve a decidir todo al recibir la petición.
 */
export function destinosVolverDeFila(fila: FilaHistorial, puedeVolver: boolean): DestinoVolver[] {
  if (puedeVolver !== true) return [];
  const out: DestinoVolver[] = [];
  for (const a of fila.artefactos) {
    if (!a.nombre.startsWith(PREFIJO_RESULTADO)) continue;
    const resultadoId = a.nombre.slice(PREFIJO_RESULTADO.length);
    if (resultadoId.length === 0 || a.vigente || a.recuperable !== "completo" || !a.versionId) continue;
    out.push({ resultadoId, versionId: a.versionId, artefacto: a });
  }
  return out;
}

// ---- estado ----

export type FaseVolver = "reposo" | "preguntando" | "confirmando" | "volviendo" | "exito" | "error";
export type TipoError = "ambiguo" | "bloqueado" | "sin_cambios" | "otro";

export interface ObjetivoVolver {
  resultadoId: string;
  versionId: string;
  /** Fecha de la FILA ya formateada por el panel (`formatearFechaFila`); null = sin fecha legible. */
  fechaTexto: string | null;
}

export interface PeticionVolver {
  id: number;
  resultadoId: string;
  versionId: string;
  confirmar: boolean;
  huella?: string;
}

export interface EstadoVolver {
  fase: FaseVolver;
  objetivo: ObjetivoVolver | null;
  nombre: string | null;
  lineas: string[];
  huella: string | null;
  /** Las líneas y la huella son NUEVAS porque algo cambió mientras la persona decidía. */
  avisoHuella: boolean;
  mensajeError: string | null;
  errorTipo: TipoError | null;
  contador: number;
  pendiente: PeticionVolver | null;
  vigenteId: number | null;
  /** Efecto que el componente debe ejecutar UNA vez: avisar al fondo y recargar el historial. */
  efecto: "avisar_y_recargar" | null;
}

export const ESTADO_VOLVER_INICIAL: EstadoVolver = {
  fase: "reposo", objetivo: null, nombre: null, lineas: [], huella: null, avisoHuella: false, mensajeError: null,
  errorTipo: null, contador: 0, pendiente: null, vigenteId: null, efecto: null,
};

export type AccionVolver =
  | { tipo: "abrir"; objetivo: ObjetivoVolver }
  | { tipo: "confirmar" }
  /** «Cancelar», Escape o «Cerrar»: vuelve a la lista. Con la petición de escritura en vuelo no hace nada. */
  | { tipo: "cancelar" }
  | { tipo: "respuesta"; id: number; resp: RespuestaGuardado; datos: Record<string, unknown> | null }
  | { tipo: "efecto_hecho" };

function esAmbiguo(resp: RespuestaGuardado): boolean {
  if (resp.tipo === "error_red") return true;
  if (resp.codigo === "historial_no_confirmado") return false; // el servidor afirma que no escribió nada
  return resp.ok || resp.status >= 500 || resp.codigo === "reemplazo_escritura_incierta";
}

function leerPregunta(datos: Record<string, unknown> | null): { lineas: string[]; huella: string; nombre: string | null } | null {
  if (!datos) return null;
  const { lineas, huella, nombre } = datos;
  if (!Array.isArray(lineas) || !lineas.every((l) => typeof l === "string")) return null;
  if (typeof huella !== "string" || huella.length === 0) return null;
  return { lineas: lineas as string[], huella, nombre: typeof nombre === "string" && nombre.trim() ? nombre : null };
}

const error = (e: EstadoVolver, errorTipo: TipoError, mensajeError: string): EstadoVolver => ({
  ...e, fase: "error", errorTipo, mensajeError, pendiente: null, vigenteId: null, avisoHuella: false,
});

function enConfirmacion(e: EstadoVolver, p: { lineas: string[]; huella: string; nombre: string | null }, avisoHuella: boolean): EstadoVolver {
  return {
    ...e, fase: "confirmando", lineas: p.lineas, huella: p.huella, nombre: p.nombre ?? e.nombre, avisoHuella,
    mensajeError: null, errorTipo: null, pendiente: null, vigenteId: null,
  };
}

export function reducirEstadoVolver(e: EstadoVolver, a: AccionVolver): EstadoVolver {
  switch (a.tipo) {
    case "abrir": {
      const id = e.contador + 1;
      return {
        ...ESTADO_VOLVER_INICIAL, fase: "preguntando", objetivo: a.objetivo, contador: id, vigenteId: id,
        pendiente: { id, resultadoId: a.objetivo.resultadoId, versionId: a.objetivo.versionId, confirmar: false },
      };
    }
    case "confirmar": {
      if (e.fase !== "confirmando" || !e.objetivo || !e.huella) return e;
      const id = e.contador + 1;
      return {
        ...e, fase: "volviendo", contador: id, vigenteId: id, avisoHuella: false,
        pendiente: { id, resultadoId: e.objetivo.resultadoId, versionId: e.objetivo.versionId, confirmar: true, huella: e.huella },
      };
    }
    case "cancelar": {
      if (e.fase === "volviendo") return e; // la escritura ya salió: no se puede cancelar a medias
      return { ...ESTADO_VOLVER_INICIAL, contador: e.contador };
    }
    case "efecto_hecho":
      return e.efecto ? { ...e, efecto: null } : e;
    case "respuesta": {
      if (a.id !== e.vigenteId || (e.fase !== "preguntando" && e.fase !== "volviendo")) return e;
      const d = decidirReemplazoAnalisis(a.resp, {}, "volver_a_version");
      const cuerpoMensaje = a.resp.tipo === "respuesta" ? a.resp.mensaje : undefined;
      if (d.tipo === "bloqueado") return error(e, "bloqueado", cuerpoMensaje ?? TEXTOS_VOLVER.bloqueado);
      if (a.resp.tipo === "respuesta" && a.resp.codigo === "sin_cambios") return error(e, "sin_cambios", TEXTOS_VOLVER.sinCambios);
      if (e.fase === "preguntando") {
        if (d.tipo === "requiere_confirmacion") {
          const p = leerPregunta(a.datos);
          return p ? enConfirmacion(e, p, false) : error(e, "ambiguo", TEXTOS_VOLVER.ambiguo);
        }
        // En la pregunta el servidor nunca escribe: un éxito es una respuesta inesperada, no un «listo».
        if (d.tipo === "exito") return error(e, "ambiguo", TEXTOS_VOLVER.ambiguo);
        if (d.tipo === "huella_vencida") return error(e, "otro", TEXTOS_VOLVER.huellaVencida);
        return error(e, "otro", d.mensajeError);
      }
      // volviendo
      if (d.tipo === "exito") {
        return { ...e, fase: "exito", pendiente: null, vigenteId: null, efecto: "avisar_y_recargar", mensajeError: null, errorTipo: null };
      }
      if (d.tipo === "huella_vencida" || d.tipo === "requiere_confirmacion") {
        const p = leerPregunta(a.datos);
        return p ? enConfirmacion(e, p, true) : error(e, "otro", TEXTOS_VOLVER.huellaVencida);
      }
      return error(e, esAmbiguo(a.resp) ? "ambiguo" : "otro", d.mensajeError);
    }
  }
}

// ---- helpers del componente ----

/** Cuerpo del POST de la petición pendiente (el proyecto lo pone el componente). */
export function cuerpoPeticionVolver(projectId: string, p: PeticionVolver): Record<string, unknown> {
  return {
    projectId, resultadoId: p.resultadoId, versionId: p.versionId,
    ...(p.confirmar ? { confirmarReemplazo: true, huella: p.huella } : {}),
  };
}

/** Tras un error ambiguo la salida es revisar el historial: el componente vuelve a la lista Y la recarga. */
export const ofreceVerHistorial = (e: EstadoVolver): boolean => e.fase === "error" && e.errorTipo === "ambiguo";

/** Solo la fase «confirmando» ofrece confirmar: ningún error ni estado intermedio tiene esa acción (sin reintento a ciegas). */
export const ofreceConfirmar = (e: EstadoVolver): boolean => e.fase === "confirmando" && !!e.huella;

export type DestinoFocoVolver = "boton_fila" | "titulo";
/** Al volver a la lista el foco regresa al botón de la fila; si esa fila ya no está (p. ej. tras recargar), al título. */
export const dondeVuelveFocoVolver = (botonSigueEnLista: boolean): DestinoFocoVolver => (botonSigueEnLista ? "boton_fila" : "titulo");
