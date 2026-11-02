// Caracterización de transformToMapaPESTEL ANTES de T3 (D3): sin ajustes el mapa sale exactamente así.
// Verde contra el código anterior; T3 no debe cambiar nada de lo que sigue (la clave `ajuste` solo aparece
// cuando HAY un ajuste). La parte de señales incompletas se fija aparte (N7 la cambia a propósito).
import { describe, expect, it } from "vitest";
import { transformToMapaPESTEL, type RawDimension } from "./transformToMapaPESTEL";

const senal = { descripcion: "d", fuente: "INEGI, 2020", fechaCorte: "2020-01", nivelConfianza: "alto" as const, origenInternacional: true };

describe("transformToMapaPESTEL — sin ajustes (caracterización)", () => {
  it("copia clasificación, narrativa, confianza y señales completas, con etiqueta de dimensión", () => {
    const raw: RawDimension[] = [
      { code: "P", classification: "AMENAZA", narrative: "n", confidence: 70, senalesFavorables: [senal], senalesAdversas: [], senalesInciertas: [] },
      { code: "Ec", classification: "OPORTUNIDAD" },
    ];
    expect(transformToMapaPESTEL(raw)).toEqual({
      P: { code: "P", label: "Político", clasificacion: "AMENAZA", senalesFavorables: [senal], senalesAdversas: [], senalesInciertas: [], narrativa: "n", confidence: 70 },
      Ec: { code: "Ec", label: "Ecológico", clasificacion: "OPORTUNIDAD", senalesFavorables: [], senalesAdversas: [], senalesInciertas: [], narrativa: undefined, confidence: undefined },
    });
  });
  it("sin clasificación cae a NEUTRAL; ninguna entrada trae la clave `ajuste`", () => {
    const m = transformToMapaPESTEL([{ code: "S" }]);
    expect(m.S?.clasificacion).toBe("NEUTRAL");
    expect(Object.prototype.hasOwnProperty.call(m.S, "ajuste")).toBe(false);
  });
});
