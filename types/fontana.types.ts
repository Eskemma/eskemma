// types/fontana.types.ts
// Modelo de sesión de Fontana (T10) — Paso 5, incremento Familia 1.
// Solo cubre lo necesario para escenario (a): proyecto activo. Campos
// documentados en Fontana_T10_Documentacion_Tecnica.md §3.3 que no aplican
// todavía (salidasAgente, exportadoAF3) se omiten hasta que exista el
// agente conversacional / Canal 1 real — se agregan junto con esas piezas,
// no antes, para no dejar campos muertos sin código que los use.

import type { Territorio } from "./shared.types";
import type { ProjectType } from "./moddulo.types";

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
  modduloProjectId?: string; // presente solo en escenario (a)
  tareaPipIds: string[];
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
