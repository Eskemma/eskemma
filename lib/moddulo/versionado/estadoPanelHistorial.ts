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
}

/**
 * Qué muestra el panel. Prioridad: error > cargando (sin filas) > vacío (la fase no tiene historial) > filas.
 * Un error con filas ya cargadas NO borra las filas: el panel muestra el error junto a ellas (el llamador conserva
 * `filas`); aquí el error solo domina cuando no hay nada que mostrar.
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

export type ClaveMarca = "vigente" | "cambio_nuevo" | "deriva_antes" | "parcial" | "no_conservada";
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
 *   · en cualquier otro caso el navegador sigue su orden natural.
 */
export function siguienteEnCiclo(enfocables: readonly string[], actual: string | null, shift: boolean): DecisionTab {
  if (enfocables.length === 0) return { prevenir: true, destino: null };
  const i = actual === null ? -1 : enfocables.indexOf(actual);
  if (i === -1) return { prevenir: true, destino: shift ? enfocables[enfocables.length - 1] : enfocables[0] };
  if (!shift && i === enfocables.length - 1) return { prevenir: true, destino: enfocables[0] };
  if (shift && i === 0) return { prevenir: true, destino: enfocables[enfocables.length - 1] };
  return { prevenir: false, destino: null };
}
