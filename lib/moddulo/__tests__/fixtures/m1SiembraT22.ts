// C1b-2 — siembra de un proyecto T22 con marcas de tiempo REALES de Firestore (`Timestamp`). En C1b-1 el fixture
// compartido (`m1Siembra`) sembraba textos («t», ISO) donde Firestore real devuelve `Timestamp`, así que las pruebas
// no ejercían ese formato. Este fixture NO toca `m1Siembra`: lo complementa. Úsalo con `siembraHistorialF2.clonar`
// (nunca `structuredClone`, que convierte un `Timestamp` en un objeto plano) y verifica `instanceof Timestamp`.
import { Timestamp } from "firebase-admin/firestore";
import type { MapaPESTEL } from "@/types/moddulo.types";
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";
import { mapaM1 } from "./m1Siembra";

export const INSTANTE_APROBACION = new Date("2026-11-10T15:00:00.123Z");
export const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

/** `m1.aprobacion` como la deja Firestore: `en` es un Timestamp (y trae la copia congelada `mapa`). */
export const aprobacionConTimestamp = (m: MapaPESTEL, over: Record<string, unknown> = {}) => ({
  por: "u1", en: Timestamp.fromDate(INSTANTE_APROBACION), huella: huellaMapaPESTEL(m),
  categoriasEditadas: 2, total: 6, mapa: JSON.parse(JSON.stringify(m)), ...over,
});

export interface OpcionesT22 {
  /** Sin payload (T22 «sin M1»). */
  sinPayload?: boolean;
  /** Sin registro `m1`. */
  sinM1?: boolean;
  sinAprobacion?: boolean;
  /** Ediciones del M1 con `en` como Timestamp (en un T22 no deberían existir; el M1 pudo venir de un express). */
  conEdiciones?: boolean;
  draftDVS?: unknown;
  motorAprobaciones?: Record<string, boolean>;
  dvs?: unknown;
  status?: string;
  /** `sourceId` del PESTEL (vacío = sin back-link). */
  sourceId?: string | null;
  extra?: Record<string, unknown>;
}

/** Proyecto `moddulo_projects/p1` con un vínculo T22 y, según las opciones, su M1, borrador y aprobaciones. */
export function docProyectoT22(o: OpcionesT22 = {}) {
  const mapa = mapaM1();
  const linkedSource = {
    kind: "T22", componente: "centinela",
    ...(o.sourceId === null ? {} : { sourceId: o.sourceId ?? "pest1" }),
    sourceAnalysisId: "a1",
    ...(o.sinPayload ? {} : { payload: mapa }),
    huellaFuente: { v: 2, h: "huella-origen" },
  };
  const m1 = o.sinM1
    ? undefined
    : {
        creadoEn: ts("2026-11-09T10:00:00.000Z"),
        ...(o.sinAprobacion ? {} : { aprobacion: aprobacionConTimestamp(mapa) }),
        ...(o.conEdiciones
          ? { ediciones: { "P.narrativa": { original: "IA P", editado: "editado P", por: "u1", en: ts("2026-11-09T11:00:00.000Z") } } }
          : {}),
        generacion: { huella: huellaMapaPESTEL(mapa), en: ts("2026-11-10T16:00:00.000Z") },
        finalizacion: { huella: huellaMapaPESTEL(mapa), en: ts("2026-11-10T17:00:00.000Z") },
      };
  return {
    name: "Proyecto T22", type: "electoral",
    collaborators: [{ uid: "u1", role: "owner" }],
    phases: {
      exploracion: {
        status: o.status ?? "in-progress",
        linkedSource,
        ...(m1 ? { m1 } : {}),
        fuentesConsultadas: [{ nombre: "x" }],
        xpctoSnapshotAtGeneration: { hito: "snap" },
        ...(o.draftDVS ? { draftDVS: o.draftDVS } : {}),
        ...(o.motorAprobaciones ? { motorAprobaciones: o.motorAprobaciones } : {}),
        ...(o.dvs ? { dvs: o.dvs } : {}),
        ...(o.extra ?? {}),
      },
    },
  };
}
