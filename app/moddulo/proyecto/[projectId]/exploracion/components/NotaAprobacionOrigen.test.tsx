// La nota de aprobación del analista en F2 (T7 C3): desplegable accesible, cerrado por defecto, atribuido al analista.
// Sin DOM en la suite: se comprueba el marcado (renderToStaticMarkup). El clic se verifica en navegador.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import NotaAprobacionOrigen from "./NotaAprobacionOrigen";

describe("NotaAprobacionOrigen", () => {
  it("cerrado por defecto: botón con aria-expanded=false y SIN el texto de la nota en el marcado", () => {
    const h = renderToStaticMarkup(<NotaAprobacionOrigen v={2} nota={{ confianza: 39, justificacion: "Con reservas documentadas." }} />);
    expect(h).toContain("Ver la nota de aprobación del analista");
    expect(h).toContain('aria-expanded="false"');
    expect(h).not.toContain("Con reservas documentadas.");
    expect(h).not.toContain("title=");
  });
  it("abierto con justificación: atribuida «Según el analista», con la confianza y la fecha", () => {
    const h = renderToStaticMarkup(<NotaAprobacionOrigen v={2} nota={{ confianza: 39, justificacion: "Con reservas documentadas.", aprobadoEn: "2026-10-20T15:30:00.000Z" }} abiertoInicial />);
    expect(h).toContain('aria-expanded="true"');
    expect(h).toContain("Ocultar la nota de aprobación");
    expect(h).toContain("Según el analista, que aprobó el análisis con una confianza global de 39 %: «Con reservas documentadas.»");
    expect(h).toContain("Aprobado el 20 de octubre de 2026");
    const id = /aria-controls="([^"]+)"/.exec(h)![1];
    expect(h).toContain(`id="${id}"`);
  });
  it("confianza 39 SIN justificación registrada (v2): dice que no hay justificación, no inventa una nota", () => {
    const h = renderToStaticMarkup(<NotaAprobacionOrigen v={2} nota={{ confianza: 39 }} abiertoInicial />);
    expect(h).toContain("no hay justificación registrada.");
    expect(h).not.toContain("Según el analista");
  });
  it.each([[1], [null]])("importación previa (huella %s): «No disponible…», sin fecha y SIN sugerir cómo obtenerla", (v) => {
    const h = renderToStaticMarkup(<NotaAprobacionOrigen v={v as never} nota={null} abiertoInicial />);
    expect(h).toContain("No disponible para esta importación (se hizo antes de que F2 guardara la nota de aprobación).");
    expect(h).not.toContain("Aprobado el");
    expect(h).not.toMatch(/Regresar|Centinela|Desvincular|vuelve|reimporta|actualiza/i);
  });
  it("v2 sin nota (aprobado con confianza suficiente o sin aprobar): no pinta nada", () => {
    expect(renderToStaticMarkup(<NotaAprobacionOrigen v={2} nota={null} />)).toBe("");
  });
});
