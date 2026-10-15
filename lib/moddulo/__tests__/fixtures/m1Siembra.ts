// Seeds for the M1 review routes: a six-dimension mapa and the project document around it.
import type { MapaPESTEL } from "@/types/moddulo.types";
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";

const senal = (n: number) => ({
  descripcion: `señal ${n}`, fuente: "INEGI, 2020", fechaCorte: "2020-01", nivelConfianza: "medio", origenInternacional: false,
});
export const dim = (code: string) => ({
  code, label: code, clasificacion: "NEUTRAL", confidence: 70, narrativa: `IA ${code}`,
  senalesFavorables: [senal(1)], senalesAdversas: [senal(2)], senalesInciertas: [],
});
export const mapaM1 = (): MapaPESTEL =>
  ({ P: dim("P"), E: dim("E"), S: dim("S"), T: dim("T"), Ec: dim("Ec"), L: dim("L") }) as unknown as MapaPESTEL;

export const huellaDe = (m: MapaPESTEL) => huellaMapaPESTEL(m);

interface Opciones {
  kind?: "express" | "T22";
  m1?: Record<string, unknown>;
  status?: string;
  dvs?: unknown;
  draftDVS?: unknown;
  motorAprobaciones?: Record<string, boolean>;
  payload?: MapaPESTEL | null;
  deletedAt?: unknown;
}

/** moddulo_projects document with phases.exploracion built from the options. */
export function docProyectoM1(o: Opciones = {}) {
  const payload = o.payload === undefined ? mapaM1() : o.payload;
  return {
    name: "Proyecto", type: "electoral",
    ...(o.deletedAt ? { deletedAt: o.deletedAt } : {}),
    phases: {
      exploracion: {
        status: o.status ?? "in-progress",
        ...(payload ? { linkedSource: { kind: o.kind ?? "express", componente: "moddulo", sourceId: "p1", payload } } : {}),
        ...(o.m1 ? { m1: o.m1 } : {}),
        ...(o.dvs ? { dvs: o.dvs } : {}),
        ...(o.draftDVS ? { draftDVS: o.draftDVS } : {}),
        ...(o.motorAprobaciones ? { motorAprobaciones: o.motorAprobaciones } : {}),
      },
    },
  };
}

export const aprobacionDe = (m: MapaPESTEL, over: Record<string, unknown> = {}) => ({
  por: "u1", en: "2026-10-15T12:00:00Z", huella: huellaMapaPESTEL(m), categoriasEditadas: 0, total: 6, mapa: structuredClone(m), ...over,
});
