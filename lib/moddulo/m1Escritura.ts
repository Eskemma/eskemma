// lib/moddulo/m1Escritura.ts
// What EVERY writer of M1 (generate-m1-express, import-pestel, link-moddulo) must leave behind when it
// puts a NEW payload in `linkedSource`: the project is recognizable as «M1 nuevo en borrador».
//
// - `m1` is replaced by a fresh record `{ creadoEn }`: without any `m1`, a project that has a finalized
//   Reporte F2 reads as «anterior» (estadoM1) and stays locked in read-only mode; with an `m1` and no
//   approval it is a draft (pencil + «Aprobar análisis»). The old edits and approval belonged to the old
//   payload, so they go with it. `creadoEn` is the stamp the screen shows.
// - The motors draft and the motor approvals were made against the OLD M1: they are discarded (this is
//   what the «Nuevo análisis» notice promises). M2–M5 are regenerated from the approved copy.
// - The finalized Reporte F2 (`dvs`) is NOT touched: it keeps being the report of the previous analysis
//   until the user finalizes a new one.
// The caller passes `FieldValue` (server-only) so this module stays plain.

export interface ValoresCampo {
  serverTimestamp: () => unknown;
  delete: () => unknown;
}

export function camposNuevoM1(fv: ValoresCampo): Record<string, unknown> {
  return {
    "phases.exploracion.m1": { creadoEn: fv.serverTimestamp() },
    "phases.exploracion.motorAprobaciones": {},
    "phases.exploracion.draftDVS": fv.delete(),
  };
}
