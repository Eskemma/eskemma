// F2 cerrada = solo lectura: el kebab no ofrece nada que reemplace o edite el análisis (opción A).
import { describe, expect, it } from "vitest";
import type { EstadoM1 } from "./m1Aprobacion";
import { opcionesKebabM1 } from "./pantallaM1";

const ESTADOS: (EstadoM1 | null)[] = ["sin_m1", "sin_m1_con_restos", "anterior", "borrador", "reabierto", "aprobado", null];
const KINDS = ["express", "T22", null];

describe("opcionesKebabM1 — fase cerrada", () => {
  it("con F2 cerrada ninguna opción, en TODAS las combinaciones de estado y tipo; el kebab no se dibuja", () => {
    for (const estado of ESTADOS) for (const kind of KINDS) {
      const o = opcionesKebabM1({ kind, estado, f2Cerrada: true });
      expect(o, `${estado}/${kind}`).toEqual({
        nuevoAnalisis: false, vincularIndependiente: false, analizarConPestel: false, vincularDeNuevo: false,
        editarNarrativas: false, hayOpciones: false,
      });
    }
  });
  it("con F2 abierta ofrece Nuevo análisis, Vincular y Analizar con PESTEL siempre; Editar narrativas solo aprobado Express", () => {
    for (const estado of ESTADOS) for (const kind of KINDS) {
      const o = opcionesKebabM1({ kind, estado, f2Cerrada: false });
      expect(o.nuevoAnalisis && o.vincularIndependiente && o.analizarConPestel && o.vincularDeNuevo && o.hayOpciones).toBe(true);
      expect(o.editarNarrativas).toBe(estado === "aprobado" && kind !== "T22");
    }
  });
});
