import { describe, expect, it } from "vitest";
import { decidirAvisoXpcto, diffsXpctoDeProyecto, type EntradaAvisoXpcto, type ResultadoAvisoXpcto } from "./avisoXpcto";

const base: EntradaAvisoXpcto = { kind: "T22", hayMotores: false, camposCambiados: [], f2Cerrada: false, m1Estado: "aprobado" };
const f = (o: Partial<EntradaAvisoXpcto>) => decidirAvisoXpcto({ ...base, ...o });
const HS = ["Hito", "Sujeto", "Justificación"];
const OTROS = ["Capacidad humano", "Fecha límite"];

// origen × motores × XPCTO × fase (M1 aprobado)
const tabla: Array<[string, Partial<EntradaAvisoXpcto>, ResultadoAvisoXpcto]> = [
  ["Centinela, sin motores, igual", { kind: "T22" }, "ninguno"],
  ["Centinela, sin motores, distinto (vacío→lleno), abierta — el caso reportado", { kind: "T22", camposCambiados: HS }, "ninguno"],
  ["Centinela, sin motores, distinto, cerrada", { kind: "T22", camposCambiados: HS, f2Cerrada: true }, "ninguno"],
  ["Centinela, con motores, igual", { kind: "T22", hayMotores: true }, "ninguno"],
  ["Centinela, con motores, distinto con Hito/Sujeto", { kind: "T22", hayMotores: true, camposCambiados: HS }, "actualizar_contraste"],
  ["Centinela, con motores, distinto sin Hito/Sujeto", { kind: "T22", hayMotores: true, camposCambiados: OTROS }, "actualizar_contraste"],
  ["Centinela, con motores, distinto, cerrada", { kind: "T22", hayMotores: true, camposCambiados: HS, f2Cerrada: true }, "ninguno"],
  ["Express, sin motores, igual", { kind: "express" }, "ninguno"],
  ["Express, sin motores, distinto con Hito/Sujeto", { kind: "express", camposCambiados: HS }, "regenerar_m1"],
  ["Express, sin motores, distinto sin Hito/Sujeto", { kind: "express", camposCambiados: OTROS }, "ninguno"],
  ["Express, sin motores, distinto, cerrada", { kind: "express", camposCambiados: HS, f2Cerrada: true }, "ninguno"],
  ["Express, con motores, igual", { kind: "express", hayMotores: true }, "ninguno"],
  ["Express, con motores, distinto con Hito/Sujeto", { kind: "express", hayMotores: true, camposCambiados: HS }, "regenerar_m1"],
  ["Express, con motores, distinto sin Hito/Sujeto", { kind: "express", hayMotores: true, camposCambiados: OTROS }, "actualizar_contraste"],
  ["Express, con motores, distinto, cerrada", { kind: "express", hayMotores: true, camposCambiados: HS, f2Cerrada: true }, "ninguno"],
];

describe("decidirAvisoXpcto — tabla origen × motores × XPCTO × fase", () => {
  it.each(tabla)("%s", (_n, o, esperado) => {
    expect(f(o)).toBe(esperado);
  });
});

describe("M1 con registro pero SIN aprobar (la compuerta del paso 4 daría 409 al actualizar el contraste)", () => {
  for (const m1Estado of ["borrador", "reabierto"] as const) {
    it(`${m1Estado}: ninguno aunque el XPCTO difiera, con o sin motores, de cualquier origen`, () => {
      for (const kind of ["T22", "express"]) for (const hayMotores of [true, false]) {
        expect(f({ kind, hayMotores, camposCambiados: HS, m1Estado })).toBe("ninguno");
      }
    });
  }
  it("al volver a estar aprobado, el aviso reaparece si el XPCTO sigue distinto", () => {
    expect(f({ hayMotores: true, camposCambiados: HS, m1Estado: "reabierto" })).toBe("ninguno");
    expect(f({ hayMotores: true, camposCambiados: HS, m1Estado: "aprobado" })).toBe("actualizar_contraste");
  });
  it("proyecto sin registro m1 (heredado) se comporta como hoy", () => {
    for (const m1Estado of ["anterior", "sin_m1", "sin_m1_con_restos", null, undefined] as const) {
      expect(f({ kind: "express", camposCambiados: HS, m1Estado })).toBe("regenerar_m1");
      expect(f({ kind: "T22", hayMotores: true, camposCambiados: HS, m1Estado })).toBe("actualizar_contraste");
    }
  });
});

describe("función total en el origen: lo que no es T22 se trata como express", () => {
  it("kind desconocido, vacío o linkedSource ausente", () => {
    for (const kind of ["algo_raro", "", null, undefined, "T21"]) {
      expect(f({ kind, camposCambiados: HS })).toBe("regenerar_m1");
      expect(f({ kind, hayMotores: true, camposCambiados: OTROS })).toBe("actualizar_contraste");
      expect(f({ kind, camposCambiados: OTROS })).toBe("ninguno");
    }
  });
});

// ── diffsXpctoDeProyecto: una sola fuente para la carga y para cada relectura del proyecto ──
const XPCTO_OLMOS2 = {
  hito: "Ganar la Presidencia Municipal de Cuernavaca, Morelos, el 6 de junio de 2027, con un margen de victoria mínimo de 5 puntos porcentuales sobre el segundo lugar, representando a Movimiento Ciudadano.",
  justificacion: "Posicionar a MC como la vía legítima para canalizar la inconformidad ciudadana con el oficialismo y la oposición rebasada.",
  tiempo: { duracionMeses: 8, fechaLimite: "2027-06-06" },
  sujeto: "Carlos Olmos Hernández, candidato a Presidente Municipal de Cuernavaca, Morelos, por Movimiento Ciudadano (MC).",
  capacidades: { humano: "Equipo profesional de 50 personas.", financiero: "Presupuesto estimado de 3,000,000 de pesos.", logistico: "Casa de campaña, bodega, 5 vehículos, 10 equipos de cómputo." },
};
const proyecto = (snapshot: string | undefined, xpcto: unknown, conPayload = true) =>
  ({ xpcto, phases: { exploracion: { ...(conPayload ? { linkedSource: { kind: "T22", payload: { P: {} } } } : {}), ...(snapshot !== undefined ? { xpctoSnapshotAtGeneration: snapshot } : {}) } } }) as never;

describe("diffsXpctoDeProyecto", () => {
  it("snapshot de importación vacío + XPCTO ya lleno ⇒ hay diferencias (lo que se calcula al cargar)", () => {
    const d = diffsXpctoDeProyecto(proyecto("{}", XPCTO_OLMOS2));
    expect(d.map((x) => x.field)).toEqual(expect.arrayContaining(["Hito", "Sujeto", "Justificación"]));
    expect(d.length).toBe(7);
  });
  it("el mismo proyecto tras generar los motores (snapshot = XPCTO vigente) ⇒ []", () => {
    expect(diffsXpctoDeProyecto(proyecto(JSON.stringify(XPCTO_OLMOS2), XPCTO_OLMOS2))).toEqual([]);
  });
  it("«Prueba Olmos 2» con sus valores reales: snapshot idéntico al XPCTO ⇒ []", () => {
    expect(diffsXpctoDeProyecto(proyecto(JSON.stringify(XPCTO_OLMOS2), { ...XPCTO_OLMOS2 }))).toEqual([]);
  });
  it("no evaluable (sin snapshot o sin análisis importado) ⇒ []", () => {
    expect(diffsXpctoDeProyecto(proyecto(undefined, XPCTO_OLMOS2))).toEqual([]);
    expect(diffsXpctoDeProyecto(proyecto("{}", XPCTO_OLMOS2, false))).toEqual([]);
  });
  it("tras la generación el aviso desaparece y la decisión de visibilidad no cambia", () => {
    const antes = diffsXpctoDeProyecto(proyecto("{}", XPCTO_OLMOS2)).map((x) => x.field);
    const despues = diffsXpctoDeProyecto(proyecto(JSON.stringify(XPCTO_OLMOS2), XPCTO_OLMOS2)).map((x) => x.field);
    // Centinela: sin motores no hay aviso aunque haya diferencias; con motores y diferencias, contraste; sin diferencias, nada.
    expect(decidirAvisoXpcto({ ...base, kind: "T22", hayMotores: false, camposCambiados: antes })).toBe("ninguno");
    expect(decidirAvisoXpcto({ ...base, kind: "T22", hayMotores: true, camposCambiados: antes })).toBe("actualizar_contraste");
    expect(decidirAvisoXpcto({ ...base, kind: "T22", hayMotores: true, camposCambiados: despues })).toBe("ninguno");
  });
  it("un cambio real posterior sí vuelve a aparecer (el XPCTO cambia después de generar)", () => {
    const d = diffsXpctoDeProyecto(proyecto(JSON.stringify(XPCTO_OLMOS2), { ...XPCTO_OLMOS2, sujeto: "Otro sujeto" }));
    expect(d.map((x) => x.field)).toEqual(["Sujeto"]);
  });
});
