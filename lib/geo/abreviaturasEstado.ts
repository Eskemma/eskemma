// lib/geo/abreviaturasEstado.ts
// Single source for the DISPLAY abbreviations of the 32 Mexican states.
// Pure module (no firebase / network): importable from client, server and scripts.
//
// Three forms, all derived from ONE table (`CODIGO_ESTADO_POR_CVE`):
//   · full name   → the catalog (`ESTADOS[].nombre`, via `nombreEstadoDisplay`).
//                   Default for prose, tooltips, tables with room.
//   · compact code → uppercase, no punctuation, <= 6 letters ("JAL", "EDOMEX").
//                   For narrow spaces: heatmap axes and row labels.
//   · dotted form  → code + "." ("JAL."), except CDMX (an acronym: no period).
//                   For short text labels ("GUADALAJARA, JAL.").
//
// DISPLAY ONLY. None of these strings is ever used to read, filter or join
// source data: the data keys are the CVE or the snake_case state key
// (`claveEstadoSnake`). Verified 26-09-23 by grep over app/, lib/, scripts/ and
// functions/src — the only consumers render the text.
//
// `MEX` is RESERVED for the country (ISO3 of Mexico, used by Fontana F4): the
// State of Mexico is `EDOMEX`. Likewise `COLI` for Colima, because `COL` is
// Colombia. A test (abreviaturasEstado.test.ts) fails if any code equals an
// ISO3 country code known to the system.
//
// Not in scope here (pending, see CLAUDE.md "Geografía compartida"): RECOGNIZING
// what a user types ("Edomex", "Mex.", "México"…) is free-text interpretation,
// not display.
//
// Kept out of lib/geo/estados.ts on purpose: its Cloud Functions copy is
// GENERATED from that file and guarded byte for byte.

import { ESTADOS_ALFABETICOS, claveEstadoSnake, nombreEstadoDisplay } from "./estados";

/** CVE (2 digits) → compact code. The single table; everything else derives from it. */
export const CODIGO_ESTADO_POR_CVE: Readonly<Record<string, string>> = {
  "01": "AGS",
  "02": "BC",
  "03": "BCS",
  "04": "CAMP",
  "05": "COAH",
  "06": "COLI",
  "07": "CHIS",
  "08": "CHIH",
  "09": "CDMX",
  "10": "DGO",
  "11": "GTO",
  "12": "GRO",
  "13": "HGO",
  "14": "JAL",
  "15": "EDOMEX",
  "16": "MICH",
  "17": "MOR",
  "18": "NAY",
  "19": "NL",
  "20": "OAX",
  "21": "PUE",
  "22": "QRO",
  "23": "QROO",
  "24": "SLP",
  "25": "SIN",
  "26": "SON",
  "27": "TAB",
  "28": "TAMPS",
  "29": "TLAX",
  "30": "VER",
  "31": "YUC",
  "32": "ZAC",
};

/** Compact code ("JAL") for a state CVE, or null if the CVE is not one of the 32. */
export function codigoEstado(cve: string | null | undefined): string | null {
  return cve ? CODIGO_ESTADO_POR_CVE[cve] ?? null : null;
}

/** Dotted form ("JAL.") for a state CVE; CDMX keeps no period. Null if unknown. */
export function abreviaturaConPunto(cve: string | null | undefined): string | null {
  const codigo = codigoEstado(cve);
  if (!codigo) return null;
  return codigo === "CDMX" ? codigo : `${codigo}.`;
}

/**
 * Name for running prose (Sefix weekly text): the full catalog name for every
 * state except Ciudad de México, which stays "CDMX" (universal acronym).
 */
export function nombreEstadoProsa(cve: string): string | null {
  if (cve === "09") return "CDMX";
  return nombreEstadoDisplay(cve);
}

/**
 * Compact code by snake_case state key ("estado_de_mexico" → "EDOMEX"), in the
 * ALPHABETICAL-by-key order the Sefix origin heatmap has always used
 * (`Object.keys` of this record is `RECEPTOR_ORDER` in OrigenCharts, and from
 * it the `ORIGIN_SUFFIXES` — data column suffixes). Keys and order are part of
 * the data contract; only the VALUES are display.
 */
export const CODIGO_ESTADO_POR_SNAKE: Readonly<Record<string, string>> = Object.fromEntries(
  ESTADOS_ALFABETICOS.map((e) => [claveEstadoSnake(e.clave), CODIGO_ESTADO_POR_CVE[e.cve]])
);
