// Fixture of the M1 gate (paso 4): `phases.exploracion` in each state the gate distinguishes, with a REAL
// approval (fingerprint of the payload + frozen copy), so the routes' tests exercise the same code path
// as production instead of a faked fingerprint.
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";

const senal = (descripcion: string) => ({ descripcion, fuente: "INEGI, 2020", fechaCorte: "2020-01", nivelConfianza: "medio", origenInternacional: false });
export const mapaGate = {
  P: { code: "P", label: "Político", clasificacion: "AMENAZA", confidence: 80, narrativa: "Narrativa P.",
    senalesFavorables: [senal("favorable")], senalesAdversas: [senal("adversa")], senalesInciertas: [] },
};
export const otroMapaGate = { P: { ...mapaGate.P, narrativa: "Narrativa P editada y vuelta a aprobar." } };
export const huellaGate = (mapa: object = mapaGate) => huellaMapaPESTEL(mapa as never);

export type EstadoGate = "sin_m1" | "sin_payload" | "borrador" | "reabierto" | "aprobado" | "copia_alterada";

/** `phases.exploracion` for each state. `mapa` lets a test approve a different content. */
export function exploracionGate(
  estado: EstadoGate,
  extra: Record<string, unknown> = {},
  mapa: object = mapaGate
): Record<string, unknown> {
  const linkedSource = { kind: "express", componente: "moddulo", sourceId: "p1", payload: mapa };
  const aprobacion = { huella: huellaGate(mapa), por: "u", en: "t", categoriasEditadas: 0, total: 1, mapa };
  switch (estado) {
    case "sin_m1": return { linkedSource, ...extra };
    case "sin_payload": return { m1: { creadoEn: "t", aprobacion }, ...extra };
    case "borrador": return { linkedSource, m1: { creadoEn: "t" }, ...extra };
    case "reabierto": return { linkedSource, m1: { creadoEn: "t", reabiertoEn: "t", reabiertoPor: "u" }, ...extra };
    case "aprobado": return { linkedSource, m1: { creadoEn: "t", aprobacion }, ...extra };
    // The approval matches the payload, but its frozen copy is not what was approved.
    case "copia_alterada": return { linkedSource, m1: { creadoEn: "t", aprobacion: { ...aprobacion, mapa: otroMapaGate } }, ...extra };
  }
}
