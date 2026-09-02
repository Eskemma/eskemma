// types/fontana.types.ts
// Modelo de sesión de Fontana (T10). Cubre escenario (a) proyecto activo,
// (b)/(c) sesiones sueltas, y la capa conversacional (2026-08-27): agente
// "Fontana" + Canvas (campo `canvasItems` + subcolección `mensajes`).
// `exportadoAF3` (Fontana_T10_Documentacion_Tecnica.md §3.3) sigue sin
// implementarse hasta que exista ese flujo real.

import type { Territorio } from "./shared.types";
import type { ProjectType } from "./moddulo.types";
import type { CeldaTablaFontana, NivelTablaFontana, IndicadorFilaFontana } from "@/lib/fontana/tablaColumnas";
import type { NaturalezaDato } from "@/lib/fontana/indicatorRegistry";

export type FamiliaFontanaId = "F1" | "F2" | "F3" | "F4" | "F5";

// Extrae la familia del prefijo del ID de indicador (ej. "F2-13" → "F2")
// — convención ya usada implícitamente en varios lugares
// (`id.startsWith("F1-")` en pipMinimos.ts, etc.), nunca antes extraída
// a función porque hasta abrir Familia 2 (2026-08-07) la familia activa
// siempre era F1. Bug real que motivó esta extracción: FontanaMunicipiosModal.tsx
// hardcodeaba "F1" en sus URLs sin importar el indicador real.
export function familiaDeIndicador(indicadorId: string): FamiliaFontanaId {
  return indicadorId.split("-")[0] as FamiliaFontanaId;
}

export interface SeleccionFamiliaFontana {
  minimos: string[]; // del PIP — no editables/eliminables en la interfaz
  seleccionUsuario: string[]; // añadidos libremente por el usuario
}

export interface FontanaSesion {
  sesionId: string;
  uid: string;
  // Presente en escenario (a) desde la creación; en Escenarios (b)/(c)
  // se agrega DESPUÉS, vía vincular-moddulo (Flujo 1/2) — nunca implica
  // por sí solo que haya un PIP de referencia (ver tareaPipIds, siempre
  // vacío en b/c).
  modduloProjectId?: string;
  tareaPipIds: string[]; // vacío en Escenarios (b)/(c) — nunca hay PIP de origen
  // Marca la última vez que esta sesión se entregó por Canal 1
  // (Escenario a, tareaPipIds no vacío) — POST /api/moddulo/f3/canal1/entregar.
  // Ligero a propósito, mismo criterio que fontanaPendiente en
  // PhaseState (moddulo.types.ts): solo lo necesario para que la UI
  // sepa "ya se entregó" sin leer la estructura interna de f3TareasPIP.
  entregaCanal1?: { fecha: string; resultadoId: string };
  // Solo relevante para sesiones sueltas (hub, Escenarios b/c) — sin esto,
  // 2 sesiones del mismo territorio se verían idénticas en el hub salvo
  // por fecha. Sugerido al crear ("Exploración — {territorio.nombre}"),
  // 100% editable. Escenario (a) no lo necesita (nunca aparece en el
  // hub) pero el campo es opcional, sin costo si queda sin usar ahí.
  nombre?: string;
  // Acento visual de la card en el hub (mismo patrón que
  // ModduloProject.color / PESTELProject.color) — respaldo #248CC1
  // (mismo acento ya usado para Fontana en el hub de Centinela) para
  // sesiones creadas antes de este campo.
  color?: string;
  // Sesión suelta archivada — oculta por default de la lista principal
  // del hub, mismo patrón que ModduloProject.status/PESTELProject.status
  // (activo vs. archivado, nunca borrado). Solo aplica a sueltas.
  archivada?: boolean;
  // Decide el set de columnas de la tabla comparativa (Documentación
  // Técnica §5.2): "electoral" → Nacional/Estatal/Distrital/Municipal;
  // los otros 3 tipos → Nacional/Estatal/Municipal/AGEB.
  tipoProyecto: ProjectType;
  // Territorio reutiliza el tipo compartido ya usado por ModduloProject/
  // PESTEL (nivel + nombres, no "cveGeo") — es lo que getProject() ya
  // regresa, sin inventar una forma nueva.
  territorio: Territorio;
  indicadoresPorFamilia: Record<FamiliaFontanaId, SeleccionFamiliaFontana>;
  fechaUltimoGuardado: string; // ISO
  versionSesion: number;
  // T10 capa conversacional (2026-08-27) — salidas que el agente "Fontana"
  // fija en la pestaña Canvas. Aditivo, opcional: sesiones creadas antes de
  // este campo siguen válidas (se leen como []). Append-only en la práctica
  // (el usuario puede borrar un item, nunca se reescriben). Los mensajes de
  // chat NO viven aquí — van en la subcolección `mensajes` (append-only,
  // puede crecer sin límite de 1 MB de documento).
  canvasItems?: FontanaCanvasItem[];
}

export function familiaVacia(): SeleccionFamiliaFontana {
  return { minimos: [], seleccionUsuario: [] };
}

// Archivo adjuntado por el usuario en el chat de Fontana (T10, 2026-09-01).
// SOLO se persiste el texto extraído — el binario nunca toca Storage, ni
// siquiera temporalmente (patrón de PESTEL upload-source, no el de Moddulo).
// Subcolección append-only fontana_sesiones/{sesionId}/adjuntos. Borrado en
// cascada al eliminar la sesión (recursiveDelete) + purga automática a los
// 90 días de `cargadoEn` (functions/src/fontana/purgeAdjuntos.ts).
export interface FontanaAdjunto {
  id: string;
  nombreArchivo: string;
  textoExtraido: string; // ya truncado a MAX_TEXT_CHARS
  tipoMime: string;
  // ISO en el cliente; en Firestore es un Timestamp (lo requiere la query
  // de rango de la purga por antigüedad).
  cargadoEn: string;
}

// Contenido del archivo .json que Fontana entrega a F3 — usado por AMBOS
// Canal 1 (canal1/entregar) y Canal 3 (VincularFuenteForm, "Vincular
// resultado externo") — un solo tipo, un solo criterio de qué incluye
// (todo lo seleccionado en la sesión, CeldaTablaFontana completo sin
// aplanar, ver Piezas 2/5 del plan de escenarios b/c). Nombre reservado
// por el contrato de Canal 1 (types/f3.types.ts, APP_TO_F3_CONTRACTS.T10.payloadSchema).
// Va SIEMPRE por Storage (nunca embebido en el documento de Firestore
// de f3Resultados) — medido en vivo: un territorio plural amplio +
// varios indicadores puede superar el límite de 1 MB por documento de
// Firestore.
export interface FontanaContextoTerritorial {
  territorio: Territorio;
  indicadores: { id: string; nombre: string; celdas: CeldaTablaFontana[] }[];
}

// ==========================================
// T10 — AGENTE CONVERSACIONAL "FONTANA"
// ==========================================

export type FontanaChatRole = "user" | "assistant";

export type FontanaToolName =
  | "consultar_indicador"
  | "consultar_indicador_territorio_externo"
  | "consultar_detalle_indicador"
  | "listar_indicadores_familia"
  | "listar_indicadores_activos_todas_familias"
  | "generar_visualizacion"
  | "navegar_pestana";

// Traza de una llamada a herramienta que produjo (o intentó producir) una
// respuesta del asistente. Se guarda con el mensaje para la línea de
// trazabilidad del chat (estilo terminal) y para reconstruir el turno.
export interface FontanaToolCall {
  tool: FontanaToolName;
  input: Record<string, unknown>; // args tal cual del bloque tool_use
  resultSummary: string; // 1 línea legible (no el payload completo)
  ok: boolean; // false si la herramienta devolvió error o "sin dato"
}

// Un mensaje del chat — subcolección fontana_sesiones/{sesionId}/mensajes,
// append-only, ordenada por `timestamp`.
export interface FontanaChatMessage {
  id: string; // crypto.randomUUID()
  role: FontanaChatRole;
  content: string; // markdown (assistant) / texto plano (user)
  timestamp: string; // ISO
  toolCalls?: FontanaToolCall[]; // solo assistant
  canvasItemIds?: string[]; // solo assistant — ids generados en el turno
  adjuntoIds?: string[]; // solo user — adjuntos referenciados en el turno (traza)
}

export type FontanaCanvasItemTipo = "resumen" | "grafica" | "tabla" | "desglose" | "distribucion";

interface FontanaCanvasItemBase {
  id: string;
  tipo: FontanaCanvasItemTipo;
  titulo: string;
  familiaId: FamiliaFontanaId;
  creadoEn: string; // ISO
  mensajeId: string; // turno de chat que lo generó (traza inversa)
}

// tipo "resumen" — filas indicador→valor a un nivel geográfico
export interface FontanaCanvasResumen extends FontanaCanvasItemBase {
  tipo: "resumen";
  nivel: NivelTablaFontana;
  filas: {
    indicadorId: string;
    nombre: string;
    valor: string | null; // string ya formateado; null ⇒ sin dato
    unidad?: string;
    naturaleza?: NaturalezaDato;
    motivo?: string; // presente sii valor === null
    fuenteEtiqueta?: string;
  }[];
}

// tipo "grafica" — un indicador comparado por niveles geográficos (barras)
export interface FontanaCanvasGrafica extends FontanaCanvasItemBase {
  tipo: "grafica";
  indicadorId: string;
  indicadorNombre: string;
  unidad?: string;
  fuenteEtiqueta?: string; // cita de fuente — mismo patrón que la tabla comparativa
  barras: {
    nivel: NivelTablaFontana;
    etiquetaNivel: string;
    valor: number | null;
    naturaleza?: NaturalezaDato;
    motivo?: string; // presente sii valor === null
  }[];
}

// tipo "tabla" — snapshot de la tabla comparativa de una familia
export interface FontanaCanvasTabla extends FontanaCanvasItemBase {
  tipo: "tabla";
  columnas: NivelTablaFontana[];
  indicadores: IndicadorFilaFontana[]; // mismo shape que consume FontanaComparativeTable
}

// tipo "desglose" — unidad→valor de un indicador que NO se puede combinar
// (no_agregable / narrativo_sintetizado) en una sesión de territorio
// plural. El agente lo genera cuando el usuario pide una gráfica de un
// indicador así: en vez de inventar un número único, muestra cada unidad.
export interface FontanaCanvasDesglose extends FontanaCanvasItemBase {
  tipo: "desglose";
  indicadorId: string;
  indicadorNombre: string;
  motivoNoAgregable: string;
  fuenteEtiqueta?: string;
  filas: {
    unidad: string;
    valor: string | number | null;
    naturaleza?: NaturalezaDato;
    motivo?: string; // presente sii valor === null
  }[];
}

// tipo "distribucion" — desglose de CATEGORÍAS dentro de un mismo nivel
// geográfico (grupos de edad, deciles de ingreso, estado civil, urbano/
// rural). Distinto de "grafica" (que compara el MISMO indicador entre
// niveles geográficos). Solo F1-2, F1-11, F1-12, F2-12 lo soportan hoy.
// Las etiquetas ya vienen legibles (nunca claves crudas tipo "P_0A4"/"I").
export interface FontanaCanvasDistribucion extends FontanaCanvasItemBase {
  tipo: "distribucion";
  indicadorId: string;
  indicadorNombre: string; // nombre en lenguaje llano, nunca el ID
  nivel: NivelTablaFontana; // nivel geográfico del que es el desglose
  ejeTipo: "categorico" | "escala_ordinal";
  formato: "conteo" | "moneda" | "porcentaje";
  nota?: string; // aclaración honesta cuando aplica (ej. F1-2: no separado por sexo)
  fuenteEtiqueta?: string;
  categorias: { etiqueta: string; valor: number }[];
}

export type FontanaCanvasItem =
  | FontanaCanvasResumen
  | FontanaCanvasGrafica
  | FontanaCanvasTabla
  | FontanaCanvasDesglose
  | FontanaCanvasDistribucion;

// Eventos del stream SSE de POST /api/fontana/chat — el cliente
// (useChatStream) los despacha a callbacks.
export type FontanaChatStreamEvent =
  | { type: "tool_call"; tool: FontanaToolName; input: Record<string, unknown> }
  | { type: "text"; content: string }
  | { type: "nav"; pestana: "fontana" | "indicadores"; familiaId?: FamiliaFontanaId }
  | { type: "canvas_item"; item: FontanaCanvasItem }
  | { type: "done"; mensajeId: string }
  | { type: "error"; message: string };
