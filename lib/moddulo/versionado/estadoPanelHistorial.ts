// lib/moddulo/versionado/estadoPanelHistorial.ts
// C4a-2a — LÓGICA PURA del panel «Historial» (sin DOM, sin Firestore, sin red; importable desde el cliente). El panel
// (C4a-2b) solo pinta lo que estas funciones deciden, de modo que todo lo que se puede equivocar se prueba sin
// navegador:
//   · estado de la pantalla (cargando / vacío / error / índice en construcción / con filas) y sus textos;
//   · fusión de páginas sin filas duplicadas;
//   · cuántos cambios no se pueden mostrar (estado final explícito, H-V54);
//   · marcas de cada fila («Versión actual», «Cambio nuevo»…);
//   · cuándo pedir la deriva de F3;
//   · la TRAMPA DE FOCO propia (H-V53): recalcula los enfocables en cada Tab, a diferencia de `useFocusTrap`, que los
//     fija al abrirse.
// Los textos de lectura y de avisos NO se inventan aquí: salen de `textosHistorial` y de `guardadoHonesto`.

import type { FaseConHistorial, FilaHistorial, RespuestaHistorial } from "@/lib/versionado/lectura";
import { TEXTO_AVISO, TEXTO_FASE_SIN_HISTORIAL } from "./textosHistorial";
import { TEXTO_HISTORIAL_INDICE_NO_LISTO } from "@/lib/moddulo/guardadoHonesto";

// ---------------------------------------------------------------------------------------------------------------------
// Estado de la pantalla
// ---------------------------------------------------------------------------------------------------------------------

export const TEXTO_CARGANDO_HISTORIAL = "Cargando historial…";

export type EstadoPanel =
  | { tipo: "cargando"; texto: string }
  | { tipo: "vacio"; texto: string }
  | { tipo: "indice_no_listo"; texto: string; reintentable: true }
  | { tipo: "error"; texto: string; reintentable: true }
  | {
      tipo: "filas";
      filas: FilaHistorial[];
      totalCambios: number;
      /** Hay más páginas que pedir con «Cargar más». */
      puedeCargarMas: boolean;
      /** Textos de aviso (de `TEXTO_AVISO`), sin repetir, en el orden en que llegan. */
      avisos: string[];
      /** Hubo un cambio mientras se cargaba: el panel ofrece «Actualizar». */
      hayCambioNuevo: boolean;
      /** Si ya no hay más páginas y aun así faltan cambios por mostrar: el texto explícito (H-V54); si no, null. */
      estadoFinal: string | null;
      /** Una petición de «Cargar más» está en vuelo (el botón se deshabilita y se anuncia con role="status"). */
      cargandoMas: boolean;
      /** Una petición de «Actualizar» (o de «Comprobar cambios sin registro») está en vuelo. */
      actualizando: boolean;
      /** Falló «Cargar más»: texto de `decidirLecturaHistorial`, junto al botón con «Reintentar»; las filas NO se borran. */
      errorAlCargarMas: string | null;
      /** Falló «Actualizar»: mismo trato (las filas anteriores se conservan). */
      errorAlActualizar: string | null;
    };

export interface EntradaEstadoPanel {
  /** Hay una petición en vuelo y todavía no hay filas que mostrar. */
  cargando: boolean;
  /** Mensaje de `decidirLecturaHistorial` cuando la última petición falló; null si no falló. */
  mensajeError: string | null;
  /** Filas acumuladas (ya fusionadas). */
  filas: readonly FilaHistorial[];
  /** Última respuesta recibida (de la 1.ª página o de «Cargar más»); null si aún no hay ninguna. */
  respuesta: RespuestaHistorial | null;
  /** `siguienteCursor` de la ÚLTIMA página cargada (puede diferir del de la 1.ª). */
  siguienteCursor: number | null;
  /** `totalCambios` de la respuesta más reciente de la 1.ª página. */
  totalCambios: number;
  cargandoMas?: boolean;
  actualizando?: boolean;
  errorAlCargarMas?: string | null;
  errorAlActualizar?: string | null;
}

/**
 * Qué muestra el panel. Prioridad: error > cargando (sin filas) > vacío (la fase no tiene historial) > filas.
 * Un error con filas ya cargadas NO borra las filas: llega en `errorAlCargarMas` / `errorAlActualizar` y el panel lo
 * muestra junto al botón con «Reintentar»; `mensajeError` solo domina cuando no hay nada que mostrar.
 */
export function decidirEstadoPanel(e: EntradaEstadoPanel): EstadoPanel {
  if (e.mensajeError !== null && e.filas.length === 0) {
    if (e.mensajeError === TEXTO_HISTORIAL_INDICE_NO_LISTO) {
      return { tipo: "indice_no_listo", texto: e.mensajeError, reintentable: true };
    }
    return { tipo: "error", texto: e.mensajeError, reintentable: true };
  }
  if (e.filas.length === 0) {
    if (e.cargando || e.respuesta === null) return { tipo: "cargando", texto: TEXTO_CARGANDO_HISTORIAL };
    if (e.totalCambios === 0 && e.respuesta.faltantesTotal === 0 && e.respuesta.avisos.length === 0) {
      return { tipo: "vacio", texto: TEXTO_FASE_SIN_HISTORIAL };
    }
  }
  const avisos: string[] = [];
  const codigos = new Set<string>();
  for (const a of e.respuesta?.avisos ?? []) {
    if (!codigos.has(a.codigo)) {
      codigos.add(a.codigo);
      if (!avisos.includes(a.texto)) avisos.push(a.texto);
    }
  }
  const sinMostrar = cambiosSinMostrar(e.totalCambios, e.filas);
  const puedeCargarMas = e.siguienteCursor !== null;
  return {
    tipo: "filas",
    filas: [...e.filas],
    totalCambios: e.totalCambios,
    puedeCargarMas,
    avisos,
    hayCambioNuevo: e.filas.some((f) => f.posteriorALaLectura) || codigos.has("cambio_durante_lectura"),
    estadoFinal: !puedeCargarMas && sinMostrar > 0 ? textoEstadoFinal(sinMostrar, e.totalCambios) : null,
    cargandoMas: e.cargandoMas === true,
    actualizando: e.actualizando === true,
    // Con filas, un error de la petición NO las borra: se muestra junto a su botón. Sin filas domina `mensajeError`.
    errorAlCargarMas: e.errorAlCargarMas ?? null,
    errorAlActualizar: e.errorAlActualizar ?? null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Fusión de páginas
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Une la página nueva con las filas ya cargadas SIN duplicados: la clave es `revisionN` (única por fase) y, si una
 * revisión llega dos veces, gana la más reciente. Orden descendente por `revisionN`. No modifica sus argumentos.
 */
export function fusionarPagina(previas: readonly FilaHistorial[], nueva: readonly FilaHistorial[]): FilaHistorial[] {
  const porRevision = new Map<number, FilaHistorial>();
  for (const f of previas) porRevision.set(f.revisionN, f);
  for (const f of nueva) porRevision.set(f.revisionN, f);
  return [...porRevision.values()].sort((a, b) => b.revisionN - a.revisionN);
}

// ---------------------------------------------------------------------------------------------------------------------
// Cambios que no se pueden mostrar (H-V54)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * N de «Algunos cambios antiguos no se pueden mostrar. Faltan N de T.».
 *   · T = `totalCambios` = `puntero.n` de la fase (un evento por revisión): lo que el contador dice que existe.
 *   · «filas únicas» = revisiones DISTINTAS entre las filas cargadas (una revisión repetida cuenta una vez).
 *   · Las filas `posteriorALaLectura` (revisionN mayor que el puntero leído) NO cuentan: no están dentro de T, y
 *     contarlas ocultaría faltantes reales.
 *   · N = max(0, T − únicas). Incluye los huecos intermedios y los eventos inválidos, no solo «los más antiguos»:
 *     es todo lo que el contador dice que existe y el panel no puede mostrar.
 * Solo es una conclusión cuando no hay más páginas que pedir (si las hay, lo que falta es solo lo no cargado todavía).
 */
export function cambiosSinMostrar(totalCambios: number, filas: readonly FilaHistorial[]): number {
  if (!Number.isInteger(totalCambios) || totalCambios < 1) return 0;
  const unicas = new Set<number>();
  for (const f of filas) if (!f.posteriorALaLectura) unicas.add(f.revisionN);
  return Math.max(0, totalCambios - unicas.size);
}

/** Reutiliza el texto existente de «eventos incompletos» y le suma el conteo. */
export function textoEstadoFinal(sinMostrar: number, total: number): string {
  return `${TEXTO_AVISO.eventos_incompletos} Faltan ${sinMostrar} de ${total}.`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Marcas de las filas
// ---------------------------------------------------------------------------------------------------------------------

export type ClaveMarca = "vigente" | "cambio_nuevo" | "deriva_antes" | "parcial" | "no_conservada" | "no_comprobada";
export interface MarcaFila {
  clave: ClaveMarca;
  texto: string;
}

export const TEXTO_MARCA: Record<ClaveMarca, string> = {
  vigente: "★ Versión actual",
  cambio_nuevo: "Cambio nuevo: ocurrió mientras se cargaba esta lista",
  deriva_antes: "Antes de este cambio, algo se modificó sin dejar registro.",
  parcial: "Parte de esta versión ya no se conserva.",
  no_conservada: "Esta versión ya no se conserva.",
  // H-V62 (C4b-1a): un registro incompleto no permite saber qué versión era; antes se rotulaba «ya no se conserva».
  no_comprobada: "No se pudo comprobar si esta versión se conserva.",
};

/**
 * Marcas de una fila, en orden fijo. Una fila posterior a la lectura NUNCA lleva «Versión actual» (aunque llegara con
 * `esVigente`). La versión «previa al historial» NO es una fila (es una versión, no un evento: la lista no la
 * muestra), así que no hay marca para ella; el detalle de versiones llegará con «volver» (C4b/C4c).
 */
export function marcasDeFila(f: FilaHistorial): MarcaFila[] {
  const m: MarcaFila[] = [];
  const marca = (clave: ClaveMarca) => m.push({ clave, texto: TEXTO_MARCA[clave] });
  if (f.esVigente && !f.posteriorALaLectura) marca("vigente");
  if (f.posteriorALaLectura) marca("cambio_nuevo");
  if (f.derivaAntes) marca("deriva_antes");
  if (f.recuperable === "parcial") marca("parcial");
  else if (f.recuperable === "no") marca("no_conservada");
  else if (f.recuperable === "desconocido") marca("no_comprobada");
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// Deriva
// ---------------------------------------------------------------------------------------------------------------------

/**
 * ¿La petición lleva `deriva=1`? F1 y F2 NO la piden: el lector la calcula siempre y es gratis (usa el documento ya
 * leído). F3 solo la pide cuando la persona pulsa «Comprobar cambios sin registro»: nunca al abrir ni al actualizar.
 */
export function debePedirDeriva(fase: FaseConHistorial, accionDeLaPersona: boolean): boolean {
  return fase === "investigacion" && accionDeLaPersona;
}

/** Lecturas de Firestore de una petición: 2 + K eventos (cuando hay puntero); +N resultados con deriva de F3. */
export function lecturasDePeticion(o: { eventosPedidos: number; conPuntero: boolean; resultadosF3?: number }): number {
  if (!o.conPuntero) return 1;
  return 2 + o.eventosPedidos + (o.resultadosF3 ?? 0);
}

// ---------------------------------------------------------------------------------------------------------------------
// Trampa de foco PROPIA (H-V53)
// ---------------------------------------------------------------------------------------------------------------------

export interface DecisionTab {
  /** true = hay que `preventDefault()` y mover el foco a `destino`; false = dejar que el navegador siga. */
  prevenir: boolean;
  /** Id del elemento a enfocar (de la lista recibida); null = enfocar el propio contenedor del panel. */
  destino: string | null;
}

/**
 * Decide qué hace la tecla Tab dentro del panel. `enfocables` se RECALCULA en cada pulsación (por eso ve los botones
 * que aparecen después, como «Cargar más»); `actual` = id del elemento que tiene el foco (null si es el contenedor o
 * algo fuera de la lista). Reglas:
 *   · lista vacía → se queda en el contenedor;
 *   · foco fuera de la lista → entra por el primero (Tab) o por el último (Shift+Tab);
 *   · Tab en el último → vuelve al primero; Shift+Tab en el primero → va al último;
 *   · con el activo fuera de la lista pero dentro del diálogo, se sigue el orden del documento (`antesDelActivo`);
 *   · en cualquier otro caso el navegador sigue su orden natural.
 */
export function siguienteEnCiclo(
  enfocables: readonly string[],
  actual: string | null,
  shift: boolean,
  /**
   * Solo cuando el elemento activo NO está en la lista pero SÍ dentro del diálogo (p. ej. un título con `tabIndex=-1` que
   * recibió el foco por código): cuántos enfocables lo PRECEDEN en el orden del documento. Entonces Tab va al siguiente
   * enfocable en ese orden (Shift+Tab, al anterior), con recorrido circular. Sin este dato, un activo ajeno a la lista va
   * al primero (Tab) o al último (Shift+Tab), como antes.
   */
  antesDelActivo?: number | null
): DecisionTab {
  if (enfocables.length === 0) return { prevenir: true, destino: null };
  const i = actual === null ? -1 : enfocables.indexOf(actual);
  if (i === -1) {
    const n = enfocables.length;
    if (typeof antesDelActivo === "number" && Number.isInteger(antesDelActivo) && antesDelActivo >= 0 && antesDelActivo <= n) {
      return { prevenir: true, destino: shift ? enfocables[(antesDelActivo - 1 + n) % n] : enfocables[antesDelActivo % n] };
    }
    return { prevenir: true, destino: shift ? enfocables[n - 1] : enfocables[0] };
  }
  if (!shift && i === enfocables.length - 1) return { prevenir: true, destino: enfocables[0] };
  if (shift && i === 0) return { prevenir: true, destino: enfocables[enfocables.length - 1] };
  return { prevenir: false, destino: null };
}

// ---------------------------------------------------------------------------------------------------------------------
// Textos de la interfaz (C4a-2b). Todos los demás salen de `textosHistorial` / `guardadoHonesto`.
// ---------------------------------------------------------------------------------------------------------------------

export const TEXTOS_PANEL = {
  boton: "Historial",
  titulo: "Historial de esta fase",
  cerrar: "Cerrar",
  cargarMas: "Cargar más",
  cargandoMas: "Cargando más cambios…",
  reintentar: "Reintentar",
  actualizar: "Actualizar",
  actualizando: "Actualizando…",
  comprobarDeriva: "Comprobar cambios sin registro",
  ayudaComprobarDeriva:
    "Revisa si algo de esta fase se cambió sin quedar en el historial. Puede tardar un poco más que abrirlo.",
  /** `N cambios en esta fase` (singular para 1). */
  total: (n: number) => (n === 1 ? "1 cambio en esta fase" : `${n} cambios en esta fase`),
} as const;

export interface AvisoDerivaVigente {
  tipo: "cambio" | "sin_cambio";
  texto: string;
}

export const TEXTO_CAMBIO_SIN_REGISTRO =
  "Lo que ves hoy en esta fase es distinto de la última versión guardada en el historial: se hizo un cambio que no quedó registrado, y el historial no sabe quién lo hizo ni cuándo.";
export const TEXTO_SIN_CAMBIO_SIN_REGISTRO = "Se comprobó: no hay cambios sin registro en esta fase.";

/**
 * Aviso (arriba de la lista) de que el estado ACTUAL difiere de la última versión registrada. Sale de
 * `respuesta.vigente.artefactos[].derivaDetectada`. En F1 y F2 el lector lo calcula siempre: solo avisa si hay cambio.
 * En F3 solo se comprueba cuando la persona lo pidió (`derivaF3Pedida`): sin pedirlo no se dice nada (los valores
 * `null` significan «no comprobado»); pedido y sin cambios, se dice que se comprobó. Sin jerga y sin siglas.
 */
export function avisoDerivaVigente(
  respuesta: Pick<RespuestaHistorial, "vigente"> | null,
  fase: FaseConHistorial,
  derivaF3Pedida: boolean
): AvisoDerivaVigente | null {
  const arts = respuesta?.vigente?.artefactos ?? [];
  if (arts.length === 0) return null;
  if (fase === "investigacion" && !derivaF3Pedida) return null;
  if (arts.some((a) => a.derivaDetectada === true)) return { tipo: "cambio", texto: TEXTO_CAMBIO_SIN_REGISTRO };
  if (fase === "investigacion" && arts.every((a) => a.derivaDetectada === false)) {
    return { tipo: "sin_cambio", texto: TEXTO_SIN_CAMBIO_SIN_REGISTRO };
  }
  return null;
}

/**
 * Dónde va el foco (R3 y H-V65): al empezar una carga el foco se queda en el DIÁLOGO (el botón que lo tenía se desmonta o
 * se deshabilita); al terminar, al título («Actualizar», 1.ª página o «Reintentar») o al botón «Cargar más» si sigue
 * habiendo páginas; al cerrar, al botón «Historial». Con el panel abierto el foco nunca debe quedar fuera del diálogo.
 */
export type MomentoFoco = "abrir" | "cargando_inicio" | "cargado" | "actualizado" | "cargado_mas" | "cerrar";
export type DestinoFoco = "titulo" | "dialogo" | "cargar_mas" | "boton_historial";
export function dondeVaElFoco(momento: MomentoFoco, hayMas = false): DestinoFoco {
  if (momento === "cerrar") return "boton_historial";
  if (momento === "cargando_inicio") return "dialogo";
  if (momento === "cargado_mas") return hayMas ? "cargar_mas" : "titulo";
  return "titulo"; // abrir, cargado, actualizado
}
