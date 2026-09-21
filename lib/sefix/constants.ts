// lib/sefix/constants.ts
// Constantes compartidas entre cliente y servidor para el módulo Sefix.
// NO importar desde este archivo en lib/sefix/storage.ts para evitar
// dependencias circulares — storage.ts declara su propio ESTADO_MAP local.

import { ESTADOS, claveEstadoSnake } from "@/lib/geo/estados";

// ============================================================
// ESTADOS DE LA REPÚBLICA MEXICANA (key normalizado → nombre oficial)
// ============================================================

export const ESTADO_MAP: Record<string, string> = Object.fromEntries(
  ESTADOS.map((e) => [claveEstadoSnake(e.clave), e.clave])
);

export const ESTADOS_LIST = Object.entries(ESTADO_MAP)
  .map(([key, nombre]) => ({ key, nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre));

// ============================================================
// COLORES DE PARTIDOS POLÍTICOS (identidad partidaria, NO design system)
// ============================================================

export const PARTY_COLORS: Record<string, string> = {
  PAN: "#003F8A",
  PRI: "#E01B22",
  PRD: "#FFCD00",
  PVEM: "#009A44",
  PT: "#C8102E",
  MC: "#F7941D",
  MORENA: "#8B0000",
  NA: "#4B0082",
  PES: "#800080",
  RSP: "#A0522D",
  FXM: "#006400",
  // Fallback para partidos no mapeados
  DEFAULT: "#6B7280",
};

// ============================================================
// CARGOS ELECTORALES
// ============================================================

export const CARGOS_LIST = [
  { key: "dip", label: "Diputados Federales" },
  { key: "sen", label: "Senadores" },
  { key: "pdte", label: "Presidencia" },
];
