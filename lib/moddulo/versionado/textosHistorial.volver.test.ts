// C4b-1b — las 5 frases (más las 2 de apoyo) del `detalle` de un evento «volver»: el panel las muestra y NUNCA el nombre
// de la clave ni el texto de la pregunta. `teniaAprobacion` (F2: «análisis») no se reutiliza.
import { describe, expect, it } from "vitest";
import { detalleEnTexto } from "./textosHistorial";

describe("detalleEnTexto — «volver a una versión anterior» de un resultado", () => {
  it("una frase por bandera", () => {
    expect(detalleEnTexto({ resultadoEstabaAprobado: true })).toBe("El resultado estaba aprobado.");
    expect(detalleEnTexto({ notasEliminadas: true })).toBe("Se quitaron las notas.");
    expect(detalleEnTexto({ sintesisExistente: true })).toBe("La síntesis ya generada no se recalculó.");
    expect(detalleEnTexto({ veredictoExistente: true })).toBe("El veredicto ya generado no se recalculó.");
    expect(detalleEnTexto({ archivoNoEncontrado: true })).toBe("El archivo de esa versión ya no estaba guardado.");
  });
  it("tareas reiniciadas: singular y plural; 0 o inválido no dice nada", () => {
    expect(detalleEnTexto({ tareasReiniciadas: 1 })).toBe("Se reinició 1 tarea de investigación.");
    expect(detalleEnTexto({ tareasReiniciadas: 3 })).toBe("Se reiniciaron 3 tareas de investigación.");
    for (const v of [0, -1, NaN, "2", null]) expect(detalleEnTexto({ tareasReiniciadas: v })).toBeNull();
  });
  it("todo junto, en un orden estable; banderas en false no dicen nada", () => {
    expect(
      detalleEnTexto({ resultadoEstabaAprobado: true, notasEliminadas: true, tareasReiniciadas: 2, sintesisExistente: true, veredictoExistente: true, archivoNoEncontrado: true })
    ).toBe("El resultado estaba aprobado. Se quitaron las notas. Se reiniciaron 2 tareas de investigación. La síntesis ya generada no se recalculó. El veredicto ya generado no se recalculó. El archivo de esa versión ya no estaba guardado.");
    expect(detalleEnTexto({ resultadoEstabaAprobado: false, notasEliminadas: false, tareasReiniciadas: 0 })).toBeNull();
  });
  it("no reutiliza `teniaAprobacion` (en F2 dice «análisis») ni muestra nombres de clave", () => {
    expect(detalleEnTexto({ teniaAprobacion: true })).toBe("El análisis estaba aprobado."); // F2, sin cambio
    const t = detalleEnTexto({ resultadoEstabaAprobado: true, tareasReiniciadas: 1 })!;
    expect(t).not.toContain("resultadoEstabaAprobado");
    expect(t).not.toContain("análisis");
  });
});
