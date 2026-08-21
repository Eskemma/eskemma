// types/fontana.types.ts
// Modelo de sesión de Fontana (T10) — Paso 5, incremento Familia 1.
// Solo cubre lo necesario para escenario (a): proyecto activo. Campos
// documentados en Fontana_T10_Documentacion_Tecnica.md §3.3 que no aplican
// todavía (salidasAgente, exportadoAF3) se omiten hasta que exista el
// agente conversacional / Canal 1 real — se agregan junto con esas piezas,
// no antes, para no dejar campos muertos sin código que los use.

import type { Territorio } from "./shared.types";
import type { ProjectType } from "./moddulo.types";
import type { CeldaTablaFontana } from "@/lib/fontana/tablaColumnas";

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
}

export function familiaVacia(): SeleccionFamiliaFontana {
  return { minimos: [], seleccionUsuario: [] };
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
