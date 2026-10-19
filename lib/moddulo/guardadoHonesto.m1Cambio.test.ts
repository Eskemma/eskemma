// Paso 4 (E): los dos textos de m1_cambio — cada uno con su variante «Recarga la página» si el refresco falla — y que
// ninguno afirma más de lo que el servidor confirmó.
import { describe, expect, it } from "vitest";
import { decidirResultadoGuardado, mensajeTrasRefresco, TEXTO_M1_CAMBIO, type RespuestaGuardado } from "./guardadoHonesto";

const r409: RespuestaGuardado = { tipo: "respuesta", ok: false, status: 409, codigo: "m1_cambio" };
const base = (a: "guardar_edicion_m1" | "aprobar_m1") => decidirResultadoGuardado(a, r409, { dimension: "Político" }).mensajeError;

describe("m1_cambio", () => {
  it("el mensaje base (sin refresco) conserva «Recarga la página» y dice qué NO pasó", () => {
    expect(base("guardar_edicion_m1")).toBe(TEXTO_M1_CAMBIO.guardar_edicion_m1.sinRefresco);
    expect(base("guardar_edicion_m1")).toContain("no se guardó la edición");
    expect(base("guardar_edicion_m1")).toContain("Recarga la página");
    expect(base("aprobar_m1")).toBe(TEXTO_M1_CAMBIO.aprobar_m1.sinRefresco);
    expect(base("aprobar_m1")).toContain("no se aprobó nada");
    expect(base("aprobar_m1")).toContain("Recarga la página");
  });
  it("con el refresco exitoso dice que la pantalla se actualizó y YA NO manda a recargar", () => {
    for (const a of ["guardar_edicion_m1", "aprobar_m1"] as const) {
      const m = mensajeTrasRefresco(a, r409, base(a), true)!;
      expect(m).toBe(TEXTO_M1_CAMBIO[a].conRefresco);
      expect(m).toContain("La pantalla se actualizó");
      expect(m).not.toMatch(/Recarga la página/);
    }
    expect(mensajeTrasRefresco("guardar_edicion_m1", r409, base("guardar_edicion_m1"), true)).toContain("no se guardó la edición");
    expect(mensajeTrasRefresco("aprobar_m1", r409, base("aprobar_m1"), true)).toContain("no se aprobó nada");
  });
  it("si el refresco falló, queda el texto con «Recarga la página»", () => {
    for (const a of ["guardar_edicion_m1", "aprobar_m1"] as const) {
      expect(mensajeTrasRefresco(a, r409, base(a), false)).toBe(base(a));
    }
  });
  it("ningún texto afirma más de lo que el servidor confirmó: no dicen «se guardó»/«se aprobó» en positivo ni prometen la versión nueva sin refresco", () => {
    for (const a of ["guardar_edicion_m1", "aprobar_m1"] as const) {
      for (const t of [TEXTO_M1_CAMBIO[a].sinRefresco, TEXTO_M1_CAMBIO[a].conRefresco]) {
        expect(t).not.toMatch(/(?<!no )se (guardó|aprobó)(?! nada| la edición)/);
      }
      expect(TEXTO_M1_CAMBIO[a].sinRefresco).not.toContain("se actualizó");
    }
  });
  it("otros errores no cambian con el refresco, y un 409 de otro código tampoco", () => {
    const r500: RespuestaGuardado = { tipo: "respuesta", ok: false, status: 500 };
    const otro: RespuestaGuardado = { tipo: "respuesta", ok: false, status: 409, codigo: "fase_cerrada" };
    expect(mensajeTrasRefresco("aprobar_m1", r500, "x", true)).toBe("x");
    expect(mensajeTrasRefresco("aprobar_m1", otro, "y", true)).toBe("y");
    expect(mensajeTrasRefresco("aprobar_m1", { tipo: "error_red" }, "z", true)).toBe("z");
  });
});
