import { describe, expect, it } from "vitest";
import {
  confirmacionValida, formatearFechaAprobacion, huellaReentrega, lineasReentrega, requiereConfirmacionReentrega,
} from "./impactoReentrega";

const BASE = { resultado: { aprobado: true, notasUsuario: "ok" }, asignacion: { estado: "recibido", resultadoId: "r1" } };

describe("requiereConfirmacionReentrega", () => {
  it("solo un resultado aprobado === true pide confirmación", () => {
    expect(requiereConfirmacionReentrega({ aprobado: true })).toBe(true);
    for (const r of [undefined, {}, { aprobado: false }, { aprobado: "true" }, { aprobado: 1 }]) {
      expect(requiereConfirmacionReentrega(r as never)).toBe(false);
    }
  });
});

describe("huellaReentrega", () => {
  it("es estable y no depende del orden de claves", () => {
    const a = huellaReentrega(BASE);
    expect(a).toBe(huellaReentrega({ asignacion: { resultadoId: "r1", estado: "recibido" }, resultado: { notasUsuario: "ok", aprobado: true } }));
  });
  it("cambia con cada campo relevante: aprobado, notas, estado y resultadoId de la asignación", () => {
    const h = huellaReentrega(BASE);
    expect(huellaReentrega({ ...BASE, resultado: { aprobado: false, notasUsuario: "ok" } })).not.toBe(h);
    expect(huellaReentrega({ ...BASE, resultado: { aprobado: true, notasUsuario: "otras" } })).not.toBe(h);
    expect(huellaReentrega({ ...BASE, asignacion: { estado: "en_curso", resultadoId: "r1" } })).not.toBe(h);
    expect(huellaReentrega({ ...BASE, asignacion: { estado: "recibido", resultadoId: "r2" } })).not.toBe(h);
  });
  it("NO depende del contenido del resultado ni de ningún uid", () => {
    const conContenido = { resultado: { ...BASE.resultado, payload: { extractoTexto: "x".repeat(5000) }, uid: "uidA" }, asignacion: BASE.asignacion };
    expect(huellaReentrega(conContenido as never)).toBe(huellaReentrega(BASE));
  });
});

describe("confirmacionValida", () => {
  const H = "abc";
  it("exige confirmarReemplazo === true Y huella igual", () => {
    expect(confirmacionValida({ confirmarReemplazo: true, huella: H }, H)).toBe(true);
  });
  it.each([
    [{}], [{ confirmarReemplazo: true }], [{ huella: H }], [{ confirmarReemplazo: "true", huella: H }],
    [{ confirmarReemplazo: true, huella: 7 }], [{ confirmarReemplazo: true, huella: "" }], [{ confirmarReemplazo: true, huella: "otra" }],
  ])("%j → no confirmado", (cuerpo) => {
    expect(confirmacionValida(cuerpo, H)).toBe(false);
  });
});

describe("formatearFechaAprobacion — hora de la Ciudad de México, nunca UTC", () => {
  it("un instante cercano a la medianoche UTC no corre el día", () => {
    // 03:30 UTC del 13 de noviembre = 21:30 del 12 en la Ciudad de México (UTC-6)
    expect(formatearFechaAprobacion("2026-11-13T03:30:00.000Z")).toBe("12 de noviembre de 2026");
    // 05:59 UTC del 13 sigue siendo 12 en México; 06:00 UTC ya es 13
    expect(formatearFechaAprobacion("2026-11-13T05:59:59.000Z")).toBe("12 de noviembre de 2026");
    expect(formatearFechaAprobacion("2026-11-13T06:00:00.000Z")).toBe("13 de noviembre de 2026");
  });
  it("valores inválidos o ausentes → null (la línea dirá «sin autoría registrada»)", () => {
    for (const v of [null, undefined, "", "no es fecha", "2026-13-45"]) expect(formatearFechaAprobacion(v as never)).toBeNull();
  });
});

describe("lineasReentrega", () => {
  it("con sello: la fecha en la primera línea; sin uid; dice dónde consultar y volver (H-V90)", () => {
    const l = lineasReentrega({ selloEn: "2026-11-13T03:30:00.000Z", tieneNotas: false, reiniciaAsignacion: false });
    expect(l[0]).toBe("El resultado que entregaste antes está aprobado (desde el 12 de noviembre de 2026).");
    expect(l.join(" ")).not.toMatch(/por ahora no hay pantalla/);
    expect(l.at(-1)).toContain("panel «Historial»");
    expect(l.at(-1)).toContain("si tienes permiso");
  });
  it("sin sello: «sin autoría registrada»", () => {
    expect(lineasReentrega({ selloEn: null, tieneNotas: false, reiniciaAsignacion: false })[0]).toContain("sin autoría registrada");
  });
  it("incluye la línea de la tarea solo si la asignación se reinicia, y la de las notas solo si había notas", () => {
    const todo = lineasReentrega({ selloEn: null, tieneNotas: true, reiniciaAsignacion: true }).join(" | ");
    expect(todo).toContain("«En curso»");
    expect(todo).toContain("notas");
    const nada = lineasReentrega({ selloEn: null, tieneNotas: false, reiniciaAsignacion: false }).join(" | ");
    expect(nada).not.toContain("«En curso»");
    expect(nada).not.toContain("notas");
  });
});
