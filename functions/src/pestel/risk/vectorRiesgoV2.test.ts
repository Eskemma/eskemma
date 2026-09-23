// functions/src/pestel/risk/vectorRiesgoV2.test.ts
// Pruebas de regresión para el Vector de Riesgo V2 (26-09-22). `functions/`
// no tenía runner de pruebas (sin jest/vitest/mocha, `firebase-functions-
// test` presente pero sin uso — ver CLAUDE.md "PESTEL — Etapa 8"). Se usa
// `node:test`/`node:assert` (stdlib, Node 22 ya lo trae) + `tsx` como
// único devDependency nuevo (loader de TS, ya usado en la raíz del repo
// para scripts) — sin introducir un framework de pruebas nuevo.
// Ejecutar: npm run test (desde functions/).

import {test, describe} from "node:test";
import assert from "node:assert/strict";
import {
  calcularVectorRiesgoV2,
  dimensionAnalysisAVectorRiesgoInput,
  type VectorRiesgoInput,
} from "./vectorRiesgoV2";
import type {DimensionAnalysisResult} from "../classifier/claudePESTL";

const UMBRAL_DEFAULT = 70;

/**
 * Fábrica de un `VectorRiesgoInput` de prueba con valores neutros por
 * defecto, sobreescribibles por caso.
 * @param {object} overrides Campos a fijar para el caso de prueba
 * @return {VectorRiesgoInput} Dimensión de prueba lista para el cálculo
 */
function dim(
  overrides: Partial<VectorRiesgoInput> & {code: string}
): VectorRiesgoInput {
  return {
    classification: "NEUTRAL",
    intensity: "MEDIA",
    trend: "ESTABLE",
    confidence: 80,
    ...overrides,
  };
}

describe("calcularVectorRiesgoV2 — caso degenerado", () => {
  test("arreglo vacío → 50, sin crisis, sin dominantes", () => {
    const out = calcularVectorRiesgoV2([], UMBRAL_DEFAULT);
    assert.equal(out.vectorRiesgo, 50);
    assert.equal(out.isCrisis, false);
    assert.deepEqual(out.dimensionesDominantes, []);
  });

  test("todas con confidence:0 → cae al neutro 50, nunca alerta", () => {
    const dims = ["P", "E", "S", "T", "L", "Ec"].map((code) =>
      dim({
        code,
        classification: "AMENAZA",
        intensity: "ALTA",
        confidence: 0,
      })
    );
    const out = calcularVectorRiesgoV2(dims, UMBRAL_DEFAULT);
    assert.equal(out.vectorRiesgo, 50);
    assert.equal(out.isCrisis, false);
    assert.ok(out.vectorRiesgo < UMBRAL_DEFAULT);
  });
});

describe("calcularVectorRiesgoV2 — riesgo por dimensión", () => {
  test("AMENAZA + ALTA + ESTABLE → riesgo máximo (80)", () => {
    const out = calcularVectorRiesgoV2(
      [dim({
        code: "P",
        classification: "AMENAZA",
        intensity: "ALTA",
        trend: "ESTABLE",
      })],
      UMBRAL_DEFAULT
    );
    assert.equal(out.vectorRiesgo, 80);
  });

  test("AMENAZA + BAJA → riesgo moderado, menor que ALTA", () => {
    const alta = calcularVectorRiesgoV2(
      [dim({code: "P", classification: "AMENAZA", intensity: "ALTA"})],
      UMBRAL_DEFAULT
    );
    const baja = calcularVectorRiesgoV2(
      [dim({code: "P", classification: "AMENAZA", intensity: "BAJA"})],
      UMBRAL_DEFAULT
    );
    assert.ok(baja.vectorRiesgo < alta.vectorRiesgo);
    // base 80, modificador 0.3 → 50 + 30*0.3 = 59
    assert.equal(baja.vectorRiesgo, 59);
  });

  test("OPORTUNIDAD + ALTA → riesgo mínimo (15)", () => {
    const out = calcularVectorRiesgoV2(
      [dim({
        code: "P",
        classification: "OPORTUNIDAD",
        intensity: "ALTA",
        trend: "ESTABLE",
      })],
      UMBRAL_DEFAULT
    );
    assert.equal(out.vectorRiesgo, 15);
  });

  test("NEUTRAL se aleja del punto neutro hacia abajo (base 40)", () => {
    // riesgo = 50 + (40-50)*modificador → ALTA:40, MEDIA:44, BAJA:47
    const esperado: Record<"ALTA" | "MEDIA" | "BAJA", number> = {
      ALTA: 40,
      MEDIA: 44,
      BAJA: 47,
    };
    for (const intensity of ["ALTA", "MEDIA", "BAJA"] as const) {
      const out = calcularVectorRiesgoV2(
        [dim({code: "P", classification: "NEUTRAL", intensity})],
        UMBRAL_DEFAULT
      );
      assert.equal(out.vectorRiesgo, esperado[intensity]);
    }
  });
});

describe("calcularVectorRiesgoV2 — ajuste de tendencia (solo AMENAZA)", () => {
  test("AMENAZA + ALTA + ASCENDENTE → +10 (80 → 90)", () => {
    const out = calcularVectorRiesgoV2(
      [dim({
        code: "P",
        classification: "AMENAZA",
        intensity: "ALTA",
        trend: "ASCENDENTE",
      })],
      UMBRAL_DEFAULT
    );
    assert.equal(out.vectorRiesgo, 90);
  });

  test("AMENAZA + ALTA + DESCENDENTE → -10 (80 → 70)", () => {
    const out = calcularVectorRiesgoV2(
      [dim({
        code: "P",
        classification: "AMENAZA",
        intensity: "ALTA",
        trend: "DESCENDENTE",
      })],
      UMBRAL_DEFAULT
    );
    assert.equal(out.vectorRiesgo, 70);
  });

  test("OPORTUNIDAD + ASCENDENTE → sin ajuste (solo aplica a AMENAZA)", () => {
    const out = calcularVectorRiesgoV2(
      [dim({
        code: "P",
        classification: "OPORTUNIDAD",
        intensity: "ALTA",
        trend: "ASCENDENTE",
      })],
      UMBRAL_DEFAULT
    );
    assert.equal(out.vectorRiesgo, 15);
  });

  test("NEUTRAL + ASCENDENTE → sin ajuste (solo aplica a AMENAZA)", () => {
    const out = calcularVectorRiesgoV2(
      [dim({
        code: "P",
        classification: "NEUTRAL",
        intensity: "ALTA",
        trend: "ASCENDENTE",
      })],
      UMBRAL_DEFAULT
    );
    assert.equal(out.vectorRiesgo, 40); // NEUTRAL+ALTA, sin +10 de AMENAZA
  });
});

describe("calcularVectorRiesgoV2 — agregado ponderado por confidence", () => {
  test("dos dimensiones con confidence igual → promedio simple", () => {
    const out = calcularVectorRiesgoV2(
      [
        dim({
          code: "P",
          classification: "AMENAZA",
          intensity: "ALTA",
          confidence: 100,
        }), // 80
        dim({
          code: "E",
          classification: "OPORTUNIDAD",
          intensity: "ALTA",
          confidence: 100,
        }), // 15
      ],
      UMBRAL_DEFAULT
    );
    assert.equal(out.vectorRiesgo, 48); // round((80+15)/2) = 47.5 → 48
  });

  test("confidence:0 en una dimensión no arrastra el promedio", () => {
    const out = calcularVectorRiesgoV2(
      [
        dim({
          code: "P",
          classification: "AMENAZA",
          intensity: "ALTA",
          confidence: 100,
        }), // 80
        dim({
          code: "E",
          classification: "NEUTRAL",
          intensity: "MEDIA",
          confidence: 0,
        }), // 44, peso 0
      ],
      UMBRAL_DEFAULT
    );
    assert.equal(out.vectorRiesgo, 80);
  });

  test("mayor confidence pesa más en el agregado", () => {
    const out = calcularVectorRiesgoV2(
      [
        dim({
          code: "P",
          classification: "AMENAZA",
          intensity: "ALTA",
          confidence: 90,
        }), // 80
        dim({
          code: "E",
          classification: "OPORTUNIDAD",
          intensity: "ALTA",
          confidence: 10,
        }), // 15
      ],
      UMBRAL_DEFAULT
    );
    // (80*90 + 15*10) / 100 = 73.5 → 74
    assert.equal(out.vectorRiesgo, 74);
  });
});

describe("calcularVectorRiesgoV2 — dimensionesDominantes", () => {
  test("máximo 2 códigos, de mayor a menor riesgo", () => {
    const out = calcularVectorRiesgoV2(
      [
        dim({
          code: "P",
          classification: "OPORTUNIDAD",
          intensity: "ALTA",
        }), // 15
        dim({code: "E", classification: "AMENAZA", intensity: "ALTA"}), // 80
        dim({code: "S", classification: "AMENAZA", intensity: "MEDIA"}), // 68
      ],
      UMBRAL_DEFAULT
    );
    assert.deepEqual(out.dimensionesDominantes, ["E", "S"]);
  });
});

describe("calcularVectorRiesgoV2 — isCrisis (sustituto, no spec 08)", () => {
  test("dispara: umbral+15 y >=2 dimensiones AMENAZA+ALTA", () => {
    // AMENAZA+ALTA+ASCENDENTE = 90 (80 base + 10 de tendencia empeorando)
    const dims = [
      dim({
        code: "P",
        classification: "AMENAZA",
        intensity: "ALTA",
        trend: "ASCENDENTE",
        confidence: 100,
      }),
      dim({
        code: "E",
        classification: "AMENAZA",
        intensity: "ALTA",
        trend: "ASCENDENTE",
        confidence: 100,
      }),
      dim({
        code: "S",
        classification: "AMENAZA",
        intensity: "ALTA",
        trend: "ASCENDENTE",
        confidence: 100,
      }),
    ];
    const out = calcularVectorRiesgoV2(dims, UMBRAL_DEFAULT);
    assert.equal(out.vectorRiesgo, 90);
    assert.ok(out.vectorRiesgo >= UMBRAL_DEFAULT + 15);
    assert.equal(out.isCrisis, true);
  });

  test("NO dispara con solo 1 dimensión AMENAZA+ALTA", () => {
    // Supera umbral+15 (85) pero solo cuenta 1 dimensión AMENAZA+ALTA.
    const dims = [
      dim({
        code: "P",
        classification: "AMENAZA",
        intensity: "ALTA",
        trend: "ASCENDENTE",
        confidence: 100,
      }),
    ];
    const out = calcularVectorRiesgoV2(dims, UMBRAL_DEFAULT);
    assert.equal(out.vectorRiesgo, 90);
    assert.ok(out.vectorRiesgo >= UMBRAL_DEFAULT + 15);
    assert.equal(out.isCrisis, false);
  });

  test("NO dispara: 2 dimensiones ALTA+AMENAZA pero VR bajo margen", () => {
    const dims = [
      dim({
        code: "P",
        classification: "AMENAZA",
        intensity: "ALTA",
        confidence: 10,
      }),
      dim({
        code: "E",
        classification: "AMENAZA",
        intensity: "ALTA",
        confidence: 10,
      }),
      dim({
        code: "S",
        classification: "OPORTUNIDAD",
        intensity: "ALTA",
        confidence: 100,
      }),
    ];
    const out = calcularVectorRiesgoV2(dims, UMBRAL_DEFAULT);
    assert.ok(out.vectorRiesgo < UMBRAL_DEFAULT + 15);
    assert.equal(out.isCrisis, false);
  });

  test("umbral por proyecto desplaza el disparo de isCrisis", () => {
    const dims = [
      dim({
        code: "P",
        classification: "AMENAZA",
        intensity: "ALTA",
        confidence: 100,
      }),
      dim({
        code: "E",
        classification: "AMENAZA",
        intensity: "ALTA",
        confidence: 100,
      }),
    ];
    const conUmbralAlto = calcularVectorRiesgoV2(dims, 90);
    assert.equal(conUmbralAlto.vectorRiesgo, 80);
    assert.equal(conUmbralAlto.isCrisis, false); // 80 < 90+15

    const conUmbralBajo = calcularVectorRiesgoV2(dims, 50);
    assert.equal(conUmbralBajo.isCrisis, true); // 80 >= 50+15
  });
});

describe("dimensionAnalysisAVectorRiesgoInput", () => {
  test("mapea solo los campos que necesita el cálculo de riesgo", () => {
    const dimResults: DimensionAnalysisResult[] = [
      {
        code: "P",
        trend: "ASCENDENTE",
        intensity: "ALTA",
        mainSignal: "Señal de prueba",
        narrative: "Narrativa de prueba, sin uso en el cálculo.",
        classification: "AMENAZA",
        confidence: 77,
      },
    ];
    const input = dimensionAnalysisAVectorRiesgoInput(dimResults);
    assert.deepEqual(input, [
      {
        code: "P",
        classification: "AMENAZA",
        intensity: "ALTA",
        trend: "ASCENDENTE",
        confidence: 77,
      },
    ]);
  });

  test("round-trip: el resultado es un input válido del cálculo", () => {
    const dimResults: DimensionAnalysisResult[] = [
      {
        code: "E",
        trend: "ESTABLE",
        intensity: "MEDIA",
        mainSignal: "s",
        narrative: "n",
        classification: "NEUTRAL",
        confidence: 60,
      },
    ];
    const out = calcularVectorRiesgoV2(
      dimensionAnalysisAVectorRiesgoInput(dimResults),
      UMBRAL_DEFAULT
    );
    assert.equal(out.vectorRiesgo, 44); // NEUTRAL+MEDIA: 50+(40-50)*0.6
  });
});
